import {
	addBatchCleanup,
	captured,
	effect,
	isReactive,
	lift,
	link,
	morph,
	reactiveOptions,
	type ScopedCallback,
	tag,
	unlink,
	untracked,
	unwrap,
} from 'mutts'
import { perf } from '../perf'
import { document } from '../shared'
import { collapse, ReactiveProp } from './composite-attributes'
import { perfCounters, testing } from './debug'
import { h } from './jsx-factory'
import { syncRegistry, walk } from './node'
import {
	type Child,
	type Children,
	DynamicRenderingError,
	type Env,
	rootEnv,
	SursautElement,
} from './sursaut-element'
import { getEnvPath } from './utils'

export const latchOwners = new WeakMap<Element, string>()

export function sursautElement(child: Children, env: Env): SursautElement {
	return child instanceof SursautElement
		? child
		: child === null || child === undefined
			? new SursautElement(() => [], 'empty', undefined, true, true)
			: Array.isArray(child)
				? new SursautElement(() => processChildren(child, env))
				: child instanceof Node
					? new SursautElement(() => child, undefined, undefined, false, true)
					: SursautElement.text(() => String(child))
}
// Deferred unlink: nodes removed during reconciliation are unlinked at end-of-batch,
// allowing rescue if the same node is re-added before the batch completes.
const pendingUnlinks = new Set<Node>()
const removedNodes = new WeakSet<Node>()

function flushPendingUnlinks() {
	for (const node of pendingUnlinks) unlink(node, { type: 'stopped', detail: 'node removal' })
	pendingUnlinks.clear()
}

function scheduleUnlink(root: Node) {
	for (const node of walk(root)) {
		pendingUnlinks.add(node)
		removedNodes.add(node)
	}
	addBatchCleanup(flushPendingUnlinks)
}

function rescueNode(root: Node) {
	for (const node of walk(root)) {
		if (!removedNodes.has(node)) continue
		removedNodes.delete(node)
		if (pendingUnlinks.has(node)) pendingUnlinks.delete(node)
		else throw new Error('[sursaut] Cannot re-add a node that has already been unlinked')
	}
}

function destroyNow(root: Node, detail: string) {
	for (const node of walk(root)) {
		removedNodes.add(node)
		unlink(node, { type: 'stopped', detail })
	}
}

let reconcileCount = 0
export function reconcile(parent: Node, newChildren: Node | readonly Node[]): ScopedCallback {
	function reconciler() {
		perfCounters.reconciliations++
		const rid = ++reconcileCount
		perf?.mark(`reconcile:${rid}:start`)
		const items = Array.isArray(newChildren) ? newChildren : newChildren ? [newChildren] : []
		const connecting = untracked`reconcile:isConnected`(() => parent.isConnected)
		if (parent instanceof Element && (items.length === 0 || parent.childNodes.length === 0)) {
			for (const node of parent.childNodes) {
				syncRegistry(node, 'delete', connecting)
				scheduleUnlink(node)
			}
			for (const item of items) rescueNode(item)
			;(parent as Element).replaceChildren(...items)
			for (const item of items) syncRegistry(item, 'add', connecting)
			return
		}
		let added = 0
		let removed = 0
		const itemsSet = new Set(items.map((i) => unwrap(i)))
		// Iterate through items and sync with live DOM
		items.forEach((item, i) => {
			const newChild = unwrap(item) as Node
			let currentChild = parent.childNodes[i]
			while (i < parent.childNodes.length && !itemsSet.has(currentChild)) {
				removed++
				parent.removeChild(currentChild)
				syncRegistry(currentChild, 'delete', connecting)
				scheduleUnlink(currentChild)
				currentChild = parent.childNodes[i]
			}
			if (currentChild !== newChild) {
				// This handles BOTH moving an existing node and inserting a brand new one
				rescueNode(newChild)
				parent.insertBefore(newChild, currentChild || null)
				syncRegistry(newChild, 'add', connecting)
				added++
			}
		})

		while (parent.childNodes.length > items.length) {
			removed++
			const node = parent.lastChild!
			parent.removeChild(node)
			syncRegistry(node, 'delete', connecting)
			scheduleUnlink(node)
		}
		testing.renderingEvent?.(`reconcile (+${added} -${removed})`, parent, newChildren)
		perf?.mark(`reconcile:${rid}:end`)
		perf?.measure(
			`reconcile:${rid}(+${added}-${removed})`,
			`reconcile:${rid}:start`,
			`reconcile:${rid}:end`
		)
	}
	if (isReactive(newChildren)) {
		const stopRedraw = effect`reconciler:redraw`(reconciler)
		// Anchor the redraw effect to the reactive children so GC doesn't collect it.
		// Root effects use FinalizationRegistry — if nobody holds the cleanup, GC kills the effect.
		link(newChildren, stopRedraw)
		return stopRedraw
	} else reconciler()
	return () => {}
}

/**
 * Latch reactive content onto a DOM element.
 * Polymorph: accepts SursautElement, Child[], Node, Node[], or undefined.
 * Processes content through the appropriate pipeline, then reconciles into the target.
 * Includes DOMContentLoaded guard and conflict detection.
 */
export function latch(
	target: string | Element,
	content: Children,
	env: Env = rootEnv
): ScopedCallback {
	let stop: ScopedCallback | undefined
	let element: Element | null = null
	function actuallyLatch() {
		perf?.mark('app:render:start')
		element =
			typeof target === 'string'
				? (document.querySelector(target as string) as Element | null)
				: (target as Element | null)
		if (!element) {
			reactiveOptions.warn(`[sursaut] latch target not found: ${target}`)
			return
		}

		perf?.mark('app:mount:start')
		const tag = element.tagName?.toLowerCase() ?? String(target)
		const existing = latchOwners.get(element)
		if (existing) {
			reactiveOptions.warn(
				`[sursaut] latch conflict on <${tag}>: already latched by "${existing}". Previous content will be replaced.`
			)
		}
		const label = typeof target === 'string' ? (target as string) : `<${tag}>`
		latchOwners.set(element, label)

		const wrapped = h('fragment', {}, ...(Array.isArray(content) ? content : [content]))
		const nodes = wrapped.render(env)

		// Anchor the nodes array to the root element to prevent GC of the effect tree!
		link(element, nodes)

		testing.renderingEvent?.('latch', tag, element)
		stop = reconcile(element, nodes)
		perf?.mark('app:mount:end')
		perf?.measure('app:mount', 'app:mount:start', 'app:mount:end')
		perf?.mark('app:render:end')
		perf?.measure('app:render', 'app:render:start', 'app:render:end')
	}

	if (document.readyState === 'loading')
		document.addEventListener('DOMContentLoaded', captured(undefined, actuallyLatch))
	else actuallyLatch()

	return () => {
		stop?.()
		if (element) {
			const mountedRoot = element
			const connecting = untracked`latch:isConnected`(() => mountedRoot.isConnected)
			latchOwners.delete(mountedRoot)
			while (mountedRoot.firstChild) {
				const node = mountedRoot.firstChild
				syncRegistry(node, 'delete', connecting)
				mountedRoot.removeChild(node)
				destroyNow(node, 'latch cleanup')
			}
		}
	}
}

/**
 * Process children into a flat array of DOM nodes.
 *
 * ARCHITECTURE — two reactive stages + ReactiveProp envelope:
 *
 * STAGE 1 — morph (children → SursautElement[] → rendered results)
 *   - Spreads childrenArray ([...childrenArray]) to subscribe to array mutations
 *   - Flattens nested arrays, filters falsy
 *   - Applies conditional rendering (if/when/else) via shouldRender()
 *   - Maps surviving SursautElements → rendered results via e.render(env)
 *   - Returns: reactive array of PerhapsReactive<Node | readonly Node[]>
 *
 * STAGE 2 — ReactiveProp getter (flattening)
 *   - Each render result can be Node, Node[], or ReactiveProp wrapping either
 *   - Stack-based traversal with collapse() handles arbitrary nesting
 *   - Returns flat Node[]
 *
 * WHY ReactiveProp envelope:
 *   reconcile() calls collapse(newChildren) inside its redraw effect.
 *   Returning a ReactiveProp means the getter runs inside that effect,
 *   so reading `rendered` (the reactive morph cache) creates a dependency.
 *   Without the wrapper, the flattening would run eagerly at processChildren
 *   call time, outside any subscribing effect.
 */
export function processChildren(children: Children, env: Env): Node | readonly Node[] {
	while (!isReactive(children) && Array.isArray(children) && children.length === 1)
		children = children[0]
	if (!children) return []
	if (!Array.isArray(children)) children = [children] as Child[]
	//Idea: keep reactivity for as late as possible
	const flatInput: Child[] =
		isReactive(children) || children.some((c) => isReactive(c))
			? tag(
					'flatInput',
					lift`link:flatInput`(() => unwrap((children as Child[]).flat(Infinity).filter(Boolean)))
				)
			: (children as Child[]).flat(Infinity).filter(Boolean)

	const needsMorph = isReactive(flatInput) || flatInput.some((c) => c instanceof ReactiveProp)

	const flatElements: readonly SursautElement[] = needsMorph
		? tag(
				'flatElements',
				morph`flatElements`(flatInput, (c) => sursautElement(collapse(c), env), {
					pure: (c) => !(c instanceof ReactiveProp),
				})
			)
		: (flatInput.map((c) => sursautElement(c, env)) as readonly SursautElement[])

	const conditioned: readonly SursautElement[] =
		needsMorph || flatElements.some((e) => e?.guarded)
			? tag(
					'conditioned',
					lift`lift:conditioned`(() => {
						const picks: Record<string, Set<unknown>> = {}
						for (const e of flatElements) {
							const pick = e?.meta?.guards?.pick
							if (pick)
								for (const [key, value] of Object.entries(pick)) {
									let set = picks[key]
									if (!set) {
										set = new Set()
										picks[key] = set
									}
									set.add(collapse(value))
								}
						}
						for (const key of Object.keys(picks)) {
							const options = picks[key]
							picks[key] = new Set()
							const oracle = getEnvPath(env, key)
							if (oracle && typeof oracle === 'function') {
								const result = oracle(options)
								const chosen = Array.isArray(result) || result instanceof Set ? result : [result]
								picks[key] = new Set(chosen)
							} else throw new DynamicRenderingError(`Pick oracle "${key}" not found in env`)
						}
						let ifOccurred = false
						return flatElements
							.map((e) => {
								if (e == null) return undefined
								const shouldRender = e.shouldRender(ifOccurred, env, picks)
								if (shouldRender) ifOccurred = true
								if (shouldRender !== false) return e
							})
							.filter(Boolean) as SursautElement[]
					})
				)
			: flatElements
	// Render the elements to nodes
	const rendered: readonly (Node | readonly Node[])[] = isReactive(conditioned)
		? tag(
				'rendered',
				morph.pure`rendered`(conditioned, (e: SursautElement) => e.render(env))
			)
		: conditioned.map((e: SursautElement) => e.render(env))

	function recurReactive(arr: readonly (Node | readonly Node[])[]): boolean {
		if (isReactive(arr)) return true
		return arr.some((e) => Array.isArray(e) && recurReactive(e))
	}
	// Skip lift:nodes when all conditioned elements are guaranteed single-node producers
	// (DOM elements always return exactly 1 node; their reactive wrapper never changes length).
	// Exclude components that might return dynamic arrays (like <try>).
	// <try> returns isSingleNode = false, so it will correctly trigger lift:nodes.
	const allSingleNode =
		!isReactive(conditioned) && conditioned.every((e) => e.isReactivityLeaf || e.isSingleNode)
	const nodes =
		!allSingleNode || recurReactive(rendered)
			? tag(
					'nodes',
					lift`lift:nodes`(() => rendered.flat(Infinity) as Node[])
				)
			: ((rendered as any[]).flat(Infinity) as Node[])

	if (isReactive(nodes)) {
		return link(nodes, flatInput, flatElements, conditioned, rendered)
	}

	return nodes
}

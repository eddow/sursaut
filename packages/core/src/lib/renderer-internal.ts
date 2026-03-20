import { biDi, captioned, effect, reactiveOptions, root, type ScopedCallback } from 'mutts'
import { CompositeAttributes, ReactiveProp } from './composite-attributes'
import { sursautOptions, testing } from './debug'
import { classNames } from './styles'

export function isFunction(value: any): value is Function {
	return typeof value === 'function'
}

const rootedEventListeners = new WeakMap<
	EventTarget,
	Map<string, Map<boolean, WeakMap<WeakKey, EventListener>>>
>()
const rootedEventListenerHook = Symbol('sursaut.rootedEventListenerHook')
type HookedEventTargetPrototype = EventTarget['constructor']['prototype'] & {
	[rootedEventListenerHook]?: {
		addEventListener: EventTarget['addEventListener']
		removeEventListener: EventTarget['removeEventListener']
	}
}

function eventCapture(options?: boolean | AddEventListenerOptions) {
	return typeof options === 'boolean' ? options : Boolean(options?.capture)
}

function rootedEventListenerMap(
	target: EventTarget,
	type: string,
	capture: boolean,
	create: boolean
) {
	let listenersByType = rootedEventListeners.get(target)
	if (!listenersByType) {
		if (!create) return undefined
		listenersByType = new Map()
		rootedEventListeners.set(target, listenersByType)
	}
	let listenersByCapture = listenersByType.get(type)
	if (!listenersByCapture) {
		if (!create) return undefined
		listenersByCapture = new Map()
		listenersByType.set(type, listenersByCapture)
	}
	let listeners = listenersByCapture.get(capture)
	if (!listeners) {
		if (!create) return undefined
		listeners = new WeakMap()
		listenersByCapture.set(capture, listeners)
	}
	return listeners
}

function rootedEventCallback(
	type: string,
	listener: EventListenerOrEventListenerObject
): EventListener {
	return function (this: EventTarget, evt: Event) {
		return root`event:${type}`(() =>
			typeof listener === 'function' ? listener.call(this, evt) : listener.handleEvent(evt)
		)
	}
}

function resolveRootedEventListener(
	target: EventTarget,
	type: string,
	listener: EventListenerOrEventListenerObject | null,
	options: boolean | AddEventListenerOptions | undefined,
	create: boolean
) {
	if (!listener || !isWeakKey(listener)) return listener
	const listeners = rootedEventListenerMap(target, type, eventCapture(options), create)
	if (!listeners) return listener
	let rooted = listeners.get(listener)
	if (!rooted && create) {
		rooted = rootedEventCallback(type, listener)
		listeners.set(listener, rooted)
	}
	return rooted ?? listener
}

function hookRootedEventListeners() {
	const prototype = globalThis.EventTarget?.prototype as HookedEventTargetPrototype | undefined
	if (!prototype) return
	const hooked = prototype[rootedEventListenerHook]
	if (hooked) return hooked
	const addEventListener = prototype.addEventListener
	const removeEventListener = prototype.removeEventListener
	prototype[rootedEventListenerHook] = { addEventListener, removeEventListener }
	prototype.addEventListener = function (
		this: EventTarget,
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions
	) {
		const rooted = resolveRootedEventListener(this, type, listener, options, true)
		testing.renderingEvent?.('add event listener', this, type, rooted, options)
		return addEventListener.call(this, type, rooted, options)
	}
	prototype.removeEventListener = function (
		this: EventTarget,
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | EventListenerOptions
	) {
		const rooted = resolveRootedEventListener(this, type, listener, options, false)
		testing.renderingEvent?.('remove event listener', this, type, rooted, options)
		return removeEventListener.call(this, type, rooted, options)
	}
	return prototype[rootedEventListenerHook]
}

const rootedEventListenerHooks = hookRootedEventListeners()

export function isNumber(value: any): value is number {
	return typeof value === 'number'
}

export function isString(value: any): value is string {
	return typeof value === 'string'
}

export function isSymbol(value: any): value is symbol {
	return typeof value === 'symbol'
}
export function isWeakKey(value: any): value is WeakKey {
	return (
		(typeof value === 'object' && value !== null) ||
		typeof value === 'symbol' ||
		typeof value === 'function'
	)
}

export function listen(
	target: EventTarget,
	type: string,
	listener: EventListener,
	options?: boolean | AddEventListenerOptions
) {
	const addEventListener = rootedEventListenerHooks?.addEventListener ?? target.addEventListener
	const removeEventListener =
		rootedEventListenerHooks?.removeEventListener ?? target.removeEventListener
	const rooted = resolveRootedEventListener(target, type, listener, options, true)
	addEventListener.call(target, type, rooted, options)
	return () => {
		removeEventListener.call(target, type, rooted, options)
	}
}

// Component Hyper-Build Detection
const componentRebuildTracker = new WeakMap<Function, { count: number; startTime: number }>()

export function checkComponentRebuild(componentCtor: Function) {
	const { maxRebuildsPerWindow, rebuildWindowMs } = sursautOptions
	if (maxRebuildsPerWindow <= 0) return // Disabled

	const now = Date.now()
	let tracker = componentRebuildTracker.get(componentCtor)

	if (!tracker || now - tracker.startTime > rebuildWindowMs) {
		tracker = { count: 0, startTime: now }
		componentRebuildTracker.set(componentCtor, tracker)
	}

	tracker.count++

	if (tracker.count > maxRebuildsPerWindow) {
		reactiveOptions.warn(
			`[sursaut] Component "${componentCtor.name}" rebuilt ${tracker.count} times in ${rebuildWindowMs}ms - possible infinite loop!`
		)
		// Reset to avoid spamming, then pause for debugging
		tracker.count = 0
		tracker.startTime = now
	}
}

export function setHtmlProperty(
	element: Element,
	key: string,
	value: any
): ScopedCallback | undefined {
	const normalizedKey = key.toLowerCase()
	const el = element as any
	let deleter: ScopedCallback | undefined
	try {
		if (normalizedKey in element) {
			const current = el[normalizedKey]
			if (typeof current === 'boolean') el[normalizedKey] = Boolean(value)
			else el[normalizedKey] = value ?? ''
			deleter = () => delete el[normalizedKey]
		}
		if (key in element) {
			const current = el[key]
			if (typeof current === 'boolean') el[key] = Boolean(value)
			else el[key] = value ?? ''
			deleter = () => delete el[key]
		}
	} catch {
		// Fallback to attribute assignment below
	}
	if (value === undefined || value === false) {
		testing.renderingEvent?.('remove attribute', element, normalizedKey)
		element.removeAttribute(normalizedKey)
		return deleter
	}
	const stringValue = value === true ? '' : String(value)
	testing.renderingEvent?.('set attribute', element, normalizedKey, stringValue)
	element.setAttribute(normalizedKey, stringValue)
	return () => {
		element.removeAttribute(normalizedKey)
		deleter?.()
	}
}

export function applyStyleProperties(element: Element, computedStyles: Record<string, any>) {
	element.removeAttribute('style')
	testing.renderingEvent?.('assign style', element, computedStyles)
	const style = (element as HTMLElement).style
	for (const [key, value] of Object.entries(computedStyles)) {
		if (key.startsWith('--')) style.setProperty(key, value == null ? '' : String(value))
		else (style as any)[key] = value ?? ''
	}
}

function setElementClass(element: Element, cls: string) {
	if (element instanceof SVGElement) {
		element.setAttribute('class', cls)
		return () => element.removeAttribute('class')
	}
	;(element as HTMLElement).className = cls
	return () => {
		;(element as HTMLElement).className = ''
	}
}

function attachAttributeValue(
	element: Element,
	key: string,
	value: any
): ScopedCallback | undefined {
	// 1. Event Listeners
	if (/^on[A-Z]/.test(key)) {
		if (value == null) return undefined
		const eventType = key.slice(2).toLowerCase()
		if (typeof value !== 'function') throw new Error('Event listeners must be functions')
		return listen(element, eventType, value)
	}

	// 2. Class
	if (key === 'class') {
		const cls = classNames(value)
		if (!cls) return
		return setElementClass(element, cls)
	}

	// 3. Style
	if (key === 'style') {
		element.removeAttribute('style')
		if (value && typeof value === 'object' && Object.keys(value).length > 0)
			applyStyleProperties(element, value)
		return () => {
			element.removeAttribute('style')
		}
	}

	// 4. Standard Property/Attribute (One-way)
	return setHtmlProperty(element, key, value)
}

function attachAttribute(element: Element, key: string, value: any): ScopedCallback | undefined {
	// Two-way Binding (BiDi) - only for ReactiveProp with explicit .set, never for event handlers
	if (
		value instanceof ReactiveProp &&
		typeof value.get === 'function' &&
		typeof value.set === 'function' &&
		!/^on[A-Z]/.test(key)
	) {
		const binding = {
			get: value.get.bind(value),
			set: value.set.bind(value),
		}

		// Helper to push DOM changes back to the signal
		const provide = captioned(biDi)`attr:${key}`(
			(v: any) => setHtmlProperty(element, key, v),
			binding
		)

		let cleanup: ScopedCallback | undefined
		if (element.tagName === 'INPUT') {
			const input = element as HTMLInputElement
			if (['checkbox', 'radio'].includes(input.type)) {
				if (key === 'checked') cleanup = listen(element, 'input', () => provide(input.checked))
				else if (key === 'indeterminate' && input.type === 'checkbox')
					cleanup = listen(element, 'input', () => provide(input.indeterminate))
			} else if (['number', 'range'].includes(input.type)) {
				if (key === 'value') cleanup = listen(element, 'input', () => provide(Number(input.value)))
			} else if (key === 'value') cleanup = listen(element, 'input', () => provide(input.value))
		} else if (element.tagName === 'TEXTAREA') {
			if (key === 'value')
				cleanup = listen(element, 'input', () => provide((element as HTMLTextAreaElement).value))
		} else if (element.tagName === 'SELECT') {
			if (key === 'value') {
				const handler = () => provide((element as HTMLSelectElement).value)
				const cleanupInput = listen(element, 'input', handler)
				const cleanupChange = listen(element, 'change', handler)
				cleanup = () => {
					cleanupInput()
					cleanupChange()
				}
			}
		}
		return cleanup
	}

	// One-way binding/setter
	return value instanceof ReactiveProp
		? effect`attr:${key}:setter`(() => attachAttributeValue(element, key, value.get()))
		: attachAttributeValue(element, key, value)
}

export function attachAttributes(
	element: Element,
	attributes: CompositeAttributes
): ScopedCallback | undefined {
	if (!(attributes instanceof CompositeAttributes))
		throw new Error('attributes must be an instance of CompositeAttributes')
	const cleanups: Record<string, ScopedCallback | undefined> = {}
	const cleanAll = () => {
		for (const cleanup of Object.values(cleanups)) cleanup?.()
	}
	attributes.mask('class')
	attributes.mask('style')

	cleanups.class = attributes.requiresEffect('class')
		? attachAttribute(element, 'class', new ReactiveProp(() => attributes.mergeClasses()))
		: attachAttributeValue(element, 'class', attributes.mergeClasses())
	cleanups.style = attributes.requiresEffect('style')
		? attachAttribute(element, 'style', new ReactiveProp(() => attributes.mergeStyles()))
		: attachAttributeValue(element, 'style', attributes.mergeStyles())

	if (attributes.isReactive) {
		// Each attribute gets its own independent effect via root() so it is
		// detached from the render effect's ownership chain. This prevents:
		// 1. The rebuild fence from firing when spread-sourced reactive state changes
		// 2. Child effects being destroyed when a parent effect re-runs
		// The entire key enumeration + per-key setup runs inside root() because
		// attributes.keys collapses function layers which may read reactive state.
		root`attachAttributes`(() => {
			const ensureKey = (key: string) => {
				if (key in cleanups) return
				let value = attributes.get(key)
				// If the attribute value dynamically comes from a reactive layer but is a plain scalar,
				// wrap it in a ReactiveProp so `attachAttribute` tracks it.
				if (!(value instanceof ReactiveProp) && typeof value !== 'function') {
					const capturedKey = key
					value = new ReactiveProp(() => attributes.get(capturedKey))
				}
				cleanups[key] = attachAttribute(element, key, value)
			}
			for (const key of attributes.keys) if (!['class', 'style'].includes(key)) ensureKey(key)
		})
		return cleanAll
	} else
		for (const key of attributes.keys)
			cleanups[key] = attachAttribute(element, key, attributes.get(key))

	return cleanAll
}

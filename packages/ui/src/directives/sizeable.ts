import { collapse, type PerhapsReactive, ReactiveProp } from '@sursaut/core'
import type { EffectAccess } from 'mutts'
import { resolveElement } from './shared'

type Direction = 'horizontal' | 'vertical'
type Edge = 'left' | 'right' | 'top' | 'bottom'

function detectDirection(parent: HTMLElement): Direction {
	const computed = getComputedStyle(parent)
	const display = computed.display || parent.style.display
	if (display === 'flex' || display === 'inline-flex') {
		const dir = computed.flexDirection || parent.style.flexDirection || 'row'
		return dir === 'column' || dir === 'column-reverse' ? 'vertical' : 'horizontal'
	}
	return 'horizontal'
}

function findFlexSibling(element: HTMLElement, siblings: HTMLElement[]): HTMLElement | null {
	const flexSiblings = siblings.filter((s) => {
		if (s === element) return false
		const computed = getComputedStyle(s)
		return computed.flex === '1 1 0%' || computed.flex === '1' || computed.flexGrow === '1'
	})

	if (flexSiblings.length !== 1) {
		console.warn('use:sizeable requires exactly one flex:1 sibling')
		return null
	}
	return flexSiblings[0]
}

function detectEdge(
	element: HTMLElement,
	siblings: HTMLElement[],
	flexSibling: HTMLElement,
	direction: Direction
): Edge {
	const elementIndex = siblings.indexOf(element)
	const siblingIndex = siblings.indexOf(flexSibling)
	if (direction === 'horizontal') {
		return elementIndex < siblingIndex ? 'right' : 'left'
	} else {
		return elementIndex < siblingIndex ? 'bottom' : 'top'
	}
}

function getCursor(edge: Edge): string {
	return edge === 'left' || edge === 'right' ? 'col-resize' : 'row-resize'
}

function getProperty(direction: Direction): string {
	return direction === 'horizontal' ? '--sizeable-width' : '--sizeable-height'
}

export function sizeable(prop: PerhapsReactive<number>) {
	return (target: Node | readonly Node[], _access: EffectAccess) => {
		const el = resolveElement(target as Node | Node[])
		if (!el) return

		const element: HTMLElement = el
		let observer: MutationObserver | undefined
		let cleanup: (() => void) | undefined
		let warnedMissingFlex = false

		function setup(): boolean {
			const parent = element.parentElement
			if (!parent) return false
			const host = parent

			const siblings = Array.from(host.children) as HTMLElement[]
			const flexSibling = findFlexSibling(element, siblings)
			if (!flexSibling) {
				warnedMissingFlex = true
				return false
			}

			const direction = detectDirection(host)
			const edge = detectEdge(element, siblings, flexSibling, direction)
			const property = getProperty(direction)
			const rp = prop instanceof ReactiveProp ? prop : null

			host.style.setProperty(property, `${collapse(prop)}px`)

			element.classList.add('sizeable', `sizeable-${edge}`)

			const handle = document.createElement('div')
			handle.className = `sizeable-handle sizeable-handle-${edge}`
			handle.style.cursor = getCursor(edge)

			host.insertBefore(handle, element.nextSibling)

			let startPos = 0
			let startSize = 0

			function onMouseDown(e: MouseEvent) {
				e.preventDefault()
				e.stopPropagation()
				startPos = direction === 'horizontal' ? e.clientX : e.clientY
				startSize = direction === 'horizontal' ? element.offsetWidth : element.offsetHeight
				document.addEventListener('mousemove', onMouseMove)
				document.addEventListener('mouseup', onMouseUp)
				handle.classList.add('dragging')
				element.classList.add('dragging')
			}

			function onMouseMove(e: MouseEvent) {
				let delta = (direction === 'horizontal' ? e.clientX : e.clientY) - startPos
				if (edge === 'left' || edge === 'top') delta = -delta
				const newSize = startSize + delta
				host.style.setProperty(property, `${newSize}px`)
				rp?.set?.(newSize)
			}

			function onMouseUp() {
				document.removeEventListener('mousemove', onMouseMove)
				document.removeEventListener('mouseup', onMouseUp)
				handle.classList.remove('dragging')
				element.classList.remove('dragging')
			}

			handle.addEventListener('mousedown', onMouseDown)

			cleanup = () => {
				handle.removeEventListener('mousedown', onMouseDown)
				document.removeEventListener('mousemove', onMouseMove)
				document.removeEventListener('mouseup', onMouseUp)
				handle.remove()
				element.classList.remove('sizeable', `sizeable-${edge}`, 'dragging')
			}
			return true
		}

		if (!setup()) {
			if (!warnedMissingFlex && typeof MutationObserver !== 'undefined') {
				observer = new MutationObserver(() => {
					if (!cleanup && setup()) observer?.disconnect()
				})
				observer.observe(document.documentElement, { childList: true, subtree: true })
			}
		}

		return () => {
			observer?.disconnect()
			cleanup?.()
		}
	}
}

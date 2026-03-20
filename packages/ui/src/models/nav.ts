// TOTO: to review/refactor
// TODO: Hungry dog
// ── ButtonGroup / Toolbar keyboard navigation utilities ──────────────────────
//
// These are pure DOM utilities — not hooks. Adapters call them from a `use=`
// mount callback on the container element.
//
// setupButtonGroupNav(container) — Arrow-key cycling within a group, Tab exits.
// setupToolbarNav(container, options) — Tab cycles between toolbar segments.

import { listen } from '@sursaut/core'

// ── Shared helpers ───────────────────────────────────────────────────────────

function getEnabledButtons(container: HTMLElement, roleFilter?: string): HTMLButtonElement[] {
	const selector = roleFilter ? `button[role="${roleFilter}"]` : 'button'
	return Array.from(container.querySelectorAll<HTMLButtonElement>(selector)).filter(
		(btn) => !btn.disabled
	)
}

function buildToolbarSegments(toolbar: HTMLElement): HTMLButtonElement[][] {
	const segments: HTMLButtonElement[][] = []
	let current: HTMLButtonElement[] = []
	for (const child of Array.from(toolbar.children) as HTMLElement[]) {
		if (child.dataset.toolbarSpacer !== undefined) {
			if (current.length > 0) {
				segments.push(current)
				current = []
			}
			continue
		}
		const buttons = child.matches('button')
			? [child as HTMLButtonElement]
			: Array.from(child.querySelectorAll<HTMLButtonElement>('button'))
		for (const btn of buttons) {
			if (!btn.disabled) current.push(btn)
		}
	}
	if (current.length > 0) segments.push(current)
	return segments
}

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function findNextFocusableOutside(group: HTMLElement, backwards: boolean): HTMLElement | null {
	const all = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(el) => !group.contains(el)
	)
	if (all.length === 0) return null
	const before: HTMLElement[] = []
	const after: HTMLElement[] = []
	for (const el of all) {
		const rel = el.compareDocumentPosition(group)
		if (rel & Node.DOCUMENT_POSITION_FOLLOWING) before.push(el)
		else after.push(el)
	}
	if (backwards) return before.at(-1) ?? after.at(-1) ?? null
	return after[0] ?? before[0] ?? null
}

// ── ButtonGroup nav ──────────────────────────────────────────────────────────

export type ButtonGroupNavOptions = {
	/** Layout direction — determines which arrow keys cycle. @default 'horizontal' */
	orientation?: 'horizontal' | 'vertical'
	/**
	 * When true, Tab key is intercepted and focus exits to the next focusable
	 * element outside the group. @default true
	 */
	trapTab?: boolean
	/**
	 * Optional role filter — only buttons with this role participate in arrow-key
	 * navigation (e.g. 'radio' for RadioButton groups). Omit for all buttons.
	 */
	roleFilter?: string
}

/**
 * Wires Arrow-key cycling and Tab-exit keyboard navigation to a button group container.
 *
 * Call from a `use=` mount callback on the group container element.
 * Returns a cleanup function that removes the event listener.
 *
 * @example
 * ```tsx
 * const ButtonGroup = (props: ButtonGroupProps) => (
 *   <div role="group" use={(el) => setupButtonGroupNav(el, { orientation: props.orientation })}>
 *     {props.children}
 *   </div>
 * )
 * ```
 */
export function setupButtonGroupNav(
	container: HTMLElement,
	options: ButtonGroupNavOptions = {}
): () => void {
	const { orientation = 'horizontal', trapTab = true, roleFilter } = options

	const onKeydown = (e: KeyboardEvent) => {
		const button = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
		if (!button || !container.contains(button)) return

		const isHorizontal = orientation === 'horizontal'

		if (
			(isHorizontal && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) ||
			(!isHorizontal && (e.key === 'ArrowUp' || e.key === 'ArrowDown'))
		) {
			e.preventDefault()
			const buttons = getEnabledButtons(container, roleFilter)
			const idx = buttons.indexOf(button)
			if (idx === -1) return
			const isNext =
				(isHorizontal && e.key === 'ArrowRight') || (!isHorizontal && e.key === 'ArrowDown')
			const next = isNext
				? buttons[(idx + 1) % buttons.length]
				: buttons[(idx - 1 + buttons.length) % buttons.length]
			next?.focus()
			return
		}

		if (trapTab && e.key === 'Tab') {
			e.preventDefault()
			const next = findNextFocusableOutside(container, e.shiftKey)
			;(next ?? document.body).focus()
		}
	}

	return listen(container, 'keydown', onKeydown as EventListener)
}

// ── Toolbar nav ──────────────────────────────────────────────────────────────

export type ToolbarNavOptions = {
	/** Layout direction. @default 'horizontal' */
	orientation?: 'horizontal' | 'vertical'
	/**
	 * When true, Tab cycles between toolbar segments (wraps around).
	 * When false, Tab exits the toolbar after the last segment. @default false
	 */
	cycleSegments?: boolean
}

/**
 * Wires Tab-based segment cycling and Arrow-key within-segment navigation to a toolbar.
 *
 * Spacer elements must have `data-toolbar-spacer` attribute to be recognised as
 * segment boundaries.
 *
 * Call from a `use=` mount callback on the toolbar container element.
 * Returns a cleanup function.
 *
 * @example
 * ```tsx
 * const Toolbar = (props: ToolbarProps) => (
 *   <div role="toolbar" use={(el) => setupToolbarNav(el, { cycleSegments: true })}>
 *     {props.children}
 *   </div>
 * )
 * ```
 */
export function setupToolbarNav(
	container: HTMLElement,
	options: ToolbarNavOptions = {}
): () => void {
	const { orientation = 'horizontal', cycleSegments = false } = options

	const onKeydown = (e: KeyboardEvent) => {
		const button = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
		if (!button || !container.contains(button)) return

		const isHorizontal = orientation === 'horizontal'

		// Arrow keys: cycle within current segment
		if (
			(isHorizontal && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) ||
			(!isHorizontal && (e.key === 'ArrowUp' || e.key === 'ArrowDown'))
		) {
			e.preventDefault()
			const segments = buildToolbarSegments(container)
			const segIdx = segments.findIndex((seg) => seg.includes(button))
			if (segIdx === -1) return
			const seg = segments[segIdx]!
			const btnIdx = seg.indexOf(button)
			const isNext =
				(isHorizontal && e.key === 'ArrowRight') || (!isHorizontal && e.key === 'ArrowDown')
			const next = isNext
				? seg[(btnIdx + 1) % seg.length]
				: seg[(btnIdx - 1 + seg.length) % seg.length]
			next?.focus()
			return
		}

		// Tab: move between segments
		if (e.key === 'Tab') {
			const segments = buildToolbarSegments(container)
			if (segments.length <= 1) return // let browser handle single-segment toolbars

			const segIdx = segments.findIndex((seg) => seg.includes(button))
			if (segIdx === -1) return

			const nextSegIdx = e.shiftKey ? segIdx - 1 : segIdx + 1

			if (nextSegIdx < 0 || nextSegIdx >= segments.length) {
				if (cycleSegments) {
					e.preventDefault()
					const wrapIdx = e.shiftKey ? segments.length - 1 : 0
					const target = e.shiftKey ? segments[wrapIdx]!.at(-1) : segments[wrapIdx]![0]
					target?.focus()
				} else {
					// Exit toolbar
					e.preventDefault()
					const next = findNextFocusableOutside(container, e.shiftKey)
					;(next ?? document.body).focus()
				}
				return
			}

			e.preventDefault()
			const targetSeg = segments[nextSegIdx]!
			const target = e.shiftKey ? targetSeg.at(-1) : targetSeg[0]
			target?.focus()
		}
	}

	return listen(container, 'keydown', onKeydown as EventListener)
}

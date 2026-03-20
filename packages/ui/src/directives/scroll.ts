import { listen } from '@sursaut/core'
import { atomic, isObject } from 'mutts'
import { resolveElement } from './shared'

export type ScrollAxis = number | { value: number; max?: number }

export type ScrollOptions = {
	x?: ScrollAxis
	y?: ScrollAxis
}

/**
 * `use:scroll` directive — tracks and optionally controls scroll position.
 *
 * @example
 * ```tsx
 * const pos = reactive({ x: { value: 0, max: 0 }, y: { value: 0, max: 0 } })
 * <div use:scroll={pos} style="overflow: auto" />
 * ```
 */
export function scroll(target: Node | Node[], value: ScrollOptions): (() => void) | undefined {
	const element = resolveElement(target)
	if (!element) return

	if (value.x !== undefined) {
		if (typeof value.x === 'number') element.scrollLeft = value.x
	}
	if (value.y !== undefined) {
		if (typeof value.y === 'number') element.scrollTop = value.y
	}

	const updateMax = () => {
		if (isObject(value.x) && 'max' in value.x) {
			const max = element.scrollWidth - element.clientWidth
			if ((value.x as { max?: number }).max !== max) {
				;(value.x as { max?: number }).max = max
			}
		}
		if (isObject(value.y) && 'max' in value.y) {
			const max = element.scrollHeight - element.clientHeight
			if ((value.y as { max?: number }).max !== max) {
				;(value.y as { max?: number }).max = max
			}
		}
	}

	const handleScroll = atomic(() => {
		const x = element.scrollLeft
		const y = element.scrollTop
		if (isObject(value.x) && 'value' in value.x && (value.x as { value: number }).value !== x) {
			;(value.x as { value: number }).value = x
		}
		if (isObject(value.y) && 'value' in value.y && (value.y as { value: number }).value !== y) {
			;(value.y as { value: number }).value = y
		}
	})

	const resizeObserver = new ResizeObserver(atomic(updateMax))
	const stopScroll = listen(element, 'scroll', handleScroll)
	resizeObserver.observe(element)
	updateMax()

	return () => {
		stopScroll()
		resizeObserver.disconnect()
	}
}

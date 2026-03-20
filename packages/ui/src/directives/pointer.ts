import { listen } from '@sursaut/core'
import { resolveElement } from './shared'

export type PointerState = {
	x: number
	y: number
	buttons: number
}

export type PointerBinding = { value: PointerState | undefined }

/**
 * `use:pointer` directive — tracks pointer position and button state.
 *
 * @example
 * ```tsx
 * const ptr = reactive({ value: undefined as PointerState | undefined })
 * <div use:pointer={ptr} />
 * ```
 */
export function pointer(target: Node | Node[], value: PointerBinding): (() => void) | undefined {
	const element = resolveElement(target)
	if (!element) return

	const handleMove = (e: PointerEvent) => {
		value.value = { x: e.offsetX, y: e.offsetY, buttons: e.buttons }
	}
	const handleLeave = () => {
		value.value = undefined
	}
	const handleDown = (e: PointerEvent) => {
		element.setPointerCapture(e.pointerId)
		handleMove(e)
	}
	const handleUp = (e: PointerEvent) => {
		element.releasePointerCapture(e.pointerId)
		handleMove(e)
	}

	const stopMove = listen(element, 'pointermove', handleMove as EventListener)
	const stopDown = listen(element, 'pointerdown', handleDown as EventListener)
	const stopUp = listen(element, 'pointerup', handleUp as EventListener)
	const stopLeave = listen(element, 'pointerleave', handleLeave)

	return () => {
		stopMove()
		stopDown()
		stopUp()
		stopLeave()
	}
}

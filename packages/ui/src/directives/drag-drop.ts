import { listen } from '@sursaut/core'
import { resolveElement } from './shared'

// Internal shared state to hold the payload being dragged
let activeDragPayload: any
let activeDragCompleted = false

export interface DragOptions {
	payload: any | (() => any)
	onStart?: (payload: any) => void
	onEnd?: (payload: any, didDrop: boolean) => void
}

export function drag(
	target: Node | Node[],
	value: any | (() => any) | DragOptions
): (() => void) | undefined {
	const element = resolveElement(target)
	if (!element) return

	element.setAttribute('draggable', 'true')

	const options: DragOptions =
		value && typeof value === 'object' && 'payload' in value
			? (value as DragOptions)
			: { payload: value }

	const onDragStart = (event: DragEvent) => {
		const payload = typeof options.payload === 'function' ? options.payload() : options.payload
		activeDragPayload = payload
		activeDragCompleted = false
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move'
			event.dataTransfer.setData('text/plain', '')
		}
		if (options.onStart) {
			options.onStart(payload)
		}
	}

	const onDragEnd = () => {
		const payload = activeDragPayload
		const didDrop = activeDragCompleted
		activeDragPayload = undefined
		activeDragCompleted = false
		if (options.onEnd) {
			options.onEnd(payload, didDrop)
		}
	}

	const stopDragStart = listen(element, 'dragstart', onDragStart as EventListener)
	const stopDragEnd = listen(element, 'dragend', onDragEnd)

	return () => {
		stopDragStart()
		stopDragEnd()
		element.removeAttribute('draggable')
	}
}

export function drop(
	target: Node | Node[],
	value: (payload: any, event: DragEvent) => void
): (() => void) | undefined {
	const element = resolveElement(target)
	if (!element) return

	const onDragOver = (e: DragEvent) => {
		if (activeDragPayload !== undefined) {
			e.preventDefault()
		}
	}

	const onDrop = (e: DragEvent) => {
		if (activeDragPayload !== undefined) {
			e.preventDefault()
			e.stopPropagation()
			activeDragCompleted = true
			value(activeDragPayload, e)
		}
	}

	const stopDragOver = listen(element, 'dragover', onDragOver as EventListener)
	const stopDrop = listen(element, 'drop', onDrop as EventListener)

	return () => {
		stopDragOver()
		stopDrop()
	}
}

export type DraggingCallback = (
	payload: any,
	isEnter: boolean,
	element: HTMLElement
) => boolean | (() => void) | void

export function dragging(target: Node | Node[], value: DraggingCallback): (() => void) | undefined {
	const element = resolveElement(target)
	if (!element) return

	let enterCount = 0
	let isAccepted = false
	// We store the cleanup returned by the callback (if any)
	let activeCleanup: (() => void) | void

	const handleDragEnter = (e: DragEvent) => {
		if (activeDragPayload === undefined) return

		enterCount++

		if (enterCount === 1) {
			const result = value(activeDragPayload, true, element)
			if (result === false) {
				isAccepted = false
			} else {
				isAccepted = true
				if (typeof result === 'function') {
					activeCleanup = result
				}
			}
		}

		if (isAccepted) {
			e.preventDefault()
		}
	}

	const handleDragOver = (e: DragEvent) => {
		if (activeDragPayload === undefined) return

		if (isAccepted) {
			// Must preventDefault on dragover to indicate we are a valid drop target
			e.preventDefault()
			// We can also set dropEffect to indicate visually what will happen
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'move' // Common for our use cases, but could be configurable if needed eventually
			}
		}
	}

	const handleDragLeave = (_e: DragEvent) => {
		if (activeDragPayload === undefined) return

		enterCount--

		if (enterCount === 0) {
			if (isAccepted) {
				if (typeof activeCleanup === 'function') {
					activeCleanup()
				} else {
					value(activeDragPayload, false, element)
				}
				activeCleanup = undefined
			}
			isAccepted = false
		}
	}

	const handleDrop = (_e: DragEvent) => {
		if (activeDragPayload === undefined) return

		// Treat drop as a leave for styling/cleanup purposes
		enterCount = 0
		if (isAccepted) {
			if (typeof activeCleanup === 'function') {
				activeCleanup()
			} else {
				value(activeDragPayload, false, element)
			}
			activeCleanup = undefined
		}
		isAccepted = false

		// (The actual drop execution is handled by the `drop` directive)
	}

	const stopDragEnter = listen(element, 'dragenter', handleDragEnter as EventListener)
	const stopDragOver = listen(element, 'dragover', handleDragOver as EventListener)
	const stopDragLeave = listen(element, 'dragleave', handleDragLeave as EventListener)
	const stopDrop = listen(element, 'drop', handleDrop as EventListener)

	return () => {
		stopDragEnter()
		stopDragOver()
		stopDragLeave()
		stopDrop()
	}
}

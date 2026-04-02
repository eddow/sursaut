export type LocalDragAxis = 'horizontal' | 'vertical'

export type LocalDragSource = 'mouse' | 'pointer'

export type LocalDragStopReason = 'up' | 'buttons' | 'cancel' | 'blur' | 'hidden' | 'manual'

export type LocalDragPoint = {
	x: number
	y: number
}

export type LocalDragSnapshot<TPayload = unknown> = {
	axis: LocalDragAxis | undefined
	payload: TPayload | undefined
	grabOffset: number
	start: LocalDragPoint
	current: LocalDragPoint
	delta: LocalDragPoint
	buttons: number
	source: LocalDragSource
	pointerId: number | undefined
}

export type LocalDragMoveHandler<TPayload = unknown> = (
	snapshot: LocalDragSnapshot<TPayload>,
	event: MouseEvent | PointerEvent
) => void

export type LocalDragStopHandler<TPayload = unknown> = (
	snapshot: LocalDragSnapshot<TPayload> & {
		reason: LocalDragStopReason
		cancelled: boolean
	},
	event: Event | undefined
) => void

export type LocalDragCapturePolicy = 'none' | 'pointer'

export type LocalDragPreview = string | HTMLElement

export type LocalDragPreviewBehavior = 'auto' | 'native' | 'none'

export interface LocalDragSessionOptions<TPayload = unknown> {
	event: MouseEvent | PointerEvent
	axis?: LocalDragAxis
	payload?: TPayload
	grabOffset?: number
	capture?: LocalDragCapturePolicy
	preview?: LocalDragPreview
	previewBehavior?: LocalDragPreviewBehavior
	onMove?: LocalDragMoveHandler<TPayload>
	onStop?: LocalDragStopHandler<TPayload>
}

export interface LocalDragSession<TPayload = unknown> {
	readonly snapshot: LocalDragSnapshot<TPayload>
	stop: (reason?: LocalDragStopReason) => void
}

function eventPoint(event: MouseEvent | PointerEvent): LocalDragPoint {
	return { x: event.clientX, y: event.clientY }
}

function isPointerEvent(event: MouseEvent | PointerEvent): event is PointerEvent {
	return 'pointerId' in event
}

function eventButtons(event: Event | undefined, fallback: number): number {
	if (!event || !(event instanceof MouseEvent)) return fallback
	return event.buttons
}

function releasePointerCapture(
	element: HTMLElement,
	pointerId: number | undefined,
	capture: LocalDragCapturePolicy
): void {
	if (capture !== 'pointer' || pointerId === undefined) return
	if (!element.isConnected) return
	if (!element.hasPointerCapture(pointerId)) return
	try {
		element.releasePointerCapture(pointerId)
	} catch {
		return
	}
}

function styleLocalDragPreview(element: HTMLElement): void {
	element.style.position = 'fixed'
	element.style.pointerEvents = 'none'
	element.style.zIndex = '9999'
	element.setAttribute('aria-hidden', 'true')
	element.dataset.localDragPreview = 'true'
}

function createLocalDragPreviewElement(
	ownerDocument: Document,
	preview: LocalDragPreview | undefined
): HTMLElement {
	if (typeof preview === 'string' || preview === undefined) {
		const element = ownerDocument.createElement('div')
		styleLocalDragPreview(element)
		element.dataset.localDragPreviewKind = preview === undefined ? 'default' : 'text'
		element.style.background = 'rgba(15, 23, 42, 0.92)'
		element.style.color = 'white'
		element.style.padding = '4px 8px'
		element.style.borderRadius = '999px'
		element.style.fontSize = '12px'
		element.style.fontFamily = 'system-ui, -apple-system, sans-serif'
		element.style.whiteSpace = 'nowrap'
		element.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.2)'
		element.textContent = preview ?? 'Dragging'
		return element
	}
	const element = preview.cloneNode(true) as HTMLElement
	styleLocalDragPreview(element)
	element.dataset.localDragPreviewKind = 'element'
	element.removeAttribute('id')
	return element
}

function positionLocalDragPreview(element: HTMLElement, point: LocalDragPoint): void {
	element.style.left = `${point.x + 10}px`
	element.style.top = `${point.y - 30}px`
}

function suppressManagedLocalDragSelection(ownerDocument: Document): () => void {
	ownerDocument.defaultView?.getSelection?.()?.removeAllRanges()
	const previousUserSelect = ownerDocument.body.style.userSelect
	const previousWebkitUserSelect = ownerDocument.body.style.getPropertyValue('-webkit-user-select')
	ownerDocument.body.style.userSelect = 'none'
	ownerDocument.body.style.setProperty('-webkit-user-select', 'none')
	return () => {
		ownerDocument.body.style.userSelect = previousUserSelect
		if (previousWebkitUserSelect)
			ownerDocument.body.style.setProperty('-webkit-user-select', previousWebkitUserSelect)
		else ownerDocument.body.style.removeProperty('-webkit-user-select')
	}
}

export function startLocalDragSession<TPayload = unknown>(
	options: LocalDragSessionOptions<TPayload>
): LocalDragSession<TPayload> {
	const sourceEvent = options.event
	const element =
		sourceEvent.currentTarget instanceof HTMLElement
			? sourceEvent.currentTarget
			: sourceEvent.target instanceof HTMLElement
				? sourceEvent.target
				: undefined
	const ownerDocument = element?.ownerDocument ?? document
	const ownerWindow = ownerDocument.defaultView ?? window
	const source = isPointerEvent(sourceEvent) ? 'pointer' : 'mouse'
	const pointerId = isPointerEvent(sourceEvent) ? sourceEvent.pointerId : undefined
	const capture = options.capture ?? 'none'
	const previewBehavior = options.previewBehavior ?? 'auto'
	const snapshot: LocalDragSnapshot<TPayload> = {
		axis: options.axis,
		payload: options.payload,
		grabOffset: options.grabOffset ?? 0,
		start: eventPoint(sourceEvent),
		current: eventPoint(sourceEvent),
		delta: { x: 0, y: 0 },
		buttons: sourceEvent.buttons,
		source,
		pointerId,
	}
	if (previewBehavior !== 'native') sourceEvent.preventDefault()
	let stopped = false

	// Create drag representation element if provided
	const restoreManagedSelection =
		previewBehavior === 'native' ? undefined : suppressManagedLocalDragSelection(ownerDocument)
	let dragElement: HTMLElement | undefined
	if (previewBehavior !== 'native' && previewBehavior !== 'none') {
		dragElement = createLocalDragPreviewElement(ownerDocument, options.preview)
		positionLocalDragPreview(dragElement, snapshot.current)
		ownerDocument.body.appendChild(dragElement)
	}

	const updateSnapshot = (event: MouseEvent | PointerEvent): void => {
		const current = eventPoint(event)
		snapshot.current = current
		snapshot.delta = {
			x: current.x - snapshot.start.x,
			y: current.y - snapshot.start.y,
		}
		snapshot.buttons = event.buttons

		// Update drag element position to follow cursor
		if (dragElement) {
			positionLocalDragPreview(dragElement, current)
		}
	}

	const stop = (reason: LocalDragStopReason = 'manual', event?: Event): void => {
		if (stopped) return
		stopped = true

		// Clean up drag element
		if (dragElement?.parentNode) {
			dragElement.parentNode.removeChild(dragElement)
		}
		restoreManagedSelection?.()

		if (source === 'pointer') {
			ownerWindow.removeEventListener('pointermove', handlePointerMove)
			ownerWindow.removeEventListener('pointerup', handlePointerUp)
			ownerWindow.removeEventListener('pointercancel', handlePointerCancel)
		} else {
			ownerWindow.removeEventListener('mousemove', handleMouseMove)
			ownerWindow.removeEventListener('mouseup', handleMouseUp)
		}
		ownerWindow.removeEventListener('blur', handleBlur)
		ownerDocument.removeEventListener('visibilitychange', handleVisibilityChange)
		releasePointerCapture(element ?? ownerDocument.body, pointerId, capture)
		options.onStop?.(
			{
				...snapshot,
				buttons: eventButtons(event, snapshot.buttons),
				reason,
				cancelled: reason !== 'up' && reason !== 'buttons' && reason !== 'manual',
			},
			event
		)
	}

	const handleBlur = (): void => {
		stop('blur')
	}

	const handleVisibilityChange = (): void => {
		if (ownerDocument.visibilityState === 'visible') return
		stop('hidden')
	}

	const handlePointerMove = (event: PointerEvent): void => {
		if (event.pointerId !== pointerId) return
		updateSnapshot(event)
		if (event.buttons === 0) {
			stop('buttons', event)
			return
		}
		options.onMove?.(snapshot, event)
	}

	const handlePointerUp = (event: PointerEvent): void => {
		if (event.pointerId !== pointerId) return
		updateSnapshot(event)
		stop('up', event)
	}

	const handlePointerCancel = (event: PointerEvent): void => {
		if (event.pointerId !== pointerId) return
		updateSnapshot(event)
		stop('cancel', event)
	}

	const handleMouseMove = (event: MouseEvent): void => {
		updateSnapshot(event)
		if (event.buttons === 0) {
			stop('buttons', event)
			return
		}
		options.onMove?.(snapshot, event)
	}

	const handleMouseUp = (event: MouseEvent): void => {
		updateSnapshot(event)
		stop('up', event)
	}

	if (capture === 'pointer' && source === 'pointer' && element && pointerId !== undefined) {
		if (element.isConnected) {
			try {
				element.setPointerCapture(pointerId)
			} catch {
				// Ignore capture failures when the pointer source is removed during drag startup.
			}
		}
	}

	if (source === 'pointer') {
		ownerWindow.addEventListener('pointermove', handlePointerMove)
		ownerWindow.addEventListener('pointerup', handlePointerUp)
		ownerWindow.addEventListener('pointercancel', handlePointerCancel)
	} else {
		ownerWindow.addEventListener('mousemove', handleMouseMove)
		ownerWindow.addEventListener('mouseup', handleMouseUp)
	}
	ownerWindow.addEventListener('blur', handleBlur)
	ownerDocument.addEventListener('visibilitychange', handleVisibilityChange)

	return { snapshot, stop }
}

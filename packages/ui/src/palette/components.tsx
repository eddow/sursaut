import { rootEnv } from '@sursaut/core'
import { effect, reactive, unwrap } from 'mutts'
import {
	localDragAxisEnd,
	localDragAxisStart,
	measureLocalDragTarget,
	resolveLocalDragCandidate,
	resolveLocalDragSplit,
	startLocalDragSession,
} from '../directives'
import type { ArrangedOrientation } from '../shared/types'
import { arranged } from '../shared/utils'
import {
	PALETTE_CATALOG_DRAG_MIME,
	paletteToolbarItemFromCatalogPayload,
	parsePaletteCatalogDragPayload,
} from './command-box'
import { hasPaletteItemTool, isEditableTool, isRunTool, PaletteError, palettes } from './palette'
import type {
	Palette,
	PaletteBase,
	PaletteBorder,
	PaletteDragging,
	PaletteItem,
	PaletteRegion,
	PaletteSchema,
	PaletteScope,
	PaletteToolbar,
	PaletteToolbarItem,
	PaletteTrack,
} from './types'

type PaletteTrackSpace = {
	border: PaletteBorder
	direction: ArrangedOrientation
	index: number
	palette: Palette
	region: PaletteRegion
	track: PaletteTrack
	trackIndex: number
}

type PaletteItemDrag = {
	border: PaletteBorder
	direction: ArrangedOrientation
	item: PaletteToolbarItem
	itemIndex: number
	palette: Palette
	region: PaletteRegion
	toolbar: PaletteToolbar
	track: PaletteTrack
	trackIndex: number
}

type PaletteDragOrigin = {
	border: PaletteBorder
	index: number
	region: PaletteRegion
	toolbar: PaletteToolbar
	track: PaletteTrack
	trackIndex: number
}

type PaletteStackSpace = {
	border: PaletteBorder
	direction: ArrangedOrientation
	index: number
	palette: Palette
	region: PaletteRegion
}

type PaletteToolbarSpace = {
	direction: ArrangedOrientation
	index: number
	palette: Palette
	toolbar: PaletteToolbar
}

type PaletteTrackDragTarget = PaletteTrackSpace & {
	contained: boolean
	element: HTMLElement
	kind: 'track-space'
	split: number
}

type PaletteStackDragTarget = PaletteStackSpace & {
	contained: boolean
	element: HTMLElement
	kind: 'stack-space'
}

type PaletteToolbarDragTarget = PaletteToolbarSpace & {
	contained: boolean
	element: HTMLElement
	kind: 'toolbar-space'
}

type PaletteDragTarget = PaletteTrackDragTarget | PaletteStackDragTarget | PaletteToolbarDragTarget

type PaletteToolbarDrag = {
	border: PaletteBorder
	direction: ArrangedOrientation
	palette: Palette
	region: PaletteRegion
	toolbar: PaletteToolbar
	track: PaletteTrack
	trackIndex: number
}

function clampUnit(value: number): number {
	return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false
	if (target.isContentEditable) return true
	if (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement
	)
		return true
	return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function dragAxis(direction: ArrangedOrientation): 'horizontal' | 'vertical' {
	return direction === 'horizontal' ? 'horizontal' : 'vertical'
}

function axisValue(direction: ArrangedOrientation, point: { x: number; y: number }): number {
	return direction === 'vertical' ? point.y : point.x
}

function rectAxisStart(
	rect: Pick<DOMRectReadOnly, 'left' | 'top'>,
	direction: ArrangedOrientation
): number {
	return direction === 'vertical' ? rect.top : rect.left
}

function rectAxisSpan(
	rect: Pick<DOMRectReadOnly, 'width' | 'height'>,
	direction: ArrangedOrientation
): number {
	return direction === 'vertical' ? rect.height : rect.width
}

function regionDirection(region: PaletteRegion): ArrangedOrientation {
	return region === 'left' || region === 'right' ? 'vertical' : 'horizontal'
}

function draggingToolbarRect(dragging: PaletteDragging): DOMRectReadOnly | undefined {
	for (const element of document.querySelectorAll<HTMLElement>('.toolbar[data-dragging="true"]')) {
		if (element.dataset.paletteId !== dragging.palette.id) continue
		if (!element.isConnected) continue
		return element.getBoundingClientRect()
	}
	return undefined
}

function resizeDraggedToolbarFromPointer(
	dragging: PaletteDragging,
	direction: ArrangedOrientation,
	point: { x: number; y: number },
	anchor: number,
	fallbackRect: DOMRectReadOnly | undefined,
	fallbackDirection: ArrangedOrientation
): void {
	const rect =
		draggingToolbarRect(dragging) ?? (direction === fallbackDirection ? fallbackRect : undefined)
	if (!rect) return
	const span = rectAxisSpan(rect, direction)
	if (span <= 0) return
	resizeToolbarFromPointer(
		dragging.track,
		dragging.index,
		direction,
		point,
		Math.min(Math.max(anchor, 0), span),
		span
	)
}

function rectContainsPoint(
	rect: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>,
	point: {
		x: number
		y: number
	}
): boolean {
	return (
		point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
	)
}

export interface ToolbarProps<TItem extends PaletteToolbarItem = PaletteToolbarItem> {
	border?: PaletteBorder<TItem>
	region?: PaletteRegion
	toolbar: PaletteToolbar<TItem>
	track?: PaletteTrack<TItem>
	trackIndex?: number
	direction: ArrangedOrientation
	el?: JSX.IntrinsicElements['div']
}

function pointDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
	return Math.hypot(a.x - b.x, a.y - b.y)
}

function rectDistanceToPoint(
	rect: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>,
	point: { x: number; y: number }
): number {
	const dx =
		point.x < rect.left ? rect.left - point.x : point.x > rect.right ? point.x - rect.right : 0
	const dy =
		point.y < rect.top ? rect.top - point.y : point.y > rect.bottom ? point.y - rect.bottom : 0
	return Math.hypot(dx, dy)
}

function expandStackSpaceRect(
	rect: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>,
	direction: ArrangedOrientation
): Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'> {
	const halo = 12
	return direction === 'horizontal'
		? {
				left: rect.left,
				right: rect.right,
				top: rect.top - halo,
				bottom: rect.bottom + halo,
				width: rect.width,
				height: rect.height + halo * 2,
			}
		: {
				left: rect.left - halo,
				right: rect.right + halo,
				top: rect.top,
				bottom: rect.bottom,
				width: rect.width + halo * 2,
				height: rect.height,
			}
}

function createToolbarDragging(target: PaletteToolbarDrag): PaletteDragging | undefined {
	const index = target.track.findIndex((slot) => slot.toolbar === target.toolbar)
	if (index < 0) return undefined
	return {
		border: target.border,
		createdTracks: [],
		index,
		palette: target.palette,
		region: target.region,
		sourceItems: [...target.toolbar],
		sourceBorder: target.border,
		sourceRegion: target.region,
		sourceTrack: target.track,
		sourceTrackIndex: target.trackIndex,
		sourceTrackWasSingleton: target.track.length === 1,
		toolbar: target.toolbar,
		track: target.track,
		trackIndex: target.trackIndex,
	}
}

function createItemDragging(
	target: PaletteItemDrag
): { dragging: PaletteDragging; target: PaletteToolbarDrag } | undefined {
	if (target.toolbar.length === 1) {
		const dragging = createToolbarDragging({
			border: target.border,
			direction: target.direction,
			palette: target.palette,
			region: target.region,
			toolbar: target.toolbar,
			track: target.track,
			trackIndex: target.trackIndex,
		})
		if (!dragging) return undefined
		return {
			dragging,
			target: {
				border: target.border,
				direction: target.direction,
				palette: target.palette,
				region: target.region,
				toolbar: target.toolbar,
				track: target.track,
				trackIndex: target.trackIndex,
			},
		}
	}
	if (target.toolbar[target.itemIndex] !== target.item) return undefined
	target.toolbar.splice(target.itemIndex, 1)
	const toolbar = reactive<PaletteToolbar>([target.item])
	const track = reactive<PaletteTrack>([{ space: 0, toolbar }])
	const border = reactive<PaletteBorder>([track])
	const dragging: PaletteDragging = {
		border,
		createdTracks: [],
		index: 0,
		palette: target.palette,
		region: target.region,
		sourceItems: [target.item],
		sourceBorder: border,
		sourceRegion: target.region,
		sourceTrack: track,
		sourceTrackIndex: 0,
		sourceTrackWasSingleton: true,
		toolbar,
		track,
		trackIndex: 0,
	}
	previewToolbarItems(dragging, target.toolbar, target.itemIndex)
	return {
		dragging,
		target: {
			border,
			direction: target.direction,
			palette: target.palette,
			region: target.region,
			toolbar,
			track,
			trackIndex: 0,
		},
	}
}

function hasPaletteDragMoved(dragging: PaletteDragging, origin: PaletteDragOrigin): boolean {
	const preview = dragging.toolbarPreview
	if (preview)
		return unwrap(preview.toolbar) !== unwrap(origin.toolbar) || preview.index !== origin.index
	return (
		unwrap(dragging.border) !== unwrap(origin.border) ||
		dragging.region !== origin.region ||
		unwrap(dragging.toolbar) !== unwrap(origin.toolbar) ||
		unwrap(dragging.track) !== unwrap(origin.track) ||
		dragging.trackIndex !== origin.trackIndex ||
		dragging.index !== origin.index
	)
}

/**
 * Shared hit-testing, proximity chrome, toolbar preview, and track/stack moves for palette toolbar drags.
 * Used by pointer sessions and HTML5 catalogue insert so behaviour stays aligned.
 */
function paletteToolbarDragApplyMove(
	point: { x: number; y: number },
	ctx: {
		paletteToolbarDrag: PaletteToolbarDrag
		anchor: number
		originRect: DOMRectReadOnly | undefined
		dragStart: { x: number; y: number }
		fallbackDirection: ArrangedOrientation
	},
	state: {
		proximityTargets: PaletteDragTarget[]
		activeTarget: PaletteDragTarget | undefined
	}
): PaletteDragTarget | undefined {
	if (!palettes.dragging) return state.activeTarget
	let dragging = palettes.dragging
	const target = ctx.paletteToolbarDrag
	const currentTrack = dragging.track
	const currentIndex = dragging.index
	const currentDirection = regionDirection(dragging.region)
	if (currentIndex < 0) return state.activeTarget
	const nextToolbarTarget = resolveToolbarSpaceTarget(point)
	const toolbarTarget =
		nextToolbarTarget && !isIgnoredToolbarSpace(nextToolbarTarget, dragging)
			? nextToolbarTarget
			: undefined
	const nextTrackTarget = resolveTrackSpaceTarget(point)
	const trackTarget =
		nextTrackTarget && !isIgnoredDropZone(nextTrackTarget, dragging) ? nextTrackTarget : undefined
	const nextStackTarget = resolveStackSpaceTarget(point)
	const stackTarget =
		nextStackTarget &&
		!(
			ctx.originRect &&
			isIgnoredStackSpace(nextStackTarget, point, {
				border: dragging.sourceBorder,
				sourceRegion: dragging.sourceRegion,
				sourceTrackWasSingleton: dragging.sourceTrackWasSingleton,
				start: ctx.dragStart,
				region: dragging.sourceRegion,
				trackIndex: dragging.sourceTrackIndex,
			})
		)
			? nextStackTarget
			: undefined
	const resolvedTarget = toolbarTarget?.contained
		? toolbarTarget
		: !trackTarget
			? stackTarget
			: !stackTarget
				? trackTarget
				: stackTarget.contained
					? stackTarget
					: trackTarget.contained
						? trackTarget
						: trackTarget
	for (const proximityTarget of state.proximityTargets) {
		if (proximityTarget.element === resolvedTarget?.element) continue
		if (proximityTarget.element === toolbarTarget?.element) continue
		if (proximityTarget.element === trackTarget?.element) continue
		if (proximityTarget.element === stackTarget?.element) continue
		setTargetState(proximityTarget, {})
	}
	state.proximityTargets = [toolbarTarget, trackTarget, stackTarget].filter(
		(candidate): candidate is PaletteDragTarget => Boolean(candidate)
	)
	let activeTarget = state.activeTarget
	if (activeTarget?.element !== resolvedTarget?.element) {
		setTargetState(activeTarget, {})
		activeTarget = resolvedTarget
	}
	state.activeTarget = activeTarget
	for (const proximityTarget of state.proximityTargets) {
		setTargetState(proximityTarget, {
			active: proximityTarget.element === resolvedTarget?.element && proximityTarget.contained,
			proximity: true,
		})
	}
	if (resolvedTarget?.kind === 'toolbar-space') {
		previewToolbarItems(dragging, resolvedTarget.toolbar, resolvedTarget.index)
		return state.activeTarget
	}
	const competingTarget = resolvedTarget?.contained ? resolvedTarget : undefined
	if (dragging.toolbarPreview && competingTarget) clearToolbarPreview(dragging)
	dragging = palettes.dragging
	if (!dragging) return state.activeTarget
	if (dragging.toolbarPreview && !competingTarget) return state.activeTarget
	if (!resolvedTarget?.contained) {
		resizeDraggedToolbarFromPointer(
			dragging,
			currentDirection,
			point,
			ctx.anchor,
			ctx.originRect,
			ctx.fallbackDirection
		)
		return state.activeTarget
	}
	if (
		resolvedTarget.kind === 'track-space' &&
		resolvedTarget.track === currentTrack &&
		(resolvedTarget.index === currentIndex || resolvedTarget.index === currentIndex + 1)
	) {
		resizeDraggedToolbarFromPointer(
			dragging,
			resolvedTarget.direction,
			point,
			ctx.anchor,
			ctx.originRect,
			ctx.fallbackDirection
		)
		return state.activeTarget
	}
	const nextDragging =
		resolvedTarget.kind === 'track-space'
			? moveToolbarToTrack(dragging, target, resolvedTarget)
			: moveToolbarToStack(dragging, target, resolvedTarget)
	if (!nextDragging) return state.activeTarget
	const catalogCarry = dragging.catalogInsert
		? ({
				catalogInsert: true as const,
				catalogInsertPointer: dragging.catalogInsertPointer,
				catalogInsertSeedBorder: dragging.catalogInsertSeedBorder,
			} satisfies Pick<
				PaletteDragging,
				'catalogInsert' | 'catalogInsertPointer' | 'catalogInsertSeedBorder'
			>)
		: undefined
	const merged = catalogCarry
		? ({ ...nextDragging, ...catalogCarry } as unknown as PaletteDragging)
		: nextDragging
	palettes.dragging = merged
	dragging = merged
	if (
		resolvedTarget.kind === 'track-space' &&
		(resolvedTarget.direction === currentDirection || draggingToolbarRect(merged))
	) {
		resizeDraggedToolbarFromPointer(
			merged,
			resolvedTarget.direction,
			point,
			ctx.anchor,
			ctx.originRect,
			ctx.fallbackDirection
		)
	}
	return state.activeTarget
}

function startPaletteToolbarDragSession(
	element: HTMLElement,
	target: PaletteToolbarDrag,
	event: PointerEvent,
	dragging: PaletteDragging,
	options?: {
		origin?: PaletteDragOrigin
		onClick?: () => void
		onMoved?: () => void
	}
): void {
	let originRect: DOMRectReadOnly | undefined
	let dragStart: { x: number; y: number } | undefined
	const moveState: {
		proximityTargets: PaletteDragTarget[]
		activeTarget: PaletteDragTarget | undefined
	} = { proximityTargets: [], activeTarget: undefined }
	let activated = false

	event.preventDefault()
	const rect = element.getBoundingClientRect()
	originRect = rect
	dragStart = { x: event.clientX, y: event.clientY }
	const anchor = axisValue(target.direction, dragStart) - rectAxisStart(rect, target.direction)
	startLocalDragSession({
		event,
		axis: dragAxis(target.direction),
		capture: 'pointer',
		onMove(snapshot) {
			if (!activated) {
				if (pointDistance(snapshot.start, snapshot.current) < 4) return
				activated = true
				palettes.dragging = dragging
			}
			paletteToolbarDragApplyMove(
				snapshot.current,
				{
					paletteToolbarDrag: target,
					anchor,
					originRect,
					dragStart: dragStart ?? snapshot.current,
					fallbackDirection: target.direction,
				},
				moveState
			)
		},
		onStop(snapshot) {
			setTargetState(moveState.activeTarget, {})
			for (const proximityTarget of moveState.proximityTargets) setTargetState(proximityTarget, {})
			moveState.proximityTargets = []
			moveState.activeTarget = undefined
			dragStart = undefined
			if (!activated) {
				if (snapshot.reason === 'up' || snapshot.reason === 'buttons') options?.onClick?.()
				return
			}
			const activeDragging = palettes.dragging
			if (unwrap(activeDragging?.palette) === unwrap(target.palette) && activeDragging) {
				if (!options?.origin || hasPaletteDragMoved(activeDragging, options.origin))
					options?.onMoved?.()
				if (activeDragging.toolbarPreview) finalizeToolbarPreview(activeDragging)
				else collapseDeferredSourceTrack(activeDragging)
				delete palettes.dragging
			}
		},
	})
}

function actualTrackSpaceAt(track: PaletteTrack, index: number): number {
	return index < track.length
		? clampUnit(track[index].space)
		: index === track.length
			? clampUnit(track.reduce((remaining, slot) => remaining - slot.space, 1))
			: 0
}

function actualTrackSpaces(track: PaletteTrack): number[] {
	const spaces = track.map((slot) => clampUnit(slot.space))
	const trailing = clampUnit(1 - spaces.reduce((sum, space) => sum + space, 0))
	return [...spaces, trailing]
}

function applyTrackSpaces(track: PaletteTrack, spaces: readonly number[]): void {
	for (let index = 0; index < track.length; index += 1)
		track[index].space = clampUnit(spaces[index] ?? 0)
}

/**
 * Removes a toolbar from a track and merges its surrounding spacing into a single gap.
 *
 * @returns The removed toolbar slot index, or `-1` when the toolbar is not in the track.
 */
function removeToolbar(track: PaletteTrack, toolbar: PaletteToolbar): number {
	const index = track.findIndex((slot) => slot.toolbar === toolbar)
	if (index < 0) return -1
	const spaces = actualTrackSpaces(track)
	const merged = (spaces[index] ?? 0) + (spaces[index + 1] ?? 0)
	spaces.splice(index, 2, merged)
	track.splice(index, 1)
	applyTrackSpaces(track, spaces)
	return index
}

/**
 * Removes the dragged toolbar from its current track and drops the whole track if it becomes empty.
 */
function removeToolbarFromDragTrack(
	dragging: PaletteDragging,
	toolbar: PaletteToolbar
): { index: number; removedTrack: boolean; trackIndex: number } | undefined {
	const trackIndex = dragging.border.indexOf(dragging.track)
	if (trackIndex < 0) return undefined
	const index = removeToolbar(dragging.track, toolbar)
	if (index < 0) return undefined
	if (dragging.track.length > 0) return { index, removedTrack: false, trackIndex }
	const isSessionCreated = dragging.createdTracks.includes(dragging.track)
	dragging.border.splice(trackIndex, 1)
	if (isSessionCreated) {
		const createdIndex = dragging.createdTracks.indexOf(dragging.track)
		if (createdIndex >= 0) dragging.createdTracks.splice(createdIndex, 1)
	}
	return { index, removedTrack: true, trackIndex }
}

/**
 * Removes a track from a border when it no longer contains any toolbars.
 */
function removeEmptyTrack(border: PaletteBorder, track: PaletteTrack): void {
	if (track.length > 0) return
	const trackIndex = border.indexOf(track)
	if (trackIndex < 0) return
	border.splice(trackIndex, 1)
}

/**
 * Collapses the original source track after a drag session when it started as a singleton.
 */
function collapseDeferredSourceTrack(dragging: PaletteDragging | undefined): void {
	if (!dragging?.sourceTrackWasSingleton) return
	removeEmptyTrack(dragging.sourceBorder, dragging.sourceTrack)
	for (const track of [...dragging.createdTracks]) removeEmptyTrack(dragging.border, track)
}

/**
 * Inserts a new single-toolbar track into a border at a clamped index.
 */
function insertTrackWithToolbar(
	border: PaletteBorder,
	index: number,
	toolbar: PaletteToolbar
): { track: PaletteTrack; trackIndex: number } {
	const trackIndex = Math.min(Math.max(index, 0), border.length)
	const track: PaletteTrack = [{ space: 0, toolbar }]
	border.splice(trackIndex, 0, track)
	return { track, trackIndex }
}

/**
 * Inserts a toolbar into an existing track and splits the target gap according to `split`.
 */
function insertToolbar(
	track: PaletteTrack,
	index: number,
	toolbar: PaletteToolbar,
	split: number
): void {
	const insertionIndex = Math.min(Math.max(index, 0), track.length)
	const spaces = actualTrackSpaces(track)
	const merged = spaces[insertionIndex] ?? 0
	const before = merged * clampUnit(split)
	const after = merged - before
	spaces.splice(insertionIndex, 1, before, after)
	track.splice(insertionIndex, 0, { space: 0, toolbar })
	applyTrackSpaces(track, spaces)
}

function splitCatalogDropClient(
	event: DragEvent,
	element: HTMLElement,
	direction: ArrangedOrientation
): number {
	const rect = element.getBoundingClientRect()
	if (direction === 'horizontal') {
		const x = event.clientX - rect.left
		return clampUnit(rect.width > 0 ? x / rect.width : 0.5)
	}
	const y = event.clientY - rect.top
	return clampUnit(rect.height > 0 ? y / rect.height : 0.5)
}

function catalogMimeAvailable(types: readonly string[]): boolean {
	return types.includes(PALETTE_CATALOG_DRAG_MIME)
}

/**
 * Start a catalogue-insert session: same `PaletteDragging` / `previewToolbarItems` path as pointer drag.
 * Call from `dragstart` after the payload is resolved to a toolbar item.
 */
export function beginPaletteCatalogInsertDrag<TSchema extends PaletteSchema>(
	palette: Palette<TSchema>,
	item: PaletteItem<TSchema>,
	pointer?: { x: number; y: number }
): void {
	if (palettes.dragging) return
	const toolbar = reactive<PaletteToolbar<PaletteItem<TSchema>>>([item])
	const track = reactive<PaletteTrack<PaletteItem<TSchema>>>([{ space: 0, toolbar }])
	const border = reactive<PaletteBorder<PaletteItem<TSchema>>>([track])
	const dragging = {
		border,
		createdTracks: [],
		index: 0,
		palette,
		region: 'top' as const,
		sourceItems: [item],
		sourceBorder: border,
		sourceRegion: 'top' as const,
		sourceTrack: track,
		sourceTrackIndex: 0,
		sourceTrackWasSingleton: true,
		toolbar,
		track,
		trackIndex: 0,
		catalogInsert: true as const,
		catalogInsertPointer: pointer ? { dragStart: { x: pointer.x, y: pointer.y } } : undefined,
		catalogInsertSeedBorder: border,
	} as unknown as PaletteDragging
	palettes.dragging = dragging
	palettes.catalogDrag = { palette: palette as unknown as PaletteBase }
}

/** Coalesced native catalogue-insert moves: one layout pass per animation frame. */
let catalogNativeMoveRaf = 0
const catalogNativePendingPoint = { x: 0, y: 0 }
const catalogNativeMoveState: {
	proximityTargets: PaletteDragTarget[]
	activeTarget: PaletteDragTarget | undefined
} = { proximityTargets: [], activeTarget: undefined }

function catalogInsertPaletteToolbarDrag(dragging: PaletteDragging): PaletteToolbarDrag {
	return {
		border: dragging.border,
		direction: regionDirection(dragging.region),
		palette: dragging.palette,
		region: dragging.region,
		toolbar: dragging.toolbar,
		track: dragging.track,
		trackIndex: dragging.trackIndex,
	}
}

function resetCatalogNativeMoveUi(): void {
	if (catalogNativeMoveRaf) {
		cancelAnimationFrame(catalogNativeMoveRaf)
		catalogNativeMoveRaf = 0
	}
	setTargetState(catalogNativeMoveState.activeTarget, {})
	for (const proximityTarget of catalogNativeMoveState.proximityTargets)
		setTargetState(proximityTarget, {})
	catalogNativeMoveState.proximityTargets = []
	catalogNativeMoveState.activeTarget = undefined
}

function flushCatalogNativeToolbarMove(): void {
	const dragging = palettes.dragging
	if (!dragging?.catalogInsert) return
	const point = catalogNativePendingPoint
	if (!dragging.catalogInsertPointer)
		dragging.catalogInsertPointer = { dragStart: { x: point.x, y: point.y } }
	const ip = dragging.catalogInsertPointer
	const rect = draggingToolbarRect(dragging)
	const dir = regionDirection(dragging.region)
	if (ip.grabAnchor === undefined && rect) {
		ip.grabAnchor = axisValue(dir, ip.dragStart) - rectAxisStart(rect, dir)
	}
	paletteToolbarDragApplyMove(
		point,
		{
			paletteToolbarDrag: catalogInsertPaletteToolbarDrag(dragging),
			anchor: ip.grabAnchor ?? 0,
			originRect: rect,
			dragStart: ip.dragStart,
			fallbackDirection: dir,
		},
		catalogNativeMoveState
	)
}

function cancelPaletteCatalogInsertDrag(): void {
	resetCatalogNativeMoveUi()
	const dragging = palettes.dragging
	if (!dragging?.catalogInsert) return
	clearToolbarPreview(dragging)
	collapseDeferredSourceTrack(dragging)
	delete palettes.dragging
	if (palettes.catalogDrag) delete palettes.catalogDrag
}

function bindPaletteCatalogDrop(
	element: HTMLElement,
	palette: Palette,
	insert: (item: PaletteToolbarItem, event: DragEvent) => void
): () => void {
	const onDragOver = (event: DragEvent) => {
		if (!palette.editing) return
		const session = palettes.dragging
		if (session?.catalogInsert && unwrap(session.palette) === unwrap(palette)) {
			event.preventDefault()
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
			return
		}
		if (!event.dataTransfer || !catalogMimeAvailable(Array.from(event.dataTransfer.types))) return
		event.preventDefault()
		event.dataTransfer.dropEffect = 'copy'
	}
	const onDrop = (event: DragEvent) => {
		if (!palette.editing) return
		const session = palettes.dragging
		if (session?.catalogInsert && unwrap(session.palette) === unwrap(palette)) {
			event.preventDefault()
			if (session.toolbarPreview) {
				finalizeToolbarPreview(session)
				collapseDeferredSourceTrack(session)
			} else {
				const item = session.sourceItems[0]
				const stillOnCatalogSeed =
					session.catalogInsertSeedBorder !== undefined &&
					session.border === session.catalogInsertSeedBorder
				if (item && stillOnCatalogSeed) insert(item as PaletteToolbarItem, event)
				collapseDeferredSourceTrack(session)
			}
			delete palettes.dragging
			if (palettes.catalogDrag) delete palettes.catalogDrag
			return
		}
		const raw = event.dataTransfer?.getData(PALETTE_CATALOG_DRAG_MIME)
		if (!raw) return
		event.preventDefault()
		const payload = parsePaletteCatalogDragPayload(raw)
		if (!payload) return
		const item = paletteToolbarItemFromCatalogPayload(palette as Palette<PaletteSchema>, payload)
		if (!item) return
		insert(item as PaletteToolbarItem, event)
	}
	element.addEventListener('dragover', onDragOver)
	element.addEventListener('drop', onDrop)
	return () => {
		element.removeEventListener('dragover', onDragOver)
		element.removeEventListener('drop', onDrop)
	}
}

/**
 * Rebalances the spaces around an existing toolbar within a track.
 */
function resizeToolbar(track: PaletteTrack, index: number, split: number): void {
	if (index < 0 || index >= track.length) return
	const spaces = actualTrackSpaces(track)
	const merged = (spaces[index] ?? 0) + (spaces[index + 1] ?? 0)
	const before = merged * clampUnit(split)
	const after = merged - before
	spaces.splice(index, 2, before, after)
	applyTrackSpaces(track, spaces)
}

/**
 * Computes a toolbar split from the pointer position using the surrounding track spaces.
 */
function resizeToolbarFromPointer(
	track: PaletteTrack,
	index: number,
	direction: ArrangedOrientation,
	point: { x: number; y: number },
	grabOffset: number,
	toolbarSpan: number
): void {
	const beforeSpace = trackSpaceElement(track, index)
	const afterSpace = trackSpaceElement(track, index + 1)
	if (!beforeSpace || !afterSpace) return
	if (direction === 'vertical') {
		const start = beforeSpace.getBoundingClientRect().top
		const end = afterSpace.getBoundingClientRect().bottom
		if (end <= start) return
		const available = end - start - toolbarSpan
		if (available <= 0) return
		const toolbarStart = Math.min(Math.max(point.y - grabOffset, start), end - toolbarSpan)
		const split = clampUnit((toolbarStart - start) / available)
		resizeToolbar(track, index, split)
		return
	}
	const start = beforeSpace.getBoundingClientRect().left
	const end = afterSpace.getBoundingClientRect().right
	if (end <= start) return
	const available = end - start - toolbarSpan
	if (available <= 0) return
	const toolbarStart = Math.min(Math.max(point.x - grabOffset, start), end - toolbarSpan)
	const split = clampUnit((toolbarStart - start) / available)
	resizeToolbar(track, index, split)
}

/**
 * Clears the transient toolbar-in-toolbar preview and restores the source track snapshot.
 */
function clearToolbarPreview(dragging: PaletteDragging): void {
	const preview = dragging.toolbarPreview
	if (!preview) return
	preview.toolbar.splice(preview.index, preview.count)
	const sourceTrack = preview.source.track
	sourceTrack.splice(0, sourceTrack.length, ...preview.source.snapshot)
	if (preview.source.removedTrack) {
		preview.source.border.splice(preview.source.trackIndex, 0, sourceTrack)
	} else applyTrackSpaces(sourceTrack, actualTrackSpaces(sourceTrack))
	delete dragging.toolbarPreview
}

/**
 * Applies or updates the transient preview that splices the dragged toolbar items into another toolbar.
 */
function previewToolbarItems(
	dragging: PaletteDragging,
	toolbar: PaletteToolbar,
	index: number
): void {
	const activePreview =
		dragging.toolbarPreview?.toolbar === toolbar ? dragging.toolbarPreview : undefined
	const insertionIndex = Math.min(
		Math.max(
			activePreview && index > activePreview.index + activePreview.count
				? index - activePreview.count
				: index,
			0
		),
		activePreview ? toolbar.length - activePreview.count : toolbar.length
	)
	if (
		dragging.toolbarPreview?.toolbar === toolbar &&
		dragging.toolbarPreview.index === insertionIndex
	) {
		return
	}
	clearToolbarPreview(dragging)
	const sourceTrack = dragging.track
	const sourceBorder = dragging.border
	const sourceTrackIndex = sourceBorder.indexOf(sourceTrack)
	if (sourceTrackIndex < 0) return
	const sourceSnapshot = sourceTrack.map((slot) => ({ space: slot.space, toolbar: slot.toolbar }))
	const removal = removeToolbarFromDragTrack(dragging, dragging.toolbar)
	if (!removal) return
	toolbar.splice(insertionIndex, 0, ...dragging.sourceItems)
	dragging.toolbarPreview = {
		count: dragging.sourceItems.length,
		index: insertionIndex,
		source: {
			border: sourceBorder,
			removedTrack: removal.removedTrack,
			track: sourceTrack,
			trackIndex: sourceTrackIndex,
			snapshot: sourceSnapshot,
		},
		toolbar,
	}
}

/**
 * Commits a toolbar preview by keeping the previewed insertion and only cleaning empty session tracks.
 */
function finalizeToolbarPreview(dragging: PaletteDragging): void {
	if (!dragging.toolbarPreview) return
	delete dragging.toolbarPreview
	for (const track of [...dragging.createdTracks]) removeEmptyTrack(dragging.border, track)
}

const trackSpaces = new Set<HTMLElement>()
const trackSpaceMeta = new WeakMap<HTMLElement, PaletteTrackSpace>()
const stackSpaces = new Set<HTMLElement>()
const stackSpaceMeta = new WeakMap<HTMLElement, PaletteStackSpace>()
const toolbarSpaces = new Set<HTMLElement>()
const toolbarSpaceMeta = new WeakMap<HTMLElement, PaletteToolbarSpace>()

function trackSpaceTargets() {
	return Array.from(trackSpaces).flatMap((element) => {
		if (!element.isConnected) {
			trackSpaces.delete(element)
			return []
		}
		const target = trackSpaceMeta.get(element)
		if (!target) return []
		return [measureLocalDragTarget({ ...target, kind: 'track-space' as const, element }, element)]
	})
}

function stackSpaceTargets() {
	return Array.from(stackSpaces).flatMap((element) => {
		if (!element.isConnected) {
			stackSpaces.delete(element)
			return []
		}
		const target = stackSpaceMeta.get(element)
		if (!target) return []
		return [measureLocalDragTarget({ ...target, kind: 'stack-space' as const, element }, element)]
	})
}

function toolbarSpaceTargets() {
	return Array.from(toolbarSpaces).flatMap((element) => {
		if (!element.isConnected) {
			toolbarSpaces.delete(element)
			return []
		}
		const target = toolbarSpaceMeta.get(element)
		if (!target) return []
		return [measureLocalDragTarget({ ...target, kind: 'toolbar-space' as const, element }, element)]
	})
}

function trackSpaceElement(track: PaletteTrack, index: number): HTMLElement | undefined {
	for (const element of trackSpaces) {
		if (!element.isConnected) continue
		const target = trackSpaceMeta.get(element)
		if (!target) continue
		if (target.track !== track) continue
		if (target.index !== index) continue
		return element
	}
	return undefined
}

function resolveTrackSpaceTarget(point: {
	x: number
	y: number
}): PaletteTrackDragTarget | undefined {
	return resolveLocalDragCandidate(trackSpaceTargets(), point, (target, state) => {
		const axis = dragAxis(target.id.direction)
		return {
			contained: state.contained,
			...target.id,
			split: resolveLocalDragSplit(
				axis,
				point,
				localDragAxisStart(target.rect, axis),
				localDragAxisEnd(target.rect, axis)
			),
		}
	})?.value
}

function resolveToolbarSpaceTarget(point: {
	x: number
	y: number
}): PaletteToolbarDragTarget | undefined {
	return resolveLocalDragCandidate(toolbarSpaceTargets(), point, (target, state) => ({
		contained: state.contained,
		...target.id,
	}))?.value
}

function resolveStackSpaceTarget(point: {
	x: number
	y: number
}): PaletteStackDragTarget | undefined {
	let best:
		| {
				distance: number
				value: PaletteStackDragTarget
		  }
		| undefined
	for (const target of stackSpaceTargets()) {
		const proximityRect = expandStackSpaceRect(target.rect, target.id.direction)
		const proximityDistance = rectDistanceToPoint(proximityRect, point)
		if (!rectContainsPoint(proximityRect, point) && proximityDistance > 0) continue
		const candidate: PaletteStackDragTarget = {
			contained: rectContainsPoint(target.rect, point),
			...target.id,
		}
		if (!best || proximityDistance < best.distance)
			best = { distance: proximityDistance, value: candidate }
	}
	return best?.value
}

function setTargetState(
	target: PaletteDragTarget | undefined,
	state: { active?: boolean; proximity?: boolean }
): void {
	if (!target) return
	if (state.active) target.element.dataset.active = 'true'
	else delete target.element.dataset.active
	if (state.proximity) target.element.dataset.proximity = 'true'
	else delete target.element.dataset.proximity
}

function isIgnoredDropZone(target: PaletteTrackSpace, dragged: PaletteDragging): boolean {
	if (target.track !== dragged.track) return false
	const { index } = dragged
	if (index < 0) return false
	return target.index === index || target.index === index + 1
}

function isIgnoredToolbarSpace(
	target: Pick<PaletteToolbarSpace, 'direction' | 'index' | 'toolbar'>,
	dragged: PaletteDragging
): boolean {
	if (target.toolbar === dragged.toolbar) return true
	const preview = dragged.toolbarPreview
	if (!preview || target.toolbar !== preview.toolbar) return false
	return target.index >= preview.index && target.index <= preview.index + preview.count
}

function isIgnoredStackSpace(
	target: PaletteStackSpace,
	point: { x: number; y: number },
	origin: {
		border: PaletteBorder
		sourceRegion?: PaletteRegion
		sourceTrackWasSingleton?: boolean
		start: { x: number; y: number }
		region: PaletteRegion
		trackIndex: number
	}
): boolean {
	const originRegion = origin.sourceRegion ?? origin.region
	if (target.border !== origin.border || target.region !== originRegion) return false
	if (origin.sourceTrackWasSingleton)
		return target.index === origin.trackIndex || target.index === origin.trackIndex + 1
	if (pointDistance(origin.start, point) > 12) return false
	return target.index === origin.trackIndex || target.index === origin.trackIndex + 1
}

function moveToolbarToTrack(
	dragging: PaletteDragging,
	target: PaletteToolbarDrag,
	reorderTarget: PaletteTrackDragTarget
): PaletteDragging | undefined {
	const removal = removeToolbarFromDragTrack(dragging, target.toolbar)
	if (!removal) return undefined
	const targetTrackIndex =
		dragging.border === reorderTarget.border &&
		dragging.track === reorderTarget.track &&
		reorderTarget.trackIndex === removal.trackIndex &&
		reorderTarget.index > removal.index
			? reorderTarget.index - 1
			: reorderTarget.index
	insertToolbar(reorderTarget.track, targetTrackIndex, target.toolbar, reorderTarget.split)
	return {
		border: reorderTarget.border,
		createdTracks: dragging.createdTracks,
		index: targetTrackIndex,
		palette: target.palette,
		region: reorderTarget.region,
		sourceItems: dragging.sourceItems,
		sourceBorder: reorderTarget.border,
		sourceRegion: reorderTarget.region,
		sourceTrack: reorderTarget.track,
		sourceTrackIndex: reorderTarget.trackIndex,
		sourceTrackWasSingleton: reorderTarget.track.length === 1,
		toolbar: target.toolbar,
		track: reorderTarget.track,
		trackIndex: reorderTarget.trackIndex,
	}
}

function moveToolbarToStack(
	dragging: PaletteDragging,
	target: PaletteToolbarDrag,
	stackTarget: PaletteStackDragTarget
): PaletteDragging | undefined {
	const removal = removeToolbarFromDragTrack(dragging, target.toolbar)
	if (!removal) return undefined
	const targetTrackIndex =
		dragging.border === stackTarget.border &&
		stackTarget.index > removal.trackIndex &&
		removal.removedTrack
			? stackTarget.index - 1
			: stackTarget.index
	const insertion = insertTrackWithToolbar(stackTarget.border, targetTrackIndex, target.toolbar)
	dragging.createdTracks.push(insertion.track)
	return {
		border: stackTarget.border,
		createdTracks: dragging.createdTracks,
		index: 0,
		palette: target.palette,
		region: stackTarget.region,
		sourceItems: dragging.sourceItems,
		sourceBorder: stackTarget.border,
		sourceRegion: stackTarget.region,
		sourceTrack: insertion.track,
		sourceTrackIndex: insertion.trackIndex,
		sourceTrackWasSingleton: true,
		toolbar: target.toolbar,
		track: insertion.track,
		trackIndex: insertion.trackIndex,
	}
}

function setPaletteRootClass(
	element: HTMLElement | null | undefined,
	name: string,
	enabled: boolean
): void {
	if (!element) return
	element.classList.toggle(name, enabled)
}

function setPaletteRootData(
	element: HTMLElement | null | undefined,
	name: string,
	enabled: boolean
): void {
	if (!element) return
	if (enabled) element.dataset[name] = 'true'
	else delete element.dataset[name]
}

function setPaletteRootId(element: HTMLElement | null | undefined, palette: Palette): void {
	if (!element) return
	element.dataset.paletteId = palette.id
}

Object.assign(rootEnv, {
	paletteRoot(element: HTMLElement, palette: Palette): (() => void) | undefined {
		if (!element.hasAttribute('tabindex')) {
			element.tabIndex = 0
		}
		setPaletteRootId(element, palette)
		const stopEditing = effect`palette.root.editing`(() => {
			const editing = palette.editing
			setPaletteRootClass(element, 'palette-editing', editing)
			setPaletteRootClass(element, 'editing', editing)
			setPaletteRootData(element, 'editing', editing)
			if (!editing && unwrap(palettes.inspecting?.palette) === unwrap(palette))
				delete palettes.inspecting
		})
		const stopDragging = effect`palette.root.dragging`(() => {
			const pointerDrag = unwrap(palettes.dragging?.palette) === unwrap(palette)
			const catalogDrag = unwrap(palettes.catalogDrag?.palette) === unwrap(palette)
			// Pointer reorder: same classes as before (toolbar opacity, proximity loop).
			setPaletteRootClass(element, 'palette-dragging', pointerDrag)
			setPaletteRootClass(element, 'dragging', pointerDrag)
			setPaletteRootData(element, 'dragging', pointerDrag)
			// Native catalogue drag: separate flag; do not reuse `data-dragging` (would break hit-testing / UX).
			setPaletteRootClass(element, 'palette-catalog-dragging', catalogDrag)
			setPaletteRootData(element, 'catalogDragging', catalogDrag)
		})

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return
			if (isEditableTarget(event.target)) return
			const toolId = palette.keys.resolve(event)
			if (!toolId) return
			event.preventDefault()
			event.stopPropagation()
			const tool = palette.tool(toolId)
			if (isRunTool(tool)) {
				if (tool.can) tool.run()
			} else if (isEditableTool(tool) && tool.type === 'boolean') tool.value = !tool.value
			else throw new PaletteError(`Palette binding "${toolId}" did not resolve to a runnable tool`)
		}

		element.addEventListener('keydown', onKeyDown)
		return () => {
			stopEditing()
			stopDragging()
			element.removeEventListener('keydown', onKeyDown)
		}
	},
	paletteTrackSpace(
		element: HTMLElement,
		target: PaletteTrackSpace | undefined
	): (() => void) | undefined {
		if (!target?.palette) return undefined
		trackSpaces.add(element)
		trackSpaceMeta.set(element, target)
		const stopCatalog = bindPaletteCatalogDrop(element, target.palette, (item, event) => {
			const split = splitCatalogDropClient(event, element, target.direction)
			const toolbar = reactive<PaletteToolbar>([item])
			insertToolbar(target.track, target.index, toolbar, split)
		})
		return () => {
			stopCatalog()
			delete element.dataset.active
			delete element.dataset.proximity
			trackSpaces.delete(element)
		}
	},
	paletteStackSpace(
		element: HTMLElement,
		target: PaletteStackSpace | undefined
	): (() => void) | undefined {
		if (!target?.palette) return undefined
		stackSpaces.add(element)
		stackSpaceMeta.set(element, target)
		const stopCatalog = bindPaletteCatalogDrop(element, target.palette, (item) => {
			const toolbar = reactive<PaletteToolbar>([item])
			insertTrackWithToolbar(target.border, target.index, toolbar)
		})
		return () => {
			stopCatalog()
			delete element.dataset.active
			delete element.dataset.proximity
			stackSpaces.delete(element)
		}
	},
	paletteToolbarSpace(
		element: HTMLElement,
		target: PaletteToolbarSpace | undefined
	): (() => void) | undefined {
		if (!target?.palette) return undefined
		toolbarSpaces.add(element)
		toolbarSpaceMeta.set(element, target)
		const stopCatalog = bindPaletteCatalogDrop(element, target.palette, (item) => {
			target.toolbar.splice(target.index, 0, item)
		})
		return () => {
			stopCatalog()
			delete element.dataset.active
			delete element.dataset.proximity
			toolbarSpaces.delete(element)
		}
	},
	paletteToolbarDrag(element: HTMLElement, target: PaletteToolbarDrag): (() => void) | undefined {
		const onPointerDown = (event: PointerEvent) => {
			if (!target?.palette) return
			if (!target.palette.editing) return
			if (event.button !== 0) return
			if (isEditableTarget(event.target)) return
			const dragging = createToolbarDragging(target)
			if (!dragging) return
			startPaletteToolbarDragSession(element, target, event, dragging)
		}
		// TODO: return listen(element, 'pointerdown', onPointerDown as EventListener)
		element.addEventListener('pointerdown', onPointerDown)
		return () => {
			element.removeEventListener('pointerdown', onPointerDown)
		}
	},
	paletteItemDrag(element: HTMLElement, target: PaletteItemDrag): (() => void) | undefined {
		const onPointerDown = (event: PointerEvent) => {
			if (!target.palette.editing) return
			if (event.button !== 0) return
			event.stopPropagation()
			palettes.inspecting = {
				item: target.item,
				palette: target.palette,
				region: target.region,
			}
			const origin = {
				border: target.border,
				index: target.itemIndex,
				region: target.region,
				toolbar: target.toolbar,
				track: target.track,
				trackIndex: target.trackIndex,
			} satisfies PaletteDragOrigin
			const drag = createItemDragging(target)
			if (!drag) return
			const sessionElement =
				drag.dragging.toolbar === target.toolbar
					? (element.closest<HTMLElement>('.toolbar') ?? element)
					: element
			startPaletteToolbarDragSession(sessionElement, drag.target, event, drag.dragging, {
				origin,
				onMoved: () => {
					if (
						unwrap(palettes.inspecting?.palette) === unwrap(target.palette) &&
						unwrap(palettes.inspecting?.item) === unwrap(target.item)
					)
						delete palettes.inspecting
				},
			})
		}

		element.addEventListener('pointerdown', onPointerDown)
		return () => {
			element.removeEventListener('pointerdown', onPointerDown)
		}
	},
	paletteItemShield(element: HTMLElement, active: boolean): (() => void) | undefined {
		element.inert = active
		return () => {
			element.inert = false
		}
	},
})

export function Toolbar<TSchema extends PaletteSchema = PaletteSchema>(
	props: ToolbarProps<PaletteItem<TSchema>>,
	scope: PaletteScope<TSchema>
) {
	const { palette } = scope
	if (!palette) throw new Error('No palette to expose')
	const o = arranged(scope, { density: 'compact', orientation: props.direction })
	const dragging = () =>
		unwrap(palettes.dragging?.palette) === unwrap(palette) ? palettes.dragging : undefined
	const isInactiveToolbarSpace = (dragging: PaletteDragging | undefined, index: number) =>
		dragging
			? isIgnoredToolbarSpace(
					{ direction: props.direction, index, toolbar: props.toolbar },
					dragging
				)
			: false
	return (
		<div
			{...props.el}
			class={['toolbar', o.class, props.el?.class]}
			data-palette-id={palette.id}
			data-editing={palette.editing ? 'true' : undefined}
			data-dragging={palettes.dragging?.toolbar === props.toolbar ? 'true' : undefined}
			use:paletteToolbarDrag={
				props.track &&
				props.border !== undefined &&
				props.region !== undefined &&
				props.trackIndex !== undefined
					? {
							border: props.border,
							direction: props.direction,
							palette,
							region: props.region,
							toolbar: props.toolbar,
							track: props.track,
							trackIndex: props.trackIndex,
						}
					: undefined
			}
		>
			<div
				class={`toolbar-item-space toolbar-drop-zone${isInactiveToolbarSpace(dragging(), 0) ? ' inactive' : ''}`}
				data-inactive={isInactiveToolbarSpace(dragging(), 0) ? 'true' : undefined}
				use:paletteToolbarSpace={
					isInactiveToolbarSpace(dragging(), 0)
						? undefined
						: {
								direction: props.direction,
								index: 0,
								palette,
								toolbar: props.toolbar,
							}
				}
			/>
			<for each={props.toolbar}>
				{(item, position) => {
					const index = position.index
					const tool = hasPaletteItemTool(item) ? palette.tool(item.tool) : undefined
					return (
						<>
							<div class="toolbar-item">
								<div
									class="toolbar-item-content"
									use:paletteItemShield={
										!!props.track &&
										props.border !== undefined &&
										props.region !== undefined &&
										props.trackIndex !== undefined &&
										palette.editing
									}
								>
									{palette.renderEditor(item, tool, scope)}
								</div>
								<div
									if={
										!!props.track &&
										props.border !== undefined &&
										props.region !== undefined &&
										props.trackIndex !== undefined &&
										palette.editing
									}
									class="toolbar-item-guard"
									data-palette-id={palette.id}
									use:paletteItemDrag={
										props.track &&
										props.border !== undefined &&
										props.region !== undefined &&
										props.trackIndex !== undefined
											? {
													border: props.border,
													direction: props.direction,
													item,
													itemIndex: index,
													palette,
													region: props.region,
													toolbar: props.toolbar,
													track: props.track,
													trackIndex: props.trackIndex,
												}
											: undefined
									}
									onClick={() => {
										palettes.inspecting = {
											item,
											palette,
											region: props.region,
										}
									}}
								/>
							</div>
							<div
								class={`toolbar-item-space toolbar-drop-zone${isInactiveToolbarSpace(dragging(), index + 1) ? ' inactive' : ''}`}
								data-inactive={isInactiveToolbarSpace(dragging(), index + 1) ? 'true' : undefined}
								use:paletteToolbarSpace={
									isInactiveToolbarSpace(dragging(), index + 1)
										? undefined
										: {
												direction: props.direction,
												index: index + 1,
												palette,
												toolbar: props.toolbar,
											}
								}
							/>
						</>
					)
				}}
			</for>
		</div>
	)
}

export function DropZone(
	props: {
		border: PaletteBorder
		space: number
		region: PaletteRegion
		track: PaletteTrack
		index: number
		trackIndex: number
		direction: ArrangedOrientation
		el?: JSX.IntrinsicElements['div']
	},
	_scope: PaletteScope
) {
	const dragging = () =>
		unwrap(palettes.dragging?.palette) === unwrap(_scope.palette) ? palettes.dragging : undefined
	const inactive = () =>
		dragging()
			? isIgnoredDropZone(
					{
						border: props.border,
						direction: props.direction,
						index: props.index,
						palette: _scope.palette!,
						region: props.region,
						track: props.track,
						trackIndex: props.trackIndex,
					},
					dragging()!
				)
			: false
	return (
		<div
			{...props.el}
			class={['toolbar-track-space', inactive() ? ' inactive' : undefined, props.el?.class]}
			data-inactive={inactive() ? 'true' : undefined}
			data-palette-id={_scope.palette?.id}
			use:paletteTrackSpace={{
				border: props.border,
				direction: props.direction,
				index: props.index,
				palette: _scope.palette!,
				region: props.region,
				track: props.track,
				trackIndex: props.trackIndex,
			}}
			style={{ flexBasis: `${props.space * 100}%`, flexGrow: `${Math.max(props.space, 0.0001)}` }}
		/>
	)
}

export function StackDropZone(
	props: {
		border: PaletteBorder
		direction: ArrangedOrientation
		index: number
		region: PaletteRegion
		el?: JSX.IntrinsicElements['div']
	},
	_scope: PaletteScope
) {
	return (
		<div
			{...props.el}
			class={['toolbar-stack-space', 'toolbar-drop-zone', props.el?.class]}
			data-palette-id={_scope.palette?.id}
			use:paletteStackSpace={{
				border: props.border,
				direction: props.direction,
				index: props.index,
				palette: _scope.palette!,
				region: props.region,
			}}
		/>
	)
}

export function ToolbarTrack(
	props: {
		border: PaletteBorder
		region: PaletteRegion
		track: PaletteTrack
		trackIndex: number
		direction: ArrangedOrientation
		el?: JSX.IntrinsicElements['div']
		space?: JSX.IntrinsicElements['div']
		toolbar?: JSX.IntrinsicElements['div']
	},
	scope: PaletteScope
) {
	arranged(scope, { orientation: props.direction })
	return (
		<div {...props.el} class={['toolbar-track', props.el?.class]}>
			<DropZone
				border={props.border}
				region={props.region}
				space={actualTrackSpaceAt(props.track, 0)}
				track={props.track}
				index={0}
				trackIndex={props.trackIndex}
				direction={props.direction}
				el={props.space}
			/>
			<for each={props.track}>
				{(item, position) => {
					const index = position.index
					return (
						<>
							<div class="toolbar-track-slot">
								<Toolbar
									border={props.border}
									region={props.region}
									toolbar={item.toolbar}
									track={props.track}
									trackIndex={props.trackIndex}
									direction={props.direction}
									el={props.toolbar}
								/>
							</div>
							<DropZone
								border={props.border}
								region={props.region}
								space={actualTrackSpaceAt(props.track, index + 1)}
								track={props.track}
								index={index + 1}
								trackIndex={props.trackIndex}
								direction={props.direction}
								el={props.space}
							/>
						</>
					)
				}}
			</for>
		</div>
	)
}

export function ToolbarBorder(
	props: {
		border: PaletteBorder
		inverse?: boolean
		direction: ArrangedOrientation
		region: PaletteRegion
		el?: JSX.IntrinsicElements['div']
		track?: JSX.IntrinsicElements['div']
		space?: JSX.IntrinsicElements['div']
		toolbar?: JSX.IntrinsicElements['div']
	},
	scope: PaletteScope
) {
	arranged(scope, { orientation: props.direction })
	scope.region = props.region
	return (
		<div
			{...props.el}
			class={[
				'toolbar-border',
				`palette-${props.direction}`,
				props.direction === 'horizontal' ? 'stack-vertical' : 'stack-horizontal',
			]}
			data-palette-id={scope.palette?.id}
			use:toolbarsContainer={props.direction}
		>
			<StackDropZone
				if={!props.inverse}
				border={props.border}
				direction={props.direction}
				index={0}
				region={props.region}
				el={props.space}
			/>
			<for each={props.inverse ? props.border.toReversed() : props.border}>
				{(item, position) => {
					const trackIndex = position.index
					return (
						<>
							<StackDropZone
								if={props.inverse}
								border={props.border}
								direction={props.direction}
								index={trackIndex + 1}
								region={props.region}
								el={props.space}
							/>
							<ToolbarTrack
								border={props.border}
								region={props.region}
								track={item}
								trackIndex={trackIndex}
								direction={props.direction}
								el={props.track}
								space={props.space}
								toolbar={props.toolbar}
							/>
							<StackDropZone
								if={!props.inverse}
								border={props.border}
								direction={props.direction}
								index={trackIndex + 1}
								region={props.region}
								el={props.space}
							/>
						</>
					)
				}}
			</for>
			<StackDropZone
				if={props.inverse}
				border={props.border}
				direction={props.direction}
				index={0}
				region={props.region}
				el={props.space}
			/>
		</div>
	)
}

export function Parking(
	props: {
		toolbars: readonly PaletteToolbar[]
		el?: JSX.IntrinsicElements['div']
		space?: JSX.IntrinsicElements['div']
		toolbar?: JSX.IntrinsicElements['div']
	},
	scope: PaletteScope
) {
	arranged(scope, { orientation: 'vertical' })
	const parkingScope = scope as PaletteScope & { parkingBorder?: PaletteBorder }
	const border = (parkingScope.parkingBorder ??= reactive<PaletteBorder>(
		props.toolbars.map((toolbar) => reactive<PaletteTrack>([{ space: 0, toolbar }]))
	))
	return (
		<div
			{...props.el}
			class={['palette-parking', 'palette-horizontal', 'stack-vertical']}
			data-palette-id={scope.palette?.id}
			use:toolbarsContainer="vertical"
		>
			<StackDropZone
				border={border}
				direction="horizontal"
				index={0}
				region="top"
				el={props.space}
			/>
			<for each={border}>
				{(track, position) => (
					<>
						<div class="palette-parking-row">
							<button
								if={scope.palette?.editing}
								type="button"
								class="palette-parking-remove"
								aria-label="Delete toolbar"
								onClick={(event: MouseEvent) => {
									event.stopPropagation()
									const toolbar = track[0]?.toolbar
									if (!toolbar) return
									removeToolbar(track, toolbar)
									removeEmptyTrack(border, track)
								}}
							>
								×
							</button>
							<Toolbar
								border={border}
								region="top"
								track={track}
								trackIndex={position.index}
								toolbar={track[0]?.toolbar ?? []}
								direction="horizontal"
								el={props.toolbar}
							/>
						</div>
						<StackDropZone
							border={border}
							direction="horizontal"
							index={position.index + 1}
							region="top"
							el={props.space}
						/>
					</>
				)}
			</for>
		</div>
	)
}

export interface IdeConfig<TItem extends PaletteToolbarItem = PaletteToolbarItem> {
	top?: PaletteBorder<TItem>
	right?: PaletteBorder<TItem>
	bottom?: PaletteBorder<TItem>
	left?: PaletteBorder<TItem>
}

export interface IdeProps<TSchema extends PaletteSchema = PaletteSchema> {
	palette: Palette<TSchema>
	config: IdeConfig<PaletteItem<TSchema>>
	el?: JSX.IntrinsicElements['div']
	center?: JSX.IntrinsicElements['div']
	border?: JSX.IntrinsicElements['div']
	track?: JSX.IntrinsicElements['div']
	space?: JSX.IntrinsicElements['div']
	toolbar?: JSX.IntrinsicElements['div']
	children?: JSX.Children
}

export function Ide<TSchema extends PaletteSchema = PaletteSchema>(
	props: IdeProps<TSchema>,
	scope: Record<string, unknown>
) {
	scope.palette = props.palette
	return (
		<div
			{...props.el}
			class="palette-ide"
			data-palette-id={props.palette.id}
			use:paletteRoot={props.palette}
		>
			<ToolbarBorder
				if={props.config.top !== undefined}
				border={props.config.top ?? []}
				direction="horizontal"
				region="top"
				el={props.border}
				track={props.track}
				space={props.space}
				toolbar={props.toolbar}
			/>
			<div class="palette-ide-middle">
				<ToolbarBorder
					if={props.config.left !== undefined}
					border={props.config.left ?? []}
					direction="vertical"
					region="left"
					el={props.border}
					track={props.track}
					space={props.space}
					toolbar={props.toolbar}
				/>
				<div {...props.center} class="palette-ide-center">
					{props.children}
				</div>
				<ToolbarBorder
					if={props.config.right !== undefined}
					border={props.config.right ?? []}
					inverse={true}
					direction="vertical"
					region="right"
					el={props.border}
					track={props.track}
					space={props.space}
					toolbar={props.toolbar}
				/>
			</div>
			<ToolbarBorder
				if={props.config.bottom !== undefined}
				border={props.config.bottom ?? []}
				inverse={true}
				direction="horizontal"
				region="bottom"
				el={props.border}
				track={props.track}
				space={props.space}
				toolbar={props.toolbar}
			/>
		</div>
	)
}

/** Elements last highlighted during native catalogue drag (pointer path does not run). */
const catalogNativeHighlightElements: HTMLElement[] = []

function clearPaletteCatalogDropHighlights(): void {
	for (const el of catalogNativeHighlightElements) {
		delete el.dataset.active
		delete el.dataset.proximity
	}
	catalogNativeHighlightElements.length = 0
}

function updatePaletteCatalogNativeDropHighlight(point: { x: number; y: number }): void {
	clearPaletteCatalogDropHighlights()
	const toolbarTarget = resolveToolbarSpaceTarget(point)
	const trackTarget = resolveTrackSpaceTarget(point)
	const stackTarget = resolveStackSpaceTarget(point)
	const resolvedTarget = toolbarTarget?.contained
		? toolbarTarget
		: !trackTarget
			? stackTarget
			: !stackTarget
				? trackTarget
				: stackTarget.contained
					? stackTarget
					: trackTarget.contained
						? trackTarget
						: trackTarget
	const candidates = [toolbarTarget, trackTarget, stackTarget].filter(
		(candidate): candidate is PaletteDragTarget => Boolean(candidate)
	)
	for (const candidate of candidates) {
		setTargetState(candidate, {
			proximity: true,
			active:
				resolvedTarget !== undefined &&
				candidate.element === resolvedTarget.element &&
				Boolean(resolvedTarget.contained),
		})
		catalogNativeHighlightElements.push(candidate.element)
	}
}

function onWindowPaletteCatalogDragOver(event: DragEvent): void {
	const dragging = palettes.dragging
	const mimeOk = event.dataTransfer && catalogMimeAvailable(Array.from(event.dataTransfer.types))
	const activeNativeCatalog = Boolean(dragging?.catalogInsert || (palettes.catalogDrag && mimeOk))
	if (!activeNativeCatalog) return
	event.preventDefault()
	if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
	const point = { x: event.clientX, y: event.clientY }
	if (dragging?.catalogInsert) {
		catalogNativePendingPoint.x = point.x
		catalogNativePendingPoint.y = point.y
		if (!catalogNativeMoveRaf) {
			catalogNativeMoveRaf = requestAnimationFrame(() => {
				catalogNativeMoveRaf = 0
				flushCatalogNativeToolbarMove()
			})
		}
		return
	}
	updatePaletteCatalogNativeDropHighlight(point)
}

function onWindowPaletteCatalogDragEnd(): void {
	if (palettes.dragging?.catalogInsert) cancelPaletteCatalogInsertDrag()
	else resetCatalogNativeMoveUi()
	clearPaletteCatalogDropHighlights()
}

if (typeof window !== 'undefined') {
	window.addEventListener('dragover', onWindowPaletteCatalogDragOver, true)
	window.addEventListener('dragend', onWindowPaletteCatalogDragEnd, true)
}

import { listen } from '@sursaut/core'
import { reactive } from 'mutts'

// ── Prefix-sum helpers ────────────────────────────────────────────────────────

function findStartIndex(
	offsets: Float64Array<ArrayBufferLike>,
	scrollTop: number,
	count: number
): number {
	let lo = 0
	let hi = count - 1
	while (lo < hi) {
		const mid = (lo + hi) >>> 1
		if (offsets[mid + 1]! <= scrollTop) lo = mid + 1
		else hi = mid
	}
	return lo
}

function rebuildOffsets(
	heightCache: Float64Array<ArrayBufferLike>,
	offsets: Float64Array<ArrayBufferLike>,
	fromIndex: number,
	count: number
): void {
	for (let i = fromIndex; i < count; i++) {
		offsets[i + 1] = offsets[i]! + heightCache[i]!
	}
}

function ensureCapacity(
	heightCache: Float64Array<ArrayBufferLike>,
	offsets: Float64Array<ArrayBufferLike>,
	needed: number
): [Float64Array<ArrayBufferLike>, Float64Array<ArrayBufferLike>] {
	if (heightCache.length >= needed) return [heightCache, offsets]
	const newSize = Math.max(needed, heightCache.length * 2)
	const newHeights = new Float64Array(newSize)
	newHeights.set(heightCache)
	const newOffsets = new Float64Array(newSize + 1)
	newOffsets.set(offsets)
	return [newHeights, newOffsets]
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type InfiniteScrollProps<T> = {
	/** Data array to render. */
	items: T[]
	/**
	 * Row height in pixels.
	 * - **number** — fixed height (fast path, no ResizeObserver overhead).
	 * - **function** — estimated height per item; actual heights are measured
	 *   via ResizeObserver and the offset table is corrected on the fly.
	 */
	itemHeight: number | ((item: T, index: number) => number)
	/** Fallback height for unmeasured items when `itemHeight` is a function. @default 40 */
	estimatedItemHeight?: number
	/** Auto-scroll to bottom when new items are appended. @default true */
	stickyLast?: boolean
	/** Render function for each item. */
	children: (item: T, index: number) => JSX.Element
}

type ItemState = {
	readonly index: number
	readonly top: number
	readonly minHeight: number
	readonly setupItem: ((el: HTMLElement) => () => void) | undefined
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InfiniteScroll<T>(props: InfiniteScrollProps<T>): JSX.Element {
	const variableMode = typeof props.itemHeight === 'function'

	const scroll = reactive({ scrollTop: 0, viewportHeight: 500, version: 0 })
	let scrollContainerEl: HTMLElement | null = null

	// Variable-height offset table
	let heightCache: Float64Array<ArrayBufferLike> = new Float64Array(256)
	let offsets: Float64Array<ArrayBufferLike> = new Float64Array(257)
	let itemCount = 0
	let rafPending = false
	const pendingMeasurements: Array<{ index: number; height: number }> = []

	// Sticky-last tracking
	let wasAtBottom = false
	let previousMax = 0

	function estimateHeight(index: number): number {
		const fn = props.itemHeight as (item: T, index: number) => number
		const item = props.items[index]
		return item !== undefined ? fn(item, index) : (props.estimatedItemHeight ?? 40)
	}

	function syncOffsets(): void {
		const n = props.items.length
		if (n === itemCount) return
		;[heightCache, offsets] = ensureCapacity(heightCache, offsets, n)
		for (let i = itemCount; i < n; i++) {
			heightCache[i] = estimateHeight(i)
		}
		const from = Math.min(itemCount, n)
		itemCount = n
		rebuildOffsets(heightCache, offsets, from, itemCount)
		scroll.version++
	}

	function onItemMeasured(index: number, measuredHeight: number): void {
		pendingMeasurements.push({ index, height: measuredHeight })
		if (!rafPending) {
			rafPending = true
			requestAnimationFrame(flushMeasurements)
		}
	}

	function flushMeasurements(): void {
		rafPending = false
		if (pendingMeasurements.length === 0) return
		let minChanged = itemCount
		const currentStart = itemCount > 0 ? findStartIndex(offsets, scroll.scrollTop, itemCount) : 0
		let totalDeltaAbove = 0

		for (const { index, height } of pendingMeasurements) {
			if (index >= itemCount) continue
			const delta = height - heightCache[index]!
			if (Math.abs(delta) < 0.5) continue
			heightCache[index] = height
			if (index < minChanged) minChanged = index
			if (index < currentStart) totalDeltaAbove += delta
		}
		pendingMeasurements.length = 0

		if (minChanged < itemCount) {
			rebuildOffsets(heightCache, offsets, minChanged, itemCount)
			scroll.version++
			if (totalDeltaAbove !== 0 && scrollContainerEl) {
				scrollContainerEl.scrollTop += totalDeltaAbove
			}
		}
	}

	const itemObserver = variableMode
		? new ResizeObserver((entries) => {
				for (const entry of entries) {
					const el = entry.target as HTMLElement
					const idx = Number(el.dataset.vindex)
					if (!Number.isNaN(idx)) {
						const height = entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight
						onItemMeasured(idx, height)
					}
				}
			})
		: null

	function computeVisibleRange(): [number, number] {
		const n = props.items.length
		const st = scroll.scrollTop
		const vh = scroll.viewportHeight
		if (variableMode) {
			syncOffsets()
			// read version to subscribe to offset rebuilds
			void scroll.version
			if (itemCount === 0) return [0, 0]
			const start = findStartIndex(offsets, st, itemCount)
			const end = Math.min(findStartIndex(offsets, st + vh, itemCount) + 1, itemCount)
			return [Math.max(0, start - 2), Math.min(n, end + 2)]
		}
		const h = props.itemHeight as number
		const start = Math.floor(st / h)
		const end = Math.min(n, start + Math.ceil(vh / h))
		return [Math.max(0, start - 2), Math.min(n, end + 2)]
	}

	function computeTotalHeight(): number {
		if (variableMode) {
			syncOffsets()
			void scroll.version
			return itemCount > 0 ? offsets[itemCount]! : 0
		}
		return props.items.length * (props.itemHeight as number)
	}

	function makeItemState(index: number): ItemState {
		const top = variableMode ? (offsets[index] ?? 0) : index * (props.itemHeight as number)
		const minHeight = variableMode
			? (heightCache[index] ?? props.estimatedItemHeight ?? 40)
			: (props.itemHeight as number)
		return {
			index,
			top,
			minHeight,
			setupItem: variableMode
				? (el: HTMLElement) => {
						el.dataset.vindex = String(index)
						itemObserver!.observe(el)
						return () => itemObserver!.unobserve(el)
					}
				: undefined,
		}
	}

	function handleScroll(e: Event): void {
		const el = e.currentTarget as HTMLElement
		const newScrollTop = el.scrollTop
		const max = el.scrollHeight - el.clientHeight

		const isAtBottom = max > 0 && Math.abs(newScrollTop - max) < 5
		if (isAtBottom) {
			wasAtBottom = true
		} else if (wasAtBottom && (props.stickyLast ?? true)) {
			if (max > previousMax && Math.abs(newScrollTop - scroll.scrollTop) < 1) {
				el.scrollTop = max
			} else {
				wasAtBottom = false
			}
		} else {
			wasAtBottom = false
		}
		previousMax = max
		scroll.scrollTop = el.scrollTop
	}

	function setupContainer(el: HTMLElement): () => void {
		scrollContainerEl = el
		const stopScroll = listen(el, 'scroll', handleScroll)
		return () => {
			stopScroll()
			scrollContainerEl = null
			itemObserver?.disconnect()
		}
	}

	function handleResize(_width: number, height: number): void {
		scroll.viewportHeight = height
	}

	function computeVisibleItems(): ItemState[] {
		const [start, end] = computeVisibleRange()
		const result: ItemState[] = []
		for (let i = start; i < end; i++) result.push(makeItemState(i))
		return result
	}

	return (
		<div use={setupContainer} use:resize={handleResize} style="overflow-y: auto; height: 100%">
			<div style={{ height: `${computeTotalHeight()}px`, position: 'relative' }}>
				<for each={computeVisibleItems()}>
					{(item: ItemState) => (
						<div
							use={item.setupItem}
							style={{
								position: 'absolute',
								top: `${item.top}px`,
								minHeight: `${item.minHeight}px`,
								width: '100%',
							}}
						>
							{props.children(props.items[item.index]!, item.index)}
						</div>
					)}
				</for>
			</div>
		</div>
	)
}

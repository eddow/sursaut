import { defaults } from '@sursaut/core'
import { componentStyle } from '@sursaut/kit'
import { lift } from 'mutts'
import type { ArrangedProps } from '../shared/types'

// ── Types ───────────────────────────────────────────────────────────────────

export type StarsValue = number | readonly [number, number]

/** Status of a single star position */
export type StarStatus = 'before' | 'inside' | 'after' | 'zero'

export type StarsProps = ArrangedProps & {
	/** Current rating — single number or `[min, max]` range. */
	value: StarsValue
	/** Number of stars to display. @default 5 */
	maximum?: number
	/** Called when the user changes the value. */
	onChange?: (value: StarsValue) => void
	/** Disable interaction. @default false */
	readonly?: boolean
	/** Icon size (CSS value). @default '1.5rem' */
	size?: string
	/** Icon name for range interior stars (defaults to `before` icon). */
	inside?: string
	/** Icon name for empty stars. @default 'star-outline' */
	after?: string
	/** Icon name for filled stars. @default 'star-filled' */
	before?: string
	/** Icon name for the "zero" position (rendered before star 1). */
	zeroElement?: string
}

export type StarItemState = {
	/** 0-based index (−1 for the zero element) */
	readonly index: number
	/** Visual status of this star */
	readonly status: StarStatus
	/** Icon name to render for this star */
	readonly iconName: string
	/** Spreadable attrs for the star element */
	readonly el: JSX.IntrinsicElements['span']
	/** mousedown handler */
	readonly onMousedown: (e: MouseEvent) => void
	/** mouseup handler */
	readonly onMouseup: () => void
	/** mousemove handler */
	readonly onMousemove: (e: MouseEvent) => void
	/** dblclick handler */
	readonly onDblclick: () => void
}

export type StarsModel = {
	/** Current value (may differ from props.value after user interaction) */
	readonly value: StarsValue
	/** Whether interaction is disabled */
	readonly readonly: boolean
	/** Icon size */
	readonly size: string
	/** Whether the zero element should be rendered */
	readonly hasZeroElement: boolean
	/** State for the zero element (index −1) — only valid when hasZeroElement is true */
	readonly zeroItem: StarItemState
	/** State for each numbered star (indices 0 … maximum−1) */
	readonly starItems: StarItemState[]
	/** Spreadable attrs for the container element */
	readonly container: JSX.IntrinsicElements['div'] & {
		readonly onMouseup: () => void
		readonly onMouseleave: () => void
	}
	/** Debug: current dragging end */
	readonly draggingEnd: 'min' | 'max' | null
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Headless star rating logic.
 *
 * Owns internal value state. Supports single-value and range `[min, max]` modes.
 * Click sets value; drag adjusts range endpoints; double-click collapses range.
 *
 * @example
 * ```tsx
 * const Stars = (props: StarsProps) => {
 *   const model = starsModel(props)
 *   return (
 *     <div class={model.readonly ? 'stars readonly' : 'stars'} {...model.container}>
 *       {model.hasZeroElement && <StarItem item={model.zeroItem} size={model.size} />}
 *       <for each={model.starItems}>{(item) => <StarItem item={item} size={model.size} />}</for>
 *     </div>
 *   )
 * }
 * ```
 */
export function starsModel(props: StarsProps): StarsModel {
	const state = defaults(props, {
		value: 0 as StarsValue,
		draggingEnd: null as 'min' | 'max' | null,
	})

	const dragEndHandler = () => {
		state.draggingEnd = null
	}

	function isRange(v: StarsValue): v is readonly [number, number] {
		return Array.isArray(v)
	}

	function set(val: StarsValue) {
		const same =
			isRange(state.value) && isRange(val)
				? val[0] === state.value[0] && val[1] === state.value[1]
				: state.value === val
		if (!same) {
			state.value = val
			props.onChange?.(val)
		}
	}

	function statusAt(index: number, val: StarsValue = state.value): StarStatus {
		if (index === -1) return 'zero'
		const [lo, hi] = isRange(val) ? val : [val as number, val as number]
		const pos = index + 1
		if (pos <= lo) return 'before'
		if (pos <= hi) return 'inside'
		return 'after'
	}

	function iconFor(index: number, status: StarStatus): string {
		if (index === -1) return props.zeroElement ?? 'star-outline'
		if (status === 'inside') return props.inside ?? props.before ?? 'star-filled'
		if (status === 'before') return props.before ?? 'star-filled'
		return props.after ?? 'star-outline'
	}

	function handleInteraction(index: number, e: MouseEvent) {
		if (props.readonly) return
		const isPrimaryButton = e.button === 0 || e.button === undefined
		const hasPrimaryButtons = (e.buttons & 1) === 1 || e.buttons === undefined
		const isDown = e.type === 'mousedown' && isPrimaryButton
		const isDrag = e.type === 'mousemove' && hasPrimaryButtons
		if (!isDown && !isDrag) return
		if (isDown || isDrag) e.preventDefault()

		const pos = index + 1

		if (isRange(state.value)) {
			const [lo, hi] = state.value
			if (!state.draggingEnd) {
				if (pos < lo) {
					state.draggingEnd = 'min'
				} else if (pos > hi) {
					state.draggingEnd = 'max'
				} else {
					const distLo = pos - lo
					const distHi = hi - pos
					if (distLo < distHi) {
						state.draggingEnd = 'min'
					} else if (distHi < distLo) {
						state.draggingEnd = 'max'
					} else {
						const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
						const orientation = props.orientation ?? 'horizontal'
						if (orientation === 'vertical') {
							state.draggingEnd = e.clientY - rect.top < rect.height / 2 ? 'min' : 'max'
						} else {
							state.draggingEnd = e.clientX - rect.left < rect.width / 2 ? 'min' : 'max'
						}
					}
				}
			}
			if (state.draggingEnd === 'min') set([pos, Math.max(pos, hi)])
			else set([Math.min(pos, lo), pos])
		} else {
			set(pos)
		}
	}

	function handleDblClick(index: number) {
		if (props.readonly) return
		if (isRange(state.value)) set([index + 1, index + 1])
	}

	function makeItem(index: number): StarItemState {
		const item: StarItemState = {
			index,
			get status() {
				return statusAt(index, state.value)
			},
			get iconName() {
				return iconFor(index, item.status)
			},
			get el() {
				return {
					class: `stars-item stars-item-${item.status}`,
					'data-star-status': item.status,
					onMousedown: item.onMousedown,
					onMouseup: item.onMouseup,
					onMousemove: item.onMousemove,
					onDblclick: item.onDblclick,
				}
			},
			onMousedown(e: MouseEvent) {
				handleInteraction(index, e)
			},
			onMouseup: dragEndHandler,
			onMousemove(e: MouseEvent) {
				handleInteraction(index, e)
			},
			onDblclick() {
				handleDblClick(index)
			},
		}
		return item
	}

	const starItems = lift`starsItems`(() => {
		const maximum = props.maximum ?? 5
		return Array.from({ length: maximum }, (_, i) => makeItem(i))
	})
	const zeroItem = makeItem(-1)
	const container: StarsModel['container'] = {
		onMouseup: dragEndHandler,
		onMouseleave: dragEndHandler,
	}

	const model: StarsModel = {
		get value() {
			return state.value
		},
		get readonly() {
			return props.readonly ?? false
		},
		get size() {
			return props.size ?? '1.5rem'
		},
		get hasZeroElement() {
			return !!props.zeroElement
		},
		get draggingEnd() {
			return state.draggingEnd
		},
		zeroItem,
		starItems,
		container,
	}
	return model
}

componentStyle.css`
	.stars-item {
		cursor: pointer;
		user-select: none;
		transition: opacity 120ms ease;
	}

	.stars-item-before {
		opacity: 1;
	}

	.stars-item-inside {
		opacity: 0.55;
	}

	.stars-item-after,
	.stars-item-zero {
		opacity: 0.9;
		color: #94a3b8;
	}
`

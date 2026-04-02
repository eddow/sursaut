import type { ElementPassthroughProps } from '../shared/types'
// ── SpacingToken ─────────────────────────────────────────────────────────────

export type SpacingToken = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const spacingScale: Record<SpacingToken, string> = {
	none: '0',
	xs: '0.25rem',
	sm: '0.5rem',
	md: '1rem',
	lg: '1.5rem',
	xl: '2rem',
}

/** Resolves a SpacingToken to a CSS value string. */
export function spacingValue(token?: SpacingToken | (string & {})): string | undefined {
	if (!token) return undefined
	return spacingScale[token as SpacingToken] ?? token
}

// ── Align / Justify maps ─────────────────────────────────────────────────────

export type AlignItems = 'start' | 'center' | 'end' | 'baseline' | 'stretch'
export type JustifyContent =
	| 'start'
	| 'center'
	| 'end'
	| 'between'
	| 'around'
	| 'evenly'
	| 'stretch'

const alignItemsMap: Record<AlignItems, string> = {
	start: 'flex-start',
	center: 'center',
	end: 'flex-end',
	baseline: 'baseline',
	stretch: 'stretch',
}

const justifyMap: Record<JustifyContent, string> = {
	start: 'flex-start',
	center: 'center',
	end: 'flex-end',
	between: 'space-between',
	around: 'space-around',
	evenly: 'space-evenly',
	stretch: 'stretch',
}

/** Resolves an AlignItems token to a CSS `align-items` value. */
export function alignItemsValue(align?: AlignItems): string | undefined {
	return align ? (alignItemsMap[align] ?? align) : undefined
}

/** Resolves a JustifyContent token to a CSS `justify-content` value. */
export function justifyContentValue(justify?: JustifyContent): string | undefined {
	return justify ? (justifyMap[justify] ?? justify) : undefined
}

// ── Stack ────────────────────────────────────────────────────────────────────

export type StackProps = ElementPassthroughProps<'div'> & {
	gap?: SpacingToken | (string & {})
	align?: AlignItems
	justify?: JustifyContent
	children?: JSX.Children
}

export type StackModel = {
	/** CSS `gap` value */
	readonly gap: string | undefined
	/** CSS `align-items` value */
	readonly alignItems: string | undefined
	/** CSS `justify-content` value */
	readonly justifyContent: string | undefined
}

/**
 * Headless vertical flex stack logic.
 *
 * @example
 * ```tsx
 * const Stack = (props: StackProps) => {
 *   const model = stackModel(props)
 *   return (
 *     <div style={{ display: 'flex', flexDirection: 'column', gap: model.gap, alignItems: model.alignItems }}>
 *       {props.children}
 *     </div>
 *   )
 * }
 * ```
 */
export function stackModel(props: StackProps): StackModel {
	const model: StackModel = {
		get gap() {
			return spacingValue(props.gap ?? 'md')
		},
		get alignItems() {
			return alignItemsValue(props.align)
		},
		get justifyContent() {
			return justifyContentValue(props.justify)
		},
	}
	return model
}

// ── Inline ───────────────────────────────────────────────────────────────────

export type InlineProps = ElementPassthroughProps<'div'> & {
	gap?: SpacingToken | (string & {})
	align?: AlignItems
	justify?: JustifyContent
	wrap?: boolean
	scrollable?: boolean
	children?: JSX.Children
}

export type InlineModel = {
	/** CSS `gap` value */
	readonly gap: string | undefined
	/** CSS `align-items` value */
	readonly alignItems: string | undefined
	/** CSS `justify-content` value */
	readonly justifyContent: string | undefined
	/** CSS `flex-wrap` value */
	readonly flexWrap: 'wrap' | 'nowrap'
	/** Whether the inline container is horizontally scrollable */
	readonly scrollable: boolean
}

/**
 * Headless horizontal flex inline logic.
 *
 * @example
 * ```tsx
 * const Inline = (props: InlineProps) => {
 *   const model = inlineModel(props)
 *   return (
 *     <div style={{ display: 'flex', gap: model.gap, alignItems: model.alignItems, flexWrap: model.flexWrap }}>
 *       {props.children}
 *     </div>
 *   )
 * }
 * ```
 */
export function inlineModel(props: InlineProps): InlineModel {
	const model: InlineModel = {
		get gap() {
			return spacingValue(props.gap ?? 'sm')
		},
		get alignItems() {
			return alignItemsValue(props.align ?? 'center')
		},
		get justifyContent() {
			return justifyContentValue(props.justify)
		},
		get flexWrap() {
			return props.wrap ? 'wrap' : 'nowrap'
		},
		get scrollable() {
			return props.scrollable ?? false
		},
	}
	return model
}

// ── Grid ─────────────────────────────────────────────────────────────────────

export type GridProps = ElementPassthroughProps<'div'> & {
	gap?: SpacingToken | (string & {})
	columns?: number | string
	minItemWidth?: string
	align?: 'start' | 'center' | 'end' | 'stretch'
	justify?: 'start' | 'center' | 'end' | 'stretch'
	children?: JSX.Children
}

export type GridModel = {
	/** CSS `gap` value */
	readonly gap: string | undefined
	/** CSS `grid-template-columns` value — undefined when not set */
	readonly gridTemplateColumns: string | undefined
	/** CSS `align-items` value */
	readonly alignItems: string | undefined
	/** CSS `justify-items` value */
	readonly justifyItems: string | undefined
}

/**
 * Headless CSS grid logic.
 *
 * @example
 * ```tsx
 * const Grid = (props: GridProps) => {
 *   const model = gridModel(props)
 *   return (
 *     <div style={{ display: 'grid', gap: model.gap, gridTemplateColumns: model.gridTemplateColumns }}>
 *       {props.children}
 *     </div>
 *   )
 * }
 * ```
 */
export function gridModel(props: GridProps): GridModel {
	const model: GridModel = {
		get gap() {
			return spacingValue(props.gap ?? 'md')
		},
		get gridTemplateColumns() {
			if (props.columns !== undefined && props.columns !== null && props.columns !== '') {
				return typeof props.columns === 'number'
					? `repeat(${props.columns}, minmax(0, 1fr))`
					: props.columns
			}
			if (props.minItemWidth) return `repeat(auto-fit, minmax(${props.minItemWidth}, 1fr))`
			return undefined
		},
		get alignItems() {
			return props.align
		},
		get justifyItems() {
			return props.justify
		},
	}
	return model
}

// ── Container ────────────────────────────────────────────────────────────────

export type ContainerProps = {
	/** When true, renders a fluid (full-width) container. @default false */
	fluid?: boolean
	/** Dynamic element tag. @default 'div' */
	tag?: string
	children?: JSX.Children
} & ElementPassthroughProps

export type ContainerModel = {
	/** Whether the container is fluid */
	readonly fluid: boolean
	/** Resolved element tag */
	readonly tag: string
}

/**
 * Headless container logic.
 *
 * @example
 * ```tsx
 * const Container = (props: ContainerProps) => {
 *   const model = containerModel(props)
 *   return (
 *     <dynamic tag={model.tag} class={model.fluid ? 'container-fluid' : 'container'}>
 *       {props.children}
 *     </dynamic>
 *   )
 * }
 * ```
 */
export function containerModel(props: ContainerProps): ContainerModel {
	const model: ContainerModel = {
		get fluid() {
			return props.fluid ?? false
		},
		get tag() {
			return props.tag ?? 'div'
		},
	}
	return model
}

// ── AppShell ─────────────────────────────────────────────────────────────────

export type AppShellProps = {
	header: JSX.Element
	/** When true, adds a shadow to the header on scroll. @default true */
	shadowOnScroll?: boolean
	children?: JSX.Children
}

export type AppShellModel = {
	/** Whether shadowOnScroll is enabled */
	readonly shadowOnScroll: boolean
	/**
	 * Mount callback for the header element.
	 * Wire via `use:setupShadow={model.setupShadow}` or call in a `use=` mount.
	 * Returns a cleanup function that removes the scroll listener.
	 */
	readonly setupShadow: (headerEl: HTMLElement) => () => void
}

/**
 * Headless app shell logic.
 *
 * The adapter renders a sticky header and a main content area.
 * Wire `model.setupShadow` to the header element via a `use=` mount callback
 * to get the scroll-based shadow behaviour.
 *
 * @example
 * ```tsx
 * const AppShell = (props: AppShellProps) => {
 *   const model = appShellModel(props)
 *   return (
 *     <div class="app-shell">
 *       <header use={model.setupShadow}>{props.header}</header>
 *       <main>{props.children}</main>
 *     </div>
 *   )
 * }
 * ```
 */
export function appShellModel(props: AppShellProps): AppShellModel {
	const model: AppShellModel = {
		get shadowOnScroll() {
			return props.shadowOnScroll !== false
		},
		get setupShadow() {
			return (headerEl: HTMLElement): (() => void) => {
				if (!model.shadowOnScroll || typeof window === 'undefined') return () => {}
				const win = window
				const onScroll = () => {
					headerEl.classList.toggle('shadow', win.scrollY > 0)
				}
				onScroll()
				// Use the realm's own `addEventListener`: `listen()` may call a captured
				// `EventTarget.prototype` hook from another global, which breaks in jsdom/Vitest.
				win.addEventListener('scroll', onScroll, { passive: true })
				return () => {
					win.removeEventListener('scroll', onScroll)
				}
			}
		},
	}
	return model
}

import type {
	ActiveEvent,
	DockviewActivePanelChangeEvent,
	DockviewApi,
	DockviewDidDropEvent,
	DockviewDndOverlayEvent,
	DockviewGroupPanel,
	DockviewGroupPanelCollapsedChangeEvent,
	DockviewGroupPanelLocationChangeEvent,
	DockviewGroupPanelPeekChangeEvent,
	DockviewLayoutMutationEvent,
	DockviewMaximizedGroupChangeEvent,
	DockviewOptions,
	DockviewPanelPinnedChangeEvent,
	DockviewTabGroupChangeEvent,
	DockviewTabGroupCollapsedChangeEvent,
	DockviewTabGroupPanelChangeEvent,
	DockviewTheme,
	DockviewWillDropEvent,
	DockviewWillShowOverlayLocationEvent,
	FocusEvent,
	GroupDragEvent,
	GroupPanelPartInitParameters,
	IContentRenderer,
	LayoutHistoryChangeEvent,
	MovePanelEvent,
	Parameters,
	PinnedChangeEvent,
	PopoutGroup,
	PopoutGroupChangePositionEvent,
	PopoutGroupChangeSizeEvent,
	SerializedDockview,
	SmartGuidesSnapEvent,
	SmartGuidesSnapTogetherEvent,
	TabDragEvent,
	TitleEvent,
	VisibilityEvent,
} from 'dockview'
import {
	type AddPanelOptions,
	createDockview,
	type DockviewGroupLocation,
	type DockviewPanelApi,
	type DockviewPopoutGroupOptions,
	type FloatingGroupOptions,
	type IDockviewPanel,
	themeDracula,
	themeLight,
} from 'dockview'
import 'dockview/dist/styles/dockview.css'
import { extend, fromAttribute, latch, ReactiveProp } from '@sursaut/core'
import { componentStyle, useDisplayContext } from '@sursaut/kit'
import {
	biDi,
	caught,
	effect,
	effectContext,
	reactive,
	root,
	type ScopedCallback,
	unreactive,
	untracked,
	withEffectContext,
} from 'mutts'
import {
	type DockviewWidgetDefinition,
	DockviewWidgetRegistry,
	type DockviewWidgets,
	defineDockviewWidgets,
} from './dockview-registry'
import {
	cloneParams,
	DOCKVIEW_CONTEXT_KEY,
	type DvWidgetLayoutContext,
	deepEqual,
	mergeInto,
} from './dockview-utils'

export { defineDockviewWidgets, DockviewWidgetRegistry }
export type { DockviewWidgetDefinition, DockviewWidgets }

componentStyle.sass`
.sursaut-dockview
	width: 100%
	height: 100%
	position: relative

.sursaut-dv-watermark
	position: absolute
	inset: 0
	z-index: 2

.sursaut-dv-item
	width: 100%
	height: 100%

	&.tab
		display: flex
		align-items: center
		overflow: hidden
		padding: 0 4px
		gap: 2px

		.title
			flex: 1
			overflow: hidden
			text-overflow: ellipsis
			white-space: nowrap
			margin: 0 4px

		.close
			margin-left: auto
			background: none
			border: none
			padding: 0
			width: 22px
			height: 22px
			flex: 0 0 auto
			display: flex
			align-items: center
			justify-content: center
			cursor: pointer
			color: inherit
			opacity: 0.7
			&:hover
				opacity: 1
			[data-icon]
				font-size: 12px
				line-height: 1
				overflow: hidden
`

export type DockviewWidgetProps<
	Params extends Record<string, any> = Record<string, any>,
	Context extends Record<PropertyKey, any> = Record<PropertyKey, any>,
> = {
	title: string
	size: { width: number; height: number }
	params: Params
	context: Context
}

/**
 * Reactive state shared by reference between a panel's tab and content.
 * Mirrors svelte `PanelState`: two visibilities (`shown` = renderer
 * onShow/onHide, `visible` = `api.isVisible`), read-only mirrors
 * (`focused`, `groupActive`, `title`), two-way (`active` activates on write,
 * `pinned` via `setPinned`), rAF-throttled `size`, and `custom` as the app
 * channel (`context` stays as a deprecated alias).
 */
export interface DockviewPanelState<Params extends Record<string, any> = Record<string, any>> {
	params: Params
	size: { width: number; height: number }
	shown: boolean
	visible: boolean
	active: boolean
	focused: boolean
	pinned: boolean
	groupActive: boolean
	api: DockviewPanelApi
	title: string
	custom: Record<string, unknown>
}

export interface DockviewWidgetScope extends Record<PropertyKey, unknown> {
	dockviewApi?: DockviewApi
	panelApi?: DockviewPanelApi
}

export type DockviewWidget<
	Params extends Record<string, any> = Record<string, any>,
	Context extends Record<PropertyKey, any> = Record<PropertyKey, any>,
> = (props: DockviewWidgetProps<Params, Context>, scope: DockviewWidgetScope) => JSX.Element

/**
 * Extracts the params type of a widget component from its `DockviewWidget<P, C>`
 * signature. Widgets that do not bind a params generic fall back to
 * `Record<string, any>` (mirrors svelte `ParamsOf`).
 */
export type DockviewParamsOf<W extends DockviewWidget<any, any>> =
	W extends DockviewWidget<infer P, any> ? P : Record<string, any>

/**
 * Extracts the params type of a `widgets` entry: a `DockviewWidgetDefinition`
 * (via its `component`) or a bare `DockviewWidget` function.
 */
export type DockviewWidgetParams<E> =
	E extends DockviewWidgetDefinition<infer C>
		? DockviewParamsOf<C>
		: E extends DockviewWidget<any, any>
			? DockviewParamsOf<E>
			: Record<string, any>

/**
 * Reactive group state, passed to header actions alongside the group.
 * Mirrors svelte `GroupState`: `isCollapsed`/`isPeeking` follow the group's
 * collapse/peek changes and `location` its `onDidLocationChange`.
 */
export interface DockviewGroupState {
	/** True while the group is collapsed to its header. */
	isCollapsed: boolean
	/** True while the group is peeking (edge/tool window). */
	isPeeking: boolean
	/** The group's current location: `'grid'`, `'floating'`, `'popout'`, or `'edge'`. */
	location: DockviewGroupLocation
}

export type DockviewHeaderActionProps = {
	group: DockviewGroupPanel
	state: DockviewGroupState
}

/** Currently active panel + group (svelte `bind:active` equivalent). */
export interface DockviewActiveState {
	panel: IDockviewPanel | undefined
	group: DockviewGroupPanel | undefined
}

/** Floating-window state (svelte `bind:floating` equivalent). */
export interface DockviewFloatingState {
	/** Number of floating windows currently open. */
	count: number
	/** True when at least one floating window is open. */
	hasFloating: boolean
}

/** Popout-window state (svelte `bind:popout` equivalent). */
export interface DockviewPopoutState {
	/** Number of popout windows currently open. */
	count: number
	/** True when at least one popout window is open. */
	hasPopout: boolean
}

/** A handle returned by `openPanel`, bundling the panel and its shared state. */
export interface DockviewPanelHandle<Params extends Record<string, any> = Record<string, any>> {
	id: string
	/** Raw dockview panel for full escape-hatch access. */
	panel: IDockviewPanel
	/** Convenience alias of `panel.api`. */
	api: DockviewPanelApi
	/** Reactive state shared by tab + content (undefined until the renderer mounts). */
	state: DockviewPanelState<Params> | undefined
}

/** Options accepted by `openPanel`. Owns `id`/`title`/`params`, passes the rest through. */
export type DockviewOpenPanelOptions<Params extends Record<string, any> = Record<string, any>> = {
	id?: string
	title?: string
	params?: Params
	tabComponent?: string
} & Omit<AddPanelOptions, 'id' | 'title' | 'component' | 'tabComponent' | 'params'>

/**
 * Ergonomic surface bound via the `handle` prop (svelte `bind:handle` equivalent).
 * `api` is the raw escape hatch; the rest is typed by widget key.
 *
 * `W` is the inferred shape of the `widgets` prop: a map keyed by widget key
 * whose values are either `DockviewWidgetDefinition` or bare `DockviewWidget`
 * functions. `openPanel(key)` derives the params type from the entry's
 * component signature, so `handle.openPanel('counter')` returns
 * `DockviewPanelHandle<CounterParams>` and `options.params` is narrowed.
 */
export interface DockviewHandle<
	W extends Record<string, DockviewWidgetDefinition | DockviewWidget<any, any>> = Record<
		string,
		DockviewWidgetDefinition | DockviewWidget<any, any>
	>,
> {
	/** The raw dockview api — full escape hatch for anything `openPanel` can't do. */
	api: DockviewApi
	/** Open a panel by widget key with an optional title/params/position. */
	openPanel: <K extends keyof W & string>(
		key: K,
		options?: DockviewOpenPanelOptions<DockviewWidgetParams<W[K]>>
	) => DockviewPanelHandle<DockviewWidgetParams<W[K]>>
	/** Register (or override) a widget definition at runtime. */
	registerWidget: (key: string, def: DockviewWidgetDefinition) => void
	/** Remove a widget definition. */
	unregisterWidget: (key: string) => void
	/**
	 * Float an existing panel or group into its own window.
	 * Accepts an `IDockviewPanel`, a `DockviewGroupPanel`, or a panel/group id string.
	 */
	float: (
		target: IDockviewPanel | DockviewGroupPanel | string,
		options?: FloatingGroupOptions
	) => void
	/**
	 * Pop an existing panel or group out into its own browser window.
	 * Resolves `true` on success, `false` if the popout window failed to open.
	 */
	popout: (
		target: IDockviewPanel | DockviewGroupPanel | string,
		options?: DockviewPopoutGroupOptions
	) => Promise<boolean>
	/** Dock every floating window back into the main grid. */
	dockAll: () => void
}

export type DockviewHeaderAction = (
	props: DockviewHeaderActionProps,
	scope: DockviewWidgetScope
) => JSX.Element | null

/** Empty-state overlay: plain widget receiving `{ openPanel }` (svelte `watermark` equivalent). */
export type DockviewWatermarkProps = {
	/** Open a panel by widget key — same as `handle.openPanel`. */
	openPanel: DockviewHandle['openPanel']
}

export type DockviewWatermark = (
	props: DockviewWatermarkProps,
	scope: DockviewWidgetScope
) => JSX.Element | null

/** All 33 `DockviewApi` events forwarded as component props (mirror svelte `Dockview.svelte`). */
export interface DockviewEventProps {
	onDidLayoutChange?: () => void
	onDidLayoutFromJSON?: () => void
	onDidAddPanel?: (panel: IDockviewPanel) => void
	onDidRemovePanel?: (panel: IDockviewPanel) => void
	onDidAddGroup?: (group: DockviewGroupPanel) => void
	onDidRemoveGroup?: (group: DockviewGroupPanel) => void
	onDidActivePanelChange?: (event: DockviewActivePanelChangeEvent) => void
	onDidActiveGroupChange?: (group: DockviewGroupPanel | undefined) => void
	onDidMovePanel?: (event: MovePanelEvent) => void
	onWillDrop?: (event: DockviewWillDropEvent) => void
	onDidDrop?: (event: DockviewDidDropEvent) => void
	onWillDragPanel?: (event: TabDragEvent) => void
	onWillDragGroup?: (event: GroupDragEvent) => void
	onWillMutateLayout?: (event: DockviewLayoutMutationEvent) => void
	onDidMutateLayout?: (event: DockviewLayoutMutationEvent) => void
	onWillShowOverlay?: (event: DockviewWillShowOverlayLocationEvent) => void
	onUnhandledDragOver?: (event: DockviewDndOverlayEvent) => void
	onDidAddPopoutGroup?: (group: PopoutGroup) => void
	onDidRemovePopoutGroup?: (group: PopoutGroup) => void
	onDidPopoutGroupSizeChange?: (event: PopoutGroupChangeSizeEvent) => void
	onDidPopoutGroupPositionChange?: (event: PopoutGroupChangePositionEvent) => void
	onDidOpenPopoutWindowFail?: () => void
	onDidCreateTabGroup?: (event: DockviewTabGroupChangeEvent) => void
	onDidDestroyTabGroup?: (event: DockviewTabGroupChangeEvent) => void
	onDidAddPanelToTabGroup?: (event: DockviewTabGroupPanelChangeEvent) => void
	onDidRemovePanelFromTabGroup?: (event: DockviewTabGroupPanelChangeEvent) => void
	onDidTabGroupChange?: (event: DockviewTabGroupChangeEvent) => void
	onDidTabGroupCollapsedChange?: (event: DockviewTabGroupCollapsedChangeEvent) => void
	onDidPanelPinnedChange?: (event: DockviewPanelPinnedChangeEvent) => void
	onDidMaximizedGroupChange?: (event: DockviewMaximizedGroupChangeEvent) => void
	onDidChangeHistory?: (event: LayoutHistoryChangeEvent) => void
	onDidSnapFloat?: (event: SmartGuidesSnapEvent) => void
	onDidSnapTogether?: (event: SmartGuidesSnapTogetherEvent) => void
}

function logDockview(debug: boolean | string | undefined, event: string, payload?: unknown) {
	if (!debug) return
	const label = typeof debug === 'string' ? debug : 'Dockview'
	if (payload === undefined) {
		console.log(`[${label}] ${event}`)
		return
	}
	console.log(`[${label}] ${event}`, payload)
}

// #region Renderers

export type PanelErrorHandler = (panelId: string, error: unknown, element: HTMLElement) => void
type Spawn = (fn: () => void) => ScopedCallback

function renderPanelError(element: HTMLElement, panelId: string, error: unknown) {
	element.innerHTML = ''
	const msg = document.createElement('div')
	msg.style.cssText = 'color:#e55;padding:8px;font-size:12px;white-space:pre-wrap'
	msg.textContent = `⚠ Panel error (${panelId}): ${error instanceof Error ? error.message : String(error)}`
	element.appendChild(msg)
}

// Test-visible registry of live panel states (content renderer owns each entry).
const livePanelStates = new Map<string, DockviewPanelState>()

function contentRenderer(
	Widget: DockviewWidget,
	props: Partial<DockviewWidgetProps>,
	onDispose: ScopedCallback,
	scope: Record<string, any>,
	spawn: Spawn,
	onPanelError?: PanelErrorHandler
): IContentRenderer {
	const element = document.createElement('div')
	element.classList.add('sursaut-dv-item', 'body')
	const cleanups: ScopedCallback[] = [onDispose]
	// Shared state, created in init() (needs panelApi) and shared by ref with the tab.
	let state: DockviewPanelState | undefined
	let lastParams: unknown
	let lastActive = false
	let lastPinned = false
	let raf = 0

	return {
		element,
		init: ({ api: panelApi, params, title }: GroupPanelPartInitParameters) => {
			let mountedCleanup: ScopedCallback | undefined
			const reactiveParams = reactive(params ?? {})
			const custom = (props.context as Record<string, unknown> | undefined) ?? reactive({})
			state = reactive({
				params: reactiveParams,
				size: { width: 0, height: 0 },
				shown: true,
				visible: panelApi.isVisible,
				active: panelApi.isActive,
				focused: panelApi.isFocused,
				pinned: panelApi.isPinned,
				groupActive: panelApi.isGroupActive,
				api: unreactive(panelApi),
				title,
				custom,
			}) as DockviewPanelState
			livePanelStates.set(panelApi.id, state)
			// Deprecated alias: `context` === `custom` (same reference).
			const context = custom
			Object.defineProperties(props, {
				title: {
					get: () => state!.title,
					set: (v: string) => {
						panelApi.setTitle(v)
						state!.title = v
					},
					enumerable: true,
					configurable: true,
				},
			})
			Object.assign(props, {
				params: state.params,
				size: state.size,
				context,
			})
			const panelId = panelApi.id
			lastParams = untracked(() => cloneParams(state!.params))
			lastActive = state.active
			lastPinned = state.pinned
			cleanups.push(
				panelApi.onDidTitleChange((e: TitleEvent) => (state!.title = e.title)).dispose,
				panelApi.onDidActiveChange((e: ActiveEvent) => {
					state!.active = e.isActive
					lastActive = e.isActive
				}).dispose,
				panelApi.onDidFocusChange((e: FocusEvent) => {
					state!.focused = e.isFocused
				}).dispose,
				panelApi.onDidVisibilityChange((e: VisibilityEvent) => {
					state!.visible = e.isVisible
				}).dispose,
				panelApi.onDidChangePinned((e: PinnedChangeEvent) => {
					state!.pinned = e.isPinned
					lastPinned = e.isPinned
				}).dispose,
				panelApi.onDidActiveGroupChange((e: ActiveEvent) => {
					state!.groupActive = e.isActive
				}).dispose,
				effect`contentRenderer.updateParameters`(() => {
					// Tracked read (not `untracked`) so the effect re-runs on widget-side
					// param writes; `cloneParams` produces a plain snapshot for comparison.
					const snap = cloneParams(state!.params)
					if (deepEqual(snap, lastParams)) return
					lastParams = snap
					panelApi.updateParameters(snap)
				}),
				effect`contentRenderer.activate`(() => {
					// Only activation is meaningful from the widget side.
					if (state!.active && !lastActive) state!.api.setActive()
				}),
				effect`contentRenderer.pin`(() => {
					if (state!.pinned !== lastPinned) {
						lastPinned = state!.pinned
						state!.api.setPinned(state!.pinned)
					}
				}),
				() => mountedCleanup?.(),
				panelApi.onDidParametersChange((payload: Parameters) => {
					mergeInto(state!.params as Record<string, unknown>, payload)
					lastParams = untracked(() => cloneParams(state!.params))
				}).dispose,
				spawn(() => {
					caught((error: unknown) => {
						console.error('[Dockview] Panel error:', panelId, error)
						mountedCleanup?.()
						mountedCleanup = undefined
						renderPanelError(element, panelId, error)
						onPanelError?.(panelId, error, element)
					})
					mountedCleanup = latch(
						element,
						<Widget
							title={(props as DockviewWidgetProps).title}
							params={(props as DockviewWidgetProps).params}
							size={(props as DockviewWidgetProps).size}
							context={(props as DockviewWidgetProps).context}
						/>,
						extend(scope, {
							dockviewApi: scope.dockviewApi ?? scope.api,
							panelApi: unreactive(panelApi),
							// Shared state for `<DvWidget>` body functions (see dvwidget.tsx).
							panelState: state,
						})
					)
				})
			)
		},
		update: (event: { params: Record<string, unknown> }) => {
			// dockview → widget (renderer update path, e.g. deserialization)
			const current = state
			if (!current) return
			mergeInto(current.params as Record<string, unknown>, event.params)
			lastParams = untracked(() => cloneParams(current.params))
		},
		layout: (width: number, height: number) => {
			cancelAnimationFrame(raf)
			raf = requestAnimationFrame(() => {
				if (!state?.shown) return
				state.size.width = width
				state.size.height = height
			})
		},
		onShow: () => {
			if (state) state.shown = true
		},
		onHide: () => {
			if (state) state.shown = false
		},
		dispose() {
			cancelAnimationFrame(raf)
			if (state) livePanelStates.delete(state.api.id)
			for (const cleanup of cleanups) cleanup()
		},
	}
}

function tabRenderer(
	Widget: DockviewWidget,
	props: DockviewWidgetProps,
	scope: Record<string, any>,
	spawn: Spawn,
	onPanelError?: PanelErrorHandler
): IContentRenderer {
	const element = document.createElement('div')
	element.classList.add('sursaut-dv-item', 'tab')
	let cleanup: ScopedCallback | undefined
	let mountedCleanup: ScopedCallback | undefined

	return {
		element,
		init: ({ api: panelApi }: GroupPanelPartInitParameters) => {
			const panelId = panelApi.id
			cleanup = spawn(() => {
				caught((error: unknown) => {
					console.error('[Dockview] Tab error:', panelId, error)
					mountedCleanup?.()
					mountedCleanup = undefined
					renderPanelError(element, panelId, error)
					onPanelError?.(panelId, error, element)
				})
				mountedCleanup = latch(
					element,
					<Widget
						title={(props as DockviewWidgetProps).title}
						params={(props as DockviewWidgetProps).params}
						size={(props as DockviewWidgetProps).size}
						context={(props as DockviewWidgetProps).context}
					/>,
					extend(scope, {
						dockviewApi: scope.dockviewApi ?? scope.api,
						panelApi: unreactive(panelApi),
						// Shared state for `<DvWidget>` tab functions (see dvwidget.tsx).
						panelState: livePanelStates.get(panelId),
					})
				)
			})
		},
		dispose() {
			mountedCleanup?.()
			cleanup?.()
		},
	}
}

function headerActionRenderer(
	Widget: DockviewHeaderAction,
	group: DockviewGroupPanel,
	scope: Record<string, any>,
	spawn: Spawn,
	onPanelError?: PanelErrorHandler
) {
	const element = document.createElement('div')
	element.classList.add('sursaut-dv-item')
	let cleanup: ScopedCallback | undefined
	let mountedCleanup: ScopedCallback | undefined
	// Reactive group-state mirror, shared by ref with the header action (svelte `GroupState`).
	const state = reactive({
		isCollapsed: group.api.isCollapsed(),
		isPeeking: group.api.isPeeking(),
		location: group.api.location,
	}) as DockviewGroupState
	const stateCleanups = [
		group.api.onDidCollapsedChange((e: DockviewGroupPanelCollapsedChangeEvent) => {
			state.isCollapsed = e.isCollapsed
		}),
		group.api.onDidPeekChange((e: DockviewGroupPanelPeekChangeEvent) => {
			state.isPeeking = e.isPeeking
		}),
		group.api.onDidLocationChange((e: DockviewGroupPanelLocationChangeEvent) => {
			state.location = e.location
		}),
	]
	return {
		element,
		init() {
			cleanup = spawn(() => {
				caught((error: unknown) => {
					console.error('[Dockview] Header action error:', group.id, error)
					mountedCleanup?.()
					mountedCleanup = undefined
					renderPanelError(element, group.id, error)
					onPanelError?.(group.id, error, element)
				})
				mountedCleanup = latch(
					element,
					<Widget group={group} state={state} />,
					extend(scope, { dockviewApi: scope.dockviewApi ?? scope.api })
				)
			})
		},
		dispose() {
			mountedCleanup?.()
			cleanup?.()
			for (const d of stateCleanups) d.dispose()
		},
	}
}

// #endregion

export interface RegularDockviewWidgetProps extends DockviewWidgetProps {
	closeable?: boolean
}

const DefaultTab = (props: RegularDockviewWidgetProps, { panelApi }: Record<string, any>) => {
	if (!('closeable' in props)) props.closeable = true
	return (
		<div class="tab">
			<span class="title" title={props.title}>
				{props.title}
			</span>
			{props.closeable && (
				<button class="close" type="button" aria-label="Close" onClick={() => panelApi.close()}>
					×
				</button>
			)}
		</div>
	)
}

export const Dockview = <
	W extends Record<string, DockviewWidget<any> | DockviewWidgetDefinition> = Record<
		string,
		DockviewWidget<any> | DockviewWidgetDefinition
	>,
>(
	props: {
		api?: DockviewApi
		debug?: boolean | string
		onReady?: (api: DockviewApi, handle?: DockviewHandle<W>) => void
		onPanelError?: PanelErrorHandler
		widgets?: W
		tabs?: Record<string, DockviewWidget<any>>
		headerLeft?: DockviewHeaderAction
		headerRight?: DockviewHeaderAction
		headerPrefix?: DockviewHeaderAction
		/**
		 * Empty-state overlay, rendered when the dock has no panels.
		 * Receives `{ openPanel }` — plain widget, no dockview factory involved.
		 */
		watermark?: DockviewWatermark
		el?: JSX.GlobalHTMLAttributes
		options?: DockviewOptions
		themeSync?:
			| boolean
			| {
					light?: DockviewTheme
					dark?: DockviewTheme
			  }
		layout?: SerializedDockview
		handle?: DockviewHandle<W>
		active?: DockviewActiveState
		floating?: DockviewFloatingState
		popout?: DockviewPopoutState
		/**
		 * Declarative widgets (`<DvWidget>` children) — alternative to the `widgets` prop.
		 * Rendered into the layout's scope so they can register themselves.
		 */
		children?: JSX.Children
	} & DockviewEventProps,
	scope: Record<string, any>
) => {
	const contexts = new Map<string, Record<PropertyKey, any>>()
	const registry = new DockviewWidgetRegistry()
	const counters = new Map<string, number>()
	let dockviewApi: DockviewApi | undefined
	let dockviewHandle: DockviewHandle<W> | undefined
	const display = useDisplayContext(scope as any)
	// Declarative-widget context published to `<DvWidget>` descendants via the
	// scope chain (same idiom as `DisplayProvider`'s `DISPLAY_KEY`). `api` is
	// populated once the layout mounts; the registry functions are stable.
	// Mutating (not extending) is required: children render under `info.env`,
	// which prototypes to this `scope` — a fresh object would never be seen.
	// Guarded like the `scope.dockviewApi` write below.
	const dvContext: DvWidgetLayoutContext = {
		get api() {
			return dockviewApi
		},
		registerWidget: (key: string, def: Record<string, unknown>) => {
			registry.register(key, def as unknown as DockviewWidgetDefinition)
		},
		unregisterWidget: (key: string) => {
			registry.unregister(key)
		},
		kind: 'dockview',
	}
	try {
		if (scope && typeof scope === 'object' && !Object.isFrozen(scope)) {
			;(scope as Record<PropertyKey, unknown>)[DOCKVIEW_CONTEXT_KEY] = dvContext
		}
	} catch (_e) {}

	// Capture layout binding from the raw composite attributes (component body — runs once)
	const attributes = (props as any)[fromAttribute]
	const apiBinding = attributes?.getSingle('api')
	const layoutBinding = attributes?.getSingle('layout')
	const handleBinding = attributes?.getSingle('handle')
	const activeBinding = attributes?.getSingle('active')
	const floatingBinding = attributes?.getSingle('floating')
	const popoutBinding = attributes?.getSingle('popout')

	// Snapshot props in the component body (outside any attend effect)
	// so initDockview reads zero reactive properties.
	// NOTE: `props.widgets` is a reactive proxy — `Object.entries` on it reads
	// `Symbol(keys-of)` + every key inside the render effect (rebuild-fence
	// warnings). Snapshot a plain object once via untracked reads instead.
	const debugLabel = props.debug
	const widgetMap = untracked`Dockview.snapshotWidgets`(() => {
		const snap: Record<string, DockviewWidget<any> | DockviewWidgetDefinition> = {}
		for (const key of Object.keys(props.widgets ?? {})) {
			snap[key] = (props.widgets as Record<string, DockviewWidget<any> | DockviewWidgetDefinition>)[
				key
			]!
		}
		return snap
	})
	const tabMap = untracked`Dockview.snapshotTabs`(() => props.tabs)
	const onReadyCb = props.onReady
	const onPanelErrorCb = props.onPanelError
	const watermarkWidget = props.watermark
	const eventProps = props as DockviewEventProps
	const WatermarkView = watermarkWidget as DockviewWatermark | undefined
	// Reactive mirror of `api.panels.length` — drives the watermark overlay JSX.
	// Written by `refreshCounts` (add/remove/layout events); read in the render
	// below so the overlay appears/disappears without a full remount.
	const panelCountCell = reactive({ count: -1 })
	const setPanelCount = (count: number) => {
		panelCountCell.count = count
	}
	// `dockviewHandle` is assigned during `initDockview` (a `use:` directive,
	// outside the render effect) — a plain `let` would be captured as
	// `undefined` by the JSX closure forever. Mirror it into a reactive cell
	// so the watermark overlay appears once the handle exists.
	const handleCell = reactive<{ current: DockviewHandle<W> | undefined }>({
		current: undefined,
	})

	// Normalize `widgets` entries: plain widget fn → `{ component }`, def passes through.
	// Seeded once here; runtime registration goes through the registry directly.
	for (const [key, entry] of Object.entries(widgetMap)) {
		registry.register(
			key,
			typeof entry === 'function' ? { component: entry as DockviewWidget<any> } : entry
		)
	}

	function nextId(key: string): string {
		const n = (counters.get(key) ?? 0) + 1
		counters.set(key, n)
		return `${key}-${n}`
	}

	function refreshCounts(api: DockviewApi) {
		const floatCount = untracked`Dockview.refreshCounts.floating`(
			() => api.groups.filter((g) => g.api.location.type === 'floating').length
		)
		const popoutCount = untracked`Dockview.refreshCounts.popout`(() => api.getPopouts().length)
		const panelCount = untracked`Dockview.refreshCounts.panels`(() => api.panels.length)
		const floatingState = { count: floatCount, hasFloating: floatCount > 0 }
		const popoutState = { count: popoutCount, hasPopout: popoutCount > 0 }
		if (floatingBinding instanceof ReactiveProp && floatingBinding.set)
			floatingBinding.set(floatingState)
		else props.floating = floatingState
		if (popoutBinding instanceof ReactiveProp && popoutBinding.set) popoutBinding.set(popoutState)
		else props.popout = popoutState
		// Watermark visibility is derived from the panel count, but the overlay
		// lives in the component's own JSX (outside dockview's DOM) — mirror the
		// count into a reactive cell so the JSX re-renders on add/remove.
		setPanelCount(panelCount)
	}

	function writeActive(state: DockviewActiveState) {
		if (activeBinding instanceof ReactiveProp && activeBinding.set) activeBinding.set(state)
		else props.active = state
	}

	function writeHandle(handle: DockviewHandle<W>) {
		handleCell.current = handle
		if (handleBinding instanceof ReactiveProp && handleBinding.set) handleBinding.set(handle)
		else props.handle = handle
	}

	const initDockview = (_target: Node | readonly Node[]) => {
		const element = (Array.isArray(_target) ? _target[0] : _target) as HTMLElement
		if (dockviewApi) return // already initialized
		const hasLayout =
			layoutBinding instanceof ReactiveProp
				? untracked`Dockview.init.hasLayout`(() => layoutBinding.get() !== undefined)
				: props.layout !== undefined
		logDockview(debugLabel, 'init:start', {
			hasLayout,
			widgetNames: Object.keys(widgetMap),
		})
		// spawn will be set once the root() block captures the effect context.
		// createComponent/createTabComponent are called lazily by dockview,
		// always after root() has run, so spawn is guaranteed to be set.
		let spawn: Spawn
		// Layout writer usable before root() bindings exist (openPanel may run first).
		// Assigned inside root() once the real writer (biDi-aware) is known.
		let writeLayoutImpl: ((value: SerializedDockview | undefined) => void) | undefined
		const writeLayoutRef = (value: SerializedDockview | undefined) => {
			if (writeLayoutImpl) writeLayoutImpl(value)
			else if (layoutBinding instanceof ReactiveProp && layoutBinding.set) layoutBinding.set(value)
			else props.layout = value
		}
		const openPanel: DockviewHandle<W>['openPanel'] = (key, opts) => {
			if (!dockviewApi) throw new Error('Dockview: not mounted yet')
			const def = registry.get(key)
			if (!def) throw new Error(`Dockview: unknown widget "${key}"`)
			const title = opts?.title ?? def.title ?? key
			const id = opts?.id ?? nextId(key)
			const { id: _omitId, title: _omitTitle, params, tabComponent, ...rest } = opts ?? {}
			const panel = untracked`Dockview.openPanel.addPanel`(() =>
				dockviewApi!.addPanel({
					...rest,
					id,
					title,
					component: key,
					tabComponent: (tabComponent as string | undefined) ?? key,
					params,
				} as AddPanelOptions)
			)
			// `addPanel` fires no layout event — emit directly so `layout` binding reflects it.
			writeLayoutRef(untracked`Dockview.openPanel.toJSON`(() => dockviewApi!.toJSON()))
			untracked`Dockview.openPanel.refresh`(() => refreshCounts(dockviewApi!))
			// The runtime state carries this widget's params; narrow to the key's type.
			return {
				id,
				panel,
				api: panel.api,
				state: livePanelStates.get(id) as
					| DockviewPanelState<DockviewWidgetParams<W[typeof key]>>
					| undefined,
			}
		}
		const registerWidget = (key: string, def: DockviewWidgetDefinition) => {
			registry.register(key, def)
		}
		const unregisterWidget = (key: string) => {
			registry.unregister(key)
		}
		const float = (
			target: IDockviewPanel | DockviewGroupPanel | string,
			options?: FloatingGroupOptions
		) => {
			if (!dockviewApi) throw new Error('Dockview: not mounted yet')
			const item =
				typeof target === 'string'
					? (dockviewApi.getPanel(target) ?? dockviewApi.groups.find((g) => g.id === target))
					: target
			if (!item) throw new Error(`Dockview: unknown panel or group "${target}"`)
			dockviewApi.addFloatingGroup(item, options)
		}
		const popout = (
			target: IDockviewPanel | DockviewGroupPanel | string,
			options?: DockviewPopoutGroupOptions
		): Promise<boolean> => {
			if (!dockviewApi) throw new Error('Dockview: not mounted yet')
			const item =
				typeof target === 'string'
					? (dockviewApi.getPanel(target) ?? dockviewApi.groups.find((g) => g.id === target))
					: target
			if (!item) throw new Error(`Dockview: unknown panel or group "${target}"`)
			return dockviewApi.addPopoutGroup(item, options)
		}
		const dockAll = () => {
			if (!dockviewApi) throw new Error('Dockview: not mounted yet')
			const grid =
				dockviewApi.groups.find((g) => g.api.location.type === 'grid') ?? dockviewApi.groups[0]
			if (!grid) return
			for (const panel of [...dockviewApi.panels]) {
				if (panel.api.location.type !== 'grid') {
					panel.api.moveTo({ group: grid, position: 'center' })
				}
			}
		}
		try {
			const activeApi = unreactive(
				createDockview(element, {
					createComponent({ id, name }: { id: string; name: string }) {
						logDockview(debugLabel, 'createComponent', {
							id,
							name,
							knownWidgets: Object.keys(widgetMap),
						})
						const def = registry.get(name)
						if (!def) throw new Error(`Widget ${name} not found`)
						const context = reactive({})
						contexts.set(id, context)
						return contentRenderer(
							def.component,
							context,
							() => {
								contexts.delete(id)
							},
							scope,
							spawn,
							onPanelErrorCb
						)
					},
					createTabComponent({ id, name }: { id: string; name: string }) {
						logDockview(debugLabel, 'createTabComponent', {
							id,
							name,
							knownTabs: Object.keys(tabMap ?? {}),
						})
						// Per-widget tab wins; deprecated `tabs` prop overrides; else DefaultTab.
						const widget = registry.get(name)?.tab ?? tabMap?.[name] ?? DefaultTab
						const context = contexts.get(id)
						if (!context) throw new Error(`Context ${id} not found`)
						return tabRenderer(widget, context as DockviewWidgetProps, scope, spawn, onPanelErrorCb)
					},
				})
			)
			dockviewApi = activeApi
		} catch (e) {
			console.error('[Dockview] createDockview CRASHED (sync):', e)
			return
		}
		const api = dockviewApi!
		try {
			if (scope && typeof scope === 'object' && !Object.isFrozen(scope)) {
				scope.dockviewApi = api
				scope.api = api
				logDockview(debugLabel, 'init:scope-api-set')
			}
		} catch (_e) {}
		if (apiBinding instanceof ReactiveProp && apiBinding.set) {
			apiBinding.set(api)
		} else if ('api' in props) {
			props.api = api
		}
		dockviewHandle = { api, openPanel, registerWidget, unregisterWidget, float, popout, dockAll }
		writeHandle(dockviewHandle)
		writeActive({ panel: api.activePanel, group: api.activeGroup })
		untracked`Dockview.init.seedCounts`(() => refreshCounts(api))
		// Set up reactive bindings in root() — detached from the attend:use
		// effect chain so reactive prop reads don't tear down initDockview.
		// Panel renderers use `spawn` to create child effects under this root,
		// so `caught()` error boundaries bubble up through the dockview's tree.
		const stopBindings = root`Dockview.bindings`((): (() => void) => {
			const ctx = effectContext()
			spawn = (fn) => withEffectContext(ctx, () => effect`dockview:spawn`(fn))
			const cleanups: (() => void)[] = []
			const hasControlledLayout =
				layoutBinding instanceof ReactiveProp
					? untracked`Dockview.bindings.hasLayout`(() => layoutBinding.get() !== undefined)
					: props.layout !== undefined
			const readLayout =
				layoutBinding instanceof ReactiveProp
					? () => untracked`Dockview.bindings.readLayout`(() => layoutBinding.get())
					: () => props.layout
			const writeLayout =
				layoutBinding instanceof ReactiveProp && layoutBinding.set
					? (value: SerializedDockview | undefined) => layoutBinding.set?.(value)
					: (value: SerializedDockview | undefined) => {
							props.layout = value
						}
			// `bind:layout` loop-break: the JSON we last emitted to the parent.
			// `fromJSON → onDidLayoutChange → emit` feedback is swallowed when the
			// fresh JSON deep-equals what we last emitted (mirror svelte).
			let lastEmitted: SerializedDockview | undefined
			const emitLayout = (emit: (value: SerializedDockview) => void) => {
				const json = untracked`Dockview.emitLayout.toJSON`(() => api.toJSON())
				if (deepEqual(json, lastEmitted)) return
				lastEmitted = json
				emit(json)
			}
			const receiveLayout = (layout: SerializedDockview | undefined) => {
				logDockview(debugLabel, 'layout:receive', {
					hasLayout: layout !== undefined,
					panelCount: untracked`Dockview.receiveLayout.count`(() => api.panels.length),
				})
				if (layout && untracked`Dockview.receiveLayout.guard`(() => deepEqual(layout, lastEmitted)))
					return
				if (layout) {
					untracked`Dockview.receiveLayout.fromJSON`(() => api.fromJSON(layout))
					lastEmitted = untracked`Dockview.receiveLayout.toJSON`(() => api.toJSON())
				} else {
					logDockview(debugLabel, 'layout:close-all-groups', {
						panelCount: untracked`Dockview.receiveLayout.count`(() => api.panels.length),
					})
					untracked`Dockview.receiveLayout.clear`(() => api.closeAllGroups())
					lastEmitted = undefined
				}
				untracked`Dockview.receiveLayout.refresh`(() => refreshCounts(api))
			}
			if (!hasControlledLayout) {
				logDockview(debugLabel, 'layout:uncontrolled')
			} else if (layoutBinding instanceof ReactiveProp && layoutBinding.set) {
				const provideLayout = biDi(receiveLayout, {
					get: () => layoutBinding.get(),
					set: (value: SerializedDockview | undefined) => layoutBinding.set?.(value),
				})
				writeLayoutImpl = (value) => {
					if (value === undefined) {
						lastEmitted = undefined
						provideLayout(value)
						return
					}
					if (deepEqual(value, lastEmitted)) return
					lastEmitted = value
					provideLayout(value)
				}
				cleanups.push(
					api.onDidLayoutChange(() =>
						untracked`Dockview.onDidLayoutChange.provide`(() => {
							untracked`Dockview.onDidLayoutChange.refresh`(() => refreshCounts(api))
							if (
								untracked`Dockview.onDidLayoutChange.guard`(() =>
									deepEqual(api.toJSON(), lastEmitted)
								)
							)
								return
							logDockview(debugLabel, 'layout:onDidLayoutChange:provide', {
								panelCount: untracked`Dockview.onDidLayoutChange.count`(() => api.panels.length),
							})
							emitLayout(provideLayout)
						})
					).dispose
				)
			} else {
				cleanups.push(
					effect`Dockview.layout.readExternalLayout`(() => {
						const layout = readLayout()
						receiveLayout(layout)
					})
				)
				writeLayoutImpl = (value) => {
					if (value === undefined) {
						lastEmitted = undefined
						writeLayout(value)
						return
					}
					if (deepEqual(value, lastEmitted)) return
					lastEmitted = value
					writeLayout(value)
				}
				cleanups.push(
					api.onDidLayoutChange(() =>
						untracked`Dockview.onDidLayoutChange.write`(() => {
							untracked`Dockview.onDidLayoutChange.refresh`(() => refreshCounts(api))
							if (
								untracked`Dockview.onDidLayoutChange.guard`(() =>
									deepEqual(api.toJSON(), lastEmitted)
								)
							)
								return
							logDockview(debugLabel, 'layout:onDidLayoutChange:write', {
								panelCount: untracked`Dockview.onDidLayoutChange.count`(() => api.panels.length),
							})
							emitLayout(writeLayout)
						})
					).dispose
				)
			}
			cleanups.push(
				api.onDidLayoutFromJSON(() =>
					untracked`Dockview.onDidLayoutFromJSON`(() => {
						lastEmitted = untracked`Dockview.onDidLayoutFromJSON.seed`(() => api.toJSON())
						untracked`Dockview.onDidLayoutFromJSON.refresh`(() => refreshCounts(api))
						eventProps.onDidLayoutFromJSON?.()
					})
				).dispose,
				api.onDidActivePanelChange((event: DockviewActivePanelChangeEvent) =>
					untracked`Dockview.onDidActivePanelChange`(() => {
						writeActive({ panel: event.panel, group: api.activeGroup })
						eventProps.onDidActivePanelChange?.(event)
					})
				).dispose,
				api.onDidActiveGroupChange((group: DockviewGroupPanel | undefined) =>
					untracked`Dockview.onDidActiveGroupChange`(() => {
						writeActive({ panel: api.activePanel, group })
						eventProps.onDidActiveGroupChange?.(group)
					})
				).dispose,
				api.onDidAddPanel((panel: IDockviewPanel) =>
					untracked`Dockview.onDidAddPanel`(() => {
						untracked`Dockview.onDidAddPanel.refresh`(() => refreshCounts(api))
						eventProps.onDidAddPanel?.(panel)
					})
				).dispose,
				api.onDidRemovePanel((panel: IDockviewPanel) =>
					untracked`Dockview.onDidRemovePanel`(() => {
						untracked`Dockview.onDidRemovePanel.refresh`(() => refreshCounts(api))
						eventProps.onDidRemovePanel?.(panel)
					})
				).dispose,
				api.onDidAddGroup((group: DockviewGroupPanel) =>
					untracked`Dockview.onDidAddGroup`(() => {
						untracked`Dockview.onDidAddGroup.refresh`(() => refreshCounts(api))
						eventProps.onDidAddGroup?.(group)
					})
				).dispose,
				api.onDidRemoveGroup((group: DockviewGroupPanel) =>
					untracked`Dockview.onDidRemoveGroup`(() => {
						untracked`Dockview.onDidRemoveGroup.refresh`(() => refreshCounts(api))
						eventProps.onDidRemoveGroup?.(group)
					})
				).dispose,
				api.onDidMovePanel((event: MovePanelEvent) =>
					untracked`Dockview.onDidMovePanel`(() => {
						untracked`Dockview.onDidMovePanel.refresh`(() => refreshCounts(api))
						eventProps.onDidMovePanel?.(event)
					})
				).dispose,
				api.onWillDrop((event: DockviewWillDropEvent) => eventProps.onWillDrop?.(event)).dispose,
				api.onDidDrop((event: DockviewDidDropEvent) => eventProps.onDidDrop?.(event)).dispose,
				api.onWillDragPanel((event: TabDragEvent) => eventProps.onWillDragPanel?.(event)).dispose,
				api.onWillDragGroup((event: GroupDragEvent) => eventProps.onWillDragGroup?.(event)).dispose,
				api.onWillMutateLayout((event: DockviewLayoutMutationEvent) =>
					eventProps.onWillMutateLayout?.(event)
				).dispose,
				api.onDidMutateLayout((event: DockviewLayoutMutationEvent) =>
					eventProps.onDidMutateLayout?.(event)
				).dispose,
				api.onWillShowOverlay((event: DockviewWillShowOverlayLocationEvent) =>
					eventProps.onWillShowOverlay?.(event)
				).dispose,
				api.onUnhandledDragOver((event: DockviewDndOverlayEvent) =>
					eventProps.onUnhandledDragOver?.(event)
				).dispose,
				api.onDidAddPopoutGroup((group: PopoutGroup) =>
					untracked`Dockview.onDidAddPopoutGroup`(() => {
						untracked`Dockview.onDidAddPopoutGroup.refresh`(() => refreshCounts(api))
						eventProps.onDidAddPopoutGroup?.(group)
					})
				).dispose,
				api.onDidRemovePopoutGroup((group: PopoutGroup) =>
					untracked`Dockview.onDidRemovePopoutGroup`(() => {
						untracked`Dockview.onDidRemovePopoutGroup.refresh`(() => refreshCounts(api))
						eventProps.onDidRemovePopoutGroup?.(group)
					})
				).dispose,
				api.onDidPopoutGroupSizeChange((event: PopoutGroupChangeSizeEvent) =>
					eventProps.onDidPopoutGroupSizeChange?.(event)
				).dispose,
				api.onDidPopoutGroupPositionChange((event: PopoutGroupChangePositionEvent) =>
					eventProps.onDidPopoutGroupPositionChange?.(event)
				).dispose,
				api.onDidOpenPopoutWindowFail(() => eventProps.onDidOpenPopoutWindowFail?.()).dispose,
				api.onDidCreateTabGroup((event: DockviewTabGroupChangeEvent) =>
					eventProps.onDidCreateTabGroup?.(event)
				).dispose,
				api.onDidDestroyTabGroup((event: DockviewTabGroupChangeEvent) =>
					eventProps.onDidDestroyTabGroup?.(event)
				).dispose,
				api.onDidAddPanelToTabGroup((event: DockviewTabGroupPanelChangeEvent) =>
					eventProps.onDidAddPanelToTabGroup?.(event)
				).dispose,
				api.onDidRemovePanelFromTabGroup((event: DockviewTabGroupPanelChangeEvent) =>
					eventProps.onDidRemovePanelFromTabGroup?.(event)
				).dispose,
				api.onDidTabGroupChange((event: DockviewTabGroupChangeEvent) =>
					eventProps.onDidTabGroupChange?.(event)
				).dispose,
				api.onDidTabGroupCollapsedChange((event: DockviewTabGroupCollapsedChangeEvent) =>
					eventProps.onDidTabGroupCollapsedChange?.(event)
				).dispose,
				api.onDidPanelPinnedChange((event: DockviewPanelPinnedChangeEvent) =>
					eventProps.onDidPanelPinnedChange?.(event)
				).dispose,
				api.onDidMaximizedGroupChange((event: DockviewMaximizedGroupChangeEvent) =>
					eventProps.onDidMaximizedGroupChange?.(event)
				).dispose,
				api.onDidChangeHistory((event: LayoutHistoryChangeEvent) =>
					eventProps.onDidChangeHistory?.(event)
				).dispose,
				api.onDidSnapFloat((event: SmartGuidesSnapEvent) => eventProps.onDidSnapFloat?.(event))
					.dispose,
				api.onDidSnapTogether((event: SmartGuidesSnapTogetherEvent) =>
					eventProps.onDidSnapTogether?.(event)
				).dispose
			)
			const emptyOptions: Record<string, any> = {}
			cleanups.push(
				effect`Dockview.syncThemeOptions`(() => {
					const themeSync = props.themeSync ?? true
					const mappedTheme =
						display.theme === 'dark'
							? themeSync && typeof themeSync === 'object' && themeSync.dark
								? themeSync.dark
								: themeDracula
							: themeSync && typeof themeSync === 'object' && themeSync.light
								? themeSync.light
								: themeLight
					const optionsSnap = props.options ? { ...props.options } : undefined
					const nextOptions = optionsSnap
						? { ...emptyOptions, ...optionsSnap }
						: { ...emptyOptions }
					if (themeSync !== false) nextOptions.theme = optionsSnap?.theme ?? mappedTheme
					else nextOptions.theme = optionsSnap?.theme
					untracked`Dockview.syncThemeOptions.update`(() => api.updateOptions(nextOptions))
					if (optionsSnap) for (const k of Object.keys(optionsSnap)) emptyOptions[k] = undefined
					emptyOptions.theme = undefined
				})
			)
			cleanups.push(
				effect`dockview:header-actions`(function maintainHeaderActions() {
					const header = untracked`Dockview.headerActions.snap`(() => ({
						headerLeft: props.headerLeft,
						headerRight: props.headerRight,
						headerPrefix: props.headerPrefix,
					}))
					const { headerLeft, headerRight, headerPrefix } = header
					untracked`Dockview.headerActions.update`(() =>
						api.updateOptions({
							createLeftHeaderActionComponent:
								headerLeft &&
								((group: DockviewGroupPanel) => {
									return headerActionRenderer(headerLeft, group, scope, spawn, onPanelErrorCb)
								}),
							createRightHeaderActionComponent:
								headerRight &&
								((group: DockviewGroupPanel) => {
									return headerActionRenderer(headerRight, group, scope, spawn, onPanelErrorCb)
								}),
							createPrefixHeaderActionComponent:
								headerPrefix &&
								((group: DockviewGroupPanel) => {
									return headerActionRenderer(headerPrefix, group, scope, spawn, onPanelErrorCb)
								}),
						})
					)
				})
			)
			return () => {
				for (const c of cleanups) c()
			}
		})
		try {
			root`Dockview.onReady`(() => onReadyCb?.(api, dockviewHandle))
		} catch (e) {
			console.error('[Dockview] onReady error:', e)
		}
		return () => {
			logDockview(debugLabel, 'dispose', {
				panelCount: api.panels.length,
			})
			stopBindings?.()
			api.dispose()
			if (apiBinding instanceof ReactiveProp && apiBinding.set) {
				apiBinding.set(undefined)
			} else if ('api' in props) {
				props.api = undefined
			}
			if (handleBinding instanceof ReactiveProp && handleBinding.set) {
				handleBinding.set(undefined)
			} else if ('handle' in props) {
				props.handle = undefined
			}
			handleCell.current = undefined
			dockviewApi = undefined
			dockviewHandle = undefined
		}
	}

	return (
		<div style="position: relative; width: 100%; height: 100%;">
			<div
				{...(props.el || {})}
				class="sursaut-dockview"
				data-testid="dockview-theme-container"
				use={initDockview}
			>
				{props.children}
			</div>
			{WatermarkView && handleCell.current && panelCountCell.count === 0 ? (
				<div class="sursaut-dv-watermark">
					<WatermarkView openPanel={handleCell.current.openPanel} />
				</div>
			) : null}
		</div>
	)
}

export const dockviewInternals = {
	contentRenderer,
	tabRenderer,
	headerActionRenderer,
	getState: (id: string): DockviewPanelState | undefined => livePanelStates.get(id),
}

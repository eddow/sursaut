import { extend, fromAttribute, latch, ReactiveProp } from '@sursaut/core'
import { componentStyle } from '@sursaut/kit'
import {
	type ActiveEvent,
	type AddPaneviewComponentOptions,
	type CreateComponentOptions,
	createPaneview,
	type ExpansionEvent,
	type FocusEvent,
	type IPanePart,
	type IPaneviewPanel,
	type PanelDimensionChangeEvent,
	type PanelUpdateEvent,
	type PanePanelComponentInitParameter,
	type PaneviewApi,
	type PaneviewComponentOptions,
	type PaneviewDidDropEvent,
	type PaneviewDndOverlayEvent,
	type PaneviewPanelApi,
	type Parameters,
	type SerializedPaneview,
	type VisibilityEvent,
} from 'dockview'
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
import type { PanelErrorHandler } from './dockview'
import {
	cloneParams,
	DOCKVIEW_CONTEXT_KEY,
	type DvWidgetLayoutContext,
	deepEqual,
	mergeInto,
} from './dockview-utils'
import {
	definePaneviewWidgets,
	type PaneviewWidgetDefinition,
	PaneviewWidgetRegistry,
	type PaneviewWidgets,
} from './paneview-registry'

export { definePaneviewWidgets, PaneviewWidgetRegistry }
export type { PaneviewWidgetDefinition, PaneviewWidgets }

componentStyle.sass`
.sursaut-paneview
	width: 100%
	height: 100%
	position: relative

.sursaut-dv-item
	width: 100%
	height: 100%

	&.paneview-body
		overflow: auto

	&.paneview-header
		display: flex
		align-items: center
		overflow: hidden
`

/**
 * Reactive state shared by a paneview pane's body and header. Same shape as
 * `SplitviewPanelState` plus the pane-specific `title` (owned by dockview at
 * open time, mirrored read-only) and `expanded` (two-way via `setExpanded`).
 * (mirrors svelte `PaneviewState`).
 */
export interface PaneviewPanelState<Params extends Record<string, any> = Record<string, any>> {
	params: Params
	size: { width: number; height: number }
	visible: boolean
	active: boolean
	focused: boolean
	expanded: boolean
	api: PaneviewPanelApi
	title: string
	custom: Record<string, unknown>
}

export interface PaneviewWidgetScope extends Record<PropertyKey, unknown> {
	paneviewApi?: PaneviewApi
	panelApi?: PaneviewPanelApi
}

export type PaneviewWidgetProps<Params extends Record<string, any> = Record<string, any>> = {
	state: PaneviewPanelState<Params>
}

export type PaneviewWidget<Params extends Record<string, any> = Record<string, any>> = (
	props: PaneviewWidgetProps<Params>,
	scope: PaneviewWidgetScope
) => JSX.Element

/** A handle returned by a paneview `openPanel`, bundling the pane and its state. */
export interface PaneviewPanelHandle<Params extends Record<string, any> = Record<string, any>> {
	id: string
	/** Raw dockview paneview panel. */
	panel: IPaneviewPanel
	/** Convenience alias of `panel.api`. */
	api: PaneviewPanelApi
	/** Reactive state shared by header + body. */
	state: PaneviewPanelState<Params> | undefined
}

/** Options accepted by a paneview `openPanel`. Owns `id`/`title`/`params`, passes the rest through. */
export type PaneviewOpenPanelOptions<Params extends Record<string, any> = Record<string, any>> = {
	id?: string
	title?: string
	params?: Params
} & Omit<AddPaneviewComponentOptions, 'id' | 'component' | 'headerComponent' | 'title' | 'params'>

/**
 * Ergonomic surface bound via the `handle` prop (svelte `bind:handle` equivalent).
 */
export interface PaneviewHandle {
	/** The raw paneview api — full escape hatch. */
	api: PaneviewApi
	/** Open a pane by widget key with an optional title/params/position. */
	openPanel: (key: string, options?: PaneviewOpenPanelOptions) => PaneviewPanelHandle
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: PaneviewWidgetDefinition) => void
	/** Remove a widget definition. */
	unregisterWidget: (key: string) => void
	/** Remove a pane by id. */
	removePanel: (id: string) => void
	/** Move a pane from one index to another. */
	movePanel: (from: number, to: number) => void
	/** Show or hide a pane by id. */
	setVisible: (id: string, visible: boolean) => void
	/** Expand or collapse a pane by id. */
	setExpanded: (id: string, expanded: boolean) => void
}

/** Paneview events forwarded as component props (mirror svelte `Paneview.svelte`). */
export interface PaneviewEventProps {
	onDidLayoutChange?: () => void
	onDidLayoutFromJSON?: () => void
	onDidAddView?: (panel: IPaneviewPanel) => void
	onDidRemoveView?: (panel: IPaneviewPanel) => void
	onDidDrop?: (event: PaneviewDidDropEvent) => void
	onUnhandledDragOver?: (event: PaneviewDndOverlayEvent) => void
}

type Spawn = (fn: () => void) => ScopedCallback

type Disposable = { dispose(): void } | ScopedCallback

/** The renderer factories returned by {@link createPaneviewFactory}. */
export interface PaneviewFactory {
	createComponent: (options: CreateComponentOptions) => IPanePart
	createHeaderComponent: (options: CreateComponentOptions) => IPanePart | undefined
	/** Access a pane's shared state by id (used by `openPanel` to build the handle). */
	getState: (id: string) => PaneviewPanelState | undefined
	/** @internal — bound by the component once its effect root exists. */
	_setSpawn: (spawn: Spawn) => void
}

function renderPanelError(element: HTMLElement, panelId: string, error: unknown) {
	element.innerHTML = ''
	const msg = document.createElement('div')
	msg.style.cssText = 'color:#e55;padding:8px;font-size:12px;white-space:pre-wrap'
	msg.textContent = `⚠ Panel error (${panelId}): ${error instanceof Error ? error.message : String(error)}`
	element.appendChild(msg)
}

// Test-visible registry of live pane states (body part owns each entry).
const livePaneviewStates = new Map<string, PaneviewPanelState>()

/**
 * One entry per pane id. Body and header are separate `IPanePart`s, each with
 * its own `dispose()`; the entry tracks both so the last one out can release
 * `state` — the same idiom as the Dockview content/tab pair.
 */
interface PaneviewPanelEntry {
	state: PaneviewPanelState
	bodyDisposed: boolean
	headerDisposed: boolean
}

/** Create a reactive paneview state (mirrors svelte `createPaneviewState`). */
export function createPaneviewState(
	api: PaneviewPanelApi,
	params: Parameters,
	title: string
): PaneviewPanelState {
	return reactive({
		params: reactive(params ?? {}),
		size: { width: 0, height: 0 },
		visible: api.isVisible,
		active: api.isActive,
		focused: api.isFocused,
		expanded: api.isExpanded,
		api: unreactive(api),
		title,
		custom: reactive({}),
	}) as PaneviewPanelState
}

/** Shared mount helper: one `IPanePart` (body or header) bound to the shared state. */
function createPanePart(
	widget: PaneviewWidget,
	scope: Record<string, any>,
	spawn: Spawn,
	onPanelError: PanelErrorHandler | undefined,
	getOrCreateState: (
		api: PaneviewPanelApi,
		params: Parameters,
		title: string,
		hasHeader: boolean
	) => PaneviewPanelEntry,
	releaseEntry: (id: string, side: 'body' | 'header') => void,
	side: 'body' | 'header',
	hasHeader: boolean
): IPanePart {
	const element = document.createElement('div')
	element.classList.add('sursaut-dv-item', side === 'body' ? 'paneview-body' : 'paneview-header')

	let entry: PaneviewPanelEntry | undefined
	let state: PaneviewPanelState | undefined
	let raf = 0
	const disposables: Disposable[] = []
	let cleanup: ScopedCallback | undefined
	let mountedCleanup: ScopedCallback | undefined
	let lastParams: unknown
	let lastActive = false
	let lastVisible = true
	let lastExpanded = false

	return {
		element,

		init(parameters: PanePanelComponentInitParameter): void {
			entry = getOrCreateState(parameters.api, parameters.params, parameters.title, hasHeader)
			state = entry.state
			const current = state
			livePaneviewStates.set(parameters.api.id, current)

			lastParams = untracked`paneview.init.params`(() => cloneParams(current.params))
			lastActive = current.active
			lastVisible = current.visible
			lastExpanded = current.expanded

			// The body owns the api mirrors + widget→dockview effects; the header
			// only mounts against the same state (it must not double-subscribe).
			if (side === 'body') {
				disposables.push(
					parameters.api.onDidActiveChange((event: ActiveEvent) => {
						current.active = event.isActive
						lastActive = event.isActive
					}),
					parameters.api.onDidFocusChange((event: FocusEvent) => {
						current.focused = event.isFocused
					}),
					parameters.api.onDidVisibilityChange((event: VisibilityEvent) => {
						current.visible = event.isVisible
						lastVisible = event.isVisible
					}),
					parameters.api.onDidDimensionsChange((event: PanelDimensionChangeEvent) => {
						cancelAnimationFrame(raf)
						raf = requestAnimationFrame(() => {
							current.size.width = event.width
							current.size.height = event.height
						})
					}),
					parameters.api.onDidExpansionChange((event: ExpansionEvent) => {
						current.expanded = event.isExpanded
						lastExpanded = event.isExpanded
					})
				)

				// Widget → dockview (params double-bind, activation, expand toggle).
				cleanup = spawn(() => {
					disposables.push(
						effect`paneview.updateParameters`(() => {
							// Tracked read (not `untracked`) so the effect re-runs on
							// widget-side param writes; `cloneParams` snapshots for comparison.
							const snap = cloneParams(current.params)
							if (deepEqual(snap, lastParams)) return
							lastParams = snap
							current.api.updateParameters(snap)
						}),
						effect`paneview.activate`(() => {
							// Only activation is meaningful from the widget side.
							if (current.active && !lastActive) current.api.setActive()
						}),
						effect`paneview.visible`(() => {
							if (current.visible !== lastVisible) {
								lastVisible = current.visible
								current.api.setVisible(current.visible)
							}
						}),
						effect`paneview.expanded`(() => {
							if (current.expanded !== lastExpanded) {
								lastExpanded = current.expanded
								current.api.setExpanded(current.expanded)
							}
						})
					)
					caught((error: unknown) => {
						console.error('[Paneview] Panel error:', parameters.api.id, error)
						mountedCleanup?.()
						mountedCleanup = undefined
						renderPanelError(element, parameters.api.id, error)
						onPanelError?.(parameters.api.id, error, element)
					})
					mountedCleanup = latch(
						element,
						widget(
							{ state: current },
							extend(scope, {
								paneviewApi: scope.paneviewApi ?? scope.api,
								panelApi: unreactive(parameters.api),
							})
						)
					)
				})
			} else {
				cleanup = spawn(() => {
					caught((error: unknown) => {
						console.error('[Paneview] Header error:', parameters.api.id, error)
						mountedCleanup?.()
						mountedCleanup = undefined
						renderPanelError(element, parameters.api.id, error)
						onPanelError?.(parameters.api.id, error, element)
					})
					mountedCleanup = latch(
						element,
						widget(
							{ state: current },
							extend(scope, {
								paneviewApi: scope.paneviewApi ?? scope.api,
								panelApi: unreactive(parameters.api),
							})
						)
					)
				})
			}
		},

		update(event: PanelUpdateEvent): void {
			// dockview → widget (body owns the merge; header shares the state).
			if (side !== 'body' || !state) return
			mergeInto(state.params as Record<string, unknown>, event.params as Record<string, unknown>)
			lastParams = untracked`paneview.update.params`(() => cloneParams(state!.params))
		},

		dispose(): void {
			cancelAnimationFrame(raf)
			mountedCleanup?.()
			mountedCleanup = undefined
			cleanup?.()
			cleanup = undefined
			for (const disposable of disposables) {
				if (typeof disposable === 'function') disposable()
				else disposable.dispose()
			}
			disposables.length = 0
			if (entry) {
				// Entries are keyed by `api.id` — read it back from the shared state.
				releaseEntry(entry.state.api.id, side)
				entry = undefined
			}
		},
	}
}

/**
 * Creates the paneview body/header renderer factories backed by a shared widget registry
 * (mirrors svelte `createPaneviewFactory`).
 *
 * dockview calls `createComponent({ id, name })` for the pane body and
 * `createHeaderComponent({ id, name })` for the pane header, where `name` is
 * the `component` / `headerComponent` string passed to `addPanel`. The body
 * owns the {@link PaneviewPanelState}; the header only mounts its component
 * against the same state object.
 *
 * When a widget defines no `header`, `createHeaderComponent` returns
 * `undefined` so dockview falls back to its built-in `DefaultHeader` (plain
 * title text) — the same fallback as the Dockview `tab`.
 */
export function createPaneviewFactory(
	registry: PaneviewWidgetRegistry,
	scope?: Record<string, any>,
	onPanelError?: PanelErrorHandler
): PaneviewFactory {
	const panes = new Map<string, PaneviewPanelEntry>()

	function getOrCreateState(
		api: PaneviewPanelApi,
		params: Parameters,
		title: string,
		hasHeader: boolean
	): PaneviewPanelEntry {
		let entry = panes.get(api.id)
		if (!entry) {
			entry = {
				state: createPaneviewState(api, params, title),
				bodyDisposed: false,
				// A headerless pane never calls `releaseEntry(id, 'header')`, so
				// pre-mark that side disposed to avoid leaking the entry forever.
				headerDisposed: !hasHeader,
			}
			panes.set(api.id, entry)
		}
		return entry
	}

	function releaseEntry(id: string, side: 'body' | 'header'): void {
		const entry = panes.get(id)
		if (!entry) return
		if (side === 'body') entry.bodyDisposed = true
		else entry.headerDisposed = true
		if (entry.bodyDisposed && entry.headerDisposed) {
			panes.delete(id)
			livePaneviewStates.delete(id)
		}
	}

	// `spawn` is assigned once the component's `root()` captures the effect
	// context; `createComponent` runs lazily after that, so it is set.
	let spawnRef: Spawn = () => () => {}
	const factorySpawn: Spawn = (fn) => spawnRef(fn)

	function createComponent(options: CreateComponentOptions): IPanePart {
		const def = registry.get(options.name)
		if (!def) throw new Error(`Paneview: unknown widget "${options.name}"`)
		return createPanePart(
			def.component,
			scope ?? {},
			factorySpawn,
			onPanelError,
			getOrCreateState,
			releaseEntry,
			'body',
			def.header !== undefined
		)
	}

	function createHeaderComponent(options: CreateComponentOptions): IPanePart | undefined {
		const def = registry.get(options.name)
		if (!def) throw new Error(`Paneview: unknown widget "${options.name}"`)
		if (!def.header) return undefined
		return createPanePart(
			def.header,
			scope ?? {},
			factorySpawn,
			onPanelError,
			getOrCreateState,
			releaseEntry,
			'header',
			true
		)
	}

	return {
		createComponent,
		createHeaderComponent,
		getState: (id: string) => panes.get(id)?.state,
		/** @internal — bound by the component once its effect root exists. */
		_setSpawn: (spawn: Spawn) => {
			spawnRef = spawn
		},
	}
}

export const paneviewInternals = {
	createPaneviewFactory,
	createPaneviewState,
	getState: (id: string): PaneviewPanelState | undefined => livePaneviewStates.get(id),
}

export const Paneview = (
	props: {
		api?: PaneviewApi
		onReady?: (api: PaneviewApi, handle?: PaneviewHandle) => void
		onPanelError?: PanelErrorHandler
		widgets?: Record<string, PaneviewWidget<any> | PaneviewWidgetDefinition>
		el?: JSX.GlobalHTMLAttributes
		options?: Omit<PaneviewComponentOptions, 'createComponent' | 'createHeaderComponent'>
		layout?: SerializedPaneview
		handle?: PaneviewHandle
		panels?: IPaneviewPanel[]
		/**
		 * Declarative widgets (`<DvWidget>` children) — alternative to the `widgets` prop.
		 */
		children?: JSX.Children
	} & PaneviewEventProps,
	scope: Record<string, any>
) => {
	const registry = new PaneviewWidgetRegistry()
	const counters = new Map<string, number>()
	let paneviewApi: PaneviewApi | undefined
	let paneviewHandle: PaneviewHandle | undefined
	// Declarative-widget context (same idiom as Dockview — see dockview.tsx).
	const dvContext: DvWidgetLayoutContext = {
		get api() {
			return paneviewApi
		},
		registerWidget: (key: string, def: Record<string, unknown>) => {
			registry.register(key, def as unknown as PaneviewWidgetDefinition)
		},
		unregisterWidget: (key: string) => {
			registry.unregister(key)
		},
		kind: 'paneview',
	}
	try {
		if (scope && typeof scope === 'object' && !Object.isFrozen(scope)) {
			;(scope as Record<PropertyKey, unknown>)[DOCKVIEW_CONTEXT_KEY] = dvContext
		}
	} catch (_e) {}

	// Capture bindings from the raw composite attributes (component body — runs once)
	const attributes = (props as any)[fromAttribute]
	const apiBinding = attributes?.getSingle('api')
	const layoutBinding = attributes?.getSingle('layout')
	const handleBinding = attributes?.getSingle('handle')
	const panelsBinding = attributes?.getSingle('panels')

	// Snapshot props in the component body (outside any attend effect)
	// so initPaneview reads zero reactive properties.
	// NOTE: `props.widgets` is a reactive proxy — `Object.entries` on it reads
	// `Symbol(keys-of)` + every key inside the render effect (rebuild-fence
	// warnings). Snapshot a plain object once via untracked reads instead.
	const widgetMap = untracked`Paneview.snapshotWidgets`(() => {
		const snap: Record<string, PaneviewWidget<any> | PaneviewWidgetDefinition> = {}
		for (const key of Object.keys(props.widgets ?? {})) {
			snap[key] = (props.widgets as Record<string, PaneviewWidget<any> | PaneviewWidgetDefinition>)[
				key
			]!
		}
		return snap
	})
	const onReadyCb = props.onReady
	const onPanelErrorCb = props.onPanelError
	const eventProps = props as PaneviewEventProps

	// Normalize `widgets` entries: plain widget fn → `{ component }`, def passes through.
	for (const [key, entry] of Object.entries(widgetMap)) {
		registry.register(
			key,
			typeof entry === 'function' ? { component: entry as PaneviewWidget<any> } : entry
		)
	}

	function nextId(key: string): string {
		const n = (counters.get(key) ?? 0) + 1
		counters.set(key, n)
		return `${key}-${n}`
	}

	function refreshPanels(api: PaneviewApi) {
		const panels = untracked`Paneview.refreshPanels.panels`(() => [...api.panels])
		if (panelsBinding instanceof ReactiveProp && panelsBinding.set) panelsBinding.set(panels)
		else props.panels = panels
	}

	function writeHandle(handle: PaneviewHandle) {
		if (handleBinding instanceof ReactiveProp && handleBinding.set) handleBinding.set(handle)
		else props.handle = handle
	}

	const initPaneview = (_target: Node | readonly Node[]) => {
		const element = (Array.isArray(_target) ? _target[0] : _target) as HTMLElement
		if (paneviewApi) return // already initialized
		const hasLayout =
			layoutBinding instanceof ReactiveProp
				? untracked`Paneview.init.hasLayout`(() => layoutBinding.get() !== undefined)
				: props.layout !== undefined
		// spawn will be set once the root() block captures the effect context.
		let spawn: Spawn
		let writeLayoutImpl: ((value: SerializedPaneview | undefined) => void) | undefined
		const writeLayoutRef = (value: SerializedPaneview | undefined) => {
			if (writeLayoutImpl) writeLayoutImpl(value)
			else if (layoutBinding instanceof ReactiveProp && layoutBinding.set) layoutBinding.set(value)
			else props.layout = value
		}
		const emitLayout = (emit: (value: SerializedPaneview) => void) => {
			const json = untracked`Paneview.emitLayout.toJSON`(() => paneviewApi!.toJSON())
			if (deepEqual(json, lastEmitted)) return
			lastEmitted = json
			emit(json)
		}
		const openPanel = (key: string, opts?: PaneviewOpenPanelOptions): PaneviewPanelHandle => {
			if (!paneviewApi) throw new Error('Paneview: not mounted yet')
			const def = registry.get(key)
			if (!def) throw new Error(`Paneview: unknown widget "${key}"`)
			const id = opts?.id ?? nextId(key)
			// Title resolves through the same three-tier chain as Dockview
			// (explicit → per-widget → widget key), evaluated once at open time.
			// `headerComponent` reuses the widget key so `createHeaderComponent`
			// can resolve the header off the same registry entry; omit it when the
			// widget defines no header so dockview falls back to `DefaultHeader`.
			const { id: _omitId, title: _omitTitle, params, ...rest } = opts ?? {}
			const panel = untracked`Paneview.openPanel.addPanel`(() =>
				paneviewApi!.addPanel({
					...rest,
					id,
					component: key,
					headerComponent: def.header ? key : undefined,
					title: opts?.title ?? def.title ?? key,
					params: params ?? {},
				} as AddPaneviewComponentOptions)
			)
			// `addPanel` fires no observed event on the open path itself —
			// refresh the bound panels/layout directly.
			writeLayoutRef(untracked`Paneview.openPanel.toJSON`(() => paneviewApi!.toJSON()))
			untracked`Paneview.openPanel.refresh`(() => refreshPanels(paneviewApi!))
			return { id, panel, api: panel.api, state: livePaneviewStates.get(id) }
		}
		const registerWidget = (key: string, def: PaneviewWidgetDefinition) => {
			registry.register(key, def)
		}
		const unregisterWidget = (key: string) => {
			registry.unregister(key)
		}
		const getPanelOrThrow = (id: string): IPaneviewPanel => {
			const panel = paneviewApi!.getPanel(id)
			if (!panel) throw new Error(`Paneview: unknown panel "${id}"`)
			return panel
		}
		const removePanel = (id: string) => {
			if (!paneviewApi) throw new Error('Paneview: not mounted yet')
			paneviewApi.removePanel(getPanelOrThrow(id))
		}
		const movePanel = (from: number, to: number) => {
			if (!paneviewApi) throw new Error('Paneview: not mounted yet')
			paneviewApi.movePanel(from, to)
		}
		const setVisible = (id: string, visible: boolean) => {
			if (!paneviewApi) throw new Error('Paneview: not mounted yet')
			getPanelOrThrow(id).api.setVisible(visible)
		}
		const setExpanded = (id: string, expanded: boolean) => {
			if (!paneviewApi) throw new Error('Paneview: not mounted yet')
			getPanelOrThrow(id).setExpanded(expanded)
		}
		// `bind:layout` loop-break: the JSON we last emitted to the parent.
		let lastEmitted: SerializedPaneview | undefined
		const receiveLayout = (layout: SerializedPaneview | undefined) => {
			if (layout && deepEqual(layout, lastEmitted)) return
			if (layout) {
				untracked`Paneview.receiveLayout.fromJSON`(() => paneviewApi!.fromJSON(layout))
				lastEmitted = untracked`Paneview.receiveLayout.toJSON`(() => paneviewApi!.toJSON())
			} else {
				untracked`Paneview.receiveLayout.clear`(() => paneviewApi!.clear())
				lastEmitted = undefined
			}
			untracked`Paneview.receiveLayout.refresh`(() => refreshPanels(paneviewApi!))
		}
		let factory: PaneviewFactory | undefined
		try {
			factory = createPaneviewFactory(registry, scope, onPanelErrorCb)
			const activeApi = unreactive(
				createPaneview(element, {
					...untracked`Paneview.init.options`(() => ({ ...(props.options ?? {}) })),
					createComponent: factory.createComponent,
					createHeaderComponent: factory.createHeaderComponent,
				})
			)
			paneviewApi = activeApi
		} catch (e) {
			console.error('[Paneview] createPaneview CRASHED (sync):', e)
			return
		}
		const api = paneviewApi!
		try {
			if (scope && typeof scope === 'object' && !Object.isFrozen(scope)) {
				scope.paneviewApi = api
				scope.api = api
			}
		} catch (_e) {}
		if (apiBinding instanceof ReactiveProp && apiBinding.set) {
			apiBinding.set(api)
		} else if ('api' in props) {
			props.api = api
		}
		paneviewHandle = {
			api,
			openPanel,
			registerWidget,
			unregisterWidget,
			removePanel,
			movePanel,
			setVisible,
			setExpanded,
		}
		writeHandle(paneviewHandle)
		untracked`Paneview.init.seedPanels`(() => refreshPanels(api))
		const stopBindings = root`Paneview.bindings`((): (() => void) => {
			const ctx = effectContext()
			spawn = (fn) => withEffectContext(ctx, () => effect`paneview:spawn`(fn))
			factory?._setSpawn(spawn)
			const cleanups: (() => void)[] = []
			const hasControlledLayout =
				layoutBinding instanceof ReactiveProp
					? untracked`Paneview.bindings.hasLayout`(() => layoutBinding.get() !== undefined)
					: props.layout !== undefined
			const readLayout =
				layoutBinding instanceof ReactiveProp
					? () => untracked`Paneview.bindings.readLayout`(() => layoutBinding.get())
					: () => props.layout
			const writeLayout =
				layoutBinding instanceof ReactiveProp && layoutBinding.set
					? (value: SerializedPaneview | undefined) => layoutBinding.set?.(value)
					: (value: SerializedPaneview | undefined) => {
							props.layout = value
						}
			const provideLayout =
				layoutBinding instanceof ReactiveProp && layoutBinding.set
					? biDi(receiveLayout, {
							get: () => layoutBinding.get(),
							set: (value: SerializedPaneview | undefined) => layoutBinding.set?.(value),
						})
					: undefined
			if (hasControlledLayout) {
				if (provideLayout) {
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
						api.onDidLayoutChange(() => {
							untracked`Paneview.onDidLayoutChange.refresh`(() => refreshPanels(api))
							if (
								untracked`Paneview.onDidLayoutChange.guard`(() =>
									deepEqual(api.toJSON(), lastEmitted)
								)
							)
								return
							emitLayout(provideLayout)
						}).dispose
					)
				} else {
					cleanups.push(
						effect`Paneview.layout.readExternalLayout`(() => {
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
						api.onDidLayoutChange(() => {
							untracked`Paneview.onDidLayoutChange.refresh`(() => refreshPanels(api))
							if (
								untracked`Paneview.onDidLayoutChange.guard`(() =>
									deepEqual(api.toJSON(), lastEmitted)
								)
							)
								return
							emitLayout(writeLayout)
						}).dispose
					)
				}
			} else {
				cleanups.push(
					api.onDidLayoutChange(() => {
						untracked`Paneview.onDidLayoutChange.refresh`(() => refreshPanels(api))
						eventProps.onDidLayoutChange?.()
					}).dispose
				)
			}
			// Apply a pre-existing `layout` before exposing the api.
			if (hasControlledLayout) {
				const initial = readLayout()
				if (initial) {
					untracked`Paneview.bindings.applyInitial`(() => api.fromJSON(initial))
					lastEmitted = untracked`Paneview.bindings.seedInitial`(() => api.toJSON())
					writeLayoutImpl?.(lastEmitted)
				}
			}
			untracked`Paneview.bindings.seedPanels`(() => refreshPanels(api))
			cleanups.push(
				api.onDidLayoutFromJSON(() => {
					lastEmitted = untracked`Paneview.onDidLayoutFromJSON.seed`(() => api.toJSON())
					untracked`Paneview.onDidLayoutFromJSON.refresh`(() => refreshPanels(api))
					eventProps.onDidLayoutFromJSON?.()
				}).dispose,
				api.onDidAddView((panel: IPaneviewPanel) => {
					untracked`Paneview.onDidAddView.refresh`(() => refreshPanels(api))
					eventProps.onDidAddView?.(panel)
				}).dispose,
				api.onDidRemoveView((panel: IPaneviewPanel) => {
					untracked`Paneview.onDidRemoveView.refresh`(() => refreshPanels(api))
					eventProps.onDidRemoveView?.(panel)
				}).dispose,
				api.onDidDrop((event: PaneviewDidDropEvent) => {
					eventProps.onDidDrop?.(event)
				}).dispose,
				api.onUnhandledDragOver((event: PaneviewDndOverlayEvent) => {
					eventProps.onUnhandledDragOver?.(event)
				}).dispose
			)
			cleanups.push(
				effect`Paneview.options`(() => {
					const opts = props.options
					if (!opts) return
					const {
						createComponent: _omit,
						createHeaderComponent: _omitHeader,
						...rest
					} = opts as PaneviewComponentOptions
					untracked`Paneview.options.update`(() => api.updateOptions(rest))
				})
			)
			return () => {
				for (const c of cleanups) c()
			}
		})
		try {
			root`Paneview.onReady`(() => onReadyCb?.(api, paneviewHandle))
		} catch (e) {
			console.error('[Paneview] onReady error:', e)
		}
		return () => {
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
			paneviewApi = undefined
			paneviewHandle = undefined
		}
	}

	return (
		<div
			{...(props.el || {})}
			class="sursaut-paneview"
			data-testid="paneview-container"
			use={initPaneview}
		>
			{props.children}
		</div>
	)
}

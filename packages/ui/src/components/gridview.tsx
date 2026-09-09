import { extend, fromAttribute, latch, ReactiveProp } from '@sursaut/core'
import { componentStyle } from '@sursaut/kit'
import {
	type ActiveEvent,
	type AddGridviewComponentOptions,
	type CreateComponentOptions,
	createGridview,
	type Direction,
	type FocusEvent,
	type GridviewApi,
	type GridviewComponentOptions,
	type GridviewInitParameters,
	GridviewPanel,
	type GridviewPanelApi,
	type IFrameworkPart,
	type IGridviewPanel,
	Orientation,
	type PanelDimensionChangeEvent,
	type PanelUpdateEvent,
	type Parameters,
	type SerializedGridviewComponent,
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
	defineGridviewWidgets,
	type GridviewWidgetDefinition,
	GridviewWidgetRegistry,
	type GridviewWidgets,
} from './gridview-registry'

export { defineGridviewWidgets, GridviewWidgetRegistry }
export type { GridviewWidgetDefinition, GridviewWidgets }

componentStyle.sass`
.sursaut-gridview
	width: 100%
	height: 100%
	position: relative

.sursaut-dv-item
	width: 100%
	height: 100%

	&.gridview-cell
		overflow: auto
`

/**
 * Reactive state shared by a gridview cell. Same shape as
 * `SplitviewPanelState` — grid cells have no headers or tabs
 * (mirrors svelte `GridviewState`).
 */
export interface GridviewPanelState<Params extends Record<string, any> = Record<string, any>> {
	params: Params
	size: { width: number; height: number }
	visible: boolean
	active: boolean
	focused: boolean
	api: GridviewPanelApi
	custom: Record<string, unknown>
}

export interface GridviewWidgetScope extends Record<PropertyKey, unknown> {
	gridviewApi?: GridviewApi
	panelApi?: GridviewPanelApi
}

export type GridviewWidgetProps<Params extends Record<string, any> = Record<string, any>> = {
	state: GridviewPanelState<Params>
}

export type GridviewWidget<Params extends Record<string, any> = Record<string, any>> = (
	props: GridviewWidgetProps<Params>,
	scope: GridviewWidgetScope
) => JSX.Element

/** A handle returned by a gridview `openPanel`, bundling the cell and its state. */
export interface GridviewPanelHandle<Params extends Record<string, any> = Record<string, any>> {
	id: string
	/** Raw dockview gridview panel. */
	panel: IGridviewPanel
	/** Convenience alias of `panel.api`. */
	api: GridviewPanelApi
	/** Reactive state (undefined until the renderer mounts). */
	state: GridviewPanelState<Params> | undefined
}

/** Options accepted by a gridview `openPanel`. Owns `id`/`params`, passes the rest through. */
export type GridviewOpenPanelOptions<Params extends Record<string, any> = Record<string, any>> = {
	id?: string
	params?: Params
} & Omit<AddGridviewComponentOptions, 'id' | 'component' | 'params'>

/** Options for `handle.movePanel`: a direction relative to a reference panel id. */
export interface GridviewMoveOptions {
	/** `'left' | 'right' | 'above' | 'below' | 'within'` — relative to `reference`. */
	direction: Direction
	/** Id of the panel to position relative to. */
	reference: string
	/** Optional size of the moved panel. */
	size?: number
}

/**
 * Ergonomic surface bound via the `handle` prop (svelte `bind:handle` equivalent).
 */
export interface GridviewHandle {
	/** The raw gridview api — full escape hatch. */
	api: GridviewApi
	/** Open a grid cell by widget key with an optional params/position. */
	openPanel: (key: string, options?: GridviewOpenPanelOptions) => GridviewPanelHandle
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: GridviewWidgetDefinition) => void
	/** Remove a widget definition. */
	unregisterWidget: (key: string) => void
	/** Remove a grid cell by id. */
	removePanel: (id: string) => void
	/** Move a cell relative to a reference panel. */
	movePanel: (id: string, move: GridviewMoveOptions) => void
	/** Show or hide a grid cell by id. */
	setVisible: (id: string, visible: boolean) => void
	/** Activate a grid cell by id. */
	setActive: (id: string) => void
}

/** Gridview events forwarded as component props (mirror svelte `Gridview.svelte`). */
export interface GridviewEventProps {
	onDidLayoutChange?: () => void
	onDidLayoutFromJSON?: () => void
	onDidAddPanel?: (panel: IGridviewPanel) => void
	onDidRemovePanel?: (panel: IGridviewPanel) => void
	onDidActivePanelChange?: (panel: IGridviewPanel | undefined) => void
}

type Spawn = (fn: () => void) => ScopedCallback

type Disposable = { dispose(): void } | ScopedCallback

/** The renderer factory returned by {@link createGridviewFactory}. */
export interface GridviewFactory {
	createComponent: (options: CreateComponentOptions) => GridviewPanel
	/** Access a cell's state by id (used by `openPanel` to build the handle). */
	getState: (id: string) => GridviewPanelState | undefined
	/** Fired when a cell's `api.onDidActiveChange` reports `isActive: true`. */
	onDidActivePanelChange: (panel: GridviewPanel) => void
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

// Test-visible registry of live cell states (renderer owns each entry).
const liveGridviewStates = new Map<string, GridviewPanelState>()

/** Per-cell dependencies captured by {@link SursautGridviewPanel} at construction. */
interface GridviewPanelDeps {
	widget: GridviewWidget
	scope: Record<string, any>
	spawn: Spawn
	onPanelError?: PanelErrorHandler
	getOrCreateState: (api: GridviewPanelApi, params: Parameters) => GridviewPanelEntry
	releaseState: (id: string) => void
	notifyActive: (panel: GridviewPanel) => void
}

/** One entry per cell id — gridview has a single renderer per cell (no tab). */
interface GridviewPanelEntry {
	state: GridviewPanelState
	disposed: boolean
}

/** Create a reactive gridview state (mirrors svelte `createGridviewState`). */
export function createGridviewState(api: GridviewPanelApi, params: Parameters): GridviewPanelState {
	return reactive({
		params: reactive(params ?? {}),
		size: { width: 0, height: 0 },
		visible: api.isVisible,
		active: api.isActive,
		focused: api.isFocused,
		api: unreactive(api),
		custom: reactive({}),
	}) as GridviewPanelState
}

/**
 * A gridview cell that mounts a sursaut widget into `this.element` and wires
 * the reactive {@link GridviewPanelState} (mirrors svelte `SvelteGridviewPanel`).
 *
 * `getComponent().update` is a no-op: params flow through the `update(event)`
 * override instead — a single, well-typed path.
 */
class SursautGridviewPanel extends GridviewPanel {
	private readonly deps: GridviewPanelDeps
	private entry: GridviewPanelEntry | undefined
	private state: GridviewPanelState | undefined
	private disposables: Disposable[] = []
	private cleanup: ScopedCallback | undefined
	private mountedCleanup: ScopedCallback | undefined
	private lastParams: unknown
	private lastActive = false
	private lastVisible = true

	constructor(id: string, component: string, deps: GridviewPanelDeps) {
		super(id, component)
		this.deps = deps
	}

	override init(parameters: GridviewInitParameters): void {
		super.init(parameters)
		const { widget, scope, spawn, onPanelError, getOrCreateState } = this.deps
		const entry = getOrCreateState(this.api, parameters.params)
		this.entry = entry
		this.state = entry.state
		const state = entry.state
		liveGridviewStates.set(this.api.id, state)

		this.lastParams = untracked`gridview.init.params`(() => cloneParams(state.params))
		this.lastActive = state.active
		this.lastVisible = state.visible

		this.disposables.push(
			this.api.onDidActiveChange((event: ActiveEvent) => {
				state.active = event.isActive
				this.lastActive = event.isActive
				// Activation lands here on the newly-active cell — the component
				// derives `bind:activePanel` from it. Deactivation is ignored;
				// the incoming cell's `true` wins without ordering hazards.
				if (event.isActive) this.deps.notifyActive(this)
			}),
			this.api.onDidFocusChange((event: FocusEvent) => {
				state.focused = event.isFocused
			}),
			this.api.onDidVisibilityChange((event: VisibilityEvent) => {
				state.visible = event.isVisible
				this.lastVisible = event.isVisible
			}),
			this.api.onDidDimensionsChange((event: PanelDimensionChangeEvent) => {
				// rAF-throttled — `onDidDimensionsChange` fires per-pixel on sash drags.
				cancelAnimationFrame(this.raf)
				this.raf = requestAnimationFrame(() => {
					state.size.width = event.width
					state.size.height = event.height
				})
			})
		)

		// Widget → dockview (params double-bind, activation, visibility).
		this.cleanup = spawn(() => {
			this.disposables.push(
				effect`gridview.updateParameters`(() => {
					// Tracked read (not `untracked`) so the effect re-runs on widget-side
					// param writes; `cloneParams` produces a plain snapshot for comparison.
					const snap = cloneParams(state.params)
					if (deepEqual(snap, this.lastParams)) return
					this.lastParams = snap
					state.api.updateParameters(snap)
				}),
				effect`gridview.activate`(() => {
					// Only activation is meaningful from the widget side.
					if (state.active && !this.lastActive) state.api.setActive()
				}),
				effect`gridview.visible`(() => {
					if (state.visible !== this.lastVisible) {
						this.lastVisible = state.visible
						state.api.setVisible(state.visible)
					}
				})
			)
			caught((error: unknown) => {
				console.error('[Gridview] Panel error:', this.api.id, error)
				this.mountedCleanup?.()
				this.mountedCleanup = undefined
				renderPanelError(this.element, this.api.id, error)
				onPanelError?.(this.api.id, error, this.element)
			})
			this.mountedCleanup = latch(
				this.element,
				widget(
					{ state },
					extend(scope, {
						gridviewApi: scope.gridviewApi ?? scope.api,
						panelApi: unreactive(this.api),
					})
				)
			)
		})
	}

	private raf = 0

	override update(event: PanelUpdateEvent): void {
		super.update(event)
		if (!this.state) return
		mergeInto(this.state.params as Record<string, unknown>, event.params as Record<string, unknown>)
		this.lastParams = untracked`gridview.update.params`(() => cloneParams(this.state!.params))
	}

	override getComponent(): IFrameworkPart {
		return {
			update: (): void => {
				// Params flow through `update(event)` above, not here (see class doc).
			},
			dispose: (): void => {
				cancelAnimationFrame(this.raf)
				this.mountedCleanup?.()
				this.mountedCleanup = undefined
				this.cleanup?.()
				this.cleanup = undefined
				for (const disposable of this.disposables) {
					if (typeof disposable === 'function') disposable()
					else disposable.dispose()
				}
				this.disposables = []
				if (this.entry && !this.entry.disposed) {
					this.entry.disposed = true
					this.deps.releaseState(this.id)
				}
				liveGridviewStates.delete(this.id)
			},
		}
	}
}

/**
 * Creates the gridview renderer factory backed by a shared widget registry
 * (mirrors svelte `createGridviewFactory`).
 */
export function createGridviewFactory(
	registry: GridviewWidgetRegistry,
	scope?: Record<string, any>,
	hooks?: { onDidActivePanelChange?: (panel: GridviewPanel) => void }
): GridviewFactory {
	const panels = new Map<string, GridviewPanelEntry>()

	function getOrCreateState(api: GridviewPanelApi, params: Parameters): GridviewPanelEntry {
		let entry = panels.get(api.id)
		if (!entry) {
			entry = { state: createGridviewState(api, params), disposed: false }
			panels.set(api.id, entry)
		}
		return entry
	}

	// `spawn` is assigned once the component's `root()` captures the effect
	// context; `createComponent` runs lazily after that, so it is set.
	let spawnRef: Spawn = () => () => {}
	const factorySpawn: Spawn = (fn) => spawnRef(fn)

	function createComponent(options: CreateComponentOptions): GridviewPanel {
		const def = registry.get(options.name)
		if (!def) throw new Error(`Gridview: unknown widget "${options.name}"`)
		return new SursautGridviewPanel(options.id, options.name, {
			widget: def.component,
			scope: scope ?? {},
			spawn: factorySpawn,
			getOrCreateState,
			releaseState: (id: string) => panels.delete(id),
			notifyActive: (panel: GridviewPanel) => hooks?.onDidActivePanelChange?.(panel),
		})
	}

	return {
		createComponent,
		getState: (id: string) => panels.get(id)?.state,
		onDidActivePanelChange: (panel: GridviewPanel) => hooks?.onDidActivePanelChange?.(panel),
		/** @internal — bound by the component once its effect root exists. */
		_setSpawn: (spawn: Spawn) => {
			spawnRef = spawn
		},
	}
}

export const gridviewInternals = {
	createGridviewFactory,
	createGridviewState,
	getState: (id: string): GridviewPanelState | undefined => liveGridviewStates.get(id),
}

export const Gridview = (
	props: {
		api?: GridviewApi
		onReady?: (api: GridviewApi, handle?: GridviewHandle) => void
		onPanelError?: PanelErrorHandler
		widgets?: Record<string, GridviewWidget<any> | GridviewWidgetDefinition>
		el?: JSX.GlobalHTMLAttributes
		options?: Omit<GridviewComponentOptions, 'createComponent'> & { orientation?: Orientation }
		layout?: SerializedGridviewComponent
		handle?: GridviewHandle
		panels?: IGridviewPanel[]
		activePanel?: IGridviewPanel | undefined
		/**
		 * Declarative widgets (`<DvWidget>` children) — alternative to the `widgets` prop.
		 */
		children?: JSX.Children
	} & GridviewEventProps,
	scope: Record<string, any>
) => {
	const registry = new GridviewWidgetRegistry()
	const counters = new Map<string, number>()
	let gridviewApi: GridviewApi | undefined
	let gridviewHandle: GridviewHandle | undefined
	// Declarative-widget context (same idiom as Dockview — see dockview.tsx).
	const dvContext: DvWidgetLayoutContext = {
		get api() {
			return gridviewApi
		},
		registerWidget: (key: string, def: Record<string, unknown>) => {
			registry.register(key, def as unknown as GridviewWidgetDefinition)
		},
		unregisterWidget: (key: string) => {
			registry.unregister(key)
		},
		kind: 'gridview',
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
	const activePanelBinding = attributes?.getSingle('activePanel')

	// Snapshot props in the component body (outside any attend effect)
	// so initGridview reads zero reactive properties.
	// NOTE: `props.widgets` is a reactive proxy — `Object.entries` on it reads
	// `Symbol(keys-of)` + every key inside the render effect (rebuild-fence
	// warnings). Snapshot a plain object once via untracked reads instead.
	const widgetMap = untracked`Gridview.snapshotWidgets`(() => {
		const snap: Record<string, GridviewWidget<any> | GridviewWidgetDefinition> = {}
		for (const key of Object.keys(props.widgets ?? {})) {
			snap[key] = (props.widgets as Record<string, GridviewWidget<any> | GridviewWidgetDefinition>)[
				key
			]!
		}
		return snap
	})
	const onReadyCb = props.onReady
	const onPanelErrorCb = props.onPanelError
	const eventProps = props as GridviewEventProps

	// Normalize `widgets` entries: plain widget fn → `{ component }`, def passes through.
	for (const [key, entry] of Object.entries(widgetMap)) {
		registry.register(
			key,
			typeof entry === 'function' ? { component: entry as GridviewWidget<any> } : entry
		)
	}

	function nextId(key: string): string {
		const n = (counters.get(key) ?? 0) + 1
		counters.set(key, n)
		return `${key}-${n}`
	}

	function refreshPanels(api: GridviewApi) {
		const panels = untracked`Gridview.refreshPanels.panels`(() => [...api.panels])
		if (panelsBinding instanceof ReactiveProp && panelsBinding.set) panelsBinding.set(panels)
		else props.panels = panels
	}

	function setActivePanel(panel: IGridviewPanel | undefined) {
		const current =
			activePanelBinding instanceof ReactiveProp
				? untracked`Gridview.setActivePanel.current`(() => activePanelBinding.get())
				: props.activePanel
		if (current?.id === panel?.id) return
		if (activePanelBinding instanceof ReactiveProp && activePanelBinding.set)
			activePanelBinding.set(panel)
		else props.activePanel = panel
		eventProps.onDidActivePanelChange?.(panel)
	}

	function writeHandle(handle: GridviewHandle) {
		if (handleBinding instanceof ReactiveProp && handleBinding.set) handleBinding.set(handle)
		else props.handle = handle
	}

	const initGridview = (_target: Node | readonly Node[]) => {
		const element = (Array.isArray(_target) ? _target[0] : _target) as HTMLElement
		if (gridviewApi) return // already initialized
		const hasLayout =
			layoutBinding instanceof ReactiveProp
				? untracked`Gridview.init.hasLayout`(() => layoutBinding.get() !== undefined)
				: props.layout !== undefined
		// spawn will be set once the root() block captures the effect context.
		let spawn: Spawn
		let writeLayoutImpl: ((value: SerializedGridviewComponent | undefined) => void) | undefined
		const writeLayoutRef = (value: SerializedGridviewComponent | undefined) => {
			if (writeLayoutImpl) writeLayoutImpl(value)
			else if (layoutBinding instanceof ReactiveProp && layoutBinding.set) layoutBinding.set(value)
			else props.layout = value
		}
		const emitLayout = (emit: (value: SerializedGridviewComponent) => void) => {
			const json = untracked`Gridview.emitLayout.toJSON`(() => gridviewApi!.toJSON())
			if (deepEqual(json, lastEmitted)) return
			lastEmitted = json
			emit(json)
		}
		const openPanel = (key: string, opts?: GridviewOpenPanelOptions): GridviewPanelHandle => {
			if (!gridviewApi) throw new Error('Gridview: not mounted yet')
			const def = registry.get(key)
			if (!def) throw new Error(`Gridview: unknown widget "${key}"`)
			const id = opts?.id ?? nextId(key)
			const { id: _omitId, params, ...rest } = opts ?? {}
			const panel = untracked`Gridview.openPanel.addPanel`(() =>
				gridviewApi!.addPanel({
					...rest,
					id,
					component: key,
					params: params ?? {},
				} as AddGridviewComponentOptions)
			)
			// `addPanel` fires no observed event on the open path itself —
			// refresh the bound panels/layout directly. `doSetGroupActive`
			// inside `addPanel` fires per-panel `onDidActiveChange`, which the
			// factory mirrors to `state.active` but the component does not
			// observe — so sync `activePanel` explicitly.
			writeLayoutRef(untracked`Gridview.openPanel.toJSON`(() => gridviewApi!.toJSON()))
			untracked`Gridview.openPanel.refresh`(() => refreshPanels(gridviewApi!))
			setActivePanel(panel)
			return { id, panel, api: panel.api, state: liveGridviewStates.get(id) }
		}
		const registerWidget = (key: string, def: GridviewWidgetDefinition) => {
			registry.register(key, def)
		}
		const unregisterWidget = (key: string) => {
			registry.unregister(key)
		}
		const getPanelOrThrow = (id: string): IGridviewPanel => {
			const panel = gridviewApi!.getPanel(id)
			if (!panel) throw new Error(`Gridview: unknown panel "${id}"`)
			return panel
		}
		const removePanel = (id: string) => {
			if (!gridviewApi) throw new Error('Gridview: not mounted yet')
			const panel = getPanelOrThrow(id)
			const wasActive =
				(activePanelBinding instanceof ReactiveProp
					? untracked`Gridview.removePanel.active`(() => activePanelBinding.get())
					: props.activePanel
				)?.id === panel.id
			gridviewApi.removePanel(panel)
			// Removal fires no active event either — fall back to the last
			// remaining cell when the active one was removed.
			if (wasActive) setActivePanel(gridviewApi.panels.at(-1))
		}
		const movePanel = (id: string, move: GridviewMoveOptions) => {
			if (!gridviewApi) throw new Error('Gridview: not mounted yet')
			gridviewApi.movePanel(getPanelOrThrow(id), {
				direction: move.direction,
				reference: move.reference,
				size: move.size,
			})
		}
		const setVisible = (id: string, visible: boolean) => {
			if (!gridviewApi) throw new Error('Gridview: not mounted yet')
			getPanelOrThrow(id).api.setVisible(visible)
		}
		const setActive = (id: string) => {
			if (!gridviewApi) throw new Error('Gridview: not mounted yet')
			getPanelOrThrow(id).api.setActive()
		}
		// `bind:layout` loop-break: the JSON we last emitted to the parent.
		let lastEmitted: SerializedGridviewComponent | undefined
		const receiveLayout = (layout: SerializedGridviewComponent | undefined) => {
			if (layout && deepEqual(layout, lastEmitted)) return
			if (layout) {
				untracked`Gridview.receiveLayout.fromJSON`(() => gridviewApi!.fromJSON(layout))
				lastEmitted = untracked`Gridview.receiveLayout.toJSON`(() => gridviewApi!.toJSON())
			} else {
				untracked`Gridview.receiveLayout.clear`(() => gridviewApi!.clear())
				lastEmitted = undefined
			}
			untracked`Gridview.receiveLayout.refresh`(() => refreshPanels(gridviewApi!))
		}
		let factory: GridviewFactory | undefined
		try {
			factory = createGridviewFactory(registry, scope, {
				onDidActivePanelChange: (panel) => setActivePanel(panel as unknown as IGridviewPanel),
			})
			const orientation = untracked`Gridview.init.orientation`(
				() => props.options?.orientation ?? Orientation.HORIZONTAL
			)
			const activeApi = unreactive(
				createGridview(element, {
					...untracked`Gridview.init.options`(() => ({ ...(props.options ?? {}) })),
					orientation,
					createComponent: factory.createComponent,
				})
			)
			gridviewApi = activeApi
		} catch (e) {
			console.error('[Gridview] createGridview CRASHED (sync):', e)
			return
		}
		const api = gridviewApi!
		try {
			if (scope && typeof scope === 'object' && !Object.isFrozen(scope)) {
				scope.gridviewApi = api
				scope.api = api
			}
		} catch (_e) {}
		if (apiBinding instanceof ReactiveProp && apiBinding.set) {
			apiBinding.set(api)
		} else if ('api' in props) {
			props.api = api
		}
		gridviewHandle = {
			api,
			openPanel,
			registerWidget,
			unregisterWidget,
			removePanel,
			movePanel,
			setVisible,
			setActive,
		}
		writeHandle(gridviewHandle)
		untracked`Gridview.init.seedPanels`(() => refreshPanels(api))
		const stopBindings = root`Gridview.bindings`((): (() => void) => {
			const ctx = effectContext()
			spawn = (fn) => withEffectContext(ctx, () => effect`gridview:spawn`(fn))
			factory?._setSpawn(spawn)
			const cleanups: (() => void)[] = []
			const hasControlledLayout =
				layoutBinding instanceof ReactiveProp
					? untracked`Gridview.bindings.hasLayout`(() => layoutBinding.get() !== undefined)
					: props.layout !== undefined
			const readLayout =
				layoutBinding instanceof ReactiveProp
					? () => untracked`Gridview.bindings.readLayout`(() => layoutBinding.get())
					: () => props.layout
			const writeLayout =
				layoutBinding instanceof ReactiveProp && layoutBinding.set
					? (value: SerializedGridviewComponent | undefined) => layoutBinding.set?.(value)
					: (value: SerializedGridviewComponent | undefined) => {
							props.layout = value
						}
			const provideLayout =
				layoutBinding instanceof ReactiveProp && layoutBinding.set
					? biDi(receiveLayout, {
							get: () => layoutBinding.get(),
							set: (value: SerializedGridviewComponent | undefined) => layoutBinding.set?.(value),
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
							untracked`Gridview.onDidLayoutChange.refresh`(() => refreshPanels(api))
							if (
								untracked`Gridview.onDidLayoutChange.guard`(() =>
									deepEqual(api.toJSON(), lastEmitted)
								)
							)
								return
							emitLayout(provideLayout)
						}).dispose
					)
				} else {
					cleanups.push(
						effect`Gridview.layout.readExternalLayout`(() => {
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
							untracked`Gridview.onDidLayoutChange.refresh`(() => refreshPanels(api))
							if (
								untracked`Gridview.onDidLayoutChange.guard`(() =>
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
						untracked`Gridview.onDidLayoutChange.refresh`(() => refreshPanels(api))
						eventProps.onDidLayoutChange?.()
					}).dispose
				)
			}
			// Apply a pre-existing `layout` before exposing the api.
			if (hasControlledLayout) {
				const initial = readLayout()
				if (initial) {
					untracked`Gridview.bindings.applyInitial`(() => api.fromJSON(initial))
					lastEmitted = untracked`Gridview.bindings.seedInitial`(() => api.toJSON())
					writeLayoutImpl?.(lastEmitted)
				}
			}
			untracked`Gridview.bindings.seedPanels`(() => refreshPanels(api))
			cleanups.push(
				api.onDidLayoutFromJSON(() => {
					lastEmitted = untracked`Gridview.onDidLayoutFromJSON.seed`(() => api.toJSON())
					untracked`Gridview.onDidLayoutFromJSON.refresh`(() => refreshPanels(api))
					eventProps.onDidLayoutFromJSON?.()
				}).dispose,
				api.onDidAddPanel((panel: IGridviewPanel) => {
					untracked`Gridview.onDidAddPanel.refresh`(() => refreshPanels(api))
					// External adds (e.g. `api.addPanel` escape hatch) activate the
					// new cell without a component-level event — same sync as `openPanel`.
					setActivePanel(panel)
					eventProps.onDidAddPanel?.(panel)
				}).dispose,
				api.onDidRemovePanel((panel: IGridviewPanel) => {
					untracked`Gridview.onDidRemovePanel.refresh`(() => refreshPanels(api))
					const current =
						activePanelBinding instanceof ReactiveProp
							? untracked`Gridview.onDidRemovePanel.active`(() => activePanelBinding.get())
							: props.activePanel
					if (current?.id === panel.id) {
						setActivePanel(api.panels.at(-1))
					}
					eventProps.onDidRemovePanel?.(panel)
				}).dispose,
				api.onDidActivePanelChange((panel: IGridviewPanel | undefined) => {
					// Focus-driven activation path. Programmatic activation
					// (`api.setActive`, `addPanel`) only fires the per-panel
					// event, handled via the factory hook above.
					setActivePanel(panel)
				}).dispose
			)
			cleanups.push(
				effect`Gridview.options`(() => {
					const opts = props.options
					if (!opts) return
					const { createComponent: _omit, ...rest } = opts as GridviewComponentOptions
					untracked`Gridview.options.update`(() => api.updateOptions(rest))
				})
			)
			return () => {
				for (const c of cleanups) c()
			}
		})
		try {
			root`Gridview.onReady`(() => onReadyCb?.(api, gridviewHandle))
		} catch (e) {
			console.error('[Gridview] onReady error:', e)
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
			gridviewApi = undefined
			gridviewHandle = undefined
		}
	}

	return (
		<div
			{...(props.el || {})}
			class="sursaut-gridview"
			data-testid="gridview-container"
			use={initGridview}
		>
			{props.children}
		</div>
	)
}

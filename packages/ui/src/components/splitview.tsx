import { extend, fromAttribute, latch, ReactiveProp } from '@sursaut/core'
import { componentStyle } from '@sursaut/kit'
import {
	type ActiveEvent,
	type AddSplitviewComponentOptions,
	type CreateComponentOptions,
	createSplitview,
	type FocusEvent,
	type IFrameworkPart,
	type ISplitviewPanel,
	type IView,
	type PanelDimensionChangeEvent,
	type PanelUpdateEvent,
	type PanelViewInitParameters,
	type Parameters,
	type SerializedSplitview,
	type SplitviewApi,
	type SplitviewComponentOptions,
	SplitviewPanel,
	type SplitviewPanelApi,
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
	defineSplitviewWidgets,
	type SplitviewWidgetDefinition,
	SplitviewWidgetRegistry,
	type SplitviewWidgets,
} from './splitview-registry'

export { defineSplitviewWidgets, SplitviewWidgetRegistry }
export type { SplitviewWidgetDefinition, SplitviewWidgets }

componentStyle.sass`
.sursaut-splitview
	width: 100%
	height: 100%
	position: relative

.sursaut-dv-item
	width: 100%
	height: 100%

	&.splitview-pane
		overflow: auto
`

/**
 * Reactive state shared by a splitview pane. Same shape as `DockviewPanelState`
 * minus the tab-only fields (`title`, `shown`, `pinned`, `groupActive`) —
 * splitview panes have no headers or tabs (mirrors svelte `SplitviewState`).
 */
export interface SplitviewPanelState<Params extends Record<string, any> = Record<string, any>> {
	params: Params
	size: { width: number; height: number }
	visible: boolean
	active: boolean
	focused: boolean
	api: SplitviewPanelApi
	custom: Record<string, unknown>
}

export interface SplitviewWidgetScope extends Record<PropertyKey, unknown> {
	splitviewApi?: SplitviewApi
	panelApi?: SplitviewPanelApi
}

export type SplitviewWidgetProps<Params extends Record<string, any> = Record<string, any>> = {
	state: SplitviewPanelState<Params>
}

export type SplitviewWidget<Params extends Record<string, any> = Record<string, any>> = (
	props: SplitviewWidgetProps<Params>,
	scope: SplitviewWidgetScope
) => JSX.Element

/** A handle returned by a splitview `openPanel`, bundling the pane and its state. */
export interface SplitviewPanelHandle<Params extends Record<string, any> = Record<string, any>> {
	id: string
	/** Raw dockview splitview panel. */
	panel: ISplitviewPanel
	/** Convenience alias of `panel.api`. */
	api: SplitviewPanelApi
	/** Reactive state (undefined until the renderer mounts). */
	state: SplitviewPanelState<Params> | undefined
}

/** Options accepted by a splitview `openPanel`. Owns `id`/`params`, passes the rest through. */
export type SplitviewOpenPanelOptions<Params extends Record<string, any> = Record<string, any>> = {
	id?: string
	params?: Params
} & Omit<AddSplitviewComponentOptions, 'id' | 'component' | 'params'>

/**
 * Ergonomic surface bound via the `handle` prop (svelte `bind:handle` equivalent).
 */
export interface SplitviewHandle {
	/** The raw splitview api — full escape hatch. */
	api: SplitviewApi
	/** Open a split pane by widget key with an optional params/position. */
	openPanel: (key: string, options?: SplitviewOpenPanelOptions) => SplitviewPanelHandle
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: SplitviewWidgetDefinition) => void
	/** Remove a widget definition. */
	unregisterWidget: (key: string) => void
	/** Remove a split pane by id. */
	removePanel: (id: string) => void
	/** Move a split pane from one index to another. */
	movePanel: (from: number, to: number) => void
	/** Show or hide a split pane by id. */
	setVisible: (id: string, visible: boolean) => void
	/** Activate a split pane by id. */
	setActive: (id: string) => void
}

/** Splitview events forwarded as component props (mirror svelte `Splitview.svelte`). */
export interface SplitviewEventProps {
	onDidLayoutChange?: () => void
	onDidLayoutFromJSON?: () => void
	onDidAddView?: (view: IView) => void
	onDidRemoveView?: (view: IView) => void
	onDidActiveViewChange?: (view: ISplitviewPanel | undefined) => void
}

type Spawn = (fn: () => void) => ScopedCallback

type Disposable = { dispose(): void } | ScopedCallback

/** The renderer factory returned by {@link createSplitviewFactory}. */
export interface SplitviewFactory {
	createComponent: (options: CreateComponentOptions) => SplitviewPanel
	/** Access a view's state by id (used by `openPanel` to build the handle). */
	getState: (id: string) => SplitviewPanelState | undefined
	/** Fired when a pane's `api.onDidActiveChange` reports `isActive: true`. */
	onDidActiveViewChange: (view: SplitviewPanel) => void
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

// Test-visible registry of live pane states (renderer owns each entry).
const liveSplitviewStates = new Map<string, SplitviewPanelState>()

/** Per-pane dependencies captured by {@link SursautSplitviewPanel} at construction. */
interface SplitviewPanelDeps {
	widget: SplitviewWidget
	scope: Record<string, any>
	spawn: Spawn
	onPanelError?: PanelErrorHandler
	getOrCreateState: (api: SplitviewPanelApi, params: Parameters) => SplitviewPanelEntry
	releaseState: (id: string) => void
	notifyActive: (view: SplitviewPanel) => void
}

/** One entry per view id — splitview has a single renderer per view (no tab). */
interface SplitviewPanelEntry {
	state: SplitviewPanelState
	disposed: boolean
}

/** Create a reactive splitview state (mirrors svelte `createSplitviewState`). */
export function createSplitviewState(
	api: SplitviewPanelApi,
	params: Parameters
): SplitviewPanelState {
	return reactive({
		params: reactive(params ?? {}),
		size: { width: 0, height: 0 },
		visible: api.isVisible,
		active: api.isActive,
		focused: api.isFocused,
		api: unreactive(api),
		custom: reactive({}),
	}) as SplitviewPanelState
}

/**
 * A splitview panel that mounts a sursaut widget into `this.element` and wires
 * the reactive {@link SplitviewPanelState} (mirrors svelte `SvelteSplitviewPanel`).
 *
 * `getComponent().update` is a no-op: dockview calls `part.update(...)` with
 * inconsistent shapes, so params flow through the `update(event)` override
 * instead — a single, well-typed path.
 */
class SursautSplitviewPanel extends SplitviewPanel {
	private readonly deps: SplitviewPanelDeps
	private entry: SplitviewPanelEntry | undefined
	private state: SplitviewPanelState | undefined
	private disposables: Disposable[] = []
	private cleanup: ScopedCallback | undefined
	private mountedCleanup: ScopedCallback | undefined
	private lastParams: unknown
	private lastActive = false
	private lastVisible = true

	constructor(id: string, component: string, deps: SplitviewPanelDeps) {
		super(id, component)
		this.deps = deps
	}

	override init(parameters: PanelViewInitParameters): void {
		super.init(parameters)
		const { widget, scope, spawn, onPanelError, getOrCreateState } = this.deps
		const entry = getOrCreateState(this.api, parameters.params)
		this.entry = entry
		this.state = entry.state
		const state = entry.state
		liveSplitviewStates.set(this.api.id, state)

		this.lastParams = untracked`splitview.init.params`(() => cloneParams(state.params))
		this.lastActive = state.active
		this.lastVisible = state.visible

		this.disposables.push(
			this.api.onDidActiveChange((event: ActiveEvent) => {
				state.active = event.isActive
				this.lastActive = event.isActive
				// Activation lands here on the newly-active pane — the component
				// derives `bind:activeView` from it. Deactivation is ignored;
				// the incoming pane's `true` wins without ordering hazards.
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
				effect`splitview.updateParameters`(() => {
					// Tracked read (not `untracked`) so the effect re-runs on widget-side
					// param writes; `cloneParams` produces a plain snapshot for comparison.
					const snap = cloneParams(state.params)
					if (deepEqual(snap, this.lastParams)) return
					this.lastParams = snap
					state.api.updateParameters(snap)
				}),
				effect`splitview.activate`(() => {
					// Only activation is meaningful from the widget side.
					if (state.active && !this.lastActive) state.api.setActive()
				}),
				effect`splitview.visible`(() => {
					if (state.visible !== this.lastVisible) {
						this.lastVisible = state.visible
						state.api.setVisible(state.visible)
					}
				})
			)
			caught((error: unknown) => {
				console.error('[Splitview] Panel error:', this.api.id, error)
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
						splitviewApi: scope.splitviewApi ?? scope.api,
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
		this.lastParams = untracked`splitview.update.params`(() => cloneParams(this.state!.params))
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
				liveSplitviewStates.delete(this.id)
			},
		}
	}
}

/**
 * Creates the splitview renderer factory backed by a shared widget registry
 * (mirrors svelte `createSplitviewFactory`).
 */
export function createSplitviewFactory(
	registry: SplitviewWidgetRegistry,
	scope?: Record<string, any>,
	hooks?: { onDidActiveViewChange?: (view: SplitviewPanel) => void }
): SplitviewFactory {
	const panels = new Map<string, SplitviewPanelEntry>()

	function getOrCreateState(api: SplitviewPanelApi, params: Parameters): SplitviewPanelEntry {
		let entry = panels.get(api.id)
		if (!entry) {
			entry = { state: createSplitviewState(api, params), disposed: false }
			panels.set(api.id, entry)
		}
		return entry
	}

	// `spawn` is assigned once the component's `root()` captures the effect
	// context; `createComponent` runs lazily after that, so it is set.
	let spawnRef: Spawn = () => () => {}
	const factorySpawn: Spawn = (fn) => spawnRef(fn)

	function createComponent(options: CreateComponentOptions): SplitviewPanel {
		const def = registry.get(options.name)
		if (!def) throw new Error(`Splitview: unknown widget "${options.name}"`)
		return new SursautSplitviewPanel(options.id, options.name, {
			widget: def.component,
			scope: scope ?? {},
			spawn: factorySpawn,
			getOrCreateState,
			releaseState: (id: string) => panels.delete(id),
			notifyActive: (view: SplitviewPanel) => hooks?.onDidActiveViewChange?.(view),
		})
	}

	return {
		createComponent,
		getState: (id: string) => panels.get(id)?.state,
		onDidActiveViewChange: (view: SplitviewPanel) => hooks?.onDidActiveViewChange?.(view),
		/** @internal — bound by the component once its effect root exists. */
		_setSpawn: (spawn: Spawn) => {
			spawnRef = spawn
		},
	}
}

export const splitviewInternals = {
	createSplitviewFactory,
	createSplitviewState,
	getState: (id: string): SplitviewPanelState | undefined => liveSplitviewStates.get(id),
}

export const Splitview = (
	props: {
		api?: SplitviewApi
		onReady?: (api: SplitviewApi, handle?: SplitviewHandle) => void
		onPanelError?: PanelErrorHandler
		widgets?: Record<string, SplitviewWidget<any> | SplitviewWidgetDefinition>
		el?: JSX.GlobalHTMLAttributes
		options?: Omit<SplitviewComponentOptions, 'createComponent'>
		layout?: SerializedSplitview
		handle?: SplitviewHandle
		views?: ISplitviewPanel[]
		activeView?: ISplitviewPanel | undefined
		/**
		 * Declarative widgets (`<DvWidget>` children) — alternative to the `widgets` prop.
		 */
		children?: JSX.Children
	} & SplitviewEventProps,
	scope: Record<string, any>
) => {
	const registry = new SplitviewWidgetRegistry()
	const counters = new Map<string, number>()
	let splitviewApi: SplitviewApi | undefined
	let splitviewHandle: SplitviewHandle | undefined
	// Declarative-widget context (same idiom as Dockview — see dockview.tsx).
	const dvContext: DvWidgetLayoutContext = {
		get api() {
			return splitviewApi
		},
		registerWidget: (key: string, def: Record<string, unknown>) => {
			registry.register(key, def as unknown as SplitviewWidgetDefinition)
		},
		unregisterWidget: (key: string) => {
			registry.unregister(key)
		},
		kind: 'splitview',
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
	const viewsBinding = attributes?.getSingle('views')
	const activeViewBinding = attributes?.getSingle('activeView')

	// Snapshot props in the component body (outside any attend effect)
	// so initSplitview reads zero reactive properties.
	// NOTE: `props.widgets` is a reactive proxy — `Object.entries` on it reads
	// `Symbol(keys-of)` + every key inside the render effect (rebuild-fence
	// warnings). Snapshot a plain object once via untracked reads instead.
	const widgetMap = untracked`Splitview.snapshotWidgets`(() => {
		const snap: Record<string, SplitviewWidget<any> | SplitviewWidgetDefinition> = {}
		for (const key of Object.keys(props.widgets ?? {})) {
			snap[key] = (
				props.widgets as Record<string, SplitviewWidget<any> | SplitviewWidgetDefinition>
			)[key]!
		}
		return snap
	})
	const onReadyCb = props.onReady
	const onPanelErrorCb = props.onPanelError
	const eventProps = props as SplitviewEventProps

	// Normalize `widgets` entries: plain widget fn → `{ component }`, def passes through.
	for (const [key, entry] of Object.entries(widgetMap)) {
		registry.register(
			key,
			typeof entry === 'function' ? { component: entry as SplitviewWidget<any> } : entry
		)
	}

	function nextId(key: string): string {
		const n = (counters.get(key) ?? 0) + 1
		counters.set(key, n)
		return `${key}-${n}`
	}

	function refreshViews(api: SplitviewApi) {
		const views = untracked`Splitview.refreshViews.panels`(() => [...api.panels])
		if (viewsBinding instanceof ReactiveProp && viewsBinding.set) viewsBinding.set(views)
		else props.views = views
	}

	function setActiveView(view: ISplitviewPanel | undefined) {
		const current =
			activeViewBinding instanceof ReactiveProp
				? untracked`Splitview.setActiveView.current`(() => activeViewBinding.get())
				: props.activeView
		if (current?.id === view?.id) return
		if (activeViewBinding instanceof ReactiveProp && activeViewBinding.set)
			activeViewBinding.set(view)
		else props.activeView = view
		eventProps.onDidActiveViewChange?.(view)
	}

	function writeHandle(handle: SplitviewHandle) {
		if (handleBinding instanceof ReactiveProp && handleBinding.set) handleBinding.set(handle)
		else props.handle = handle
	}

	const initSplitview = (_target: Node | readonly Node[]) => {
		const element = (Array.isArray(_target) ? _target[0] : _target) as HTMLElement
		if (splitviewApi) return // already initialized
		const hasLayout =
			layoutBinding instanceof ReactiveProp
				? untracked`Splitview.init.hasLayout`(() => layoutBinding.get() !== undefined)
				: props.layout !== undefined
		// spawn will be set once the root() block captures the effect context.
		let spawn: Spawn
		let writeLayoutImpl: ((value: SerializedSplitview | undefined) => void) | undefined
		const writeLayoutRef = (value: SerializedSplitview | undefined) => {
			if (writeLayoutImpl) writeLayoutImpl(value)
			else if (layoutBinding instanceof ReactiveProp && layoutBinding.set) layoutBinding.set(value)
			else props.layout = value
		}
		const emitLayout = (emit: (value: SerializedSplitview) => void) => {
			const json = untracked`Splitview.emitLayout.toJSON`(() => splitviewApi!.toJSON())
			if (deepEqual(json, lastEmitted)) return
			lastEmitted = json
			emit(json)
		}
		const openPanel = (key: string, opts?: SplitviewOpenPanelOptions): SplitviewPanelHandle => {
			if (!splitviewApi) throw new Error('Splitview: not mounted yet')
			const def = registry.get(key)
			if (!def) throw new Error(`Splitview: unknown widget "${key}"`)
			const id = opts?.id ?? nextId(key)
			const { id: _omitId, params, ...rest } = opts ?? {}
			const panel = untracked`Splitview.openPanel.addPanel`(() =>
				splitviewApi!.addPanel({
					...rest,
					id,
					component: key,
					params: params ?? {},
				} as AddSplitviewComponentOptions)
			)
			// `addPanel` fires no observed event on the open path itself —
			// refresh the bound views/layout directly. `setActive` inside
			// `addPanel` fires per-panel `onDidActiveChange`, which the factory
			// mirrors to `state.active` but the component does not observe —
			// so sync `activeView` explicitly.
			writeLayoutRef(untracked`Splitview.openPanel.toJSON`(() => splitviewApi!.toJSON()))
			untracked`Splitview.openPanel.refresh`(() => refreshViews(splitviewApi!))
			setActiveView(panel)
			return { id, panel, api: panel.api, state: liveSplitviewStates.get(id) }
		}
		const registerWidget = (key: string, def: SplitviewWidgetDefinition) => {
			registry.register(key, def)
		}
		const unregisterWidget = (key: string) => {
			registry.unregister(key)
		}
		const getPanelOrThrow = (id: string): ISplitviewPanel => {
			const panel = splitviewApi!.getPanel(id)
			if (!panel) throw new Error(`Splitview: unknown panel "${id}"`)
			return panel
		}
		const removePanel = (id: string) => {
			if (!splitviewApi) throw new Error('Splitview: not mounted yet')
			const panel = getPanelOrThrow(id)
			const wasActive =
				(activeViewBinding instanceof ReactiveProp
					? untracked`Splitview.removePanel.active`(() => activeViewBinding.get())
					: props.activeView
				)?.id === panel.id
			splitviewApi.removePanel(panel)
			// `removePanel` activates the last pane without any active event —
			// fall back to it when the active one was removed.
			if (wasActive) setActiveView(splitviewApi.panels.at(-1))
		}
		const movePanel = (from: number, to: number) => {
			if (!splitviewApi) throw new Error('Splitview: not mounted yet')
			splitviewApi.movePanel(from, to)
		}
		const setVisible = (id: string, visible: boolean) => {
			if (!splitviewApi) throw new Error('Splitview: not mounted yet')
			getPanelOrThrow(id).api.setVisible(visible)
		}
		const setActive = (id: string) => {
			if (!splitviewApi) throw new Error('Splitview: not mounted yet')
			getPanelOrThrow(id).api.setActive()
		}
		// `bind:layout` loop-break: the JSON we last emitted to the parent.
		let lastEmitted: SerializedSplitview | undefined
		const receiveLayout = (layout: SerializedSplitview | undefined) => {
			if (layout && deepEqual(layout, lastEmitted)) return
			if (layout) {
				untracked`Splitview.receiveLayout.fromJSON`(() => splitviewApi!.fromJSON(layout))
				lastEmitted = untracked`Splitview.receiveLayout.toJSON`(() => splitviewApi!.toJSON())
			} else {
				untracked`Splitview.receiveLayout.clear`(() => splitviewApi!.clear())
				lastEmitted = undefined
			}
			untracked`Splitview.receiveLayout.refresh`(() => refreshViews(splitviewApi!))
		}
		let factory: SplitviewFactory | undefined
		try {
			factory = createSplitviewFactory(registry, scope, {
				// The factory emits the concrete `SplitviewPanel`; the component
				// surface is typed as `ISplitviewPanel` (the public view contract).
				onDidActiveViewChange: (view) => setActiveView(view as unknown as ISplitviewPanel),
			})
			const activeApi = unreactive(
				createSplitview(element, {
					...untracked`Splitview.init.options`(() => ({ ...(props.options ?? {}) })),
					createComponent: factory.createComponent,
				})
			)
			splitviewApi = activeApi
		} catch (e) {
			console.error('[Splitview] createSplitview CRASHED (sync):', e)
			return
		}
		const api = splitviewApi!
		try {
			if (scope && typeof scope === 'object' && !Object.isFrozen(scope)) {
				scope.splitviewApi = api
				scope.api = api
			}
		} catch (_e) {}
		if (apiBinding instanceof ReactiveProp && apiBinding.set) {
			apiBinding.set(api)
		} else if ('api' in props) {
			props.api = api
		}
		splitviewHandle = {
			api,
			openPanel,
			registerWidget,
			unregisterWidget,
			removePanel,
			movePanel,
			setVisible,
			setActive,
		}
		writeHandle(splitviewHandle)
		untracked`Splitview.init.seedViews`(() => refreshViews(api))
		const stopBindings = root`Splitview.bindings`((): (() => void) => {
			const ctx = effectContext()
			spawn = (fn) => withEffectContext(ctx, () => effect`splitview:spawn`(fn))
			factory?._setSpawn(spawn)
			const cleanups: (() => void)[] = []
			const hasControlledLayout =
				layoutBinding instanceof ReactiveProp
					? untracked`Splitview.bindings.hasLayout`(() => layoutBinding.get() !== undefined)
					: props.layout !== undefined
			const readLayout =
				layoutBinding instanceof ReactiveProp
					? () => untracked`Splitview.bindings.readLayout`(() => layoutBinding.get())
					: () => props.layout
			const writeLayout =
				layoutBinding instanceof ReactiveProp && layoutBinding.set
					? (value: SerializedSplitview | undefined) => layoutBinding.set?.(value)
					: (value: SerializedSplitview | undefined) => {
							props.layout = value
						}
			const provideLayout =
				layoutBinding instanceof ReactiveProp && layoutBinding.set
					? biDi(receiveLayout, {
							get: () => layoutBinding.get(),
							set: (value: SerializedSplitview | undefined) => layoutBinding.set?.(value),
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
							untracked`Splitview.onDidLayoutChange.refresh`(() => refreshViews(api))
							if (
								untracked`Splitview.onDidLayoutChange.guard`(() =>
									deepEqual(api.toJSON(), lastEmitted)
								)
							)
								return
							emitLayout(provideLayout)
						}).dispose
					)
				} else {
					cleanups.push(
						effect`Splitview.layout.readExternalLayout`(() => {
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
							untracked`Splitview.onDidLayoutChange.refresh`(() => refreshViews(api))
							if (
								untracked`Splitview.onDidLayoutChange.guard`(() =>
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
						untracked`Splitview.onDidLayoutChange.refresh`(() => refreshViews(api))
						eventProps.onDidLayoutChange?.()
					}).dispose
				)
			}
			// Apply a pre-existing `layout` before exposing the api.
			if (hasControlledLayout) {
				const initial = readLayout()
				if (initial) {
					untracked`Splitview.bindings.applyInitial`(() => api.fromJSON(initial))
					lastEmitted = untracked`Splitview.bindings.seedInitial`(() => api.toJSON())
					writeLayoutImpl?.(lastEmitted)
				}
			}
			untracked`Splitview.bindings.seedViews`(() => refreshViews(api))
			cleanups.push(
				api.onDidLayoutFromJSON(() => {
					lastEmitted = untracked`Splitview.onDidLayoutFromJSON.seed`(() => api.toJSON())
					untracked`Splitview.onDidLayoutFromJSON.refresh`(() => refreshViews(api))
					eventProps.onDidLayoutFromJSON?.()
				}).dispose,
				api.onDidAddView((view: IView) => {
					untracked`Splitview.onDidAddView.refresh`(() => refreshViews(api))
					// External adds (e.g. `api.addPanel` escape hatch) activate the
					// new pane without a component-level event — same sync as `openPanel`.
					// `onDidAddView` is typed `Event<IView>` (base view: element/layout/setVisible,
					// no `id`/`api`), but the runtime value is a `SplitviewPanel`/`ISplitviewPanel` —
					// a dockview type-gap, so narrow deliberately.
					setActiveView(view as unknown as ISplitviewPanel)
					eventProps.onDidAddView?.(view)
				}).dispose,
				api.onDidRemoveView((view: IView) => {
					// Same dockview type-gap as `onDidAddView`: only `.id` is read, via a
					// narrow cast (base `IView` has no `.id`).
					const removedId = (view as unknown as ISplitviewPanel | undefined)?.id
					untracked`Splitview.onDidRemoveView.refresh`(() => refreshViews(api))
					const current =
						activeViewBinding instanceof ReactiveProp
							? untracked`Splitview.onDidRemoveView.active`(() => activeViewBinding.get())
							: props.activeView
					if (removedId !== undefined && current?.id === removedId) {
						setActiveView(api.panels.at(-1))
					}
					eventProps.onDidRemoveView?.(view)
				}).dispose
			)
			cleanups.push(
				effect`Splitview.options`(() => {
					const opts = props.options
					if (!opts) return
					const { createComponent: _omit, ...rest } = opts as SplitviewComponentOptions
					untracked`Splitview.options.update`(() => api.updateOptions(rest))
				})
			)
			return () => {
				for (const c of cleanups) c()
			}
		})
		try {
			root`Splitview.onReady`(() => onReadyCb?.(api, splitviewHandle))
		} catch (e) {
			console.error('[Splitview] onReady error:', e)
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
			splitviewApi = undefined
			splitviewHandle = undefined
		}
	}

	return (
		<div
			{...(props.el || {})}
			class="sursaut-splitview"
			data-testid="splitview-container"
			use={initSplitview}
		>
			{props.children}
		</div>
	)
}

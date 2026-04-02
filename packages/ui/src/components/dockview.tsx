import {
	createDockview,
	type DockviewApi,
	type DockviewGroupPanel,
	type DockviewOptions,
	type DockviewPanelApi,
	type DockviewTheme,
	type GroupPanelPartInitParameters,
	type IContentRenderer,
	type SerializedDockview,
	themeDracula,
	themeLight,
} from 'dockview-core'
import 'dockview-core/dist/styles/dockview.css'
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
	withEffectContext,
} from 'mutts'
import { Icon } from '../icon'

componentStyle.sass`
.sursaut-dockview
	width: 100%
	height: 100%

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
			display: flex
			align-items: center
			justify-content: center
			cursor: pointer
			color: inherit
			opacity: 0.7
			&:hover
				opacity: 1
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

export interface DockviewWidgetScope extends Record<PropertyKey, unknown> {
	dockviewApi?: DockviewApi
	panelApi?: DockviewPanelApi
}

export type DockviewWidget<
	Params extends Record<string, any> = Record<string, any>,
	Context extends Record<PropertyKey, any> = Record<PropertyKey, any>,
> = (props: DockviewWidgetProps<Params, Context>, scope: DockviewWidgetScope) => JSX.Element

export type DockviewHeaderActionProps = {
	group: DockviewGroupPanel
}

export type DockviewHeaderAction = (
	props: DockviewHeaderActionProps,
	scope: DockviewWidgetScope
) => JSX.Element | null

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
	const size = reactive({ width: 0, height: 0 })
	const cleanups: ScopedCallback[] = [onDispose]

	return {
		element,
		init: ({ api: panelApi, params, title }: GroupPanelPartInitParameters) => {
			let mountedCleanup: ScopedCallback | undefined
			params = reactive(params)
			const internalState = reactive({ title })
			const context = props.context ?? reactive({})
			Object.defineProperties(props, {
				title: {
					get: () => internalState.title,
					set: (v: string) => {
						panelApi.setTitle(v)
						internalState.title = v
					},
					enumerable: true,
					configurable: true,
				},
			})
			Object.assign(props, {
				params,
				size,
				context,
			})
			const panelId = panelApi.id
			cleanups.push(
				panelApi.onDidTitleChange(
					(e: any) => (internalState.title = typeof e === 'string' ? e : e.title)
				).dispose,
				effect`contentRenderer.updateParameters`(() => panelApi.updateParameters(params)),
				() => mountedCleanup?.(),
				panelApi.onDidParametersChange((payload: any) => {
					Object.assign(params, payload)
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
						})
					)
				})
			)
		},
		layout: (width: number, height: number) => {
			size.width = width
			size.height = height
		},
		dispose() {
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
	{ group }: DockviewHeaderActionProps,
	scope: Record<string, any>,
	spawn: Spawn,
	onPanelError?: PanelErrorHandler
) {
	const element = document.createElement('div')
	element.classList.add('sursaut-dv-item')
	let cleanup: ScopedCallback | undefined
	let mountedCleanup: ScopedCallback | undefined
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
					<Widget group={group} />,
					extend(scope, { dockviewApi: scope.dockviewApi ?? scope.api })
				)
			})
		},
		dispose() {
			mountedCleanup?.()
			cleanup?.()
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
				<button class="close" aria-label="Close" onClick={() => panelApi.close()}>
					<Icon name="tabler-outline-x" />
				</button>
			)}
		</div>
	)
}

export const Dockview = (
	props: {
		api?: DockviewApi
		debug?: boolean | string
		onReady?: (api: DockviewApi) => void
		onPanelError?: PanelErrorHandler
		widgets: Record<string, DockviewWidget<any>>
		tabs?: Record<string, DockviewWidget<any>>
		headerLeft?: DockviewHeaderAction
		headerRight?: DockviewHeaderAction
		headerPrefix?: DockviewHeaderAction
		el?: JSX.GlobalHTMLAttributes
		options?: DockviewOptions
		themeSync?:
			| boolean
			| {
					light?: DockviewTheme
					dark?: DockviewTheme
			  }
		layout?: SerializedDockview
	},
	scope: Record<string, any>
) => {
	const contexts = new Map<string, Record<PropertyKey, any>>()
	let dockviewApi: DockviewApi | undefined
	const display = useDisplayContext(scope as any)

	// Capture layout binding from the raw composite attributes (component body — runs once)
	const attributes = (props as any)[fromAttribute]
	const apiBinding = attributes?.getSingle('api')
	const layoutBinding = attributes?.getSingle('layout')

	// Snapshot props in the component body (outside any attend effect)
	// so initDockview reads zero reactive properties.
	const debugLabel = props.debug
	const widgetMap = props.widgets
	const tabMap = props.tabs
	const onReadyCb = props.onReady
	const onPanelErrorCb = props.onPanelError
	const hasLayout =
		layoutBinding instanceof ReactiveProp
			? layoutBinding.get() !== undefined
			: props.layout !== undefined

	const initDockview = (_target: Node | readonly Node[]) => {
		const element = (Array.isArray(_target) ? _target[0] : _target) as HTMLElement
		if (dockviewApi) return // already initialized
		logDockview(debugLabel, 'init:start', {
			hasLayout,
			widgetNames: Object.keys(widgetMap),
		})
		// spawn will be set once the root() block captures the effect context.
		// createComponent/createTabComponent are called lazily by dockview-core,
		// always after root() has run, so spawn is guaranteed to be set.
		let spawn: Spawn
		try {
			const activeApi = unreactive(
				createDockview(element, {
					createComponent({ id, name }: { id: string; name: string }) {
						logDockview(debugLabel, 'createComponent', {
							id,
							name,
							knownWidgets: Object.keys(widgetMap),
						})
						const widget = widgetMap[name]
						if (!widget) throw new Error(`Widget ${name} not found`)
						const context = reactive({})
						contexts.set(id, context)
						return contentRenderer(
							widget,
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
						const widget = tabMap?.[name] ?? DefaultTab
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
					? layoutBinding.get() !== undefined
					: props.layout !== undefined
			const readLayout =
				layoutBinding instanceof ReactiveProp ? () => layoutBinding.get() : () => props.layout
			const writeLayout =
				layoutBinding instanceof ReactiveProp && layoutBinding.set
					? (value: SerializedDockview | undefined) => layoutBinding.set?.(value)
					: (value: SerializedDockview | undefined) => {
							props.layout = value
						}
			let applyingExternalLayout = false
			const receiveLayout = (layout: SerializedDockview | undefined) => {
				logDockview(debugLabel, 'layout:receive', {
					hasLayout: layout !== undefined,
					panelCount: api.panels.length,
				})
				applyingExternalLayout = true
				try {
					if (layout) api.fromJSON(layout)
					else {
						logDockview(debugLabel, 'layout:close-all-groups', {
							panelCount: api.panels.length,
						})
						api.closeAllGroups()
					}
				} finally {
					applyingExternalLayout = false
				}
			}
			if (!hasControlledLayout) {
				logDockview(debugLabel, 'layout:uncontrolled')
			} else if (layoutBinding instanceof ReactiveProp && layoutBinding.set) {
				const provideLayout = biDi(receiveLayout, {
					get: () => layoutBinding.get(),
					set: (value: SerializedDockview | undefined) => layoutBinding.set?.(value),
				})
				cleanups.push(
					api.onDidLayoutChange(() => {
						if (!applyingExternalLayout) {
							logDockview(debugLabel, 'layout:onDidLayoutChange:provide', {
								panelCount: api.panels.length,
							})
							provideLayout(api.toJSON())
						}
					}).dispose
				)
			} else {
				cleanups.push(
					effect`Dockview.layout.readExternalLayout`(() => {
						const layout = readLayout()
						if (!applyingExternalLayout) receiveLayout(layout)
					})
				)
				cleanups.push(
					api.onDidLayoutChange(() => {
						if (!applyingExternalLayout) {
							logDockview(debugLabel, 'layout:onDidLayoutChange:write', {
								panelCount: api.panels.length,
							})
							writeLayout(api.toJSON())
						}
					}).dispose
				)
			}
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
					const nextOptions = props.options
						? { ...emptyOptions, ...props.options }
						: { ...emptyOptions }
					if (themeSync !== false) nextOptions.theme = props.options?.theme ?? mappedTheme
					else nextOptions.theme = props.options?.theme
					api.updateOptions(nextOptions)
					if (props.options) for (const k of Object.keys(props.options)) emptyOptions[k] = undefined
					emptyOptions.theme = undefined
				})
			)
			cleanups.push(
				effect`dockview:header-actions`(function maintainHeaderActions() {
					const { headerLeft, headerRight, headerPrefix } = props
					api.updateOptions({
						createLeftHeaderActionComponent:
							headerLeft &&
							((group: DockviewGroupPanel) => {
								return headerActionRenderer(headerLeft, { group }, scope, spawn, onPanelErrorCb)
							}),
						createRightHeaderActionComponent:
							headerRight &&
							((group: DockviewGroupPanel) => {
								return headerActionRenderer(headerRight, { group }, scope, spawn, onPanelErrorCb)
							}),
						createPrefixHeaderActionComponent:
							headerPrefix &&
							((group: DockviewGroupPanel) => {
								return headerActionRenderer(headerPrefix, { group }, scope, spawn, onPanelErrorCb)
							}),
					})
				})
			)
			return () => {
				for (const c of cleanups) c()
			}
		})
		try {
			root`Dockview.onReady`(() => onReadyCb?.(api))
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
			dockviewApi = undefined
		}
	}

	return (
		<div
			{...(props.el || {})}
			class="sursaut-dockview"
			data-testid="dockview-theme-container"
			use={initDockview}
		></div>
	)
}

export const dockviewInternals = {
	contentRenderer,
	tabRenderer,
	headerActionRenderer,
}

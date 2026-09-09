import { defaults } from '@sursaut/core'
import {
	type ClientRouteDefinition,
	client,
	type NavigationKind,
	type OpenedRoute,
	type RouterLoading,
	type RouterModel,
	type RouterModelConfig,
	type RouterModelRouteDefinition,
	type RouterNotFound,
	type RouterOnRouteEnd,
	type RouterOnRouteError,
	type RouterOnRouteStart,
	type RouteSpecification,
	routerModel,
} from '@sursaut/kit'
import type { DockviewApi, DockviewOptions, SerializedDockview } from 'dockview'
import { caught, effect, reactive } from 'mutts'
import {
	Dockview,
	type DockviewHeaderAction,
	type DockviewWidget,
	type PanelErrorHandler,
} from './dockview'

export type DockviewRouteWidgetParams = Record<string, string> & {
	url: string
	routeId: string
}

export interface DockviewRouterProps<Definition extends ClientRouteDefinition> {
	readonly routes: readonly RouterModelRouteDefinition<Definition>[]
	readonly base?: string
	readonly getRouteId?: RouterModelConfig<Definition>['getRouteId']
	readonly debug?: boolean | string
	readonly extraWidgets?: Record<string, DockviewWidget<any>>
	readonly tabs?: Record<string, DockviewWidget<any>>
	readonly headerLeft?: DockviewHeaderAction
	readonly headerRight?: DockviewHeaderAction
	readonly headerPrefix?: DockviewHeaderAction
	readonly el?: JSX.GlobalHTMLAttributes
	readonly options?: DockviewOptions
	readonly layout?: SerializedDockview
	readonly notFound?: RouterNotFound<RouterModelRouteDefinition<Definition>>
	readonly loading?: RouterLoading<RouterModelRouteDefinition<Definition>>
	readonly onRouteStart?: RouterOnRouteStart<Definition>
	readonly onRouteEnd?: RouterOnRouteEnd<Definition>
	readonly onRouteError?: RouterOnRouteError<Definition>
	readonly initialUrl?: string
	readonly initialUrls?: readonly string[]
	readonly onPanelError?: PanelErrorHandler
}

type DockviewRouterErrorReporter = (message: string, error: unknown) => void

function logDockviewRouter(
	debug: DockviewRouterProps<any>['debug'],
	event: string,
	payload?: unknown
) {
	if (!debug) return
	const label = typeof debug === 'string' ? debug : 'DockviewRouter'
	if (payload === undefined) {
		console.log(`[${label}] ${event}`)
		return
	}
	console.log(`[${label}] ${event}`, payload)
}

function formatDockviewRouterError(stage: string, subject: string, error: unknown) {
	const detail = error instanceof Error ? error.message : String(error)
	return `DockviewRouter ${stage} failed for ${subject}: ${detail}`
}

function reportDockviewRouterError(
	stage: string,
	subject: string,
	error: unknown,
	report?: DockviewRouterErrorReporter
) {
	report?.(formatDockviewRouterError(stage, subject, error), error)
}

function isExactRouteMatch<Definition extends ClientRouteDefinition>(
	match: RouteSpecification<RouterModelRouteDefinition<Definition>> | null,
	route: RouterModelRouteDefinition<Definition>
): match is RouteSpecification<RouterModelRouteDefinition<Definition>> {
	return (
		!!match &&
		match.definition.path === route.path &&
		(match.unusedPath === '' || match.unusedPath === '/')
	)
}

function renderRoutePanel<Definition extends ClientRouteDefinition>(
	props: {
		model: RouterModel<Definition>
		route: RouterModelRouteDefinition<Definition>
		url: string
		routes: readonly RouterModelRouteDefinition<Definition>[]
		loading?: RouterLoading<RouterModelRouteDefinition<Definition>>
		notFound?: RouterNotFound<RouterModelRouteDefinition<Definition>>
	},
	scope: Record<PropertyKey, unknown>
): JSX.Element {
	function wrap(content: JSX.Element | JSX.Element[]): JSX.Element {
		return <>{content}</>
	}
	const match = props.model.matcher(props.url)
	if (!isExactRouteMatch(match, props.route)) {
		if (props.notFound) return wrap(props.notFound({ routes: props.routes, url: props.url }, scope))
		return <div data-testid="dockview-router-not-found">Route not found: {props.url}</div>
	}
	if ('view' in props.route && typeof props.route.view === 'function') {
		return wrap(props.route.view(match, scope))
	}
	if (props.route.loading) {
		return wrap(props.route.loading({ route: props.route, url: props.url }, scope))
	}
	if (props.loading) {
		return wrap(props.loading({ route: props.route, url: props.url }, scope))
	}
	return <div data-testid="dockview-router-loading">Loading route…</div>
}

function createRouteWidgets<Definition extends ClientRouteDefinition>(
	props: Pick<DockviewRouterProps<Definition>, 'routes' | 'extraWidgets' | 'loading' | 'notFound'>,
	model: RouterModel<Definition>
): Record<string, DockviewWidget<any>> {
	const widgets: Record<string, DockviewWidget<any>> = { ...(props.extraWidgets ?? {}) }
	for (const route of props.routes) {
		widgets[route.path] = (
			widgetProps: { params: DockviewRouteWidgetParams },
			widgetScope: Record<PropertyKey, unknown>
		) => {
			const url = String(widgetProps.params?.url ?? '')
			return renderRoutePanel(
				{
					model,
					route,
					url,
					routes: props.routes,
					loading: props.loading,
					notFound: props.notFound,
				},
				widgetScope
			)
		}
	}
	return widgets
}

function openRoutePanel<Definition extends ClientRouteDefinition>(
	api: DockviewApi,
	opened: OpenedRoute<Definition>,
	debug?: DockviewRouterProps<Definition>['debug'],
	reportError?: DockviewRouterErrorReporter
) {
	try {
		const existing = api.panels.find((panel) => panel.id === opened.id)
		if (existing) {
			logDockviewRouter(debug, 'openRoutePanel:existing', {
				activePanelId: api.activePanel?.id,
				panelCount: api.panels.length,
				routeId: opened.id,
				url: opened.url,
			})
			existing.api.setActive()
			existing.group.model.openPanel(existing)
			return existing
		}
		const candidate = api.activePanel ?? api.panels[0]
		const referencePanel =
			candidate && api.panels.some((p) => p.id === candidate.id) ? candidate : undefined
		logDockviewRouter(debug, 'openRoutePanel:add', {
			activePanelId: api.activePanel?.id,
			panelCount: api.panels.length,
			referencePanelId: referencePanel?.id,
			routeId: opened.id,
			url: opened.url,
		})
		const panel = api.addPanel({
			id: opened.id,
			title: opened.title,
			component: opened.match.definition.path,
			params: {
				...opened.match.params,
				url: opened.url,
				routeId: opened.id,
			},
			floating: false,
			...(referencePanel
				? { position: { referencePanel, direction: 'within' as const } }
				: { position: { direction: 'right' as const } }),
		})
		logDockviewRouter(debug, 'openRoutePanel:added', {
			activePanelId: api.activePanel?.id,
			panelCount: api.panels.length,
			routeId: opened.id,
			url: opened.url,
		})
		return panel
	} catch (e) {
		console.error('[DockviewRouter] openRoutePanel error:', opened.id, e)
		reportDockviewRouterError('openRoutePanel', opened.id, e, reportError)
		return undefined
	}
}

function openInitialRoutes<Definition extends ClientRouteDefinition>(
	api: DockviewApi,
	model: RouterModel<Definition>,
	urls: readonly string[],
	debug?: DockviewRouterProps<Definition>['debug'],
	reportError?: DockviewRouterErrorReporter
) {
	for (const url of urls) {
		try {
			logDockviewRouter(debug, 'openInitialRoutes:open', { url })
			const opened = model.open(url)
			if (!opened) {
				logDockviewRouter(debug, 'openInitialRoutes:miss', { url })
				continue
			}
			openRoutePanel(api, opened, debug, reportError)
		} catch (e) {
			console.error('[DockviewRouter] openInitialRoutes error:', url, e)
			reportDockviewRouterError('openInitialRoutes', url, e, reportError)
		}
	}
}

function normalizeBase(base: string | undefined) {
	if (!base || base === '/') return ''
	const normalized = base.startsWith('/') ? base : `/${base}`
	return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
}

function stripBase(url: string, base: string) {
	if (!base) return url
	if (url === base) return '/'
	if (url.startsWith(`${base}/`)) return url.slice(base.length)
	return url
}

function prependBase(url: string, base: string) {
	if (!base) return url
	if (!url || url === '/') return base
	if (/^[?#]/.test(url)) return `${base}${url}`
	return `${base}${url.startsWith('/') ? url : `/${url}`}`
}

function getClientRouteUrl(base = '') {
	return stripBase(`${client.url.pathname}${client.url.search}`, base)
}

function findOpenedRouteByUrl<Definition extends ClientRouteDefinition>(
	model: RouterModel<Definition>,
	url: string
) {
	for (let index = model.opened.length - 1; index >= 0; index -= 1) {
		const opened = model.opened[index]
		if (opened?.url === url) return opened
	}
	return null
}

function syncActiveRouteToUrl(
	activeUrl: string | undefined,
	currentUrl: string,
	base = '',
	replace: (url: string) => void = (url) => client.replace(url)
) {
	if (!activeUrl || activeUrl === currentUrl) return false
	replace(prependBase(activeUrl, base))
	return true
}

function syncClientRouteToDockview<Definition extends ClientRouteDefinition>(
	api: DockviewApi,
	model: RouterModel<Definition>,
	context: {
		url: string
		navigation: NavigationKind
	},
	debug?: DockviewRouterProps<Definition>['debug'],
	reportError?: DockviewRouterErrorReporter,
	clearError?: () => void
) {
	if (!context.url) {
		logDockviewRouter(debug, 'syncClientRouteToDockview:skip-empty')
		clearError?.()
		return null
	}
	const activePanel = api.activePanel
	if (activePanel?.params?.url === context.url) {
		logDockviewRouter(debug, 'syncClientRouteToDockview:skip-active', {
			navigation: context.navigation,
			url: context.url,
		})
		clearError?.()
		return null
	}
	try {
		const existingPanel = api.panels.find((p) => p.params?.url === context.url)
		if (existingPanel) {
			let reuseSuccess = true
			try {
				model.activate(existingPanel.id)
			} catch (e) {
				reuseSuccess = false
				console.error('[DockviewRouter] model.activate error:', existingPanel.id, e)
				reportDockviewRouterError('model.activate', existingPanel.id, e, reportError)
			}
			try {
				existingPanel.api.setActive()
			} catch (e) {
				reuseSuccess = false
				console.error('[DockviewRouter] setActive error:', existingPanel.id, e)
				reportDockviewRouterError('setActive', existingPanel.id, e, reportError)
			}
			try {
				existingPanel.group.model.openPanel(existingPanel)
			} catch (e) {
				reuseSuccess = false
				console.error('[DockviewRouter] openPanel error:', existingPanel.id, e)
				reportDockviewRouterError('openPanel', existingPanel.id, e, reportError)
			}
			logDockviewRouter(debug, 'syncClientRouteToDockview:reuse-existing', {
				navigation: context.navigation,
				routeId: existingPanel.id,
				url: context.url,
			})
			if (reuseSuccess) clearError?.()
			return null
		}
		logDockviewRouter(debug, 'syncClientRouteToDockview:open', {
			activeUrl: api.activePanel?.params?.url,
			navigation: context.navigation,
			url: context.url,
		})
		const opened = model.open(context.url)
		if (!opened) {
			logDockviewRouter(debug, 'syncClientRouteToDockview:miss', {
				navigation: context.navigation,
				url: context.url,
			})
			clearError?.()
			return null
		}
		openRoutePanel(api, opened, debug, reportError)
		logDockviewRouter(debug, 'syncClientRouteToDockview:opened', {
			panelCount: api.panels.length,
			routeId: opened.id,
			url: opened.url,
		})
		clearError?.()
		return opened
	} catch (e) {
		console.error('[DockviewRouter] syncClientRouteToDockview error:', context.url, e)
		reportDockviewRouterError('syncClientRouteToDockview', context.url, e, reportError)
		return null
	}
}

function reconcileDockviewRouteState<Definition extends ClientRouteDefinition>(
	api: DockviewApi,
	model: RouterModel<Definition>,
	debug?: DockviewRouterProps<Definition>['debug']
) {
	const panelIds = new Set(api.panels.map((panel) => panel.id))
	for (const opened of [...model.opened]) {
		if (!panelIds.has(opened.id)) {
			logDockviewRouter(debug, 'reconcileDockviewRouteState:close-missing', {
				panelCount: api.panels.length,
				routeId: opened.id,
				url: opened.url,
			})
			model.close(opened.id)
		}
	}
	const activePanel = api.activePanel ?? api.panels[0]
	if (!activePanel) {
		logDockviewRouter(debug, 'reconcileDockviewRouteState:no-active', {
			openedCount: model.opened.length,
			panelCount: api.panels.length,
		})
		return null
	}
	model.activate(activePanel.id)
	logDockviewRouter(debug, 'reconcileDockviewRouteState:active', {
		activePanelId: activePanel.id,
		activeUrl: model.active?.url,
		openedCount: model.opened.length,
		panelCount: api.panels.length,
	})
	return model.active
}

function bindDockviewRouter<Definition extends ClientRouteDefinition>(
	api: DockviewApi,
	model: RouterModel<Definition>,
	base: string,
	debug?: DockviewRouterProps<Definition>['debug'],
	reportError?: DockviewRouterErrorReporter,
	clearError?: () => void
) {
	let syncing = false
	const reconcileFromPanels = () => {
		try {
			logDockviewRouter(debug, 'bindDockviewRouter:sync-from-panels', {
				activePanelId: api.activePanel?.id,
				panelCount: api.panels.length,
			})
			reconcileDockviewRouteState(api, model, debug)
		} catch (e) {
			console.error('[DockviewRouter] reconcileFromPanels error:', e)
			reportDockviewRouterError(
				'reconcileFromPanels',
				api.activePanel?.id ?? 'dockview',
				e,
				reportError
			)
		}
	}
	const syncActivePanelToUrl = () => {
		if (syncing) return
		try {
			logDockviewRouter(debug, 'bindDockviewRouter:sync-active-to-url', {
				activePanelId: api.activePanel?.id,
				panelCount: api.panels.length,
			})
			const active = reconcileDockviewRouteState(api, model, debug)
			syncActiveRouteToUrl(active?.url, getClientRouteUrl(base), base)
			clearError?.()
		} catch (e) {
			console.error('[DockviewRouter] syncActivePanelToUrl error:', e)
			reportDockviewRouterError(
				'syncActivePanelToUrl',
				api.activePanel?.id ?? 'dockview',
				e,
				reportError
			)
		}
	}
	const onAdd = api.onDidAddPanel(reconcileFromPanels)
	const onRemove = api.onDidRemovePanel(reconcileFromPanels)
	const onActive = api.onDidActivePanelChange(syncActivePanelToUrl)
	const stopEffect = effect`bindDockviewRouter.syncClientRoute`(() => {
		caught((error: unknown) => {
			console.error('[DockviewRouter] bindDockviewRouter reactive error:', error)
			reportDockviewRouterError('bindDockviewRouter', 'reactive-read', error, reportError)
		})
		const context = {
			url: getClientRouteUrl(base),
			navigation: client.history.navigation,
		}
		syncing = true
		try {
			syncClientRouteToDockview(api, model, context, debug, reportError, clearError)
		} catch (e) {
			console.error('[DockviewRouter] bindDockviewRouter effect error:', e)
			reportDockviewRouterError('bindDockviewRouter', context.url, e, reportError)
		} finally {
			syncing = false
		}
	})
	return () => {
		logDockviewRouter(debug, 'bindDockviewRouter:dispose')
		onAdd.dispose()
		onRemove.dispose()
		onActive.dispose()
		stopEffect()
	}
}

export const DockviewRouter = <Definition extends ClientRouteDefinition>(
	inputProps: DockviewRouterProps<Definition>,
	scope: Record<PropertyKey, unknown>
) => {
	const props = defaults(inputProps, {})
	const state = reactive({ runtimeError: null as string | null })
	const base = normalizeBase(props.base)
	const initialUrls = inputProps.initialUrls?.length
		? inputProps.initialUrls.map((url) => stripBase(url, base))
		: inputProps.initialUrl
			? [stripBase(inputProps.initialUrl, base)]
			: []
	let nextRouteId = 0
	const model = routerModel<Definition>({
		routes: props.routes,
		notFound: props.notFound,
		onRouteStart: props.onRouteStart,
		onRouteEnd: props.onRouteEnd,
		onRouteError: props.onRouteError,
		getRouteId: props.getRouteId ?? ((_match, url) => `${url}#${++nextRouteId}`),
	})
	const widgets = createRouteWidgets(props, model)
	let stopBindings: (() => void) | undefined
	const clearRuntimeError = () => {
		if (state.runtimeError !== null) state.runtimeError = null
	}
	const reportRuntimeError: DockviewRouterErrorReporter = (message) => {
		state.runtimeError = message
	}
	const onReady = (api: DockviewApi) => {
		try {
			logDockviewRouter(props.debug, 'setup:ready', {
				base,
				initialUrls,
				panelCount: api.panels.length,
			})
			openInitialRoutes(api, model, initialUrls, props.debug, reportRuntimeError)
			reconcileDockviewRouteState(api, model, props.debug)
			stopBindings = bindDockviewRouter(
				api,
				model,
				base,
				props.debug,
				reportRuntimeError,
				clearRuntimeError
			)
		} catch (e) {
			console.error('[DockviewRouter] onReady error:', e)
			reportDockviewRouterError('onReady', base || '/', e, reportRuntimeError)
		}
	}
	const errorBannerRef = { current: null as HTMLDivElement | null }
	const setErrorBannerEl = (el: HTMLElement) => {
		errorBannerRef.current = el as HTMLDivElement
	}
	const setup = () => {
		return () => {
			logDockviewRouter(props.debug, 'setup:dispose')
			stopBindings?.()
		}
	}
	effect`DockviewRouter.renderRuntimeError`(() => {
		const el = errorBannerRef.current
		if (!el) return
		if (state.runtimeError) {
			el.style.display = 'block'
			el.textContent = state.runtimeError
		} else {
			el.style.display = 'none'
			el.textContent = ''
		}
	})
	try {
		;(scope as Record<string, unknown>).routerModel = model
	} catch (_error) {}
	return (
		<div use={setup} style="display: contents">
			<div
				use={setErrorBannerEl}
				data-test="dockview-router-runtime-error"
				style="display: none; margin: 0 0 12px 0; padding: 10px 12px; border: 1px solid #f87171; border-radius: 8px; background: #450a0a; color: #fecaca; font-size: 13px; white-space: pre-wrap;"
			/>
			<Dockview
				onReady={onReady}
				onPanelError={props.onPanelError}
				widgets={widgets}
				tabs={props.tabs}
				headerLeft={props.headerLeft}
				headerRight={props.headerRight}
				headerPrefix={props.headerPrefix}
				el={props.el}
				options={props.options}
				debug={props.debug}
				layout={props.layout}
			/>
		</div>
	)
}

export const dockviewRouterInternals = {
	bindDockviewRouter,
	createRouteWidgets,
	findOpenedRouteByUrl,
	formatDockviewRouterError,
	getClientRouteUrl,
	normalizeBase,
	prependBase,
	reconcileDockviewRouteState,
	renderRoutePanel,
	stripBase,
	syncActiveRouteToUrl,
	syncClientRouteToDockview,
	openInitialRoutes,
	openRoutePanel,
}

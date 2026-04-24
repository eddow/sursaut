import { defaults, latch, SursautElement } from '@sursaut/core'
import { effect, lift, link, reactive, untracked } from 'mutts'
import { perf, recordPerf } from '../perf.js'
import { client } from '../platform/shared.js'
import type { NavigationKind } from '../platform/types.js'
import { getLoadedRouteView, loadRouteView, registerPrefetchRoutes } from './lazy-cache.js'
import {
	matchRoute as coreMatchRoute,
	routeMatcher as coreRouteMatcher,
	type ParsedPathSegment,
	type ParsedQueryParam,
	type ParsedRoute,
	type RouteParamFormat,
	type RouteParams,
	type RouteWildcard,
} from './logic.js'
import { getRouterPathnamePrefix, toAppPath } from './pathname-base.js'
import { routerModel } from './router-model.js'
// TODO: Router should scroll=0 on reload - r is it something else than router ? (more general)
// Re-export core types
export type {
	ParsedPathSegment,
	ParsedQueryParam,
	ParsedRoute,
	RouteParamFormat,
	// RouteParams, // Hide from re-export to avoid conflict with defs.ts
	RouteWildcard,
}
export { buildRoute } from './logic.js'

// === ROUTER TYPES ===

/** Minimal route definition for client-side routing. */
export interface ClientRouteDefinition {
	readonly path: RouteWildcard
}

/** Result of a successful route match — passed to the route's `view` function. */
export type RouteSpecification<Definition extends ClientRouteDefinition> = {
	readonly definition: Definition
	readonly params: RouteParams
	readonly unusedPath: string
}

/** View function signature: receives the matched route spec and scope, returns JSX. */
export type RouterRender<Definition extends ClientRouteDefinition> = (
	specification: RouteSpecification<Definition>,
	scope: Record<PropertyKey, unknown>
) => JSX.Element | JSX.Element[]

export interface LazyRouteModule<Definition extends ClientRouteDefinition> {
	readonly default?: RouterRender<Definition>
	readonly view?: RouterRender<Definition>
}

export type RouterLazyLoader<Definition extends ClientRouteDefinition> = () => Promise<
	RouterRender<Definition> | LazyRouteModule<Definition>
>

export type EagerRouteDefinition<Definition extends ClientRouteDefinition> = Definition & {
	readonly view: RouterRender<Definition>
	readonly lazy?: never
	readonly loading?: never
	readonly error?: never
}

export type LazyRouteDefinition<Definition extends ClientRouteDefinition> = Definition & {
	readonly lazy: RouterLazyLoader<Definition>
	readonly view?: never
	readonly loading?: RouterLoading<RouterRouteDefinition<Definition>>
	readonly error?: RouterError<RouterRouteDefinition<Definition>>
}

export type RouterRouteDefinition<Definition extends ClientRouteDefinition> =
	| EagerRouteDefinition<Definition>
	| LazyRouteDefinition<Definition>

/** Fallback renderer when no route matches. */
export type RouterNotFound<Definition extends ClientRouteDefinition> = (
	context: { url: string; routes: readonly Definition[] },
	scope: Record<PropertyKey, unknown>
) => JSX.Element | JSX.Element[]

export type RouterLoadingContext<Definition extends ClientRouteDefinition> = {
	readonly route: RouterRouteDefinition<Definition>
	readonly url: string
}

export type RouterLoading<Definition extends ClientRouteDefinition> = (
	context: RouterLoadingContext<Definition>,
	scope: Record<PropertyKey, unknown>
) => JSX.Element | JSX.Element[]

export type RouterErrorContext<Definition extends ClientRouteDefinition> = {
	readonly route: RouterRouteDefinition<Definition>
	readonly url: string
	readonly error: unknown
}

export type RouterError<Definition extends ClientRouteDefinition> = (
	context: RouterErrorContext<Definition>,
	scope: Record<PropertyKey, unknown>
) => JSX.Element | JSX.Element[]

export type RouterNavigationStatus = 'match' | 'not-found'

export type RouterNavigationContext<Definition extends ClientRouteDefinition> = {
	readonly from: string | undefined
	readonly to: string
	readonly navigation: NavigationKind
	readonly route: RouterRouteDefinition<Definition> | null
	readonly match: RouteSpecification<RouterRouteDefinition<Definition>> | null
}

export type RouterNavigationEndContext<Definition extends ClientRouteDefinition> =
	RouterNavigationContext<Definition> & {
		readonly status: RouterNavigationStatus
	}

export type RouterNavigationErrorContext<Definition extends ClientRouteDefinition> =
	RouterNavigationContext<Definition> & {
		readonly error: unknown
	}

export type RouterOnRouteStart<Definition extends ClientRouteDefinition> = (
	context: RouterNavigationContext<Definition>
) => void

export type RouterOnRouteEnd<Definition extends ClientRouteDefinition> = (
	context: RouterNavigationEndContext<Definition>
) => void

export type RouterOnRouteError<Definition extends ClientRouteDefinition> = (
	context: RouterNavigationErrorContext<Definition>
) => void

/** Props for the `<Router>` component. */
export interface RouterProps<Definition extends ClientRouteDefinition> {
	readonly routes: readonly Definition[]
	readonly notFound: RouterNotFound<Definition>
	readonly loading?: RouterLoading<Definition>
	readonly onRouteStart?: RouterOnRouteStart<Definition>
	readonly onRouteEnd?: RouterOnRouteEnd<Definition>
	readonly onRouteError?: RouterOnRouteError<Definition>
	/**
	 * Whether to scroll to the top of the window on route changes.
	 * @default true
	 */
	readonly scrollToTop?: boolean
}

/** Pre-compiled route matcher function. */
export type RouteAnalyzer<Definition extends ClientRouteDefinition> = (
	url: string
) => RouteSpecification<Definition> | null

// === MATCHER WRAPPERS ===

/** Match a URL against client route definitions. Wrapper around core `matchRoute`. */
export function matchRoute<Definition extends ClientRouteDefinition>(
	road: string,
	definitions: readonly Definition[]
): RouteSpecification<Definition> | null {
	const result = coreMatchRoute(road, definitions)
	if (!result) return null
	return {
		definition: result.definition,
		params: result.params,
		unusedPath: result.unusedPath,
	}
}

/** Create a reusable route matcher for client route definitions. */
export function routeMatcher<Definition extends ClientRouteDefinition>(
	routes: readonly Definition[]
): RouteAnalyzer<Definition> {
	const matcher = coreRouteMatcher(routes)
	return (url: string) => {
		const result = matcher(url)
		if (!result) return null
		return {
			definition: result.definition,
			params: result.params,
			unusedPath: result.unusedPath,
		}
	}
}

function hasRouteView<Definition extends ClientRouteDefinition>(
	route: RouterRouteDefinition<Definition>
): route is EagerRouteDefinition<Definition> {
	return 'view' in route && typeof route.view === 'function'
}

// === COMPONENTS ===

/**
 * Reactive router component.
 * Matches `client.url.pathname` against route definitions and renders the matching view.
 * Re-renders automatically when the URL changes.
 */
export function Router<Definition extends ClientRouteDefinition>(
	props: RouterProps<RouterRouteDefinition<Definition>>,
	scope: Record<PropertyKey, unknown>
) {
	const vm = defaults(props, {
		get url() {
			const path =
				getRouterPathnamePrefix() === '' ? client.url.pathname : toAppPath(client.url.pathname)
			return `${path}${client.url.search}`
		},
		scrollToTop: true,
	})
	registerPrefetchRoutes(vm.routes)
	const model = routerModel<Definition>({ routes: vm.routes })
	const matcher = model.matcher
	let lastStartedSignature: string | undefined
	let lastCompletedSignature: string | undefined
	let lastErroredSignature: string | undefined
	let lastNavigationUrl: string | undefined
	let activeNavigationFrom: string | undefined
	let lastRenderedDefinition: RouterRouteDefinition<Definition> | undefined
	let lastRenderedOutput: Node[] | undefined
	const routeSpecificationState = untracked`router:routeSpecificationState`(() =>
		reactive({
			current: null as RouteSpecification<RouterRouteDefinition<Definition>> | null,
		})
	)
	try {
		;(scope as Record<string, unknown>).routeSpecification = routeSpecificationState
	} catch (_error) {}
	const lazyStates = new Map<
		RouteWildcard,
		{
			status: 'loading' | 'ready' | 'error'
			view: RouterRender<Definition> | undefined
			error: unknown
		}
	>()

	function getNavigationSignature() {
		return `${client.history.navigation}:${vm.url}`
	}

	function createNavigationContext(
		match: RouteSpecification<RouterRouteDefinition<Definition>> | null
	): RouterNavigationContext<Definition> {
		return {
			from: activeNavigationFrom,
			match,
			navigation: client.history.navigation,
			route: match?.definition ?? null,
			to: vm.url,
		}
	}

	function publishRouteSpecification(
		match: RouteSpecification<RouterRouteDefinition<Definition>> | null
	) {
		if (!match) {
			routeSpecificationState.current = null
			return null
		}
		const published = {
			...match,
			params: { ...match.params },
		}
		routeSpecificationState.current = published
		return published
	}

	function emitRouteStart(match: RouteSpecification<RouterRouteDefinition<Definition>> | null) {
		const signature = getNavigationSignature()
		if (lastStartedSignature === signature) return signature
		activeNavigationFrom = lastNavigationUrl
		lastNavigationUrl = vm.url
		lastStartedSignature = signature
		lastErroredSignature = undefined
		vm.onRouteStart?.(createNavigationContext(match))
		return signature
	}

	function emitRouteEnd(
		match: RouteSpecification<RouterRouteDefinition<Definition>> | null,
		status: RouterNavigationStatus
	) {
		const signature = getNavigationSignature()
		if (lastCompletedSignature === signature) return
		lastCompletedSignature = signature
		vm.onRouteEnd?.({ ...createNavigationContext(match), status })
	}

	function emitRouteError(
		match: RouteSpecification<RouterRouteDefinition<Definition>> | null,
		error: unknown
	) {
		const signature = getNavigationSignature()
		if (lastErroredSignature === signature) return
		lastErroredSignature = signature
		vm.onRouteError?.({ ...createNavigationContext(match), error })
	}

	function getLazyState(route: LazyRouteDefinition<Definition>) {
		const cached = lazyStates.get(route.path)
		if (cached) return cached
		const existing = getLoadedRouteView(route.path) as RouterRender<Definition> | undefined

		const created = untracked`router:lazyState`(() =>
			reactive({
				status: (existing ? 'ready' : 'loading') as 'loading' | 'ready' | 'error',
				view: existing,
				error: undefined as unknown,
			})
		)
		lazyStates.set(route.path, created)

		if (existing) return created

		void loadRouteView(route)
			.then((view) => {
				created.view = view
				created.error = undefined
				created.status = 'ready'
			})
			.catch((error: unknown) => {
				const current = matcher(vm.url)
				if (current && current.definition.path === route.path) {
					emitRouteError(current, error)
				}
				created.view = undefined
				created.error = error
				created.status = 'error'
			})

		return created
	}

	function renderElements(jsx: JSX.Element | JSX.Element[]): Node[] {
		const els = Array.isArray(jsx) ? jsx : [jsx]
		const outputs: Node[] = []
		els.forEach((el) => {
			if (!(el instanceof SursautElement)) throw new Error('Invalid JSX element for route')
			const nodes = el.render(scope)
			const nodeArray = Array.isArray(nodes)
				? Array.from(nodes)
				: nodes && typeof nodes === 'object' && Symbol.iterator in nodes
					? Array.from(nodes as Iterable<Node>)
					: [nodes]
			// Anchor the reactive proxy to the DOM node so it is not garbage collected
			if (nodeArray.length > 0 && typeof nodes === 'object' && nodes !== null) {
				link(nodeArray[0], nodes)
			}
			outputs.push(...nodeArray)
		})
		return outputs
	}

	const LazyRouteOutlet = (
		lazyProps: {
			route: LazyRouteDefinition<Definition>
			match: RouteSpecification<RouterRouteDefinition<Definition>>
			url: string
			loading?: RouterLoading<RouterRouteDefinition<Definition>>
		},
		lazyScope: Record<PropertyKey, unknown>
	) => {
		const lazyState = getLazyState(lazyProps.route)

		function renderLazyError(_current: RouteSpecification<RouterRouteDefinition<Definition>>) {
			if (lazyProps.route.error) {
				return lazyProps.route.error(
					{ error: lazyState.error, route: lazyProps.route, url: vm.url },
					lazyScope
				)
			}

			return (
				<div style="padding: 20px; border: 1px solid #ff6b6b; background-color: #ffe0e0; color: #d63031; margin: 20px;">
					<h2 style="margin-top: 0">Something went wrong</h2>
					<p>Error loading route module.</p>
					<details>
						<summary>Error details</summary>
						<pre style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px; margin-top: 10px;">
							{lazyState.error instanceof Error ? lazyState.error.stack : String(lazyState.error)}
						</pre>
					</details>
				</div>
			)
		}

		function renderLazyLoading(_current: RouteSpecification<RouterRouteDefinition<Definition>>) {
			if (lazyProps.route.loading) {
				return lazyProps.route.loading({ route: lazyProps.route, url: vm.url }, lazyScope)
			}

			if (lazyProps.loading) {
				return lazyProps.loading({ route: lazyProps.route, url: vm.url }, lazyScope)
			}

			return (
				<div
					data-testid="router-loading-view"
					aria-live="polite"
					style="padding: 20px; color: #cbd5e1;"
				>
					<div style="height: 3px; border-radius: 999px; background: linear-gradient(90deg, #2563eb, #7dd3fc); margin-bottom: 12px;" />
					Loading route…
				</div>
			)
		}

		return (
			<div
				style="display: contents"
				use={(target: Node | Node[]) => {
					const host = Array.isArray(target) ? target[0] : target
					if (!(host instanceof Element)) return

					let stopLatched: (() => void) | undefined
					const stopEffect = effect`router:lazy-outlet`(() => {
						const current = matcher(vm.url)
						if (!current || current.definition.path !== lazyProps.route.path) return

						const content =
							lazyState.status === 'error'
								? renderLazyError(current)
								: lazyState.status === 'ready' && lazyState.view
									? lazyState.view(current, lazyScope)
									: renderLazyLoading(current)

						stopLatched?.()
						stopLatched = latch(host, content, lazyScope)
					})

					link(host, stopEffect, () => stopLatched?.())
				}}
			/>
		)
	}

	return lift(function routerCompute() {
		try {
			const matchStartedAt = perf?.now()
			const match = matcher(vm.url)
			emitRouteStart(match)
			if (matchStartedAt != null) recordPerf('route:match', matchStartedAt)

			if (
				match &&
				(match.unusedPath === '' || match.unusedPath === '/' || match.unusedPath.startsWith('#'))
			) {
				// Scroll to top for push/replace navigation in SPA Router (not pop)
				if (vm.scrollToTop && client.history.navigation !== 'pop') {
					requestAnimationFrame(() => window.scrollTo(0, 0))
				}

				model.clear()
				const opened = model.open(vm.url)
				const current = publishRouteSpecification(opened?.match ?? match)
				if (!current) throw new Error('Route specification missing after successful match')
				if (lastRenderedDefinition === current.definition && lastRenderedOutput) {
					emitRouteEnd(current, 'match')
					return lastRenderedOutput
				}
				if (hasRouteView(current.definition)) {
					try {
						const renderStartedAt = perf?.now()
						const output = renderElements(current.definition.view(current, scope))
						if (renderStartedAt != null) recordPerf('route:render', renderStartedAt)
						lastRenderedDefinition = current.definition
						lastRenderedOutput = output
						emitRouteEnd(current, 'match')
						return output
					} catch (err) {
						lastRenderedDefinition = undefined
						lastRenderedOutput = undefined
						emitRouteError(current, err)
						console.error('Router view error:', err)
						return renderElements(
							<div style="padding: 20px; border: 1px solid #ff6b6b; background-color: #ffe0e0; color: #d63031; margin: 20px;">
								<h2 style="margin-top: 0">Something went wrong</h2>
								<p>Error loading route.</p>
								<details>
									<summary>Error details</summary>
									<pre style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px; margin-top: 10px;">
										{err instanceof Error ? err.stack : String(err)}
									</pre>
								</details>
							</div>
						)
					}
				}

				const cachedView = getLoadedRouteView(current.definition.path) as
					| RouterRender<Definition>
					| undefined
				if (cachedView) {
					try {
						const renderStartedAt = perf?.now()
						const output = renderElements(cachedView(current, scope))
						if (renderStartedAt != null) recordPerf('route:render', renderStartedAt)
						lastRenderedDefinition = current.definition
						lastRenderedOutput = output
						emitRouteEnd(current, 'match')
						return output
					} catch (err) {
						lastRenderedDefinition = undefined
						lastRenderedOutput = undefined
						emitRouteError(current, err)
						console.error('Router view error:', err)
						return renderElements(
							<div style="padding: 20px; border: 1px solid #ff6b6b; background-color: #ffe0e0; color: #d63031; margin: 20px;">
								<h2 style="margin-top: 0">Something went wrong</h2>
								<p>Error loading route.</p>
								<details>
									<summary>Error details</summary>
									<pre style="background-color: #f8f9fa; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px; margin-top: 10px;">
										{err instanceof Error ? err.stack : String(err)}
									</pre>
								</details>
							</div>
						)
					}
				}
				emitRouteEnd(current, 'match')
				const output = renderElements(
					<LazyRouteOutlet
						route={current.definition}
						match={current}
						url={vm.url}
						loading={vm.loading}
					/>
				)
				lastRenderedDefinition = current.definition
				lastRenderedOutput = output
				return output
			}
			model.clear()
			publishRouteSpecification(null)
			lastRenderedDefinition = undefined
			lastRenderedOutput = undefined
			const notFoundStartedAt = perf?.now()
			const output = renderElements(vm.notFound({ routes: vm.routes, url: vm.url }, scope))
			if (notFoundStartedAt != null) recordPerf('route:not-found', notFoundStartedAt)
			emitRouteEnd(null, 'not-found')
			return output
		} catch (err) {
			publishRouteSpecification(null)
			lastRenderedDefinition = undefined
			lastRenderedOutput = undefined
			emitRouteError(null, err)
			console.error('Router matching error:', err)
			return renderElements(
				<div style="padding: 20px; border: 1px solid #ff6b6b; background-color: #ffe0e0; color: #d63031; margin: 20px;">
					<h2>Something went wrong</h2>
					<p>Router error.</p>
				</div>
			)
		}
	})
}

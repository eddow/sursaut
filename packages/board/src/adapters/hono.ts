/**
 * Hono adapter for sursaut-board
 * Handles UI route tree building for SSR and content injection.
 * API routing is handled separately by the `expose` system.
 */

import { type RouteMatch, routeMatcher } from '@sursaut/kit'
import type { Context, MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { enableSSR, setRouteRegistry } from '../lib/http/client.js'
import {
	clearExposeRegistry,
	type HTTPVerb,
	type RouteRegistryEntry,
	routeRegistry,
	type SursautRequest,
} from '../lib/router/expose.js'
import { buildRouteTree, type RouteTreeNode } from '../lib/router/index.js'
import { injectSSRContent, withSSRContext } from '../lib/ssr/utils.js'

export interface SursautMiddlewareOptions {
	/** Path to routes directory. Defaults to './routes' */
	routesDir?: string
	/** Custom module importer (e.g. vite.ssrLoadModule) */
	importFn?: (path: string) => Promise<any>
	/** Glob routes object for environments without filesystem access (e.g. production) */
	globRoutes?: Record<string, () => Promise<any>>
}

// Cached route trees (lazily initialized per routesDir)
const routeTreeCache = new Map<string, RouteTreeNode>()

// Flattened API routes for rapid matching
interface ApiRoute {
	path: string
	entry: RouteRegistryEntry
}
const apiMatcherCache = new Map<string, (url: string) => RouteMatch<ApiRoute> | null>()

/**
 * Create Hono middleware that handles sursaut-board SSR and UI routing.
 * API routing is handled separately by the `expose` system.
 */
export function createSursautMiddleware(options?: SursautMiddlewareOptions): MiddlewareHandler {
	const routesDir = options?.routesDir ?? './routes'

	return async (c: Context, next: () => Promise<void>) => {
		const url = new URL(c.req.url)
		const origin = `${url.protocol}//${url.host}`

		await withSSRContext(async () => {
			// Build UI route tree once (lazy init per routesDir)
			let routeTree = routeTreeCache.get(routesDir)
			if (!routeTree) {
				routeTree = await buildRouteTree(routesDir, options?.importFn, options?.globRoutes)
				routeTreeCache.set(routesDir, routeTree)

				// Build API routes once `buildRouteTree` executes the `expose` files
				const apiRoutes: ApiRoute[] = []
				for (const [path, entry] of routeRegistry.entries()) {
					apiRoutes.push({ path, entry })
				}
				const matcher = routeMatcher(apiRoutes)
				apiMatcherCache.set(routesDir, matcher)

				// 3.4 Hook up server-side local proxy dispatch
				setRouteRegistry({
					match(path: string, method: HTTPVerb | string) {
						const match = matcher(path)
						if (match && (!match.unusedPath || match.unusedPath === '/')) {
							const verb = method.toLowerCase() as HTTPVerb
							const endpoint =
								match.definition.entry.endpoints.get(verb) ||
								(verb === 'get' ? match.definition.entry.endpoints.get('stream') : undefined)
							if (endpoint) {
								return {
									handler: endpoint.handler,
									middlewareStack: endpoint.middle as any, // MiddleFunction overlaps closely with RouteHandler mw
									params: match.params,
								}
							}
						}
						return null
					},
				})
			}

			// Content negotiation
			const accept = c.req.header('accept') || ''
			const isSpaProvideFetch = c.req.header('X-Sursaut-Provide') === 'true'
			const expectsHtml = accept.includes('text/html')

			// 1. Check API Routes (if it's not explicitly a UI navigation request)
			let apiHandled = false
			if (!expectsHtml || isSpaProvideFetch) {
				const matcher = apiMatcherCache.get(routesDir)
				const match = matcher ? matcher(url.pathname) : null

				// API routes require an EXACT match (no leftover unusedPath)
				if (match && (!match.unusedPath || match.unusedPath === '/')) {
					apiHandled = true
					const sursautReq: SursautRequest = {
						params: match.params,
						url,
						raw: c.req.raw,
						request: c.req.raw,
					}

					let finalHandler: ((req: SursautRequest) => any) | null = null

					if (isSpaProvideFetch) {
						if (match.definition.entry.provide) {
							finalHandler = match.definition.entry.provide
						} else {
							c.res = c.json({})
							return
						}
					} else {
						const reqVerb = c.req.method.toLowerCase() as HTTPVerb
						const endpoint =
							match.definition.entry.endpoints.get(reqVerb) ||
							(reqVerb === 'get' ? match.definition.entry.endpoints.get('stream') : undefined)
						if (!endpoint) {
							apiHandled = false
						} else {
							finalHandler = endpoint.handler
						}
					}

					if (finalHandler) {
						// Execute pipeline with middleware
						let mwIndex = -1
						const executeChain = async (i: number): Promise<Response> => {
							if (i <= mwIndex) throw new Error('next() called multiple times')
							mwIndex = i

							if (!isSpaProvideFetch && i < match.definition.entry.middle.length) {
								const layer = match.definition.entry.middle[i]
								const result = await layer(sursautReq, () => executeChain(i + 1))
								if (result === undefined) return executeChain(i + 1)
								return result
							} else {
								const result = await finalHandler(sursautReq)
								if (result instanceof Response) return result
								return c.json(result)
							}
						}

						c.res = await executeChain(0)
					}
				}
			}

			// 2. Fallthrough to UI Routing / other handlers if API didn't handle it
			if (!apiHandled) {
				enableSSR()
				await next()

				// Handle SSR injection for HTML responses
				const contentType = c.res.headers.get('Content-Type')
				if (contentType?.includes('text/html')) {
					const html = await c.res.text()
					const finalHtml = await injectSSRContent(html)

					c.res = new Response(finalHtml, {
						status: c.res.status,
						headers: c.res.headers,
					})
					c.res.headers.delete('Content-Length')
				}
			}
		}, origin)
	}
}

/**
 * Create a Hono app with sursaut-board integration
 */
export function createSursautApp(options?: SursautMiddlewareOptions): Hono {
	const app = new Hono()
	app.use('*', createSursautMiddleware(options))
	return app
}

/**
 * Clear the route tree cache to force a rebuild on the next request.
 *
 * Crucial for Hot Module Replacement (HMR). When a route file is added,
 * removed, or modified, the cache must be cleared so that `buildRouteTree`
 * runs again, discovering new files and re-importing updated modules
 * (via `vite.ssrLoadModule`).
 */
export function clearRouteTreeCache(): void {
	routeTreeCache.clear()
	apiMatcherCache.clear()
	clearExposeRegistry()
}

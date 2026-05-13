import * as fs from 'node:fs'
import { createServer } from 'node:http'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getRequestListener } from '@hono/node-server'
import { h } from '@sursaut/core'
import { renderToStringAsync } from '@sursaut/core/node'
import { routeMatcher } from '@sursaut/kit'
import { Hono } from 'hono'
import { createServer as createViteServer } from 'vite'
import { clearRouteTreeCache, createSursautMiddleware } from '../adapters/hono.js'
import { enableSSR } from '../lib/http/client.js'
import type { SursautRequest } from '../lib/router/expose.js'
import { routeRegistry } from '../lib/router/expose.js'
import { buildRouteTree, matchRoute } from '../lib/router/index.js'
import { getSSRId, injectSSRContent, injectSSRData, withSSRContext } from '../lib/ssr/utils.js'
import { flushSSRPromises } from '../server/index.js'
import { plusImportResolverPlugin, resolvePlusImport } from './plus-imports.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface DevServerOptions {
	port?: number
	hmrPort?: number
	routesDir?: string
	entryHtml?: string
}

/**
 * Run the sursaut-board development server.
 */
export async function runDevServer(options: DevServerOptions = {}) {
	enableSSR()
	const port = options.port ?? 3000
	const hmrPort = options.hmrPort ?? port + 20000
	const routesDir = options.routesDir ?? './routes'
	const entryHtml = options.entryHtml ?? './index.html'
	const projectRoot = process.cwd()
	const absoluteRoutesDir = path.resolve(projectRoot, routesDir)
	const sandboxRoutesDir = path.resolve(projectRoot, 'sandbox/board-dev-routes')
	let routeImportVersion = Date.now()
	let mirroredRouteVersion = -1
	fs.rmSync(sandboxRoutesDir, { recursive: true, force: true })

	const mirrorRouteFile = (sourcePath: string, targetPath: string) => {
		const sourceCode = fs.readFileSync(sourcePath, 'utf-8')
		const rewrittenImports = sourceCode.replace(
			/((?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s*|import\s*\()(['"])([^'"]+)\2/g,
			(fullMatch, prefix, quote, specifier: string) => {
				if (!specifier.startsWith('+')) return fullMatch
				const resolved = resolvePlusImport(specifier, sourcePath, { routesDir, projectRoot })
				if (!resolved) return fullMatch
				let relativeSpecifier = path
					.relative(path.dirname(targetPath), resolved)
					.replace(/\\/g, '/')
				if (!relativeSpecifier.startsWith('.')) relativeSpecifier = `./${relativeSpecifier}`
				return `${prefix}${quote}${relativeSpecifier}${quote}`
			}
		)
		const rewritten = sourcePath.endsWith('.tsx')
			? `import { h, Fragment } from '@sursaut/core'\nconst React = { createElement: h, Fragment }\n${rewrittenImports}`
			: rewrittenImports
		fs.mkdirSync(path.dirname(targetPath), { recursive: true })
		fs.writeFileSync(targetPath, rewritten)
	}

	const mirrorRouteTree = (sourceDir: string, targetDir: string) => {
		const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
		for (const entry of entries) {
			const sourcePath = path.join(sourceDir, entry.name)
			const targetPath = path.join(targetDir, entry.name)
			if (entry.isDirectory()) {
				mirrorRouteTree(sourcePath, targetPath)
				continue
			}
			if (!entry.isFile()) continue
			mirrorRouteFile(sourcePath, targetPath)
		}
	}

	const ensureMirroredRoutes = () => {
		if (mirroredRouteVersion === routeImportVersion) return
		fs.rmSync(sandboxRoutesDir, { recursive: true, force: true })
		fs.mkdirSync(sandboxRoutesDir, { recursive: true })
		mirrorRouteTree(absoluteRoutesDir, sandboxRoutesDir)
		mirroredRouteVersion = routeImportVersion
	}

	const importRouteModule = async (modulePath: string) => {
		ensureMirroredRoutes()
		const absolutePath = path.resolve(modulePath)
		const relativeRoutePath = path.relative(absoluteRoutesDir, absolutePath)
		const mirroredPath = path.join(sandboxRoutesDir, relativeRoutePath)
		const moduleUrl = new URL(pathToFileURL(mirroredPath).href)
		moduleUrl.searchParams.set('t', String(routeImportVersion))
		return import(/* @vite-ignore */ moduleUrl.href)
	}

	const app = new Hono()

	// 1. Initialize Vite in middleware mode
	const vite = await createViteServer({
		plugins: [plusImportResolverPlugin({ routesDir })],
		server: {
			middlewareMode: true,
			hmr: {
				port: hmrPort,
			},
			fs: {
				allow: [
					path.resolve('.'),
					path.resolve(__dirname, '../../../core'),
					path.resolve(__dirname, '../../../kit'),
					path.resolve(__dirname, '../../../ui'),
					path.resolve(__dirname, '../../../../../mutts'),
				],
			},
		},
		appType: 'custom',
		resolve: {
			alias: {
				mutts: 'mutts/browser/prod',
				'@sursaut/board/client': path.resolve(__dirname, '../client/index.ts'),
				'@sursaut/board/server': path.resolve(__dirname, '../server/index.ts'),
				'@sursaut/board': path.resolve(__dirname, '../index.ts'),
			},
		},
		ssr: {
			external: ['mutts', 'mutts/browser/prod', '@sursaut/core', '@sursaut/kit', '@sursaut/ui'],
		},
	})

	// 2. Attach @sursaut/board middleware
	app.use(
		'*',
		createSursautMiddleware({
			routesDir,
			importFn: importRouteModule,
		})
	)

	vite.watcher.on('all', (event, filePath) => {
		if (filePath.startsWith(absoluteRoutesDir)) {
			routeImportVersion = Date.now()
			console.log(`[sursaut dev] Route change detected (${event}), refreshing route tree...`)
			clearRouteTreeCache()
		}
	})

	// 3. Fallback HTML handler
	app.get('*', async (c) => {
		const url = new URL(c.req.url)
		const origin = `${url.protocol}//${url.host}`

		const { result } = await withSSRContext(async () => {
			const indexPath = path.resolve(entryHtml)
			if (!fs.existsSync(indexPath)) {
				return c.text(`Entry HTML not found: \${indexPath}`, 404)
			}

			let template = fs.readFileSync(indexPath, 'utf-8')
			template = await vite.transformIndexHtml(url.pathname, template)

			const routeTree = await buildRouteTree(routesDir, importRouteModule)
			const match = matchRoute(url.pathname, routeTree)

			if (match?.component) {
				const exactEntry = routeRegistry.get(url.pathname)
				const apiRoutes = [...routeRegistry.entries()].map(([routePath, entry]) => ({
					path: routePath,
					entry,
				}))
				const matchedRoute = exactEntry
					? {
							unusedPath: '',
							params: match.params,
							definition: { path: url.pathname, entry: exactEntry },
						}
					: routeMatcher(apiRoutes)(url.pathname)
				let pageProps: Record<string, unknown> = { params: match.params }

				if (matchedRoute && (!matchedRoute.unusedPath || matchedRoute.unusedPath === '/')) {
					const provideHandler = matchedRoute.definition.entry.provide
					if (provideHandler) {
						const sursautReq: SursautRequest = {
							params: matchedRoute.params,
							url,
							raw: c.req.raw,
							request: c.req.raw,
						}
						const providedData = ((await provideHandler(sursautReq)) ?? {}) as Record<
							string,
							unknown
						>
						injectSSRData(getSSRId(url.pathname + url.search), providedData)

						pageProps = {
							...pageProps,
							...providedData,
						}
					}
				}

				if (typeof match.component !== 'function') return template

				let app = h(match.component, pageProps)
				if (match.layouts) {
					for (let i = match.layouts.length - 1; i >= 0; i--) {
						app = h(match.layouts[i], pageProps, app)
					}
				}

				let renderedHtml: string
				try {
					renderedHtml = await renderToStringAsync(app as any, undefined, {
						collectPromises: flushSSRPromises,
					})
				} catch (error) {
					console.error('[sursaut-board][dev-ssr] render failed', {
						path: url.pathname,
						params: match.params,
						pageProps,
						component:
							typeof match.component === 'function'
								? match.component.name || 'anonymous'
								: typeof match.component,
						layouts:
							match.layouts?.map((layout) =>
								typeof layout === 'function' ? layout.name || 'anonymous' : typeof layout
							) ?? [],
						error,
					})
					throw error
				}

				template = template.replace('<div id="root"></div>', `<div id="root">${renderedHtml}</div>`)
			}
			return injectSSRContent(template)
		}, origin)

		if (result instanceof Response) return result
		return c.html(result)
	})

	const honoListener = getRequestListener(app.fetch)
	const server = createServer(async (req, res) => {
		if (req.url?.startsWith('/.well-known/')) {
			res.statusCode = 404
			res.end('Not Found')
			return
		}

		vite.middlewares(req, res, async () => {
			honoListener(req, res)
		})
	})

	console.log(`\n  🚀 Sursaut-Board dev server starting...`)
	server.listen(port, () => {
		console.log(`  http://localhost:${port} (HMR: ${hmrPort})\n`)
	})

	const shutdown = async () => {
		console.log('\n  🛑 Sursaut-Board dev server shutting down...')
		await vite.close()
		server.close(() => {
			process.exit(0)
		})
	}

	process.on('SIGINT', shutdown)
	process.on('SIGTERM', shutdown)
}

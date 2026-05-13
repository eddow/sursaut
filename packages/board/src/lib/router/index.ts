import { type ParsedPathSegment, parsePathSegment, type RouteParams } from '@sursaut/kit'

/**
 * Convert a file path to a file:// URL without encoding special characters like brackets.
 * This is needed because dynamic routes like [id] would otherwise get encoded as %5Bid%5D.
 */
function toFileUrl(filePath: string): string {
	// Ensure absolute path and forward slashes
	const absolutePath = normalizePath(filePath)
	return `file://${absolutePath}`
}

function normalizePath(value: string): string {
	return value.replace(/\\/g, '/')
}

function pathStem(value: string): string {
	const normalized = normalizePath(value)
	const fileName = normalized.slice(normalized.lastIndexOf('/') + 1)
	const dotIndex = fileName.lastIndexOf('.')
	return dotIndex === -1 ? fileName : fileName.slice(0, dotIndex)
}

function pathJoin(...parts: string[]): string {
	if (parts.length === 0) return ''
	const normalizedParts = parts.map((part) => normalizePath(part))
	const first = normalizedParts[0]
	const hasLeadingSlash = first.startsWith('/')
	const trimmed = normalizedParts
		.map((part, index) => {
			if (index === 0) return part.replace(/\/+$/g, '')
			return part.replace(/^\/+|\/+$/g, '')
		})
		.filter((part) => part.length > 0)
	const joined = trimmed.join('/')
	return hasLeadingSlash && !joined.startsWith('/') ? `/${joined}` : joined
}

function relativeDepth(base: string, target: string): number {
	const normalizedBase = normalizePath(base).replace(/\/+$/g, '')
	const normalizedTarget = normalizePath(target).replace(/\/+$/g, '')
	if (normalizedTarget === normalizedBase) return 0
	if (!normalizedTarget.startsWith(`${normalizedBase}/`)) return Number.POSITIVE_INFINITY
	return normalizedTarget.slice(normalizedBase.length + 1).split('/').length
}

// Re-export for convenience
export type { RouteParams, ParsedPathSegment }

/**
 * Result of a successful route match.
 */
export type RouteMatch = {
	/** Frontend page component (from index.tsx or named.tsx) */
	component?: any
	/** Collected layout components from root to leaf (layout.tsx) */
	layouts?: any[]
	/** Extracted path parameters (e.g., { id: "123" }) */
	params: RouteParams
	/** The normalized matched path */
	path: string
}

/**
 * Node in the route tree structure representing a path segment.
 */
export type RouteTreeNode = {
	/** The URL segment this node matches (e.g., "users" or "") */
	segment: string
	/** True if this is a dynamic segment (e.g., [id]) */
	isDynamic: boolean
	/** True if this is a catch-all segment (e.g., [...slug]) */
	isCatchAll: boolean
	/** The name of the parameter for dynamic/catch-all segments */
	paramName?: string
	/** Child nodes mapped by their segment name */
	children: Map<string, RouteTreeNode>
	/** Page component loaded from index.tsx or named.tsx */
	component?: any
	/** Layout component loaded from layout.tsx */
	layout?: any
	/** True if this is a route group (folder in parentheses) */
	isRouteGroup?: boolean
	/** Path to associated shared type definitions (.d.ts) */
	types?: string
}

/**
 * Segment info derived from sursaut-ts parsePathSegment.
 * Adapts ParsedPathSegment to the format used by buildRouteTree.
 */
export interface SegmentInfo {
	isDynamic: boolean
	isCatchAll: boolean
	paramName?: string
	normalizedSegment: string
}

/**
 * Parse dynamic segment from path segment using sursaut-ts core.
 * Adapts the ParsedPathSegment to SegmentInfo format for tree building.
 *
 * [id] -> { isDynamic: true, paramName: 'id' }
 * [...slug] -> { isCatchAll: true, paramName: 'slug' }
 */
export function parseSegment(segment: string): SegmentInfo {
	const parsed = parsePathSegment(segment)

	switch (parsed.kind) {
		case 'catchAll':
			return {
				isDynamic: true,
				isCatchAll: true,
				paramName: parsed.name,
				normalizedSegment: segment,
			}
		case 'param':
			return {
				isDynamic: true,
				isCatchAll: false,
				paramName: parsed.name,
				normalizedSegment: segment,
			}
		default:
			return {
				isDynamic: false,
				isCatchAll: false,
				normalizedSegment: segment,
			}
	}
}

/**
 * Match a URL path against the route tree for UI routing.
 * Returns component, layouts, and extracted params.
 *
 * Priority: static routes > dynamic routes > catch-all routes > route groups
 */
export function matchRoute(urlPath: string, routeTree: RouteTreeNode): RouteMatch | null {
	// Normalize path: remove trailing slash (except for root)
	const normalizedPath = urlPath === '/' ? '/' : urlPath.replace(/\/$/, '')
	const segments = normalizedPath.split('/').filter((s) => s !== '')

	/**
	 * Recursive tree traversal with priority handling
	 */
	function traverse(
		node: RouteTreeNode,
		segmentIndex: number,
		depth = 0
	): {
		node: RouteTreeNode
		params: RouteParams
		layouts: any[]
	} | null {
		if (depth > 50) {
			console.warn('[sursaut-board] Route matching depth exceeded')
			return null
		}
		// Base case: If we've consumed all segments, check for component at this node
		if (segmentIndex >= segments.length) {
			if (node.component) {
				return {
					node,
					params: {},
					layouts: node.layout ? [node.layout] : [],
				}
			}
		}

		const currentSegment = segments[segmentIndex]

		// Helper to prepend this node's layout to result
		const withStack = (
			result: {
				node: RouteTreeNode
				params: RouteParams
				layouts: any[]
			} | null
		) => {
			if (!result) return null

			if (node.layout) {
				result.layouts.unshift(node.layout)
			}
			return result
		}

		// Priority 1: Try exact static match first
		if (segmentIndex < segments.length) {
			const staticChild = node.children.get(currentSegment)
			if (staticChild && !staticChild.isDynamic && !staticChild.isRouteGroup) {
				const result = traverse(staticChild, segmentIndex + 1, depth + 1)
				if (result) return withStack(result)
			}
		}

		// Priority 2: Try dynamic segment match [id]
		if (segmentIndex < segments.length) {
			for (const [_, child] of node.children) {
				if (child.isDynamic && !child.isCatchAll && !child.isRouteGroup) {
					const result = traverse(child, segmentIndex + 1, depth + 1)
					if (result) {
						if (child.paramName) {
							result.params[child.paramName] = currentSegment
						}
						return withStack(result)
					}
				}
			}
		}

		// Priority 3: Try route groups (transparent)
		for (const [_, child] of node.children) {
			if (child.isRouteGroup) {
				const result = traverse(child, segmentIndex, depth + 1)
				if (result) return withStack(result)
			}
		}

		// Priority 4: Try catch-all segment [...slug]
		if (segmentIndex < segments.length) {
			for (const [_, child] of node.children) {
				if (child.isCatchAll && child.paramName) {
					const remaining = segments.slice(segmentIndex).join('/')
					if (child.component) {
						return withStack({
							node: child,
							params: { [child.paramName]: remaining },
							layouts: child.layout ? [child.layout] : [],
						})
					}
				}
			}
		}

		return null
	}

	const result = traverse(routeTree, 0)
	if (!result) return null

	return {
		component: result.node.component,
		layouts: result.layouts,
		params: result.params,
		path: normalizedPath,
	}
}

/**
 * Scan routes directory and build UI route tree.
 *
 * Discovers and loads:
 * - `index.tsx` -> Frontend page components
 * - `layout.tsx` -> Layouts (inherited, wraps children)
 * - `named.tsx` -> Page components (e.g. `list.tsx` -> `/list`)
 * - `*.d.ts`   -> Shared type definitions
 *
 * API routing (.ts files) will be handled by the `expose` system.
 * This uses node:fs and is intended for server-side usage.
 */
export async function buildRouteTree(
	routesDir: string,
	importFn: (path: string) => Promise<any> = (p) => import(/* @vite-ignore */ toFileUrl(p)),
	globRoutes?: Record<string, () => Promise<any>>
): Promise<RouteTreeNode> {
	const root: RouteTreeNode = {
		segment: '',
		isDynamic: false,
		isCatchAll: false,
		children: new Map(),
	}

	// If globRoutes is provided, use it instead of fs scanning
	if (globRoutes) {
		const sortedEntries = Object.entries(globRoutes).sort(([pathA], [pathB]) => {
			const getScore = (p: string) => {
				const parts = p.split('/')
				const file = parts[parts.length - 1]
				let score = parts.length * 1000 // shallowest first
				if (file.startsWith('layout.')) score -= 10
				else if (file.startsWith('index.')) score -= 5
				return score
			}
			return getScore(pathA) - getScore(pathB)
		})

		for (const [filePath, loader] of sortedEntries) {
			// Normalize path to be relative to routesDir (virtual or real)
			// Glob keys are usually like "/src/routes/api/index.ts" or "./routes/api/index.ts"

			// We need to extract the segments relative to the routes root
			// Assumption: keys contain the full path. We need to find where "routes" starts.
			// Or we assume the glob is exactly import.meta.glob('/src/routes/**')

			// Simple heuristic: remove everything up to and including "routes/"
			// If routesDir is "./routes", we look for that.

			// Better approach: expected input is relative paths like "./index.tsx", "./users/[id].ts"
			// OR absolute paths if simpler.

			// Let's assume the keys are relative to the project root, and we filter by routesDir
			// Actually, let consumer handle filtering. We just need to parse the path relative to routesDir.

			// Let's assume the user passes import.meta.glob('/src/routes/**')
			// The keys will be like "/src/routes/index.tsx"

			// For simplicity and robustness, lets just take the relative path from the key
			// If routesDir is "src/routes", and key is "/app/src/routes/index.tsx", we want "index.tsx"

			let relativePath = filePath
			if (filePath.includes(routesDir.replace(/^\.\//, ''))) {
				const parts = filePath.split(routesDir.replace(/^\.\//, ''))
				relativePath = parts[parts.length - 1] // Take the part after routesDir
				if (relativePath.startsWith('/')) relativePath = relativePath.slice(1)
			}

			const segments = relativePath.split('/')
			const fileName = segments.pop()!

			if (fileName.startsWith('+') || segments.some((segmentName) => segmentName.startsWith('+'))) {
				continue
			}

			// Traverse/Create nodes for directories
			let currentNode = root
			for (const segmentName of segments) {
				if (segmentName === '' || segmentName === '.') continue

				const segmentInfo = parseSegment(segmentName)
				const isGroup = segmentName.startsWith('(') && segmentName.endsWith(')')

				let child = currentNode.children.get(segmentName)
				if (!child) {
					child = {
						segment: isGroup ? '' : segmentInfo.normalizedSegment,
						isDynamic: segmentInfo.isDynamic,
						isCatchAll: segmentInfo.isCatchAll,
						paramName: segmentInfo.paramName,
						children: new Map(),
						isRouteGroup: isGroup,
					}
					currentNode.children.set(segmentName, child)
				}
				currentNode = child
			}

			// Handle the file
			await processFile(fileName, loader, currentNode, filePath)
		}

		return root
	}

	async function processFile(
		name: string,
		loader: () => Promise<any>,
		node: RouteTreeNode,
		fullPath?: string
	) {
		if (name === 'layout.tsx') {
			try {
				const mod = await loader()
				if (mod.default) node.layout = mod.default
			} catch (e) {
				console.error(`Failed to load layout`, e)
			}
		} else if (name === 'index.tsx') {
			try {
				const mod = await loader()
				if (mod.default) node.component = mod.default
			} catch (e) {
				console.error(`Failed to load component`, e)
			}
		} else if (name.endsWith('.d.ts')) {
			// Type definition file
			if (name === 'types.d.ts' || name === 'index.d.ts') {
				node.types = fullPath
			} else {
				// Named type file e.g. users.d.ts -> /users
				const fileNameNoExt = name.slice(0, -5) // remove .d.ts
				const segmentInfo = parseSegment(fileNameNoExt)
				const segment = segmentInfo.normalizedSegment

				let childNode = node.children.get(segment)
				if (!childNode) {
					childNode = {
						segment: segment,
						isDynamic: segmentInfo.isDynamic,
						isCatchAll: segmentInfo.isCatchAll,
						paramName: segmentInfo.paramName,
						children: new Map(),
					}
					node.children.set(segment, childNode)
				}
				childNode.types = fullPath
			}
		} else if (name.endsWith('.tsx')) {
			// Named .tsx component file
			const fileNameNoExt = pathStem(name)
			let childNode = node

			if (fileNameNoExt !== 'index') {
				const segmentInfo = parseSegment(fileNameNoExt)
				const segmentSegment = segmentInfo.normalizedSegment

				let nextNode = node.children.get(segmentSegment)
				if (!nextNode) {
					nextNode = {
						segment: segmentSegment,
						isDynamic: segmentInfo.isDynamic,
						isCatchAll: segmentInfo.isCatchAll,
						paramName: segmentInfo.paramName,
						children: new Map(),
					}
					node.children.set(segmentSegment, nextNode)
				}
				childNode = nextNode
			}

			try {
				const mod = await loader()
				if (mod.default) childNode.component = mod.default
			} catch (e) {
				console.error(`Failed to load component`, e)
			}
		} else if (name.endsWith('.ts')) {
			// API routes mapped via expose() tree flattening
			const fileNameNoExt = pathStem(name)

			if (fileNameNoExt !== 'index') {
				const segmentInfo = parseSegment(fileNameNoExt)
				const segmentSegment = segmentInfo.normalizedSegment

				let nextNode = node.children.get(segmentSegment)
				if (!nextNode) {
					nextNode = {
						segment: segmentSegment,
						isDynamic: segmentInfo.isDynamic,
						isCatchAll: segmentInfo.isCatchAll,
						paramName: segmentInfo.paramName,
						children: new Map(),
					}
					node.children.set(segmentSegment, nextNode)
				}
			}

			// The file execution context
			if (fullPath) {
				let relativePath = fullPath
				if (fullPath.includes(routesDir.replace(/^\.\//, ''))) {
					const parts = fullPath.split(routesDir.replace(/^\.\//, ''))
					relativePath = parts[parts.length - 1]
					if (relativePath.startsWith('/')) relativePath = relativePath.slice(1)
				}

				const relativeSegments = normalizePath(relativePath)
					.split('/')
					.filter((segment) => segment.length > 0)
				const fileSegment = relativeSegments[relativeSegments.length - 1] ?? relativePath
				const routeSegments = relativeSegments
					.slice(0, -1)
					.filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
				const urlPathDir = routeSegments.length > 0 ? routeSegments.join('/') : '.'
				const fileStem = pathStem(fileSegment)

				let baseUrl = ''
				if (urlPathDir === '.') {
					baseUrl = fileStem === 'index' ? '/' : `/${fileStem}`
				} else {
					baseUrl = fileStem === 'index' ? `/${urlPathDir}` : `/${urlPathDir}/${fileStem}`
				}
				// Temporary Global Injection
				;(globalThis as any).__SURSAUT_CURRENT_FILE__ = fullPath
				;(globalThis as any).__SURSAUT_CURRENT_BASE_URL__ = baseUrl.replace(/\\/g, '/')

				try {
					await loader()
				} catch (e) {
					console.error(`Failed to process API route ${fullPath}`, e)
				} finally {
					delete (globalThis as any).__SURSAUT_CURRENT_FILE__
					delete (globalThis as any).__SURSAUT_CURRENT_BASE_URL__
				}
			}
		}
	}

	async function scan(dir: string, node: RouteTreeNode) {
		if (relativeDepth(routesDir, dir) > 20) {
			console.warn(`[sursaut-board] Route recursion depth exceeded at ${dir}`)
			return
		}

		let entries
		try {
			const fs = await import('node:fs/promises')
			entries = await fs.default.readdir(dir, { withFileTypes: true })
		} catch {
			return // Directory likely doesn't exist
		}

		const files = []
		const dirs = []
		for (const entry of entries) {
			if (entry.isFile()) files.push(entry)
			else if (entry.isDirectory()) dirs.push(entry)
		}

		files.sort((a, b) => {
			const pA = a.name.startsWith('layout.') ? 1 : a.name.startsWith('index.') ? 2 : 3
			const pB = b.name.startsWith('layout.') ? 1 : b.name.startsWith('index.') ? 2 : 3
			if (pA !== pB) return pA - pB
			return a.name.localeCompare(b.name)
		})

		for (const file of files) {
			if (file.name.startsWith('+')) continue
			const entryPath = pathJoin(dir, file.name)
			const loader = () => importFn(entryPath)
			await processFile(file.name, loader, node, entryPath)
		}

		for (const directory of dirs) {
			if (directory.name.startsWith('+')) continue
			const entryPath = pathJoin(dir, directory.name)
			const segmentInfo = parseSegment(directory.name)
			const isGroup = directory.name.startsWith('(') && directory.name.endsWith(')')

			const childNode: RouteTreeNode = {
				segment: isGroup ? '' : segmentInfo.normalizedSegment,
				isDynamic: segmentInfo.isDynamic,
				isCatchAll: segmentInfo.isCatchAll,
				paramName: segmentInfo.paramName,
				children: new Map(),
				isRouteGroup: isGroup,
			}

			node.children.set(directory.name, childNode)
			await scan(entryPath, childNode)
		}
	}

	await scan(routesDir, root)
	return root
}

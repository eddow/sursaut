import { document, listen } from '@sursaut/core'
import { atom, reactive } from 'mutts'
import { mountHeadContent } from '../head-mount.js'
import { perf, recordPerf } from '../perf.js'
import { setPlatform } from '../platform/shared.js'
import type {
	Client,
	ClientHistoryState,
	ClientUrl,
	ClientViewport,
	Direction,
	NavigateOptions,
	NavigationKind,
	PlatformAdapter,
} from '../platform/types.js'

// --- Build the reactive client ---

const client = reactive({
	url: createUrlSnapshot(new URL('http://localhost/')),
	viewport: { width: 0, height: 0 } as ClientViewport,
	history: { length: 0, navigation: 'load' } as ClientHistoryState,
	focused: false,
	visibilityState: 'hidden' as const,
	devicePixelRatio: 1,
	online: true,
	language: 'en-US',
	timezone: 'UTC',
	direction: 'ltr' as Direction,
	navigate: (_to: string | URL, _options?: NavigateOptions) => {},
	replace: (_to: string | URL, _options?: Omit<NavigateOptions, 'replace'>) => {},
	reload: () => {},
	dispose: () => {},
	prefersDark: false,
}) as Client

const cleanupFns: (() => void)[] = []
let pendingNavigation: NavigationKind = 'load'
const scrollPositions = new Map<string, number>()
const originalHistoryMethods: Partial<
	Record<'pushState' | 'replaceState', (...args: Parameters<History['pushState']>) => void>
> = {}

if (typeof window !== 'undefined') {
	initializeClientListeners()
	synchronizeUrl('load')
	rememberScrollPosition(window.location.href)
	client.viewport = createViewportSnapshot()
	client.history = createHistorySnapshot('load')
	client.focused = getInitialFocusState()
	client.visibilityState = document.visibilityState === 'visible' ? 'visible' : 'hidden'
	client.devicePixelRatio = getInitialDevicePixelRatio()
	client.online = getInitialOnlineState()
	client.language = getInitialLanguage()
	client.timezone = getInitialTimezone()
	client.direction = getInitialDirection()
}

// --- API Overrides ---

client.navigate = (to: string | URL, options?: NavigateOptions): void => {
	const startedAt = perf?.now()
	const href = resolveHref(to)
	const hashIndex = href.indexOf('#')
	const pathPart = hashIndex >= 0 ? href.slice(0, hashIndex) : href
	const hashPart = hashIndex >= 0 ? href.slice(hashIndex) : ''
	const stateData = options?.state ?? null
	const method = options?.replace ? 'replaceState' : 'pushState'
	const navigation = options?.replace ? 'replace' : 'push'
	const updateHistory =
		originalHistoryMethods[method] ?? window.history[method].bind(window.history)
	if (options?.replace) {
		pendingNavigation = 'replace'
	} else {
		pendingNavigation = 'push'
	}
	updateHistory(stateData, '', pathPart)
	if (startedAt != null) recordPerf('route:navigate', startedAt)
	synchronizeUrl(navigation)
	if (hashPart) {
		requestAnimationFrame(() => {
			window.location.hash = hashPart
		})
	}
}

client.replace = (to: string | URL, options?: Omit<NavigateOptions, 'replace'>): void => {
	client.navigate(to, { ...options, replace: true })
}

client.reload = (): void => {
	window.location.reload()
}

client.dispose = (): void => {
	while (cleanupFns.length > 0) {
		const fn = cleanupFns.pop()
		fn?.()
	}
}

try {
	const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
	client.prefersDark = darkQuery.matches
	const syncDark = (e: MediaQueryListEvent) => {
		client.prefersDark = e.matches
	}
	cleanupFns.push(listen(darkQuery, 'change', syncDark as EventListener))
} catch {
	client.prefersDark = false
}

// --- Platform Adapter ---

const domAdapter: PlatformAdapter = {
	client,
	mountHead(content, env) {
		return mountHeadContent(document.head, content, env)
	},
}

setPlatform(domAdapter)
export { domAdapter }

// --- Internals ---

function initializeClientListeners(): void {
	const syncViewport = () => {
		client.viewport = createViewportSnapshot()
	}
	const syncDevicePixelRatio = () => {
		client.devicePixelRatio = getInitialDevicePixelRatio()
	}
	const syncFocus = () => {
		client.focused = getInitialFocusState()
	}
	const syncVisibility = () => {
		client.visibilityState = document.visibilityState === 'visible' ? 'visible' : 'hidden'
	}
	const syncOnline = () => {
		client.online = getInitialOnlineState()
	}
	const syncLanguage = () => {
		client.language = getInitialLanguage()
		client.timezone = getInitialTimezone()
	}
	const syncScrollPosition = () => {
		rememberScrollPosition(window.location.href)
	}

	addWindowListener('popstate', () => synchronizeUrl('pop'))
	addWindowListener('hashchange', () => synchronizeUrl('hash'))
	interceptHistoryMethod('pushState')
	interceptHistoryMethod('replaceState')
	addWindowListener('scroll', syncScrollPosition)

	addWindowListener('resize', () => {
		syncViewport()
		syncDevicePixelRatio()
	})
	addWindowListener('focus', () => {
		syncFocus()
		syncVisibility()
	})
	addWindowListener('blur', syncFocus)
	const visibilityHandler = () => {
		syncVisibility()
		syncFocus()
	}
	cleanupFns.push(listen(document, 'visibilitychange', visibilityHandler))
	addWindowListener('online', syncOnline)
	addWindowListener('offline', syncOnline)
	addWindowListener('languagechange', syncLanguage)

	const dirObserver = new MutationObserver(() => {
		client.direction = getInitialDirection()
	})
	dirObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] })
	cleanupFns.push(() => dirObserver.disconnect())
}

function synchronizeUrl(navigation: NavigationKind = pendingNavigation): void {
	const startedAt = perf?.now()
	const nextUrl = createUrlSnapshot(new URL(window.location.href))
	const nextHistory = createHistorySnapshot(navigation)
	if (startedAt != null) recordPerf('route:sync', startedAt)
	atom(() => {
		client.url = nextUrl
		client.history = nextHistory
	})
	if (navigation === 'pop') restoreScrollPosition(window.location.href)
	pendingNavigation = 'load'
}

// --- Helpers ---

function resolveHref(input: string | URL): string {
	if (typeof input === 'string') {
		return input
	}
	return input.toString()
}

function rememberScrollPosition(href: string): void {
	scrollPositions.set(href, window.scrollY)
}

function restoreScrollPosition(href: string): void {
	const y = scrollPositions.get(href)
	if (y === undefined) return
	requestAnimationFrame(() => window.scrollTo(0, y))
}

function createUrlSnapshot(url: URL): ClientUrl {
	const query: Record<string, string> = {}
	url.searchParams.forEach((value, key) => {
		query[key] = value
	})

	return {
		href: url.href,
		origin: url.origin,
		pathname: url.pathname,
		search: url.search,
		hash: url.hash,
		segments: extractSegments(url.pathname),
		query,
	}
}

function createViewportSnapshot(): ClientViewport {
	return {
		width: window.innerWidth,
		height: window.innerHeight,
	}
}

function createHistorySnapshot(navigation: NavigationKind): ClientHistoryState {
	return {
		length: window.history.length,
		navigation,
	}
}

function extractSegments(pathname: string): readonly string[] {
	return pathname.split('/').filter((segment) => segment.length > 0)
}

function getInitialFocusState(): boolean {
	if (typeof document.hasFocus !== 'function') return false
	try {
		return document.hasFocus()
	} catch (_error) {
		return false
	}
}

function getInitialDevicePixelRatio(): number {
	return typeof window.devicePixelRatio === 'number' && Number.isFinite(window.devicePixelRatio)
		? window.devicePixelRatio
		: 1
}

function getInitialOnlineState(): boolean {
	return navigator.onLine ?? true
}

function getInitialLanguage(): string {
	return navigator.language ?? 'en-US'
}

function getInitialDirection(): Direction {
	return (document.documentElement.dir as Direction) || 'ltr'
}

function getInitialTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
	} catch (_error) {
		return 'UTC'
	}
}

function addWindowListener<K extends keyof WindowEventMap>(
	type: K,
	listener: (event: WindowEventMap[K]) => void
): void {
	cleanupFns.push(listen(window, type, listener as EventListener))
}

function interceptHistoryMethod(method: 'pushState' | 'replaceState'): void {
	const history = window.history
	const original = history[method] as (...args: Parameters<History['pushState']>) => void
	originalHistoryMethods[method] = original.bind(history)
	const wrapped = function (this: History, ...args: Parameters<History['pushState']>) {
		original.apply(this, args)
		synchronizeUrl(method === 'pushState' ? 'push' : 'replace')
	}

	history[method] = wrapped as History['pushState']
	cleanupFns.push(() => {
		history[method] = original as History['pushState']
	})
}

// Export the client and register with platform
export { client }
setPlatform({
	client,
	mountHead: (content, env) => mountHeadContent(document.head, content, env),
})

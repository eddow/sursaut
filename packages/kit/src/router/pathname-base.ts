/**
 * Optional pathname prefix when the SPA is hosted under a subpath (e.g. GitHub Pages
 * project sites). Align with Vite `base`: pass `import.meta.env.BASE_URL` from the app.
 */
let _prefix = ''

function normalizePrefix(raw: string): string {
	const t = raw.trim()
	if (t === '' || t === '/') return ''
	const noTrail = t.endsWith('/') ? t.slice(0, -1) : t
	return noTrail.startsWith('/') ? noTrail : `/${noTrail}`
}

/** Configure router + link model to strip/prepend this pathname prefix. */
export function setRouterPathnamePrefix(viteBaseOrPrefix: string): void {
	_prefix = normalizePrefix(viteBaseOrPrefix)
}

export function getRouterPathnamePrefix(): string {
	return _prefix
}

/** Map browser pathname to the application path used by route definitions. */
export function toAppPath(pathname: string): string {
	if (_prefix === '') return pathname
	if (pathname === _prefix) return '/'
	if (pathname.startsWith(`${_prefix}/`)) {
		const rest = pathname.slice(_prefix.length)
		return rest === '' ? '/' : rest
	}
	return pathname
}

/** Prefix an in-app href (`/foo`) for `history.pushState` / full URL bar paths. */
export function toHistoryPath(appHref: string): string {
	if (_prefix === '') return appHref
	if (!appHref.startsWith('/')) return appHref
	if (appHref === '/') return _prefix
	return `${_prefix}${appHref}`
}

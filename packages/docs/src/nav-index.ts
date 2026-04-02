export interface NavLink {
	title: string
	href: string
}

export interface NavSection {
	title: string
	links: NavLink[]
	collapsible?: boolean
}

export const navigation: NavSection[] = [
	{
		title: 'Getting Started',
		links: [
			{ title: 'Overview', href: '/getting-started' },
			{ title: 'Concepts', href: '/getting-started/concepts' },
		],
	},
	{
		title: '@sursaut/core',
		collapsible: true,
		links: [
			{ title: 'Overview', href: '/core' },
			{ title: 'JSX Factory', href: '/core/jsx' },
			{ title: 'Components', href: '/core/components' },
			{ title: 'Meta-attributes', href: '/core/meta-attributes' },
			{ title: 'Meta-components', href: '/core/meta-components' },
			{ title: 'Bidirectional Binding', href: '/core/bind' },
			{ title: 'Scope', href: '/core/env' },
			{ title: 'SSR', href: '/core/ssr' },
		],
	},
	{
		title: '@sursaut/kit',
		collapsible: true,
		links: [
			{ title: 'Overview', href: '/kit' },
			{ title: 'Router', href: '/kit/router' },
			{ title: 'Client State', href: '/kit/client' },
			{ title: 'Intl', href: '/kit/intl' },
			{ title: 'Storage', href: '/kit/storage' },
			{ title: 'CSS Utilities', href: '/kit/css' },
			{ title: 'API Client', href: '/kit/api' },
		],
	},
	{
		title: '@sursaut/ui',
		collapsible: true,
		links: [
			{ title: 'Overview', href: '/ui' },
			{ title: 'Button', href: '/ui/button' },
			{ title: 'Accordion', href: '/ui/accordion' },
			{ title: 'Card', href: '/ui/card' },
			{ title: 'Forms', href: '/ui/forms' },
			{ title: 'Overlays', href: '/ui/overlays' },
			{ title: 'Layout', href: '/ui/layout' },
			{ title: 'Palette', href: '/ui/palette' },
			{ title: 'Progress', href: '/ui/progress' },
			{ title: 'Status', href: '/ui/status' },
			{ title: 'Stars', href: '/ui/stars' },
			{ title: 'Menu', href: '/ui/menu' },
			{ title: 'Typography', href: '/ui/typography' },
			{ title: 'InfiniteScroll', href: '/ui/infinite-scroll' },
			{ title: 'Directives', href: '/ui/directives' },
			{ title: 'CSS Variables', href: '/ui/css-variables' },
			{ title: 'Display & Theme', href: '/ui/display' },
			{ title: 'Adapters', href: '/ui/adapter' },
		],
	},
	{
		title: 'Adapters',
		collapsible: true,
		links: [
			{ title: 'Overview', href: '/adapters' },
			{ title: 'PicoCSS', href: '/adapters/pico' },
			{ title: 'Creating Adapters', href: '/adapters/creating' },
		],
	},
	{
		title: '@sursaut/board',
		collapsible: true,
		links: [
			{ title: 'Overview', href: '/board' },
			{ title: 'Routing', href: '/board/routing' },
			{ title: 'SSR Flow', href: '/board/ssr' },
			{ title: 'Middleware', href: '/board/middleware' },
		],
	},
]

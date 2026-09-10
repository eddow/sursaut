import {
	A,
	Container,
	client,
	DisplayProvider,
	type Env,
	Heading,
	Router,
	Text,
	ThemeToggle,
	type ThemeValue,
} from '@sursaut'
import { Toolbar } from '@sursaut/adapter-pico'
import { stored } from '@sursaut/kit'
import { Splitview, type SplitviewHandle } from '@sursaut/ui/dockview'
import { reactive } from 'mutts'
import PageNav from './components/page-nav'
import Search from './components/search'
import routes from './routes'

const envSettings = reactive<{ theme: ThemeValue }>({ theme: 'auto' })
const mainContainerEl = { style: 'padding: 2rem 0 3rem;' }
const uiState = reactive({ mobileOpen: false })

// Splitview layout, persisted. Two-way bound: user drags write back here,
// reload restores via the layout prop.
const sidebarState = stored({ layout: undefined as never })

function SidebarPane() {
	return (
		<aside class="docs-sidebar" data-test="docs-sidebar">
			<div class="docs-sidebar-brand">
				<A href="/" class="docs-brand-mark">
					<div class="docs-brand-pill">Sursaut</div>
					<div class="docs-brand-title">Affirmative UI</div>
					<div class="docs-brand-copy">
						Direct DOM reactivity, explicit layers, and a web stack shaped around what should hold.
					</div>
				</A>
			</div>
			<Search />
			<PageNav />
			<div class="docs-sidebar-footer">
				<a href="https://www.npmjs.com/package/mutts">mutts</a>
				<a href="https://github.com/eddow/sursaut">GitHub</a>
			</div>
		</aside>
	)
}

function MainPane() {
	return (
		<div class="docs-main" data-test="docs-main">
			<header class="docs-header">
				<Container>
					<Toolbar el={{ class: 'docs-topbar' }}>
						<button
							class="mobile-toggle"
							onClick={() => (uiState.mobileOpen = !uiState.mobileOpen)}
						>
							☰
						</button>
						<div class="docs-topbar-copy">
							<Heading level={5}>Sursaut Docs</Heading>
							<Text class="docs-topbar-subtitle">Affirmative UI for the web</Text>
						</div>
						<Toolbar.Spacer />
						<A href="/getting-started" class="docs-topbar-link">
							Start here
						</A>
						<ThemeToggle settings={envSettings} simple />
					</Toolbar>
				</Container>
			</header>
			<Container tag="main" el={mainContainerEl}>
				<Router
					routes={routes}
					onRouteEnd={() => {
						closeMobileNav()
						scrollAfterRouteChange()
					}}
					notFound={({ url }: { url: string }) => (
						<section style="padding: 2rem 0;">
							<Heading level={2}>Not found</Heading>
							<Text>
								No page at <code>{url}</code>.
							</Text>
						</section>
					)}
				/>
			</Container>
		</div>
	)
}

function closeMobileNav() {
	uiState.mobileOpen = false
}

function scrollAfterRouteChange() {
	if (client.url.hash) {
		scrollToHashTarget()
		return
	}
	requestAnimationFrame(() => {
		window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
	})
}

function scrollToHashTarget() {
	const hash = client.url.hash
	if (!hash) return
	const targetId = decodeURIComponent(hash.slice(1))
	if (!targetId) return
	// Retry: the target section may not be mounted yet on first paint
	// (Router just swapped the article). rAF x3 covers mount + styles.
	const attempt = (left: number) => {
		const el = document.getElementById(targetId)
		if (el) el.scrollIntoView({ block: 'start' })
		else if (left > 0) requestAnimationFrame(() => attempt(left - 1))
	}
	requestAnimationFrame(() => attempt(3))
}

export function DocsApp(_props: {}, _env: Env) {
	return (
		<DisplayProvider theme={envSettings.theme}>
			<div
				class={{ 'docs-layout': true, 'mobile-open': uiState.mobileOpen }}
				data-test="docs-layout"
			>
				<Splitview
					widgets={{
						sidebar: { component: SidebarPane },
						main: { component: MainPane },
					}}
					el={{ class: 'docs-split' }}
					layout={sidebarState.layout}
					onReady={(_api: unknown, handle?: SplitviewHandle) => {
						handle?.openPanel('sidebar')
						handle?.openPanel('main')
					}}
				/>
			</div>
		</DisplayProvider>
	)
}

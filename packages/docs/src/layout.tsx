import {
	A,
	Container,
	client,
	DisplayProvider,
	type Env,
	Heading,
	Router,
	r,
	sizeable,
	stored,
	Text,
	ThemeToggle,
	type ThemeValue,
} from '@sursaut'
import { Toolbar } from '@sursaut/adapter-pico'
import { reactive } from 'mutts'
import PageNav from './components/page-nav'
import Search from './components/search'
import routes from './routes'

const DEFAULT_WIDTH = 300
const mainContainerEl = { style: 'padding: 2rem 0 3rem;' }

const envSettings = reactive<{ theme: ThemeValue }>({ theme: 'auto' })
const uiState = reactive({ mobileOpen: false })

// Use stored to persist sidebar width
const sidebarState = stored({ width: DEFAULT_WIDTH })

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
	requestAnimationFrame(() => {
		document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
	})
}

export function DocsApp(_props: {}, _env: Env) {
	const sizeableSidebar = sizeable(
		r(
			() => sidebarState.width,
			(v) => {
				sidebarState.width = v
			}
		)
	)
	const closeMobileNav = () => {
		uiState.mobileOpen = false
	}
	return (
		<DisplayProvider theme={envSettings.theme}>
			<div
				class={{ 'docs-layout': true, 'mobile-open': uiState.mobileOpen }}
				style={{ '--sizeable-width': `${sidebarState.width}px` }}
			>
				<aside class="docs-sidebar" use={sizeableSidebar}>
					<div class="docs-sidebar-brand">
						<A href="/" class="docs-brand-mark" onClick={closeMobileNav}>
							<div class="docs-brand-pill">Sursaut</div>
							<div class="docs-brand-title">Affirmative UI</div>
							<div class="docs-brand-copy">
								Direct DOM reactivity, explicit layers, and a web stack shaped around what should
								hold.
							</div>
						</A>
					</div>
					<Search onNavigate={closeMobileNav} />
					<PageNav onNavigate={closeMobileNav} />
					<div class="docs-sidebar-footer">
						<a href="https://www.npmjs.com/package/mutts">mutts</a>
						<a href="https://github.com/eddow/sursaut">GitHub</a>
					</div>
				</aside>
				<div class="docs-main">
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
			</div>
		</DisplayProvider>
	)
}

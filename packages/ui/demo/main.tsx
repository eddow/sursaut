import { latch } from '@sursaut/core'
import {
	type ClientRouteDefinition,
	type LinkProps,
	linkModel,
	Router,
	type RouterRender,
} from '@sursaut/kit'
import AccordionDemo from './components/AccordionDemo'
import DisplayContextDemo from './components/DisplayContextDemo'
import DockviewDemo from './components/DockviewDemo'
import DockviewRouterDemo from './components/DockviewRouterDemo'
import DragDropDemo from './components/DragDropDemo'
import FormDemo from './components/FormDemo'
import MenuDemo from './components/MenuDemo'
import MultiSelectDemo from './components/MultiSelectDemo'
import OverlayDemo from './components/OverlayDemo'
import PaletteDemo from './components/PaletteDemo'
import ProgressDemo from './components/ProgressDemo'
import SizeableDemo from './components/SizeableDemo'
import StarsDemo from './components/StarsDemo'
import 'mutts/debug'

function AppLink(props: LinkProps) {
	const model = linkModel(props)
	return (
		<a {...props} {...model}>
			{props.children}
		</a>
	)
}

type DemoRoute = ClientRouteDefinition & {
	href?: string
	label: string | null
	view: RouterRender<DemoRoute>
}

const routes: DemoRoute[] = [
	{ path: '/', label: 'Form', view: () => <FormDemo /> },
	{ path: '/overlay', label: 'Overlays', view: () => <OverlayDemo /> },
	{ path: '/drawer', label: null, view: () => <OverlayDemo /> },
	{ path: '/accordion', label: 'Accordion', view: () => <AccordionDemo /> },
	{ path: '/dockview', label: 'Dockview', view: () => <DockviewDemo /> },
	{
		path: '/dockview-router/[...route]',
		href: '/dockview-router',
		label: 'DockviewRouter',
		view: () => <DockviewRouterDemo />,
	},
	{ path: '/drag-drop', label: 'Drag & Drop', view: () => <DragDropDemo /> },
	{ path: '/menu', label: 'Menu', view: () => <MenuDemo /> },
	{ path: '/multiselect', label: 'MultiSelect', view: () => <MultiSelectDemo /> },
	{ path: '/palette', label: 'Palette', view: () => <PaletteDemo /> },
	{ path: '/progress', label: 'Progress', view: () => <ProgressDemo /> },
	{ path: '/sizeable', label: 'Sizeable', view: () => <SizeableDemo /> },
	{ path: '/stars', label: 'Stars', view: () => <StarsDemo /> },
	{ path: '/display-context', label: 'DisplayContext', view: () => <DisplayContextDemo /> },
	{ path: '/themetoggle', label: null, view: () => <DisplayContextDemo /> },
	{ path: '/toast', label: null, view: () => <OverlayDemo /> },
]

function DemoApp() {
	return (
		<div
			data-test="demo-app"
			style="display: flex; flex-direction: column; gap: 0; height: 100vh; min-height: 0; padding: clamp(12px, 3vw, 24px); max-width: 1000px; margin: 0 auto; width: min(100%, 1000px); box-sizing: border-box; overflow: hidden; font-family: sans-serif;"
		>
			<h1 style="color: #f1f5f9; margin-bottom: 8px;">@sursaut/ui Demo</h1>
			<p style="color: #94a3b8; margin-bottom: 32px;">
				Headless UI primitives for Sursaut applications
			</p>

			<nav
				data-test="demo-nav"
				style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid #334155; padding-bottom: 16px;"
			>
				<for each={routes.filter((route) => route.label)}>
					{(route) => (
						<AppLink href={route.href ?? route.path}>
							<button style="padding: 6px 12px; border: none; border-radius: 4px; background: transparent; color: #94a3b8; cursor: pointer; font-weight: 500; white-space: nowrap;">
								{route.label}
							</button>
						</AppLink>
					)}
				</for>
			</nav>

			<main
				data-test="demo-content"
				style="display: flex; flex: 1 1 auto; min-height: 0; overflow: hidden; background: #1e293b; padding: clamp(14px, 3vw, 24px); border-radius: 12px; border: 1px solid #334155; overflow: auto;"
			>
				<Router routes={routes} notFound={() => <p style="color: #f87171;">404 - Not Found</p>} />
			</main>
		</div>
	)
}

latch('#app', <DemoApp />)

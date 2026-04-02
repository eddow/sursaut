import { A } from '@sursaut/adapter-pico'
import { latch } from '@sursaut/core'
import { type ClientRouteDefinition, Router, type RouterRender } from '@sursaut/kit'
import '@sursaut/adapter-pico/css'
import ButtonsSection from './sections/Buttons'
import CardsSection from './sections/Cards'
import FormControlsSection from './sections/FormControls'
import LayoutSection from './sections/Layout'
import NavigationSection from './sections/Navigation'
import OptionsSection from './sections/Options'
import OverlaysSection from './sections/Overlays'
import PaletteSection from './sections/Palette'
import StatusSection from './sections/Status'
import ThemeSection from './sections/Theme'

type DemoRoute = ClientRouteDefinition & {
	label: string
	description: string
	view: RouterRender<DemoRoute>
}

const routes: DemoRoute[] = [
	{
		path: '/',
		label: 'Form controls',
		description: 'Checkbox, radio, switch and progress concerns.',
		view: () => <FormControlsSection />,
	},
	{
		path: '/buttons',
		label: 'Buttons',
		description: 'Button variants, toggles and button-group navigation.',
		view: () => <ButtonsSection />,
	},
	{
		path: '/options',
		label: 'Options',
		description: 'Select, combobox and multiselect concerns.',
		view: () => <OptionsSection />,
	},
	{
		path: '/palette',
		label: 'Palette',
		description: 'Registry-first Pico palette editors and command box.',
		view: () => <PaletteSection />,
	},
	{
		path: '/status',
		label: 'Status',
		description: 'Badge, pill, chip and stars components.',
		view: () => <StatusSection />,
	},
	{
		path: '/layout',
		label: 'Layout',
		description: 'Container, text, stack, grid and toolbar layout helpers.',
		view: () => <LayoutSection />,
	},
	{
		path: '/cards',
		label: 'Cards',
		description: 'Card structure and section composition.',
		view: () => <CardsSection />,
	},
	{
		path: '/navigation',
		label: 'Navigation',
		description: 'Link, menu and accordion concerns.',
		view: () => <NavigationSection />,
	},
	{
		path: '/overlays',
		label: 'Overlays',
		description: 'Dialog, drawer, toast and overlay manager.',
		view: () => <OverlaysSection />,
	},
	{
		path: '/theme',
		label: 'Theme',
		description: 'ThemeToggle inside an AppShell and display context.',
		view: () => <ThemeSection />,
	},
]

function DemoApp() {
	return (
		<div class="container" style="padding-block: 2rem; display: grid; gap: 1.5rem;">
			<header style="display: grid; gap: 0.5rem;">
				<h1 style="margin: 0;">@sursaut/adapter-pico Demo</h1>
				<p style="margin: 0; color: var(--pico-muted-color);">
					Grouped adapter concerns, with the same section modules reused as direct test fixtures.
				</p>
			</header>
			<nav aria-label="Demo sections" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
				<for each={routes}>
					{(route) => (
						<A href={route.path} el={{ role: 'button', class: 'secondary outline' }}>
							{route.label}
						</A>
					)}
				</for>
			</nav>
			<main>
				<Router routes={routes} notFound={() => <p>Not found.</p>} />
			</main>
		</div>
	)
}

latch('#app', <DemoApp />)

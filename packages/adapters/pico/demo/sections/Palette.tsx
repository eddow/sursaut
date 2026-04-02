import { Button, PicoPaletteCommandBox, picoPalettePreset } from '@sursaut/adapter-pico'
import {
	createPaletteKeys,
	Palette,
	type PaletteToolbar,
	paletteCommandBoxModel,
	paletteCommandEntries,
} from '@sursaut/ui/palette'
import { reactive } from 'mutts'
import { DemoCard, DemoGrid, DemoSection, DemoState } from './shared'

type PaletteDemoState = {
	notifications: boolean
	layout: 'horizontal' | 'vertical'
	zoom: number
}

const state = reactive<PaletteDemoState>({
	notifications: true,
	layout: 'horizontal',
	zoom: 3,
})

const tools = {
	notifications: {
		type: 'boolean' as const,
		label: 'Notifications',
		icon: '🔔',
		get value() {
			return state.notifications
		},
		set value(value: boolean) {
			state.notifications = value
		},
		default: true,
	},
	layout: {
		type: 'enum' as const,
		label: 'Layout',
		icon: '▤',
		get value() {
			return state.layout
		},
		set value(value: 'horizontal' | 'vertical') {
			state.layout = value
		},
		default: 'horizontal' as const,
		values: [
			{ value: 'horizontal' as const, label: 'Horizontal', icon: '↔' },
			{ value: 'vertical' as const, label: 'Vertical', icon: '↕' },
		],
	},
	zoom: {
		type: 'number' as const,
		label: 'Zoom',
		icon: '🔎',
		get value() {
			return state.zoom
		},
		set value(value: number) {
			state.zoom = value
		},
		default: 3,
		min: 1,
		max: 5,
		step: 1,
	},
	reset: {
		label: 'Reset',
		icon: '↺',
		get can() {
			return !(state.notifications === true && state.layout === 'horizontal' && state.zoom === 3)
		},
		run() {
			state.notifications = true
			state.layout = 'horizontal'
			state.zoom = 3
		},
	},
}

const palette = new Palette({
	tools,
	keys: createPaletteKeys({
		N: 'notifications',
		H: 'layout|horizontal',
		V: 'layout|vertical',
		'+': 'zoom:inc',
		'-': 'zoom:dec',
		R: 'reset',
	}),
	...picoPalettePreset,
})

const entries = paletteCommandEntries({ palette })
const commandBox = paletteCommandBoxModel({
	entries,
	placeholder: 'Command…',
})

const PaletteIde = palette.Ide

const toolbarItems: PaletteToolbar = [
	{ editor: 'commandBox', config: { icon: '⌘', label: 'Commands' } },
	{ tool: 'notifications', editor: 'toggle', config: { label: 'Notifications', tone: 'accent' } },
	{ tool: 'layout', editor: 'segmented', config: { label: 'Layout' } },
	{ tool: 'zoom', editor: 'stepper', config: { label: 'Zoom' } },
	{ tool: 'reset', editor: 'button', config: { label: 'Reset' } },
]

const ideConfig = {
	top: [
		[
			{
				space: 1,
				toolbar: toolbarItems,
			},
		],
	],
}

export default function PaletteSection() {
	return (
		<DemoSection
			title="Palette"
			description="Registry-first Pico palette controls with a dedicated command box and toolbar demo."
		>
			<DemoGrid>
				<DemoCard title="Toolbar-first palette">
					{PaletteIde(
						{
							config: ideConfig,
							el: { style: 'display:grid; gap:1rem;' },
							center: {
								style: 'padding: 0; min-height: 0; display:none;',
							},
							toolbar: { class: 'secondary' },
						},
						{ commandBox, commandBoxFloating: false, commandBoxExpanded: true }
					)}
					<DemoState label="Notifications" value={state.notifications ? 'On' : 'Off'} />
					<DemoState label="Layout" value={state.layout} />
					<DemoState label="Zoom" value={String(state.zoom)} />
				</DemoCard>
				<DemoCard title="Standalone command box">
					<PicoPaletteCommandBox commandBox={commandBox} expanded floating={false} />
					<DemoState
						label="Selection"
						value={commandBox.selection.item?.label ?? commandBox.selection.item?.id ?? 'None'}
					/>
				</DemoCard>
			</DemoGrid>
			<DemoCard title="Palette IDE shell">
				{PaletteIde(
					{
						config: ideConfig,
						el: { style: 'display:grid; gap:1rem;' },
						center: {
							style:
								'padding: 1rem; min-height: 10rem; display:grid; gap:0.75rem; align-content:start;',
						},
						toolbar: { class: 'secondary' },
					},
					{ commandBox, commandBoxFloating: false, commandBoxExpanded: true }
				)}
				<div>
					<p style="margin:0; color: var(--pico-muted-color);">
						The Pico adapter owns the editor rendering while `@sursaut/ui/palette` stays headless.
					</p>
					<div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:0.75rem;">
						<Button onClick={() => tools.reset.run()} disabled={!tools.reset.can}>
							Reset state
						</Button>
					</div>
				</div>
			</DemoCard>
		</DemoSection>
	)
}

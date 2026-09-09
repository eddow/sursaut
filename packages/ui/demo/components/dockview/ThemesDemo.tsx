import { Dockview, type DockviewHandle } from '@sursaut/ui/dockview'
import { themeAbyss, themeDark, themeDracula, themeLight } from 'dockview'
import { reactive } from 'mutts'
import { BasicPanel } from './_widgets/BasicPanel'

const themes = { abyss: themeAbyss, dark: themeDark, light: themeLight, dracula: themeDracula }
type ThemeName = keyof typeof themes

const widgets = {
	basic: { component: BasicPanel, title: 'Themed' },
}

export default function ThemesDemo() {
	const state = reactive<{
		handle: DockviewHandle | undefined
		name: ThemeName
	}>({ handle: undefined, name: 'abyss' })

	const onReady = (_api: unknown, handle?: DockviewHandle) => {
		if (handle) {
			state.handle = handle
			handle.openPanel('basic', { params: { text: 'Switch the theme!' } })
		}
	}

	return (
		<div data-test="gallery-themes-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>Themes</h2>
			<div style="display: flex; gap: 8px; margin-bottom: 8px;">
				{(Object.keys(themes) as ThemeName[]).map((t) => (
					<button
						data-test={`gallery-theme-${t}`}
						aria-pressed={state.name === t ? 'true' : 'false'}
						onClick={() => {
							state.name = t
						}}
					>
						{t}
					</button>
				))}
			</div>
			<div data-test="gallery-themes-shell" style="height: 40vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;">
				<Dockview
					handle={state.handle}
					widgets={widgets}
					options={{ theme: themes[state.name] }}
					el={{ style: 'height: 100%; width: 100%;' }}
					onReady={onReady}
				/>
			</div>
		</div>
	)
}

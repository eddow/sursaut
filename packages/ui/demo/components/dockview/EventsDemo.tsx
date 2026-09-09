import {
	Dockview,
	type DockviewActiveState,
	type DockviewHandle,
} from '@sursaut/ui/dockview'
import { themeAbyss } from 'dockview'
import { reactive } from 'mutts'
import { BasicPanel } from './_widgets/BasicPanel'

const widgets = {
	a: { component: BasicPanel, title: 'A' },
	b: { component: BasicPanel, title: 'B' },
}

export default function EventsDemo() {
	const state = reactive<{
		handle: DockviewHandle | undefined
		active: DockviewActiveState | undefined
		log: string[]
		seq: number
	}>({ handle: undefined, active: undefined, log: [], seq: 0 })

	const push = (msg: string) => {
		state.seq += 1
		state.log = [...state.log.slice(-9), `#${state.seq} ${msg}`]
	}

	const onReady = (_api: unknown, handle?: DockviewHandle) => {
		if (handle) {
			state.handle = handle
			handle.openPanel('a', { params: { text: 'Panel A' } })
			handle.openPanel('b', { params: { text: 'Panel B' } })
		}
	}

	return (
		<div data-test="gallery-events-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>bind:active + events</h2>
			<p data-test="gallery-events-active">
				active panel: <strong>{state.active?.panel?.id ?? '(none)'}</strong>
			</p>
			<div style="display: flex; gap: 8px; margin-bottom: 8px;">
				<button
					data-test="gallery-events-add"
					onClick={() => state.handle?.openPanel('a', { params: { text: 'Another A' } })}
				>
					add panel
				</button>
			</div>
			<div data-test="gallery-events-shell" style="height: 40vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;">
				<Dockview
					handle={state.handle}
					active={state.active}
					widgets={widgets}
					options={{ theme: themeAbyss }}
					el={{ style: 'height: 100%; width: 100%;' }}
					onReady={onReady}
					onDidActivePanelChange={(e) => push(`active panel → ${e.panel?.id ?? '(none)'}`)}
					onDidAddPanel={(p) => push(`added ${p.id}`)}
					onDidRemovePanel={(p) => push(`removed ${p.id}`)}
				/>
			</div>
			<ul data-test="gallery-events-log" style="margin: 8px 0 0 0; padding-left: 18px; font-size: 12px; color: #cbd5e1;">
				<for each={state.log}>
					{(entry) => <li>{entry}</li>}
				</for>
			</ul>
		</div>
	)
}

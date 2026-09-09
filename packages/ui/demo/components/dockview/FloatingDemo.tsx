import {
	Dockview,
	type DockviewFloatingState,
	type DockviewHandle,
	type DockviewPopoutState,
} from '@sursaut/ui/dockview'
import { themeAbyss } from 'dockview'
import { reactive } from 'mutts'
import { BasicPanel } from './_widgets/BasicPanel'
import { GroupHeaderActions } from './_widgets/GroupHeaderActions'
import { PanelHeaderTab } from './_widgets/PanelHeaderTab'

const widgets = {
	a: { component: BasicPanel, tab: PanelHeaderTab, title: 'A' },
	b: { component: BasicPanel, tab: PanelHeaderTab, title: 'B' },
}

export default function FloatingDemo() {
	const state = reactive<{
		handle: DockviewHandle | undefined
		floating: DockviewFloatingState | undefined
		popout: DockviewPopoutState | undefined
		gridPanelId: string | undefined
	}>({ handle: undefined, floating: undefined, popout: undefined, gridPanelId: undefined })

	const onReady = (_api: unknown, handle?: DockviewHandle) => {
		if (handle) {
			state.handle = handle
			const first = handle.openPanel('a', { params: { text: 'Panel A (grid)' } })
			handle.openPanel('b', { params: { text: 'Panel B (grid)' } })
			state.gridPanelId = first.id
		}
	}

	return (
		<div data-test="gallery-floating-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>Floating groups</h2>
			<p style="color: #94a3b8; max-width: 72ch;">
				Floating windows stay reactive via <code>bind:floating</code> — dragging, floating,
				or docking back all update it. <code>handle.float()</code> floats an existing panel
				or group; <code>handle.dockAll()</code> docks everything back.
			</p>
			<div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center; flex-wrap: wrap;">
				<button
					data-test="gallery-floating-open"
					onClick={() => {
						state.handle?.openPanel('a', {
							id: `float-${Date.now()}`,
							title: 'Floating A',
							floating: { x: 80, y: 80, width: 320, height: 220 },
							params: { text: 'I am floating' },
						})
					}}
				>
					open floating
				</button>
				<button
					data-test="gallery-floating-float-a"
					disabled={!state.gridPanelId}
					onClick={() => state.gridPanelId && state.handle?.float(state.gridPanelId)}
				>
					float panel A
				</button>
				<button
					data-test="gallery-floating-dock-all"
					disabled={!state.floating?.hasFloating}
					onClick={() => state.handle?.dockAll()}
				>
					dock all
				</button>
				<span data-test="gallery-floating-count">
					floating groups: <strong>{state.floating?.count ?? 0}</strong>
				</span>
				<span data-test="gallery-popout-count">
					popout windows: <strong>{state.popout?.count ?? 0}</strong>
				</span>
			</div>
			<div data-test="gallery-floating-shell" style="height: 40vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;">
				<Dockview
					handle={state.handle}
					floating={state.floating}
					popout={state.popout}
					widgets={widgets}
					headerRight={GroupHeaderActions}
					options={{ theme: themeAbyss }}
					el={{ style: 'height: 100%; width: 100%;' }}
					onReady={onReady}
				/>
			</div>
		</div>
	)
}

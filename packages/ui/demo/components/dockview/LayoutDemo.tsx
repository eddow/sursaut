import { Dockview, type DockviewHandle } from '@sursaut/ui/dockview'
import { Orientation, type SerializedDockview, themeAbyss } from 'dockview'
import { reactive } from 'mutts'
import { BasicPanel } from './_widgets/BasicPanel'

const widgets = {
	a: { component: BasicPanel, title: 'A' },
	b: { component: BasicPanel, title: 'B' },
}

const STORAGE_KEY = 'sursaut:gallery-layout-demo'

function loadStored(): SerializedDockview | undefined {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		return raw ? (JSON.parse(raw) as SerializedDockview) : undefined
	} catch {
		return undefined
	}
}

function defaultLayout(): SerializedDockview {
	return {
		grid: {
			root: {
				type: 'branch',
				data: [
					{
						type: 'leaf',
						data: { views: ['panel-a'], activeView: 'panel-a', id: 'group-left' },
						size: 50,
					},
					{
						type: 'leaf',
						data: { views: ['panel-b'], activeView: 'panel-b', id: 'group-right' },
						size: 50,
					},
				],
				size: 100,
			},
			width: 800,
			height: 600,
			orientation: Orientation.HORIZONTAL,
		},
		panels: {
			'panel-a': {
				id: 'panel-a',
				contentComponent: 'a',
				tabComponent: 'a',
				title: 'Panel A',
				params: { text: 'Panel A (from layout)' },
			},
			'panel-b': {
				id: 'panel-b',
				contentComponent: 'b',
				tabComponent: 'b',
				title: 'Panel B (from layout)',
				params: { text: 'Panel B (from layout)' },
			},
		},
		activeGroup: 'group-left',
	}
}

export default function LayoutDemo() {
	const state = reactive<{
		handle: DockviewHandle | undefined
		layout: SerializedDockview | undefined
		saved: string | undefined
		mounted: boolean
	}>({
		handle: undefined,
		layout: loadStored() ?? defaultLayout(),
		saved: undefined,
		mounted: true,
	})

	const onReady = (_api: unknown, handle?: DockviewHandle) => {
		if (handle) state.handle = handle
	}

	const restore = () => {
		if (!state.saved) return
		// Remount with the saved layout (same idiom as DockviewDemo's
		// restore/reset): live `fromJSON` receive on an already-mounted
		// grid is unreliable, but a fresh mount from `layout` is exact.
		state.layout = JSON.parse(state.saved) as SerializedDockview
		state.mounted = false
		requestAnimationFrame(() => {
			state.mounted = true
		})
	}

	return (
		<div data-test="gallery-layout-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>Save / restore bind:layout</h2>
			<div style="display: flex; gap: 8px; margin-bottom: 8px;">
				<button data-test="gallery-layout-save" onClick={() => {
					state.saved = JSON.stringify(state.layout)
				}}>
					save layout
				</button>
				<button
					data-test="gallery-layout-restore"
					disabled={!state.saved}
					onClick={restore}
				>
					restore layout
				</button>
				<button
					data-test="gallery-layout-add"
					onClick={() => state.handle?.openPanel('a', { params: { text: 'Another A' } })}
				>
					add panel
				</button>
			</div>
			<div data-test="gallery-layout-shell" style="height: 40vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;">
				{state.mounted && (
					<Dockview
						handle={state.handle}
						layout={state.layout}
						widgets={widgets}
						options={{ theme: themeAbyss }}
						el={{ style: 'height: 100%; width: 100%;' }}
						onReady={onReady}
					/>
				)}
			</div>
		</div>
	)
}

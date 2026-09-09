import { Dockview, type DockviewHandle } from '@sursaut/ui/dockview'
import { themeAbyss } from 'dockview'
import { reactive } from 'mutts'
import { BasicPanel } from './_widgets/BasicPanel'
import { EmptyWatermark } from './_widgets/EmptyWatermark'

const widgets = {
	a: { component: BasicPanel, title: 'A' },
}

export default function EmptyDemo() {
	const state = reactive<{ handle: DockviewHandle | undefined }>({ handle: undefined })

	const onReady = (_api: unknown, handle?: DockviewHandle) => {
		if (handle) state.handle = handle
	}

	return (
		<div data-test="gallery-empty-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>Empty state (watermark)</h2>
			<p style="color: #94a3b8; max-width: 72ch;">
				With no panels open, <code>Dockview</code> shows the <code>watermark</code> prop — a
				plain component receiving <code>{'{ openPanel }'}</code>.
			</p>
			<div style="display: flex; gap: 8px; margin-bottom: 8px;">
				<button
					data-test="gallery-empty-open"
					onClick={() => state.handle?.openPanel('a', { params: { text: 'Panel A' } })}
				>
					open panel
				</button>
				<button data-test="gallery-empty-close-all" onClick={() => state.handle?.api.clear()}>
					close all
				</button>
			</div>
			<div data-test="gallery-empty-shell" style="height: 40vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;">
				<Dockview
					handle={state.handle}
					widgets={widgets}
					watermark={EmptyWatermark}
					options={{ theme: themeAbyss }}
					el={{ style: 'height: 100%; width: 100%;' }}
					onReady={onReady}
				/>
			</div>
		</div>
	)
}

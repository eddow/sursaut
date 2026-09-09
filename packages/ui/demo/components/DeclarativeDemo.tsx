import {
	Dockview,
	type DockviewHandle,
	type DockviewPanelState,
	DvWidget,
} from '@sursaut/ui/dockview'
import { themeAbyss } from 'dockview'
import { reactive } from 'mutts'

export default function DeclarativeDemo() {
	const state = reactive<{
		handle: DockviewHandle | undefined
		seq: number
	}>({
		handle: undefined,
		seq: 0,
	})

	const onReady = (_api: unknown, handle?: DockviewHandle) => {
		if (handle) {
			state.handle = handle
			addPanel()
		}
	}

	function addPanel() {
		state.seq += 1
		state.handle?.openPanel('basic', { params: { n: state.seq } })
	}

	return (
		<div data-test="declarative-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>Declarative widgets (<code>&lt;DvWidget&gt;</code>)</h2>
			<p style="color: #94a3b8; max-width: 72ch;">
				Same panel, no <code>widgets</code> prop — the body function receives the shared{' '}
				<code>state</code> object, exactly like a registry component's{' '}
				<code>{'{ state }'}</code> prop.
			</p>
			<div style="display: flex; gap: 8px; margin-bottom: 8px;">
				<button data-test="declarative-add-panel" onClick={addPanel}>
					add panel
				</button>
			</div>
			<div
				data-test="declarative-shell"
				style="height: 40vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;"
			>
				<Dockview
					handle={state.handle}
					options={{ theme: themeAbyss }}
					el={{ style: 'height: 100%; width: 100%;' }}
					onReady={onReady}
				>
					<DvWidget name="basic" title="Basic">
						{(panelState: DockviewPanelState<{ n?: number }>) => (
							<div
								data-test="declarative-basic"
								style="padding: 16px; height: 100%; box-sizing: border-box;"
							>
								<p data-test="declarative-panel-n">panel #{panelState.params.n ?? '—'}</p>
								<p data-test="declarative-panel-size" style="opacity: 0.7; font-size: 12px;">
									size: {panelState.size.width} × {panelState.size.height}
								</p>
							</div>
						)}
					</DvWidget>
				</Dockview>
			</div>
		</div>
	)
}

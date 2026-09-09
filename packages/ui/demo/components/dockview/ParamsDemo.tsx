import { Dockview, type DockviewHandle } from '@sursaut/ui/dockview'
import { themeAbyss } from 'dockview'
import { reactive } from 'mutts'
import { CounterPanel } from './_widgets/CounterPanel'

const widgets = {
	counter: { component: CounterPanel, title: 'Counter' },
}

export default function ParamsDemo() {
	// Passed by reference as openPanel `params`, so this object IS
	// `state.params` in the widget. Mutate its fields from either side and
	// both update — but never reassign it wholesale (that would detach the
	// widget's reference).
	const counter = reactive({ start: 10, step: 2 })
	const state = reactive<{ handle: DockviewHandle | undefined }>({ handle: undefined })

	const onReady = (_api: unknown, handle?: DockviewHandle) => {
		if (handle) {
			state.handle = handle
			handle.openPanel('counter', { params: counter })
		}
	}

	return (
		<div data-test="gallery-params-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>Reactive params (two-way)</h2>
			<p style="color: #94a3b8; max-width: 72ch;">
				Mutating <code>state.params</code> in the widget calls{' '}
				<code>api.updateParameters</code>; dockview-side updates merge back in. The page
				shares its own object as the panel's <code>params</code> — try <code>step++</code>{' '}
				on either side and watch both update.
			</p>
			<div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center; flex-wrap: wrap;">
				<button data-test="gallery-params-page-step" onClick={() => (counter.step += 1)}>
					page: step++ ({counter.step})
				</button>
				<span data-test="gallery-params-page-sees">
					page sees: start={counter.start}, step={counter.step}
				</span>
			</div>
			<div data-test="gallery-params-shell" style="height: 40vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;">
				<Dockview
					handle={state.handle}
					widgets={widgets}
					options={{ theme: themeAbyss }}
					el={{ style: 'height: 100%; width: 100%;' }}
					onReady={onReady}
				/>
			</div>
		</div>
	)
}

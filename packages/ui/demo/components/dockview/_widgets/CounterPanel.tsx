import type { DockviewWidget } from '@sursaut/ui/dockview'
import { effect, reactive, untracked } from 'mutts'

type CounterParams = {
	start?: number
	step?: number
}

export const CounterPanel: DockviewWidget<CounterParams> = (props, scope) => {
	const local = reactive({
		count: untracked`gallery.counter.init`(() => props.params.start ?? 0),
	})

	effect`gallery.counter.syncStart`(() => {
		local.count = props.params.start ?? 0
	})

	return (
		<div
			data-test="gallery-counter-panel"
			style="padding: 16px; height: 100%; box-sizing: border-box; background: #0f172a; color: white; display: flex; flex-direction: column; gap: 12px;"
		>
			<p data-test="gallery-counter-text">
				count: <strong data-test="gallery-counter-count">{local.count}</strong> (params:
				start={props.params.start}, step={props.params.step})
			</p>
			<div style="display: flex; gap: 8px; flex-wrap: wrap;">
				<button
					data-test="gallery-counter-local"
					onClick={() => {
						local.count += props.params.step ?? 1
					}}
				>
					+ step (local)
				</button>
				<button
					data-test="gallery-counter-step"
					onClick={() => {
						props.params.step = (props.params.step ?? 1) + 1
					}}
				>
					step++ (param)
				</button>
				<button
					data-test="gallery-counter-rename"
					onClick={() => scope.panelApi?.setTitle(`Count ${local.count}`)}
				>
					rename to count
				</button>
			</div>
		</div>
	)
}

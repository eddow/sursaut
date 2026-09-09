import {
	Gridview,
	type GridviewHandle,
	type GridviewWidget,
} from '@sursaut/ui/dockview'
import {
	Orientation,
	type GridviewApi,
	type IGridviewPanel,
	type SerializedGridviewComponent,
} from 'dockview'
import { reactive } from 'mutts'

type GridParams = {
	text?: string
}

const GridCell: GridviewWidget<GridParams> = (props) => {
	return (
		<div
			data-test={`gridview-cell-${props.state.params.text ?? 'cell'}`}
			style="padding: 16px; height: 100%; box-sizing: border-box; overflow: auto; background: #0f172a; color: white;"
		>
			<p data-test="gridview-cell-text">{props.state.params.text ?? 'Grid cell'}</p>
			<p data-test="gridview-cell-size" style="opacity: 0.7; font-size: 12px;">
				size: {props.state.size.width} × {props.state.size.height}
			</p>
			<div style="display: flex; gap: 8px;">
				<button
					data-test="gridview-cell-toggle-visible"
					onClick={() => {
						props.state.visible = !props.state.visible
					}}
				>
					{props.state.visible ? 'hide' : 'show'}
				</button>
				<button
					data-test="gridview-cell-activate"
					onClick={() => {
						props.state.active = true
					}}
				>
					activate
				</button>
			</div>
			<p data-test="gridview-cell-flags" style="opacity: 0.7; font-size: 12px;">
				active: {String(props.state.active)} · visible: {String(props.state.visible)}
			</p>
		</div>
	)
}

export default function GridviewDemo() {
	const state = reactive<{
		api: GridviewApi | undefined
		handle: GridviewHandle | undefined
		panels: IGridviewPanel[]
		activePanel: IGridviewPanel | undefined
		layout: SerializedGridviewComponent | undefined
		orientation: Orientation
		mounted: boolean
	}>({
		api: undefined,
		handle: undefined,
		panels: [],
		activePanel: undefined,
		layout: undefined,
		orientation: Orientation.HORIZONTAL,
		mounted: true,
	})

	const widgets = {
		a: { component: GridCell },
		b: { component: GridCell },
	}

	const onReady = (api: GridviewApi, handle?: GridviewHandle) => {
		state.api = api
		if (handle) state.handle = handle
		// Seed once the gridview has a real size (see splitview demo): cells
		// opened at 0px collapse — `Sizing.Distribute` divides the then-current size.
		const wait = () => {
			if ((handle?.api.width ?? 0) > 0) {
				handle?.openPanel('a', { params: { text: 'Top-left cell' } })
				handle?.openPanel('b', {
					params: { text: 'Top-right cell' },
					position: { direction: 'right', referencePanel: 'a-1' },
				})
				handle?.openPanel('a', {
					params: { text: 'Bottom-left cell' },
					position: { direction: 'below', referencePanel: 'a-1' },
				})
				handle?.openPanel('b', {
					params: { text: 'Bottom-right cell' },
					position: { direction: 'below', referencePanel: 'b-1' },
				})
			} else {
				requestAnimationFrame(wait)
			}
		}
		requestAnimationFrame(wait)
	}

	return (
		<div data-test="gridview-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>Gridview Primitive Demo</h2>
			<p style="color: #94a3b8; max-width: 72ch;">
				Simple grid splits with the same idiom as Dockview — widgets, typed openPanel,
				reactive state, bind:layout. No tabs, no headers. Position new cells with{' '}
				<code>position: {'{ direction, referencePanel }'}</code>.
			</p>
			<div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; align-items: center;">
				<button
					data-test="gridview-toggle-orientation"
					onClick={() => {
						state.orientation =
							state.orientation === Orientation.HORIZONTAL
								? Orientation.VERTICAL
								: Orientation.HORIZONTAL
					}}
				>
					orientation: {state.orientation === Orientation.HORIZONTAL ? 'horizontal' : 'vertical'}
				</button>
				<button
					data-test="gridview-add-cell"
					onClick={() => {
						state.handle?.openPanel('a', { params: { text: `Cell ${state.panels.length + 1}` } })
					}}
				>
					add cell
				</button>
				<button
					data-test="gridview-move-first-last"
					onClick={() => {
						const first = state.panels[0]
						const last = state.panels[state.panels.length - 1]
						if (first && last && first !== last)
							state.handle?.movePanel(first.id, { direction: 'below', reference: last.id })
					}}
				>
					move first below last
				</button>
				<span data-test="gridview-cell-count">
					cells: <strong>{state.panels.length}</strong>
				</span>
				<span data-test="gridview-active-panel">
					active: <strong>{state.activePanel?.id ?? 'none'}</strong>
				</span>
			</div>
			<div
				data-test="gridview-shell"
				style="height: 60vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;"
			>
				{state.mounted && (
					<Gridview
						api={state.api}
						handle={state.handle}
						panels={state.panels}
						activePanel={state.activePanel}
						widgets={widgets}
						layout={state.layout}
						options={{ orientation: state.orientation, proportionalLayout: true }}
						el={{ style: 'height: 100%; width: 100%;' }}
						onReady={onReady}
					/>
				)}
			</div>
		</div>
	)
}

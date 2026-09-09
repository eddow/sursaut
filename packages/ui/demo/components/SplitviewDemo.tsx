import {
	Splitview,
	type SplitviewHandle,
	type SplitviewWidget,
} from '@sursaut/ui/dockview'
import {
	Orientation,
	type ISplitviewPanel,
	type SerializedSplitview,
	type SplitviewApi,
} from 'dockview'
import { reactive } from 'mutts'

type SplitParams = {
	text?: string
}

const SplitPane: SplitviewWidget<SplitParams> = (props) => {
	return (
		<div
			data-test={`splitview-pane-${props.state.params.text ?? 'pane'}`}
			style="padding: 16px; height: 100%; box-sizing: border-box; overflow: auto; background: #0f172a; color: white;"
		>
			<p data-test="splitview-pane-text">{props.state.params.text ?? 'Split pane'}</p>
			<p data-test="splitview-pane-size" style="opacity: 0.7; font-size: 12px;">
				size: {props.state.size.width} × {props.state.size.height}
			</p>
			<div style="display: flex; gap: 8px;">
				<button
					data-test="splitview-pane-toggle-visible"
					onClick={() => {
						props.state.visible = !props.state.visible
					}}
				>
					{props.state.visible ? 'hide' : 'show'}
				</button>
				<button
					data-test="splitview-pane-activate"
					onClick={() => {
						props.state.active = true
					}}
				>
					activate
				</button>
			</div>
			<p data-test="splitview-pane-flags" style="opacity: 0.7; font-size: 12px;">
				active: {String(props.state.active)} · visible: {String(props.state.visible)}
			</p>
		</div>
	)
}

export default function SplitviewDemo() {
	const state = reactive<{
		api: SplitviewApi | undefined
		handle: SplitviewHandle | undefined
		views: ISplitviewPanel[]
		activeView: ISplitviewPanel | undefined
		layout: SerializedSplitview | undefined
		orientation: Orientation
		mounted: boolean
	}>({
		api: undefined,
		handle: undefined,
		views: [],
		activeView: undefined,
		layout: undefined,
		orientation: Orientation.HORIZONTAL,
		mounted: true,
	})

	const widgets = {
		a: { component: SplitPane },
		b: { component: SplitPane },
	}
	let nextPane = 1

	const onReady = (api: SplitviewApi, handle?: SplitviewHandle) => {
		state.api = api
		if (handle) state.handle = handle
		// Seed one frame past `onReady`: dockview's `Resizable` only learns the
		// container size on its first `ResizeObserver` pass. Panels opened while
		// the splitview still measures 0px keep a 0px first pane.
		const wait = () => {
			if ((handle?.api.width ?? 0) > 0) {
				handle?.openPanel('a', { params: { text: 'Left pane' } })
				handle?.openPanel('b', { params: { text: 'Right pane' } })
			} else {
				requestAnimationFrame(wait)
			}
		}
		requestAnimationFrame(wait)
	}

	return (
		<div data-test="splitview-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>Splitview Primitive Demo</h2>
			<p style="color: #94a3b8; max-width: 72ch;">
				Resizable split panes with the same idiom as Dockview — widgets, typed openPanel,
				reactive state, bind:layout. No tabs, no headers.
			</p>
			<div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; align-items: center;">
				<button
					data-test="splitview-toggle-orientation"
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
					data-test="splitview-add-pane"
					onClick={() => {
						state.handle?.openPanel('a', { params: { text: `Pane ${state.views.length + 1}` } })
						nextPane++
					}}
				>
					add pane
				</button>
				<button
					data-test="splitview-move-first-last"
					onClick={() => {
						state.handle?.movePanel(0, (state.handle?.api.panels.length ?? 1) - 1)
					}}
				>
					move first → last
				</button>
				<span data-test="splitview-view-count">
					views: <strong>{state.views.length}</strong>
				</span>
				<span data-test="splitview-active-view">
					active: <strong>{state.activeView?.id ?? 'none'}</strong>
				</span>
			</div>
			<div
				data-test="splitview-shell"
				style="height: 40vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;"
			>
				{state.mounted && (
					<Splitview
						api={state.api}
						handle={state.handle}
						views={state.views}
						activeView={state.activeView}
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

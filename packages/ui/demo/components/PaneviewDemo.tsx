import {
	Paneview,
	type PaneviewHandle,
	type PaneviewWidget,
} from '@sursaut/ui/dockview'
import {
	type IPaneviewPanel,
	type PaneviewApi,
	type SerializedPaneview,
} from 'dockview'
import { reactive } from 'mutts'

type PaneParams = {
	text?: string
}

const PaneBody: PaneviewWidget<PaneParams> = (props) => {
	return (
		<div
			data-test={`paneview-pane-${props.state.params.text ?? 'pane'}`}
			style="padding: 16px; height: 100%; box-sizing: border-box; overflow: auto; background: #0f172a; color: white;"
		>
			<p data-test="paneview-pane-text">{props.state.params.text ?? 'Pane body'}</p>
			<p data-test="paneview-pane-size" style="opacity: 0.7; font-size: 12px;">
				size: {props.state.size.width} × {props.state.size.height}
			</p>
			<div style="display: flex; gap: 8px;">
				<button
					data-test="paneview-pane-toggle-expanded"
					onClick={() => {
						props.state.expanded = !props.state.expanded
					}}
				>
					{props.state.expanded ? 'collapse' : 'expand'}
				</button>
			</div>
			<p data-test="paneview-pane-flags" style="opacity: 0.7; font-size: 12px;">
				active: {String(props.state.active)} · expanded: {String(props.state.expanded)}
			</p>
		</div>
	)
}

const PaneHeader: PaneviewWidget = (props) => {
	return (
		<span
			data-test={`paneview-header-${props.state.title}`}
			style="display: flex; align-items: center; gap: 8px; width: 100%;"
		>
			<span>{props.state.title}</span>
			<button
				data-test="paneview-header-toggle"
				aria-label="toggle"
				onClick={() => {
					props.state.expanded = !props.state.expanded
				}}
			>
				{props.state.expanded ? '▾' : '▸'}
			</button>
		</span>
	)
}

export default function PaneviewDemo() {
	const state = reactive<{
		api: PaneviewApi | undefined
		handle: PaneviewHandle | undefined
		panels: IPaneviewPanel[]
		layout: SerializedPaneview | undefined
		mounted: boolean
		seeded: boolean
	}>({
		api: undefined,
		handle: undefined,
		panels: [],
		layout: undefined,
		mounted: true,
		seeded: false,
	})

	const widgets = {
		a: { component: PaneBody, header: PaneHeader, title: 'Pane A' },
		b: { component: PaneBody, title: 'Pane B' },
	}

	const onReady = (api: PaneviewApi, handle?: PaneviewHandle) => {
		state.api = api
		if (handle) state.handle = handle
		if (state.seeded) return
		state.seeded = true
		handle?.openPanel('a', { params: { text: 'First pane (custom header)' }, isExpanded: true })
		handle?.openPanel('b', { params: { text: 'Second pane (default header)' } })
	}

	return (
		<div data-test="paneview-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>Paneview Primitive Demo</h2>
			<p style="color: #94a3b8; max-width: 72ch;">
				Collapsible VS Code-style sidebars with the same idiom as Dockview — widgets,
				typed openPanel, reactive state, bind:layout. Each pane mounts a body component
				plus an optional custom header (sharing one state); without a header dockview's
				default title header is used.
			</p>
			<div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; align-items: center;">
				<button
					data-test="paneview-add-pane"
					onClick={() => {
						state.handle?.openPanel('a', { params: { text: `Pane ${state.panels.length + 1}` } })
					}}
				>
					add pane
				</button>
				<button
					data-test="paneview-move-first-last"
					onClick={() => {
						state.handle?.movePanel(0, (state.handle?.api.panels.length ?? 1) - 1)
					}}
				>
					move first → last
				</button>
				<span data-test="paneview-pane-count">
					panes: <strong>{state.panels.length}</strong>
				</span>
			</div>
			<div
				data-test="paneview-shell"
				style="height: 40vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;"
			>
				{state.mounted && (
					<Paneview
						api={state.api}
						handle={state.handle}
						panels={state.panels}
						widgets={widgets}
						layout={state.layout}
						el={{ style: 'height: 100%; width: 100%;' }}
						onReady={onReady}
					/>
				)}
			</div>
		</div>
	)
}

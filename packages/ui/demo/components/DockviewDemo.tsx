import {
	Dockview,
	type DockviewActiveState,
	type DockviewFloatingState,
	type DockviewHandle,
	type DockviewHeaderAction,
	type DockviewPopoutState,
	type DockviewWatermarkProps,
	type DockviewWidget,
} from '@sursaut/ui/dockview'
import {
	type DockviewApi,
	Orientation,
	type SerializedDockview,
	themeAbyss,
	themeDark,
	themeDracula,
	themeLight,
} from 'dockview'
import { reactive, untracked, effect } from 'mutts'

type DemoContext = {
	accent?: string
	badge?: string
	label?: string
	status?: string
}

type CounterParams = {
	panelId: string
	initial: number
	step: number
}

type NotesParams = {
	panelId: string
	initial: string
}

function cloneLayout(layout: SerializedDockview): SerializedDockview {
	return JSON.parse(JSON.stringify(layout)) as SerializedDockview
}

function createDefaultLayout(): SerializedDockview {
	return {
		grid: {
			root: {
				type: 'branch',
				data: [
					{
						type: 'leaf',
						data: {
							id: 'demo-group',
							views: ['counter-1', 'notes-1'],
							activeView: 'counter-1',
						},
						size: 900,
					},
				],
			},
			width: 900,
			height: 520,
			orientation: Orientation.HORIZONTAL,
		},
		panels: {
			'counter-1': {
				id: 'counter-1',
				contentComponent: 'counter',
				tabComponent: 'live-counter-tab',
				title: 'Counter 1',
				params: {
					panelId: 'counter-1',
					initial: 1,
					step: 1,
				},
			},
			'notes-1': {
				id: 'notes-1',
				contentComponent: 'notes',
				tabComponent: 'live-notes-tab',
				title: 'Notes',
				params: {
					panelId: 'notes-1',
					initial: 'Hello from Dockview',
				},
			},
		},
	}
}

const CounterWidget: DockviewWidget<CounterParams, DemoContext> = (props) => {
	const state = reactive({
		value: untracked`DockviewDemo.CounterWidget.initial`(() => props.params.initial),
	})

	effect`DockviewDemo.CounterWidget.syncContext`(() => {
		props.context.badge = String(state.value)
		props.context.status = state.value % 2 === 0 ? 'even' : 'odd'
		props.context.accent = state.value % 2 === 0 ? '#0f766e' : '#7c3aed'
	})

	return (
		<div
			data-test={`dockview-counter-${props.params.panelId}`}
			style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #0f172a; color: white; box-sizing: border-box;"
		>
			<h3 style="margin: 0;">Counter widget</h3>
			<div
				data-test={`dockview-counter-value-${props.params.panelId}`}
				style="font-size: 28px; font-weight: 700;"
			>
				{state.value}
			</div>
			<div style="display: flex; gap: 8px; flex-wrap: wrap;">
				<button
					data-test={`dockview-counter-inc-${props.params.panelId}`}
					style="background: #2563eb; color: white; border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer;"
					onClick={() => {
						state.value += props.params.step
					}}
				>
					+{props.params.step}
				</button>
				<button
					data-test={`dockview-counter-rename-${props.params.panelId}`}
					style="background: #334155; color: white; border: 1px solid #475569; border-radius: 8px; padding: 8px 12px; cursor: pointer;"
					onClick={() => {
						const label = `Counter ${state.value}`
						props.context.label = label
						props.title = label
					}}
				>
					Rename tab
				</button>
			</div>
			<div style="color: #94a3b8; font-size: 14px;">
				Shared context badge: <strong>{props.context.badge ?? '-'}</strong>
			</div>
		</div>
	)
}

const NotesWidget: DockviewWidget<NotesParams, DemoContext> = (props) => {
	const state = reactive({
		text: untracked`DockviewDemo.NotesWidget.initial`(() => props.params.initial),
	})

	effect`DockviewDemo.NotesWidget.syncContext`(() => {
		props.context.badge = String(state.text.length)
		props.context.status = state.text.length === 0 ? 'empty' : 'draft'
		props.context.accent = state.text.length === 0 ? '#64748b' : '#ea580c'
	})

	return (
		<div
			data-test={`dockview-notes-${props.params.panelId}`}
			style="height: 100%; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #111827; color: white; box-sizing: border-box;"
		>
			<h3 style="margin: 0;">Notes widget</h3>
			<textarea
				data-test={`dockview-notes-input-${props.params.panelId}`}
				style="flex: 1; min-height: 160px; resize: vertical; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: white; padding: 12px;"
				value={state.text}
				onInput={(e: Event) => {
					if (e.target instanceof HTMLTextAreaElement) state.text = e.target.value
				}}
			></textarea>
			<div style="color: #94a3b8; font-size: 14px;">
				Characters shared to tab: <strong>{props.context.badge ?? '0'}</strong>
			</div>
		</div>
	)
}

const LiveTab: DockviewWidget<{ panelId: string }, DemoContext> = (props, scope) => {
	const accent = () => props.context.accent ?? '#475569'
	const label = () => props.context.label ?? props.title
	const floatPanel = () => {
		const api = scope.dockviewApi
		const id = scope.panelApi?.id
		if (!api || !id) return
		const panel = api.getPanel(id)
		if (panel) api.addFloatingGroup(panel)
	}
	const popoutPanel = () => {
		const api = scope.dockviewApi
		const id = scope.panelApi?.id
		if (!api || !id) return
		const panel = api.getPanel(id)
		if (panel) void api.addPopoutGroup(panel)
	}
	return (
		<div
			data-test={`dockview-tab-${props.params.panelId}`}
			class="tab"
			style="display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0;"
		>
			<span
				data-test={`dockview-tab-dot-${props.params.panelId}`}
				style={`width: 8px; height: 8px; border-radius: 999px; flex: 0 0 auto; background: ${accent()};`}
			></span>
			<span data-test={`dockview-tab-title-${props.params.panelId}`} class="title" title={label()}>
				{label()}
			</span>
			<span
				data-test={`dockview-tab-badge-${props.params.panelId}`}
				style={`font-size: 11px; line-height: 1; padding: 3px 6px; border-radius: 999px; background: ${accent()}; color: white; flex: 0 0 auto;`}
			>
				{props.context.badge ?? '0'}
			</span>
			<button
				data-test={`dockview-tab-float-${props.params.panelId}`}
				style="background: none; border: none; cursor: pointer; color: inherit; opacity: 0.7; font-size: 12px; padding: 0 2px;"
				title="Float panel"
				aria-label={`Float ${props.title}`}
				onClick={floatPanel}
			>
				⧉
			</button>
			<button
				data-test={`dockview-tab-popout-${props.params.panelId}`}
				style="background: none; border: none; cursor: pointer; color: inherit; opacity: 0.7; font-size: 12px; padding: 0 2px;"
				title="Popout panel"
				aria-label={`Popout ${props.title}`}
				onClick={popoutPanel}
			>
				↗
			</button>
			<button
				data-test={`dockview-tab-close-${props.params.panelId}`}
				class="close"
				aria-label={`Close ${props.title}`}
				onClick={() => scope.panelApi?.close()}
			>
				×
			</button>
		</div>
	)
}

const GroupHeaderAction: DockviewHeaderAction = ({ group }, scope) => {
	return (
		<div style="display: flex; align-items: center; gap: 4px;">
			<button
				data-test={`dockview-group-float-${group.id}`}
				style="background: transparent; color: inherit; border: 1px solid currentColor; border-radius: 999px; padding: 2px 8px; font-size: 11px; cursor: pointer; opacity: 0.8;"
				title="Float group"
				aria-label="Float group"
				onClick={() => scope.dockviewApi?.addFloatingGroup(group)}
			>
				⧉
			</button>
			<button
				data-test={`dockview-group-popout-${group.id}`}
				style="background: transparent; color: inherit; border: 1px solid currentColor; border-radius: 999px; padding: 2px 8px; font-size: 11px; cursor: pointer; opacity: 0.8;"
				title="Popout group"
				aria-label="Popout group"
				onClick={() => scope.dockviewApi?.addPopoutGroup(group)}
			>
				↗
			</button>
			<button
				data-test={`dockview-group-close-${group.id}`}
				style="background: transparent; color: inherit; border: 1px solid currentColor; border-radius: 999px; padding: 2px 8px; font-size: 11px; cursor: pointer; opacity: 0.8;"
				onClick={() => group.api.close()}
			>
				Close group ({group.panels.length})
			</button>
		</div>
	)
}

const EmptyWatermark = (props: DockviewWatermarkProps) => {
	return (
		<div
			data-test="dockview-watermark"
			style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; height: 100%; color: #94a3b8;"
		>
			<p style="margin: 0;">Empty dock — open a panel to begin</p>
			<button
				data-test="dockview-watermark-open"
				style="background: #2563eb; color: white; border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer;"
				onClick={() =>
					props.openPanel('counter', {
						params: { panelId: 'counter-watermark', initial: 1, step: 1 },
					})
				}
			>
				Open panel
			</button>
		</div>
	)
}

const themes = { abyss: themeAbyss, dark: themeDark, light: themeLight, dracula: themeDracula }
type ThemeName = keyof typeof themes

export default function DockviewDemo() {
	const storedLayout = (() => {
		try {
			const raw = localStorage.getItem('sursaut:dockview-demo')
			return raw ? (JSON.parse(raw) as SerializedDockview) : undefined
		} catch {
			return undefined
		}
	})()
	const initialLayout = storedLayout ?? createDefaultLayout()
	const state = reactive<{
		api: DockviewApi | undefined
		handle: DockviewHandle | undefined
		active: DockviewActiveState | undefined
		floating: DockviewFloatingState | undefined
		popout: DockviewPopoutState | undefined
		layout: SerializedDockview | undefined
		mounted: boolean
		savedLayout: string
		panelCount: number
		activePanelId: string | undefined
		themeName: ThemeName
		eventLog: string[]
		eventSeq: number
	}>({
		api: undefined,
		handle: undefined,
		active: undefined,
		floating: undefined,
		popout: undefined,
		layout: cloneLayout(initialLayout),
		mounted: true,
		savedLayout: '',
		panelCount: 0,
		activePanelId: undefined,
		themeName: 'dracula',
		eventLog: [],
		eventSeq: 0,
	})

	const pushEvent = (msg: string) => {
		state.eventSeq += 1
		state.eventLog = [...state.eventLog.slice(-9), `#${state.eventSeq} ${msg}`]
	}

	const widgets = {
		counter: { component: CounterWidget, tab: LiveTab, title: 'Counter' },
		notes: { component: NotesWidget, tab: LiveTab, title: 'Notes' },
	}
	const tabs = {
		'live-counter-tab': LiveTab,
		'live-notes-tab': LiveTab,
	}
	let nextCounter = 2
	let nextNotes = 2

	const addCounter = () => {
		const handle = state.handle
		if (!handle) return
		const order = nextCounter++
		handle.openPanel('counter', {
			id: `counter-${order}`,
			title: `Counter ${order}`,
			params: { panelId: `counter-${order}`, initial: order, step: 1 },
		})
	}

	const addNotes = () => {
		const handle = state.handle
		if (!handle) return
		const order = nextNotes++
		handle.openPanel('notes', {
			id: `notes-${order}`,
			title: `Notes ${order}`,
			params: { panelId: `notes-${order}`, initial: `Notes for notes-${order}` },
		})
	}

	const splitActiveRight = () => {
		const handle = state.handle
		const api = state.api
		// Same staleness guard as `closeActive` — prefer live api state.
		const liveId = api?.activePanel?.id ?? api?.panels[0]?.id
		const storedId = state.active?.panel?.id
		const staleId =
			liveId ?? (storedId && api?.panels.some((p) => p.id === storedId) ? storedId : undefined)
		const referencePanel = staleId ? api?.panels.find((p) => p.id === staleId) : undefined
		if (!handle || !referencePanel) return
		const order = nextCounter++
		handle.openPanel('counter', {
			id: `counter-${order}`,
			title: `Counter ${order}`,
			params: { panelId: `counter-${order}`, initial: order, step: 1 },
			position: { referencePanel, direction: 'right' as const },
		})
	}

	const saveLayout = () => {
		state.savedLayout = JSON.stringify(
			state.api?.toJSON() ?? state.layout ?? createDefaultLayout(),
			null,
			2
		)
		persistLayout()
	}

	const restoreLayout = () => {
		if (!state.savedLayout) return
		const nextLayout = JSON.parse(state.savedLayout) as SerializedDockview
		const snapshot = cloneLayout(nextLayout)
		state.layout = snapshot
		state.mounted = false
		state.api = undefined
		requestAnimationFrame(() => {
			state.mounted = true
		})
	}

	const resetLayout = () => {
		const nextLayout = createDefaultLayout()
		const snapshot = cloneLayout(nextLayout)
		state.layout = snapshot
		state.mounted = false
		state.api = undefined
		requestAnimationFrame(() => {
			state.mounted = true
		})
	}

	const closeActive = () => {
		// Never close through a stored wrapper: `fromJSON` rebuilds group
		// objects, so `state.active.panel` may point at a disposed panel whose
		// `close()` throws "invalid operation". Prefer the live api state;
		// fall back to the stored id only if it still resolves to a live panel.
		const api = state.api
		const liveId = api?.activePanel?.id ?? api?.panels[0]?.id
		const storedId = state.active?.panel?.id
		const staleId =
			liveId ?? (storedId && api?.panels.some((p) => p.id === storedId) ? storedId : undefined)
		const panel = staleId ? api?.panels.find((p) => p.id === staleId) : undefined
		panel?.api.close()
	}

	const floatActive = () => {
		const handle = state.handle
		const api = state.api
		// Same staleness guard as `closeActive` — prefer live api state.
		const liveId = api?.activePanel?.id ?? api?.panels[0]?.id
		const storedId = state.active?.panel?.id
		const staleId =
			liveId ?? (storedId && api?.panels.some((p) => p.id === storedId) ? storedId : undefined)
		const panel = staleId ? api?.panels.find((p) => p.id === staleId) : undefined
		if (!handle || !panel) return
		handle.float(panel.id)
	}

	const openFloatingCounter = () => {
		const handle = state.handle
		if (!handle) return
		const order = nextCounter++
		handle.openPanel('counter', {
			id: `counter-${order}`,
			title: `Floating ${order}`,
			params: { panelId: `counter-${order}`, initial: order, step: 1 },
			floating: { x: 80, y: 80, width: 320, height: 220 },
		})
	}

	const persistLayout = () => {
		try {
			if (state.layout) localStorage.setItem('sursaut:dockview-demo', JSON.stringify(state.layout))
		} catch {
			// Storage full or unavailable — the demo still works in-memory.
		}
	}

	const onReady = (api: DockviewApi, handle?: DockviewHandle) => {
		state.api = api
		if (handle) state.handle = handle
		const sync = () => {
			state.panelCount = api.totalPanels
			state.activePanelId = api.activePanel?.id ?? api.panels[0]?.id
		}
		sync()
		const disposables = [
			api.onDidAddPanel(sync),
			api.onDidRemovePanel(sync),
			api.onDidActivePanelChange(sync),
			api.onDidLayoutChange(sync),
			api.onDidLayoutFromJSON(() => {
				if (!api.activePanel && api.panels[0]) api.panels[0].api.setActive()
				sync()
			}),
		]
		return () => {
			for (const d of disposables) d.dispose()
		}
	}

	return (
		<div
			data-test="dockview-demo"
			style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;"
		>
			<h2>Dockview Primitive Demo</h2>
			<p style="color: #94a3b8; max-width: 72ch;">
				This demo exercises dynamic panels, layout persistence, group header actions, and custom
				tabs that react to shared widget context.
			</p>
			<div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0;">
				<button data-test="dockview-add-counter" onClick={addCounter}>
					Add Counter
				</button>
				<button data-test="dockview-add-notes" onClick={addNotes}>
					Add Notes
				</button>
				<button data-test="dockview-split-active-right" onClick={splitActiveRight}>
					Split Active Right
				</button>
				<button data-test="dockview-open-floating" onClick={openFloatingCounter}>
					Open Floating
				</button>
				<button
					data-test="dockview-float-active"
					onClick={floatActive}
					disabled={!state.activePanelId}
				>
					Float Active
				</button>
				<button
					data-test="dockview-dock-all"
					onClick={() => state.handle?.dockAll()}
					disabled={!state.floating?.hasFloating}
				>
					Dock All
				</button>
				<button data-test="dockview-save-layout" onClick={saveLayout}>
					Save Layout
				</button>
				<button
					data-test="dockview-restore-layout"
					onClick={restoreLayout}
					disabled={!state.savedLayout}
				>
					Restore Saved
				</button>
				<button data-test="dockview-reset-layout" onClick={resetLayout}>
					Reset Layout
				</button>
				<button
					data-test="dockview-close-active"
					onClick={closeActive}
					disabled={!state.activePanelId}
				>
					Close Active
				</button>
			</div>
			<div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 16px 0; align-items: center;">
				<span style="color: #94a3b8; font-size: 12px;">Theme:</span>
				{(Object.keys(themes) as ThemeName[]).map((name) => (
					<button
						data-test={`dockview-theme-${name}`}
						aria-pressed={state.themeName === name}
						style={`padding: 4px 10px; border-radius: 6px; border: 1px solid ${state.themeName === name ? '#2563eb' : '#475569'}; background: ${state.themeName === name ? '#1e3a8a' : 'transparent'}; color: white; cursor: pointer; font-size: 12px;`}
						onClick={() => {
							state.themeName = name
						}}
					>
						{name}
					</button>
				))}
			</div>
			<div style="display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 16px; align-items: start;">
				<div
					data-test="dockview-shell"
					class="dockview-theme-dark"
					style="height: 480px; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;"
				>
					{state.mounted && (
						<Dockview
							api={state.api}
							handle={state.handle}
							active={state.active}
							floating={state.floating}
							popout={state.popout}
							widgets={widgets}
							tabs={tabs}
							headerRight={GroupHeaderAction}
							watermark={EmptyWatermark}
							layout={state.layout}
							options={{ singleTabMode: 'default', theme: themes[state.themeName] }}
							themeSync={false}
							el={{ style: 'height: 100%; width: 100%;' }}
							onReady={onReady}
							onDidActivePanelChange={(event) =>
								pushEvent(`active panel → ${event.panel?.id ?? '(none)'}`)
							}
							onDidAddPanel={(panel) => pushEvent(`added ${panel.id}`)}
							onDidRemovePanel={(panel) => pushEvent(`removed ${panel.id}`)}
						/>
					)}
				</div>
				<div style="display: flex; flex-direction: column; gap: 12px;">
					<div style="padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #1e293b;">
						<div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 6px;">
							Runtime
						</div>
						<div data-test="dockview-api-state">API: {state.api ? 'ready' : 'pending'}</div>
						<div data-test="dockview-panel-count">Panels: {state.panelCount}</div>
						<div data-test="dockview-active-panel">
							Active: {state.activePanelId ?? 'none'}
						</div>
						<div data-test="dockview-floating-state">
							Floating: {state.floating?.count ?? 0}
						</div>
						<div data-test="dockview-popout-state">
							Popout: {state.popout?.count ?? 0}
						</div>
					</div>
					<div style="padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #1e293b;">
						<div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 6px;">
							Events
						</div>
						<div data-test="dockview-active-panel-state">
							Active: {state.active?.panel?.id ?? '(none)'}
						</div>
						<ul
							data-test="dockview-event-log"
							style="margin: 6px 0 0 0; padding-left: 18px; font-size: 12px; color: #cbd5e1; max-height: 160px; overflow: auto;"
						>
							<for each={state.eventLog}>
								{(entry) => <li>{entry}</li>}
							</for>
						</ul>
					</div>
					<div style="padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #1e293b;">
						<div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 6px;">
							Saved Layout
						</div>
						<pre
							data-test="dockview-saved-layout"
							style="margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 12px; color: #cbd5e1; max-height: 220px; overflow: auto;"
						>
							{state.savedLayout || 'Nothing saved yet.'}
						</pre>
					</div>
				</div>
			</div>
		</div>
	)
}

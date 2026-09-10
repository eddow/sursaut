import { Code, PackageHeader, Section } from '../../components'

const openSnippet = `import { Dockview, defineDockviewWidgets } from '@sursaut'

const widgets = defineDockviewWidgets({
  counter: { component: CounterWidget, title: 'Counter' },
  notes: { component: NotesWidget, tab: NotesTab },
})

function Layout() {
  return (
    <Dockview
      widgets={widgets}
      handle={(h) => (handleRef = h)}
      watermark={({ openPanel }) => (
        <button onClick={() => openPanel('counter')}>Open counter</button>
      )}
    >
      <DvWidget name="extra" title="Extra">
        {(state) => <ExtraWidget state={state} />}
      </DvWidget>
    </Dockview>
  )
}

// Typed open: params inferred from the widget component signature.
handleRef.openPanel('counter', { params: { start: 5 } })
// -> { id, panel, state: DockviewPanelState }`

const stateSnippet = `// One shared PanelState per panel (svelte parity):
// { params, size, shown, visible, active, focused, pinned, groupActive,
//   api, title, custom }
// - shown: renderer onShow/onHide. visible: api.isVisible. Two visibilities.
// - pinned: two-way. active/focused/groupActive: read-only mirrors.
// - params: deep-merged dockview->widget (mergeInto, identity-preserving);
//   widget->dockview writes guarded by deepEqual (no layout loop).
// - size: written on layout, skipped while !shown (rAF-throttled).`

const siblingSnippet = `// Same idiom, three more layouts:
import { Splitview, Gridview, Paneview } from '@sursaut'

<Splitview widgets={splitWidgets} bind:layout={state.layout} />
<Gridview widgets={gridWidgets} bind:panels={state.panels} />
<Paneview widgets={paneWidgets} bind:panels={state.panels} />
// Each has its own registry (SplitviewWidgetRegistry, ...),
// DvWidget children, openPanel/removePanel/movePanel/setVisible/setActive.`

const routerSnippet = `import { DockviewRouter } from '@sursaut'

// Routes -> widgets. Sursaut-only (no svelte equivalent).
<DockviewRouter
  routes={routes}
  extraWidgets={widgets}
  loading={({ url }) => <span>Loading {url}…</span>}
  notFound={({ url }) => <h1>404: {url}</h1>}
/>`

export default function DockviewPage() {
	return (
		<article>
			<PackageHeader
				name="Dockview family"
				description="Dockview, Splitview, Gridview, Paneview, DvWidget, DockviewRouter — dockview-svelte parity in Sursaut."
				install="pnpm add @sursaut/ui dockview"
			/>

			<Section title="Dockview + handle">
				<p>
					<code>handle</code> is the svelte <code>bind:handle</code> equivalent:{' '}
					<code>{'{ api, openPanel, registerWidget, float, popout, dockAll }'}</code>.{' '}
					<code>openPanel(key, opts)</code> resolves title (
					<code>opts.title ?? def.title ?? key</code>), auto-ids (<code>{'`${key}-${n}`'}</code>),
					and infers params per widget.
				</p>
				<Code code={openSnippet} lang="tsx" />
			</Section>

			<Section title="Shared PanelState">
				<Code code={stateSnippet} lang="text" />
			</Section>

			<Section title="Watermark, events, loop guard">
				<ul>
					<li>
						<code>watermark</code>: plain widget receiving <code>{'{ openPanel }'}</code>, rendered
						when panel count is 0.
					</li>
					<li>
						All 33 <code>DockviewApi</code> events forwarded as component props +{' '}
						<code>onReady({'{ api, handle }'})</code>.
					</li>
					<li>
						<code>bind:layout</code> loop-break via <code>lastEmitted</code> +{' '}
						<code>deepEqual</code>; <code>bind:active/floating/popout</code> mirrors and{' '}
						<code>GroupState</code> for header actions.
					</li>
					<li>
						Sursaut-only extras kept: <code>themeSync</code> (DisplayContext → dracula/light),{' '}
						<code>debug</code> logging, <code>caught</code> boundaries, <code>onPanelError</code>/
						<code>renderPanelError</code>.
					</li>
				</ul>
			</Section>

			<Section title="Sibling layouts">
				<Code code={siblingSnippet} lang="tsx" />
			</Section>

			<Section title="DvWidget + DockviewRouter">
				<p>
					<code>{'<DvWidget name title>'}</code> children register snippet-backed widgets
					declaratively (<code>tab</code> → Dockview, <code>header</code> → Paneview,{' '}
					<code>title</code> → Dockview/Paneview; inapplicable ones warn in dev).
				</p>
				<Code code={routerSnippet} lang="tsx" />
			</Section>
		</article>
	)
}

import { collapse } from '@sursaut/core'
import { effect, link } from 'mutts'
import type { DockviewWidget } from './dockview'
import {
	DOCKVIEW_CONTEXT_KEY,
	type DvWidgetLayoutContext,
	type DvWidgetLayoutKind,
} from './dockview-utils'
import type { GridviewWidget } from './gridview'
import type { PaneviewWidget } from './paneview'
import type { SplitviewWidget } from './splitview'

/**
 * Body render function for `<DvWidget>`: receives the panel's shared `state`
 * object — the same object a `widgets`-registry component receives — and
 * returns its content. (sursaut idiom for svelte's `{#snippet children(state)}`.)
 */
export type DvWidgetBody<State = never> = (state: State) => JSX.Element

/**
 * Props for `<DvWidget>` (mirrors svelte `DvWidget.svelte`).
 *
 * The `children` function receives the panel's shared `state` object — the
 * same object a `widgets`-registry component receives as its `state` prop —
 * and its output is rendered into the panel body (and tab/header, when given).
 * `tab` / `header` receive the same `state`.
 *
 * > **Type note:** the function parameter defaults to `never` on purpose — it
 * > cannot be inferred per-widget, so annotate it with your panel's state type
 * > (e.g. `children={(state: DockviewPanelState<{ n?: number }>) => …}`).
 *
 * Usage:
 *
 * ```tsx
 * <Dockview>
 * 	<DvWidget name="chat" title="Chat">
 * 		{(state: DockviewPanelState) => <ChatWidget state={state} />}
 * 	</DvWidget>
 * </Dockview>
 * ```
 */
export interface DvWidgetProps {
	/** Widget key this instance registers under. */
	name: string
	/** Body content, called with the shared `state`. */
	children: DvWidgetBody<any>
	/** Dockview tab override, called with the shared `PanelState` (Dockview only). */
	tab?: DvWidgetBody<any>
	/** Paneview header override, called with the shared `PaneviewState` (Paneview only). */
	header?: DvWidgetBody<any>
	/** Default title for this widget (tier 2 in the resolution chain). */
	title?: string
}

function warnInapplicable(
	kind: DvWidgetLayoutKind,
	hasTab: boolean,
	hasHeader: boolean,
	hasTitle: boolean
) {
	if (hasTab && kind !== 'dockview') {
		console.warn(
			`dockview: <DvWidget tab> is only supported by <Dockview>; ignored inside <${kind}>`
		)
	}
	if (hasHeader && kind !== 'paneview') {
		console.warn(
			`dockview: <DvWidget header> is only supported by <Paneview>; ignored inside <${kind}>`
		)
	}
	if (hasTitle && kind !== 'dockview' && kind !== 'paneview') {
		console.warn(
			`dockview: <DvWidget title> is only supported by <Dockview>/<Paneview>; ignored inside <${kind}>`
		)
	}
}

/**
 * Wrap a body function as a registry widget. The factories call
 * `widget(props, scope)` with the shared state, so the wrapper only needs to
 * forward the right shape per layout:
 * - Dockview content/tab: legacy `{ title, size, params, context }` props.
 *   The shared `DockviewPanelState` is threaded through `scope.panelState`
 *   (the body function receives it directly — no prop translation needed).
 * - Splitview/Gridview/Paneview: `{ state }` props already.
 */
function bodyComponent(
	body: DvWidgetBody<any>,
	kind: DvWidgetLayoutKind
): DockviewWidget<any, any> | SplitviewWidget<any> | GridviewWidget<any> | PaneviewWidget<any> {
	if (kind === 'dockview') {
		return ((_props: unknown, scope: Record<string, unknown>) =>
			body(scope.panelState)) as unknown as DockviewWidget<any, any>
	}
	return (({ state }: { state: unknown }) => body(state)) as
		| SplitviewWidget<any>
		| GridviewWidget<any>
		| PaneviewWidget<any>
}

/**
 * Declarative widget registration (svelte `<DvWidget>` equivalent).
 *
 * Must be a child of `Dockview`/`Splitview`/`Gridview`/`Paneview` — reads the
 * parent layout context from scope (published under `DOCKVIEW_CONTEXT_KEY`,
 * same idiom as `DisplayProvider`'s `DISPLAY_KEY`). Registers on mount and on
 * every prop change; the effect cleanup unregisters the current key first, so
 * a changed `name` never leaves a stale entry behind. `widgets`-prop entries
 * with the same key win on re-seed — declarative children are the override
 * path, not the base.
 *
 * Only snippets that apply to the parent layout reach the registry (`tab` →
 * Dockview, `header` → Paneview, `title` → Dockview/Paneview); inapplicable
 * ones warn in dev instead of silently dropping (mirrors svelte).
 *
 * Renders nothing — registration is a side effect only.
 */
export function DvWidget(props: DvWidgetProps, scope: Record<string, any>): null {
	const ctx = (scope as Record<PropertyKey, unknown>)[DOCKVIEW_CONTEXT_KEY] as
		| DvWidgetLayoutContext
		| undefined
	if (!ctx) {
		throw new Error('dockview: <DvWidget> must be a child of Dockview/Splitview/Gridview/Paneview')
	}
	const kind = ctx.kind

	// Extract the body function from `props.children`. `props.children` arrives
	// via `asProps({ children })`: the raw JSX children array is the superLayer,
	// so `props.children` is the array itself (NOT unwrapped — `processChildren`'s
	// single-element unwrap happens later at render). Each entry is typically a
	// `ReactiveProp` wrapping the real child — `collapse` through it, then unwrap
	// single-element arrays (mirrors `processChildren`).
	const name = props.name
	const rawChildren = collapse(props.children) as unknown
	const collapsed = Array.isArray(rawChildren)
		? rawChildren.map((c) => collapse(c as never))
		: collapse(rawChildren as never)
	const unwrapped = Array.isArray(collapsed) && collapsed.length === 1 ? collapsed[0] : collapsed
	const body = unwrapped as unknown as DvWidgetBody<any>
	if (typeof body !== 'function') {
		throw new Error(
			`dockview: <DvWidget> expects a single function child, got ${Array.isArray(unwrapped) ? `${unwrapped.length} children` : typeof unwrapped}`
		)
	}
	const tab = props.tab
	const header = props.header
	const title = props.title

	warnInapplicable(kind, tab !== undefined, header !== undefined, title !== undefined)

	const def: Record<string, unknown> = { component: bodyComponent(body, kind) }
	if (tab && kind === 'dockview') def.tab = bodyComponent(tab, kind)
	if (header && kind === 'paneview') def.header = bodyComponent(header, kind)
	if (title !== undefined && (kind === 'dockview' || kind === 'paneview')) {
		def.title = title
	}
	ctx.registerWidget(name, def)
	// Unregister on unmount. `effect` inside the component body parents to the
	// render effect, so its cleanup runs when the `<DvWidget>` node is removed
	// (same lifecycle as svelte's `$effect` cleanup).
	//
	// NOTE: unlike svelte's `$effect`-driven re-registration, `name`/`title`/
	// `tab`/`header`/`children` are *static* props snapshotted at mount — sursaut's
	// rebuild fence forbids re-running the component body on reactive prop reads,
	// so a reactively-changing `name` is unsupported (documented divergence). To
	// change a widget's registration, unmount and re-mount the `<DvWidget>`.
	//
	// The stop handle is linked to a per-instance anchor node returned as the
	// component output: `produceComponent` runs `processChildren` on it, which
	// links rendered nodes to the render-effect stop — chaining the anchor
	// (and its effect) into the same cleanup tree. Tearing down the nodes
	// (latch cleanup / reconcile removal) unlinks the anchor, stops the effect,
	// and fires the unregister. Without the anchor, a `null` render has no
	// nodes to attach to and the effect would leak.
	// NOTE: the anchor must be a `Node` (not a plain object) — `processChildren`
	// only links `Node | readonly Node[]` outputs into the cleanup tree.
	const anchor = document.createComment('dv-widget')
	const stop = effect`DvWidget.register`(function register() {
		return () => ctx.unregisterWidget(name)
	})
	link(anchor, stop)
	return anchor as unknown as null
}

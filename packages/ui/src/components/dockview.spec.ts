import { h } from '@sursaut/core'
import type { DockviewPanelApi, GroupPanelPartInitParameters } from 'dockview'
import { effect, reactive } from 'mutts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	type DockviewEventProps,
	type DockviewHandle,
	type DockviewPanelHandle,
	type DockviewParamsOf,
	type DockviewWidget,
	type DockviewWidgetParams,
	type DockviewWidgetProps,
	type DockviewWidgetScope,
	dockviewInternals,
} from './dockview'

type DemoContext = { badge?: string }
type DemoParams = { panelId: string }

function createPanelApi() {
	let titleListener: ((value: { title: string } | string) => void) | undefined
	let paramsListener: ((value: Record<string, unknown>) => void) | undefined
	const listeners: Record<string, ((value: any) => void) | undefined> = {}
	const onEvent = (key: string) => (listener: (value: any) => void) => {
		listeners[key] = listener
		return { dispose: vi.fn() }
	}
	const api = {
		id: 'panel-1',
		isVisible: true,
		isActive: false,
		isFocused: false,
		isPinned: false,
		isGroupActive: false,
		close: vi.fn(),
		setTitle: vi.fn(),
		setActive: vi.fn(),
		setPinned: vi.fn(),
		updateParameters: vi.fn(),
		onDidTitleChange(listener: (value: { title: string } | string) => void) {
			titleListener = listener
			return { dispose: vi.fn() }
		},
		onDidParametersChange(listener: (value: Record<string, unknown>) => void) {
			paramsListener = listener
			return { dispose: vi.fn() }
		},
		onDidActiveChange: onEvent('active'),
		onDidFocusChange: onEvent('focused'),
		onDidVisibilityChange: onEvent('visible'),
		onDidChangePinned: onEvent('pinned'),
		onDidActiveGroupChange: onEvent('groupActive'),
	}
	return {
		api: api as unknown as DockviewPanelApi,
		fireTitle(value: { title: string } | string) {
			titleListener?.(value)
		},
		fireParams(value: Record<string, unknown>) {
			paramsListener?.(value)
		},
		fire(key: 'active' | 'focused' | 'visible' | 'pinned' | 'groupActive', value: any) {
			listeners[key]?.(value)
		},
		spies: api,
	}
}

function noop() {
	return h('div', {})
}

describe('Dockview renderer internals', () => {
	afterEach(() => {
		document.body.innerHTML = ''
	})

	it('shares a reactive context between widget and tab, and injects scope', () => {
		const shared = reactive({ value: 1 })
		const captured: { widget?: DockviewWidgetScope; tab?: DockviewWidgetScope } = {}
		const panel = createPanelApi()
		const props: Partial<DockviewWidgetProps<DemoParams, DemoContext>> = {
			context: reactive({}),
		}
		const scope = { api: { id: 'dockview-api' } }

		const Widget: DockviewWidget<any, any> = (wp, sc) => {
			captured.widget = sc
			effect`dockview.spec.Widget.syncBadge`(() => {
				wp.context.badge = String(shared.value)
			})
			return noop()
		}

		const Tab: DockviewWidget<any, any> = (_tp, sc) => {
			captured.tab = sc
			return noop()
		}

		const content = dockviewInternals.contentRenderer(Widget, props, vi.fn(), scope, (fn) =>
			effect`dockview.spec.content`(fn)
		)
		document.body.appendChild(content.element)
		content.init({
			api: panel.api,
			params: { panelId: 'counter-1' },
			title: 'Counter 1',
			containerApi: scope.api as never,
		} satisfies GroupPanelPartInitParameters)

		const tab = dockviewInternals.tabRenderer(Tab, props as DockviewWidgetProps, scope, (fn) =>
			effect`dockview.spec.tab`(fn)
		)
		document.body.appendChild(tab.element)
		tab.init({
			api: panel.api,
			params: { panelId: 'counter-1' },
			title: 'Counter 1',
			containerApi: scope.api as never,
		} satisfies GroupPanelPartInitParameters)

		// Shared reactive context is visible from both widget and tab
		expect((props.context as DemoContext).badge).toBe('1')

		// Scope injection: both widget and tab receive dockviewApi and panelApi
		expect(captured.widget?.dockviewApi).toBe(scope.api)
		expect(captured.tab?.dockviewApi).toBe(scope.api)
		expect(captured.widget?.panelApi).toBe(panel.api)
		expect(captured.tab?.panelApi).toBe(panel.api)

		// Reactive context flows across: mutating source updates context on props
		shared.value = 42
		expect((props.context as DemoContext).badge).toBe('42')

		content.dispose?.()
		tab.dispose?.()
	})

	it('title setter calls panelApi.setTitle and params update flows through', () => {
		const panel = createPanelApi()
		const props: Partial<DockviewWidgetProps<DemoParams, DemoContext>> = {
			context: reactive({}),
		}
		const scope = { api: { id: 'dockview-api' } }

		const content = dockviewInternals.contentRenderer(
			noop as DockviewWidget,
			props,
			vi.fn(),
			scope,
			(fn) => effect`dockview.spec.title`(fn)
		)
		document.body.appendChild(content.element)
		content.init({
			api: panel.api,
			params: { panelId: 'counter-1' },
			title: 'Counter 1',
			containerApi: scope.api as never,
		} satisfies GroupPanelPartInitParameters)

		// Title getter returns the initial title
		const typed = props as DockviewWidgetProps<DemoParams, DemoContext>
		expect(typed.title).toBe('Counter 1')

		// Title setter delegates to panelApi.setTitle
		typed.title = 'Renamed'
		expect(panel.spies.setTitle).toHaveBeenCalledWith('Renamed')
		expect(typed.title).toBe('Renamed')

		// External title change via onDidTitleChange listener
		panel.fireTitle({ title: 'External' })
		expect(typed.title).toBe('External')

		// Params update via onDidParametersChange listener
		panel.fireParams({ panelId: 'counter-9' })
		expect(typed.params.panelId).toBe('counter-9')

		content.dispose?.()
	})

	it('calls onPanelError when a panel widget throws', () => {
		const panel = createPanelApi()
		const props: Partial<DockviewWidgetProps<DemoParams, DemoContext>> = {
			context: reactive({}),
		}
		const scope = { api: { id: 'dockview-api' } }
		const onPanelError = vi.fn()
		const Widget: DockviewWidget<any, any> = () => {
			throw new Error('boom')
		}

		const content = dockviewInternals.contentRenderer(
			Widget,
			props,
			vi.fn(),
			scope,
			(fn) => effect`dockview.spec.error`(fn),
			onPanelError
		)
		document.body.appendChild(content.element)
		content.init({
			api: panel.api,
			params: { panelId: 'counter-1' },
			title: 'Counter 1',
			containerApi: scope.api as never,
		} satisfies GroupPanelPartInitParameters)

		expect(onPanelError).toHaveBeenCalledTimes(1)
		expect(onPanelError).toHaveBeenCalledWith('panel-1', expect.any(Error), content.element)
		expect((onPanelError.mock.calls[0]?.[1] as Error).message).toBe('boom')

		content.dispose?.()
	})

	it('mirrors dockview booleans into state and back', () => {
		const panel = createPanelApi()
		const props: Partial<DockviewWidgetProps<DemoParams, DemoContext>> = {
			context: reactive({}),
		}
		const scope = { api: { id: 'dockview-api' } }
		const content = dockviewInternals.contentRenderer(
			noop as DockviewWidget,
			props,
			vi.fn(),
			scope,
			(fn) => effect`dockview.spec.mirrors`(fn)
		)
		document.body.appendChild(content.element)
		content.init({
			api: panel.api,
			params: { panelId: 'counter-1' },
			title: 'Counter 1',
			containerApi: scope.api as never,
		} satisfies GroupPanelPartInitParameters)
		const state = dockviewInternals.getState('panel-1')
		expect(state).toBeDefined()
		expect(state!.visible).toBe(true)
		expect(state!.active).toBe(false)

		// dockview → state
		panel.fire('visible', { isVisible: false })
		expect(state!.visible).toBe(false)
		panel.fire('active', { isActive: true })
		expect(state!.active).toBe(true)
		panel.fire('pinned', { isPinned: true })
		expect(state!.pinned).toBe(true)

		// state → dockview (pin toggle)
		state!.pinned = false
		expect(panel.spies.setPinned).toHaveBeenCalledWith(false)

		content.dispose?.()
		expect(dockviewInternals.getState('panel-1')).toBeUndefined()
	})

	it('deep-merges dockview params preserving identity and guards no-op writes', () => {
		const panel = createPanelApi()
		const props: Partial<DockviewWidgetProps<DemoParams, DemoContext>> = {
			context: reactive({}),
		}
		const scope = { api: { id: 'dockview-api' } }
		const content = dockviewInternals.contentRenderer(
			noop as DockviewWidget,
			props,
			vi.fn(),
			scope,
			(fn) => effect`dockview.spec.merge`(fn)
		)
		document.body.appendChild(content.element)
		content.init({
			api: panel.api,
			params: { panelId: 'counter-1', nested: { x: 1 } },
			title: 'Counter 1',
			containerApi: scope.api as never,
		} satisfies GroupPanelPartInitParameters)
		const state = dockviewInternals.getState('panel-1')
		const nested = (state!.params as Record<string, unknown>).nested
		panel.fireParams({ nested: { y: 2 } })
		expect((state!.params as Record<string, unknown>).nested).toBe(nested)
		expect(state!.params).toMatchObject({ nested: { x: 1, y: 2 } })

		// No-op external params must not trigger updateParameters
		const calls = panel.spies.updateParameters.mock.calls.length
		panel.fireParams({ nested: { x: 1, y: 2 } })
		expect(panel.spies.updateParameters.mock.calls.length).toBe(calls)

		content.dispose?.()
	})

	it('round-trips widget param writes into api.updateParameters (no-op guarded)', () => {
		const panel = createPanelApi()
		const props: Partial<DockviewWidgetProps<DemoParams, DemoContext>> = {
			context: reactive({}),
		}
		const scope = { api: { id: 'dockview-api' } }
		const content = dockviewInternals.contentRenderer(
			noop as DockviewWidget,
			props,
			vi.fn(),
			scope,
			(fn) => effect`dockview.spec.roundtrip`(fn)
		)
		document.body.appendChild(content.element)
		content.init({
			api: panel.api,
			params: { panelId: 'counter-1', nested: { x: 1 } },
			title: 'Counter 1',
			containerApi: scope.api as never,
		} satisfies GroupPanelPartInitParameters)

		const state = dockviewInternals.getState('panel-1')!
		const updateSpy = panel.spies.updateParameters

		// Widget-side mutation triggers the double-bind effect → api.updateParameters.
		state.params.panelId = 'counter-9'
		expect(updateSpy).toHaveBeenCalledTimes(1)
		expect(updateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ panelId: 'counter-9', nested: { x: 1 } })
		)

		// No-op writes must not re-emit (deepEqual + lastParams guard).
		state.params.panelId = 'counter-9'
		expect(updateSpy).toHaveBeenCalledTimes(1)

		content.dispose?.()
	})

	it('declares all 33 dockview event props (type-level parity with svelte)', () => {
		// Compile-time assertion: DockviewEventProps must accept every forwarded event.
		const events: DockviewEventProps = {
			onDidLayoutChange: () => {},
			onDidLayoutFromJSON: () => {},
			onDidAddPanel: (_panel) => {},
			onDidRemovePanel: (_panel) => {},
			onDidAddGroup: (_group) => {},
			onDidRemoveGroup: (_group) => {},
			onDidActivePanelChange: (_event) => {},
			onDidActiveGroupChange: (_group) => {},
			onDidMovePanel: (_event) => {},
			onWillDrop: (_event) => {},
			onDidDrop: (_event) => {},
			onWillDragPanel: (_event) => {},
			onWillDragGroup: (_event) => {},
			onWillMutateLayout: (_event) => {},
			onDidMutateLayout: (_event) => {},
			onWillShowOverlay: (_event) => {},
			onUnhandledDragOver: (_event) => {},
			onDidAddPopoutGroup: (_group) => {},
			onDidRemovePopoutGroup: (_group) => {},
			onDidPopoutGroupSizeChange: (_event) => {},
			onDidPopoutGroupPositionChange: (_event) => {},
			onDidOpenPopoutWindowFail: () => {},
			onDidCreateTabGroup: (_event) => {},
			onDidDestroyTabGroup: (_event) => {},
			onDidAddPanelToTabGroup: (_event) => {},
			onDidRemovePanelFromTabGroup: (_event) => {},
			onDidTabGroupChange: (_event) => {},
			onDidTabGroupCollapsedChange: (_event) => {},
			onDidPanelPinnedChange: (_event) => {},
			onDidMaximizedGroupChange: (_event) => {},
			onDidChangeHistory: (_event) => {},
			onDidSnapFloat: (_event) => {},
			onDidSnapTogether: (_event) => {},
		}
		expect(Object.keys(events)).toHaveLength(33)
	})

	it('infers per-widget params for openPanel (type-level ParamsOf)', () => {
		type CounterParams = { panelId: string; count: number }
		type NotesParams = { panelId: string; text: string }
		const Counter = (() => noop()) as unknown as DockviewWidget<CounterParams>
		const Notes = (() => noop()) as unknown as DockviewWidget<NotesParams>

		const widgets = {
			counter: { component: Counter, title: 'Counter' },
			notes: { component: Notes, title: 'Notes' },
		}
		type W = typeof widgets
		type H = DockviewHandle<W>

		// ParamsOf extracts the params generic from a widget component.
		type P1 = DockviewParamsOf<W['counter']['component']>
		type P2 = DockviewWidgetParams<W['counter']>
		// @ts-expect-error — CounterParams is not NotesParams
		const _bad: NotesParams = null as unknown as P1

		// openPanel narrows both the options.params and the returned handle.
		type OpenRet = ReturnType<H['openPanel']>
		type Opts = Parameters<H['openPanel']>[1]

		const p1: P1 = { panelId: 'a', count: 1 }
		const p2: P2 = { panelId: 'a', count: 2 }
		const panel: DockviewPanelHandle<CounterParams> = null as unknown as ReturnType<
			Extract<H['openPanel'], (k: 'counter') => unknown>
		>
		void p1
		void p2
		void panel
		void _bad
		void (null as unknown as Opts)
		void (null as unknown as OpenRet)
	})
})

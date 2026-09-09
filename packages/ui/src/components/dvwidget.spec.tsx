import { latch } from '@sursaut/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	DOCKVIEW_CONTEXT_KEY,
	type DvWidgetLayoutContext,
	type DvWidgetLayoutKind,
} from './dockview-utils'
import { DvWidget } from './dvwidget'

/** A fake parent-layout context that records registrations/unregistrations. */
function makeCtx(kind: DvWidgetLayoutKind = 'dockview') {
	const registrations: Array<[string, Record<string, unknown>]> = []
	const unregistrations: string[] = []
	const ctx: DvWidgetLayoutContext = {
		api: undefined,
		registerWidget: (key: string, def: Record<string, unknown>) => {
			registrations.push([key, def])
		},
		unregisterWidget: (key: string) => {
			unregistrations.push(key)
		},
		kind,
	}
	return { ctx, registrations, unregistrations }
}

function mountWidget(
	props: {
		name: string
		title?: string
		tab?: (state: never) => JSX.Element
		header?: (state: never) => JSX.Element
		body?: (state: never) => JSX.Element
	},
	fake: ReturnType<typeof makeCtx>
): () => void {
	const scope = { [DOCKVIEW_CONTEXT_KEY]: fake.ctx } as Record<string, any>
	const stop = latch(
		document.body,
		<DvWidget
			name={props.name}
			{...(props.title !== undefined ? { title: props.title } : {})}
			{...(props.tab ? { tab: props.tab } : {})}
			{...(props.header ? { header: props.header } : {})}
		>
			{props.body ?? (() => <div data-testid="dv-body" />)}
		</DvWidget>,
		scope
	)
	return stop
}

describe('DvWidget', () => {
	afterEach(() => {
		document.body.innerHTML = ''
	})

	it('throws outside a layout', () => {
		expect(() => latch(document.body, <DvWidget name="x">{() => <div />}</DvWidget>, {})).toThrow(
			'must be a child of Dockview/Splitview/Gridview/Paneview'
		)
	})

	it('registers the widget with a function component + title on mount', () => {
		const fake = makeCtx()
		const unmount = mountWidget({ name: 'chat', title: 'Chat' }, fake)

		expect(fake.registrations).toHaveLength(1)
		const [key, def] = fake.registrations[0]!
		expect(key).toBe('chat')
		expect(typeof def.component).toBe('function')
		expect(def.title).toBe('Chat')
		expect(def.tab).toBeUndefined()
		expect(def.header).toBeUndefined()

		unmount()
		expect(fake.unregistrations).toEqual(['chat'])
	})

	it('includes tab when provided (dockview)', () => {
		const fake = makeCtx('dockview')
		const unmount = mountWidget({ name: 'chat', tab: () => <div /> }, fake)

		const [, def] = fake.registrations[0]!
		expect(typeof def.tab).toBe('function')

		unmount()
	})

	it('drops tab/title that are inapplicable to the layout', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		try {
			const fake = makeCtx('splitview')
			const unmount = mountWidget({ name: 'a', title: 'X', tab: () => <div /> }, fake)

			// `tab` and `title` don't apply to Splitview, so they never reach the registry.
			expect(fake.registrations).toHaveLength(1)
			const [, def] = fake.registrations[0]!
			expect(typeof def.component).toBe('function')
			expect(def.tab).toBeUndefined()
			expect(def.title).toBeUndefined()
			expect(warn).toHaveBeenCalled()
			unmount()
		} finally {
			warn.mockRestore()
		}
	})

	it('keeps header only in a paneview layout', () => {
		const fake = makeCtx('paneview')
		const unmount = mountWidget({ name: 'a', header: () => <div /> }, fake)

		const [, def] = fake.registrations[0]!
		expect(typeof def.header).toBe('function')
		unmount()
	})

	it('keeps tab + title in a dockview layout', () => {
		const fake = makeCtx('dockview')
		const unmount = mountWidget({ name: 'a', title: 'A', tab: () => <div /> }, fake)

		const [, def] = fake.registrations[0]!
		expect(typeof def.tab).toBe('function')
		expect(def.title).toBe('A')
		unmount()
	})

	it('forwards the shared state to the body function', () => {
		const fake = makeCtx('splitview')
		const seen: unknown[] = []
		const scope = { [DOCKVIEW_CONTEXT_KEY]: fake.ctx } as Record<string, any>
		const stop = latch(
			document.body,
			<DvWidget name="a">
				{(state: unknown) => {
					seen.push(state)
					return <div />
				}}
			</DvWidget>,
			scope
		)
		const [, def] = fake.registrations[0]!
		const state = { params: { text: 'hi' } }
		;(def.component as (props: { state: unknown }) => unknown)({ state })
		expect(seen[0]).toBe(state)
		stop()
	})

	it('registers a fresh key after unmount + re-mount (static name, documented divergence)', () => {
		const fake = makeCtx('dockview')
		const scope = { [DOCKVIEW_CONTEXT_KEY]: fake.ctx } as Record<string, any>

		// Mount under "first".
		let stop = latch(document.body, <DvWidget name="first">{() => <div />}</DvWidget>, scope)
		expect(fake.registrations.map(([k]) => k)).toEqual(['first'])

		// Unmount unregisters the key.
		stop()
		expect(fake.unregistrations).toEqual(['first'])

		// Re-mount under "second" registers afresh (name is a static mount-time
		// prop; sursaut's rebuild fence forbids reactive re-registration in place).
		stop = latch(document.body, <DvWidget name="second">{() => <div />}</DvWidget>, scope)
		expect(fake.registrations.map(([k]) => k)).toEqual(['first', 'second'])
		stop()
	})
})

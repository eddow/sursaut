import { h } from '@sursaut/core'
import { effect } from 'mutts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	createPaneviewFactory,
	type PaneviewEventProps,
	type PaneviewWidget,
	paneviewInternals,
} from './paneview'
import { PaneviewWidgetRegistry } from './paneview-registry'

function noop() {
	return h('div', {})
}

const spawnInline = (fn: () => void) => effect`paneview.spec.spawn`(fn)

function fakeParams(id: string, params: Record<string, unknown> = {}, title = 'T') {
	// The real `PaneviewPanelApiImpl` is constructed by dockview's `PaneviewPanel`
	// base class; here we drive the factory through real parts created by
	// `createComponent`, whose `init` receives the api from dockview. For unit
	// tests we pass a minimal stub api — the factory only reads flags and
	// subscribes to events at init time.
	const listeners: Record<string, Array<(e: never) => void>> = {}
	const on = (key: string) => (cb: (e: never) => void) => {
		listeners[key] ??= []
		listeners[key].push(cb)
		return { dispose: vi.fn() }
	}
	const api = {
		id,
		isVisible: true,
		isActive: false,
		isFocused: false,
		isExpanded: true,
		setActive: vi.fn(),
		setVisible: vi.fn(),
		setExpanded: vi.fn(),
		updateParameters: vi.fn(),
		onDidActiveChange: on('active'),
		onDidFocusChange: on('focused'),
		onDidVisibilityChange: on('visible'),
		onDidDimensionsChange: on('dimensions'),
		onDidExpansionChange: on('expansion'),
		_fire(key: string, value: never) {
			listeners[key]?.forEach((cb) => cb(value))
		},
	}
	return { api, params, title, listeners }
}

describe('Paneview factory', () => {
	afterEach(() => {
		document.body.innerHTML = ''
		vi.unstubAllGlobals()
	})

	it('throws for unknown widgets at createComponent/createHeaderComponent time', () => {
		const factory = createPaneviewFactory(new PaneviewWidgetRegistry())
		expect(() => factory.createComponent({ id: 'p1', name: 'missing' })).toThrow(
			'unknown widget "missing"'
		)
		expect(() => factory.createHeaderComponent({ id: 'p1', name: 'missing' })).toThrow(
			'unknown widget "missing"'
		)
	})

	it('mounts body and header against one shared state', () => {
		const registry = new PaneviewWidgetRegistry()
		const seen: unknown[] = []
		const probe = ((_props: { state: unknown }) => {
			seen.push(_props.state)
			return noop()
		}) as unknown as PaneviewWidget
		registry.register('a', { component: probe, header: probe, title: 'Pane A' })

		const factory = createPaneviewFactory(registry, {})
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init(fakeParams('p1', { text: 'hi' }) as never)
		const headerPart = factory.createHeaderComponent({ id: 'p1', name: 'a' })!
		headerPart.init(fakeParams('p1', { text: 'hi' }) as never)

		const state = factory.getState('p1')
		expect(state).toBeDefined()
		expect(state!.params).toEqual({ text: 'hi' })
		expect(state!.title).toBe('T')
		// Both mounts receive the same state object by reference.
		expect(seen[0]).toBe(state)
		expect(seen[1]).toBe(state)
		expect(paneviewInternals.getState('p1')).toBe(state)

		body.dispose()
		// Body disposed but header still holds the entry.
		expect(factory.getState('p1')).toBeDefined()
		headerPart.dispose()
		expect(factory.getState('p1')).toBeUndefined()
	})

	it('returns undefined header when the widget defines none', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: (() => noop()) as unknown as PaneviewWidget })
		const factory = createPaneviewFactory(registry, {})
		expect(factory.createHeaderComponent({ id: 'p1', name: 'a' })).toBeUndefined()
	})

	it('mirrors active / focus / visible / expanded flags into state', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: (() => noop()) as unknown as PaneviewWidget })
		const factory = createPaneviewFactory(registry, {})
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		const fp = fakeParams('p1')
		body.init(fp as never)

		fp.api._fire('active', { isActive: true } as never)
		fp.api._fire('focused', { isFocused: true } as never)
		fp.api._fire('visible', { isVisible: false } as never)
		fp.api._fire('expansion', { isExpanded: false } as never)

		const state = factory.getState('p1')
		expect(state?.active).toBe(true)
		expect(state?.focused).toBe(true)
		expect(state?.visible).toBe(false)
		expect(state?.expanded).toBe(false)
		body.dispose()
	})

	it('releases a headerless pane on body dispose (no leak)', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: (() => noop()) as unknown as PaneviewWidget })
		const factory = createPaneviewFactory(registry, {})
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init(fakeParams('p1') as never)
		expect(factory.getState('p1')).toBeDefined()
		expect(factory.createHeaderComponent({ id: 'p1', name: 'a' })).toBeUndefined()

		body.dispose()
		expect(factory.getState('p1')).toBeUndefined()
	})

	it('round-trips widget param writes into api.updateParameters (no-op guarded)', () => {
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: (() => noop()) as unknown as PaneviewWidget })
		const factory = createPaneviewFactory(registry, {})
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		const fp = fakeParams('p1', { text: 'hi', nested: { x: 1 } })
		body.init(fp as never)

		const state = factory.getState('p1')!
		const updateSpy = fp.api.updateParameters

		// Widget-side mutation triggers the double-bind effect → api.updateParameters.
		state.params.text = 'changed'
		expect(updateSpy).toHaveBeenCalledTimes(1)
		expect(updateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ text: 'changed', nested: { x: 1 } })
		)

		// No-op writes must not re-emit (deepEqual + lastParams guard).
		state.params.text = 'changed'
		expect(updateSpy).toHaveBeenCalledTimes(1)

		body.dispose()
	})

	it('writes size from dimensions (rAF-throttled)', () => {
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			cb(0)
			return 1
		})
		vi.stubGlobal('cancelAnimationFrame', vi.fn())
		const registry = new PaneviewWidgetRegistry()
		registry.register('a', { component: (() => noop()) as unknown as PaneviewWidget })
		const factory = createPaneviewFactory(registry, {})
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		const fp = fakeParams('p1')
		body.init(fp as never)

		fp.api._fire('dimensions', { width: 100, height: 200 } as never)
		expect(factory.getState('p1')?.size).toEqual({ width: 100, height: 200 })
		body.dispose()
	})

	it('merges dockview params updates into state via update() (body only)', () => {
		const registry = new PaneviewWidgetRegistry()
		const probe = (() => noop()) as unknown as PaneviewWidget
		registry.register('a', { component: probe, header: probe })
		const factory = createPaneviewFactory(registry, {})
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const body = factory.createComponent({ id: 'p1', name: 'a' })
		body.init(fakeParams('p1', { a: 1, nested: { x: 1 } }) as never)
		body.update({ params: { nested: { y: 2 } } } as never)
		expect(factory.getState('p1')?.params).toEqual({ a: 1, nested: { x: 1, y: 2 } })

		const headerPart = factory.createHeaderComponent({ id: 'p1', name: 'a' })!
		headerPart.init(fakeParams('p1') as never)
		// Header updates are no-ops — the shared state is untouched.
		headerPart.update({ params: { z: 9 } } as never)
		expect(factory.getState('p1')?.params).toEqual({ a: 1, nested: { x: 1, y: 2 } })

		body.dispose()
		headerPart.dispose()
	})

	it('declares paneview event props (parity with svelte Paneview.svelte)', () => {
		const events: PaneviewEventProps = {
			onDidLayoutChange: () => {},
			onDidLayoutFromJSON: () => {},
			onDidAddView: (_panel) => {},
			onDidRemoveView: (_panel) => {},
			onDidDrop: (_event) => {},
			onUnhandledDragOver: (_event) => {},
		}
		expect(Object.keys(events)).toHaveLength(6)
	})
})

import { h } from '@sursaut/core'
import { effect } from 'mutts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	createSplitviewFactory,
	type SplitviewEventProps,
	type SplitviewWidget,
	splitviewInternals,
} from './splitview'
import { SplitviewWidgetRegistry } from './splitview-registry'

function noop() {
	return h('div', {})
}

const spawnInline = (fn: () => void) => effect`splitview.spec.spawn`(fn)

type TestPanel = ReturnType<ReturnType<typeof createSplitviewFactory>['createComponent']>

function fireActive(panel: TestPanel, isActive: boolean) {
	;(
		panel.api as unknown as { _onDidActiveChange: { fire(e: unknown): void } }
	)._onDidActiveChange.fire({ isActive })
}

function fireFocused(panel: TestPanel, isFocused: boolean) {
	;(
		panel.api as unknown as { _onDidChangeFocus: { fire(e: unknown): void } }
	)._onDidChangeFocus.fire({ isFocused })
}

function fireVisible(panel: TestPanel, isVisible: boolean) {
	;(
		panel.api as unknown as { _onDidVisibilityChange: { fire(e: unknown): void } }
	)._onDidVisibilityChange.fire({ isVisible })
}

function fireDimensions(panel: TestPanel, width: number, height: number) {
	;(
		panel.api as unknown as { _onDidDimensionChange: { fire(e: unknown): void } }
	)._onDidDimensionChange.fire({ width, height })
}

describe('Splitview factory', () => {
	afterEach(() => {
		document.body.innerHTML = ''
		vi.unstubAllGlobals()
	})

	it('throws for unknown widgets at createComponent time', () => {
		const factory = createSplitviewFactory(new SplitviewWidgetRegistry())
		expect(() => factory.createComponent({ id: 'p1', name: 'missing' })).toThrow(
			'unknown widget "missing"'
		)
	})

	it('mounts the widget and exposes its state via getState', () => {
		const registry = new SplitviewWidgetRegistry()
		const seen: unknown[] = []
		const probe = ((_props: { state: unknown }) => {
			seen.push(_props.state)
			return noop()
		}) as unknown as SplitviewWidget
		registry.register('probe', { component: probe })

		const factory = createSplitviewFactory(registry, {})
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const renderer = factory.createComponent({ id: 'p1', name: 'probe' })
		document.body.appendChild(renderer.element)
		renderer.init({ params: { text: 'hi' } } as never)

		const state = factory.getState('p1')
		expect(state).toBeDefined()
		expect(state!.params).toEqual({ text: 'hi' })
		expect(seen[0]).toBe(state)
		expect(splitviewInternals.getState('p1')).toBe(state)

		// `getComponent().dispose()` is the BasePanelView dispose path.
		renderer.getComponent().dispose()
		expect(factory.getState('p1')).toBeUndefined()
	})

	it('mirrors active / focus / visible flags into state', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', { component: (() => noop()) as unknown as SplitviewWidget })
		const factory = createSplitviewFactory(registry, {})
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const renderer = factory.createComponent({ id: 'p1', name: 'a' })
		document.body.appendChild(renderer.element)
		renderer.init({ params: {} } as never)

		fireActive(renderer, true)
		fireFocused(renderer, true)
		fireVisible(renderer, false)

		const state = factory.getState('p1')
		expect(state?.active).toBe(true)
		expect(state?.focused).toBe(true)
		expect(state?.visible).toBe(false)
		renderer.getComponent().dispose()
	})

	it('writes size from dimensions (rAF-throttled)', () => {
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			cb(0)
			return 1
		})
		vi.stubGlobal('cancelAnimationFrame', vi.fn())
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', { component: (() => noop()) as unknown as SplitviewWidget })
		const factory = createSplitviewFactory(registry, {})
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const renderer = factory.createComponent({ id: 'p1', name: 'a' })
		document.body.appendChild(renderer.element)
		renderer.init({ params: {} } as never)

		fireDimensions(renderer, 100, 200)
		expect(factory.getState('p1')?.size).toEqual({ width: 100, height: 200 })
		renderer.getComponent().dispose()
	})

	it('merges dockview params updates into state via update()', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', { component: (() => noop()) as unknown as SplitviewWidget })
		const factory = createSplitviewFactory(registry, {})
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const renderer = factory.createComponent({ id: 'p1', name: 'a' })
		document.body.appendChild(renderer.element)
		renderer.init({ params: { a: 1, nested: { x: 1 } } } as never)
		renderer.update({ params: { nested: { y: 2 } } } as never)

		expect(factory.getState('p1')?.params).toEqual({ a: 1, nested: { x: 1, y: 2 } })
		renderer.getComponent().dispose()
	})

	it('round-trips widget param writes into api.updateParameters (no-op guarded)', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', { component: (() => noop()) as unknown as SplitviewWidget })
		const factory = createSplitviewFactory(registry, {})
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const renderer = factory.createComponent({ id: 'p1', name: 'a' })
		document.body.appendChild(renderer.element)
		renderer.init({ params: { text: 'hi', nested: { x: 1 } } } as never)

		const state = factory.getState('p1')!
		const updateSpy = vi.spyOn(state.api, 'updateParameters')

		// Widget-side mutation triggers the double-bind effect → api.updateParameters.
		state.params.text = 'changed'
		expect(updateSpy).toHaveBeenCalledTimes(1)
		expect(updateSpy).toHaveBeenCalledWith(
			expect.objectContaining({ text: 'changed', nested: { x: 1 } })
		)

		// No-op writes must not re-emit (deepEqual + lastParams guard).
		state.params.text = 'changed'
		expect(updateSpy).toHaveBeenCalledTimes(1)

		renderer.getComponent().dispose()
	})

	it('notifies active view changes only on activation', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', { component: (() => noop()) as unknown as SplitviewWidget })
		const seen: unknown[] = []
		const factory = createSplitviewFactory(
			registry,
			{},
			{
				onDidActiveViewChange: (view) => seen.push(view),
			}
		)
		;(factory as unknown as { _setSpawn: (s: typeof spawnInline) => void })._setSpawn(spawnInline)
		const renderer = factory.createComponent({ id: 'p1', name: 'a' })
		document.body.appendChild(renderer.element)
		renderer.init({ params: {} } as never)
		fireActive(renderer, false)
		expect(seen).toEqual([])
		fireActive(renderer, true)
		expect(seen.length).toBe(1)
		renderer.getComponent().dispose()
	})

	it('declares splitview event props (parity with svelte Splitview.svelte)', () => {
		const events: SplitviewEventProps = {
			onDidLayoutChange: () => {},
			onDidLayoutFromJSON: () => {},
			onDidAddView: (_view) => {},
			onDidRemoveView: (_view) => {},
			onDidActiveViewChange: (_view) => {},
		}
		expect(Object.keys(events)).toHaveLength(5)
	})
})

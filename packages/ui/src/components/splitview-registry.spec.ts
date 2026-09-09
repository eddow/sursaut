import { describe, expect, it } from 'vitest'
import { defineSplitviewWidgets, SplitviewWidgetRegistry } from './splitview-registry'

const widgetA = { component: (() => {}) as never }
const widgetB = { component: (() => {}) as never }

describe('SplitviewWidgetRegistry', () => {
	it('registers and retrieves definitions', () => {
		const registry = new SplitviewWidgetRegistry()
		expect(registry.has('a')).toBe(false)
		registry.register('a', widgetA)
		expect(registry.has('a')).toBe(true)
		expect(registry.get('a')).toBe(widgetA)
	})

	it('replaces existing definitions', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', widgetA)
		registry.register('a', widgetB)
		expect(registry.get('a')).toBe(widgetB)
	})

	it('unregisters definitions', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.register('a', widgetA)
		registry.unregister('a')
		expect(registry.has('a')).toBe(false)
		expect(registry.get('a')).toBeUndefined()
	})

	it('seeds from a widgets object', () => {
		const registry = new SplitviewWidgetRegistry()
		registry.seed({ a: widgetA, b: widgetB })
		expect(registry.get('a')).toBe(widgetA)
		expect(registry.get('b')).toBe(widgetB)
	})

	it('returns undefined for unknown keys', () => {
		const registry = new SplitviewWidgetRegistry()
		expect(registry.get('missing')).toBeUndefined()
	})
})

describe('defineSplitviewWidgets (deprecated alias)', () => {
	it('returns the same object preserving keys', () => {
		const widgets = defineSplitviewWidgets({ a: widgetA, b: widgetB })
		expect(widgets.a).toBe(widgetA)
		expect(widgets.b).toBe(widgetB)
	})
})

import { reactive } from 'mutts'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { ReactiveProp, c, h, sursautOptions, r } from '@sursaut/core'
import type { PropInteraction } from '@sursaut/core'

describe('PropInteraction tracking', () => {
	let warnSpy: ReturnType<typeof vi.spyOn>
	let prevCheck: false | 'warn' | 'error'

	beforeEach(() => {
		prevCheck = sursautOptions.checkReactivity
		sursautOptions.checkReactivity = 'warn'
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
	})

	afterEach(() => {
		sursautOptions.checkReactivity = prevCheck
		warnSpy.mockRestore()
	})

	it('starts at none', () => {
		const rp = new ReactiveProp(() => 42)
		expect(rp.interaction).toBe<PropInteraction>('none')
	})

	it('get: none → read', () => {
		const rp = new ReactiveProp(() => 42)
		const proxy = c({ x: rp }).asProps()
		void proxy.x
		expect(rp.interaction).toBe<PropInteraction>('read')
		expect(warnSpy).not.toHaveBeenCalled()
	})

	it('get: read → read (idempotent)', () => {
		const rp = new ReactiveProp(() => 1)
		const proxy = c({ x: rp }).asProps()
		void proxy.x
		void proxy.x
		expect(rp.interaction).toBe<PropInteraction>('read')
	})

	it('set with reactive setter: none → bidi when touched called', () => {
		const state = reactive({ v: 0 })
		const rp = new ReactiveProp(
			() => state.v,
			(v) => { state.v = v }
		)
		const proxy = c({ x: rp }).asProps()
		proxy.x = 99
		expect(rp.interaction).toBe<PropInteraction>('bidi')
		expect(warnSpy).not.toHaveBeenCalled()
	})

	it('set with non-reactive setter: none → write', () => {
		let local = 0
		const rp = new ReactiveProp(
			() => local,
			(v) => { local = v }
		)
		const proxy = c({ x: rp }).asProps()
		proxy.x = 5
		expect(rp.interaction).toBe<PropInteraction>('write')
		expect(warnSpy).not.toHaveBeenCalled()
	})

	it('get after write-only: warns and upgrades to bidi', () => {
		let local = 0
		const rp = new ReactiveProp(
			() => local,
			(v) => { local = v }
		)
		const proxy = c({ x: rp }).asProps()
		proxy.x = 5
		expect(rp.interaction).toBe<PropInteraction>('write')
		void proxy.x
		expect(rp.interaction).toBe<PropInteraction>('bidi')
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('write-only'))
	})

	it('set after read-only: warns', () => {
		let local = 0
		const rp = new ReactiveProp(
			() => local,
			(v) => { local = v }
		)
		const proxy = c({ x: rp }).asProps()
		void proxy.x
		expect(rp.interaction).toBe<PropInteraction>('read')
		proxy.x = 7
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('read-only'))
	})

	it('error mode: get after write-only throws', () => {
		sursautOptions.checkReactivity = 'error'
		let local = 0
		const rp = new ReactiveProp(
			() => local,
			(v) => { local = v }
		)
		const proxy = c({ x: rp }).asProps()
		proxy.x = 5
		expect(() => { void proxy.x }).toThrow('[sursaut]')
	})

	it('no tracking when checkReactivity is false', () => {
		sursautOptions.checkReactivity = false
		const state = reactive({ v: 0 })
		const rp = new ReactiveProp(
			() => state.v,
			(v) => { state.v = v }
		)
		const proxy = c({ x: rp }).asProps()
		void proxy.x
		proxy.x = 1
		expect(rp.interaction).toBe<PropInteraction>('none')
		expect(warnSpy).not.toHaveBeenCalled()
	})
})

describe('propsProxy write guard', () => {
	test('assigning a one-way binding in strict mode throws TypeError', () => {
		const comp = (props: { value: string }) => {
			'use strict'
			props.value = 'test'
			return []
		}
		expect(() => {
			h(comp, { value: r(() => 'initial') }).render({})
		}).toThrow(TypeError)
	})
})

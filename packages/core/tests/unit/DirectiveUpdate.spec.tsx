/**
 * Test directive re-rendering behavior
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { reactive, reactiveOptions, unreactive } from 'mutts'
import { c, h, latch, document, sursautOptions } from '@sursaut/core'

describe('Directive Re-rendering', () => {
	let container: HTMLElement

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>'
		container = document.getElementById('app') as HTMLElement
	})

	it('should re-call directive when its argument changes', () => {
		let callCount = 0
		const state = reactive({ arg: 1 })

		const myDir = (el: HTMLElement, arg: number) => {
			callCount++
			el.setAttribute('data-arg', String(arg))
		}

		const env = unreactive({ myDir })

		const App = () => (
			<div use:myDir={state.arg} />
		)

		latch(container, <App />, env)
		expect(callCount).toBe(1)
		expect(container.querySelector('div')?.getAttribute('data-arg')).toBe('1')

		state.arg = 2
		expect(callCount).toBe(2)
		expect(container.querySelector('div')?.getAttribute('data-arg')).toBe('2')
	})

	it('should NOT re-call directive when parent re-renders if JSX is the same (cache hit)', () => {
		let callCount = 0
		const state = reactive({ parentTrigger: 0 })

		const myDir = (el: HTMLElement) => {
			callCount++
			el.setAttribute('data-calls', String(callCount))
		}

		const env = unreactive({ myDir })

		const staticChild = <div id="child" use:myDir />

		const App = () => {
			state.parentTrigger // track
			return <div id="parent">{staticChild}</div>
		}

		latch(container, <App />, env)
		expect(callCount).toBe(1)
		const child = document.getElementById('child')
		expect(child?.getAttribute('data-calls')).toBe('1')

		const original = sursautOptions.checkRebuild
		sursautOptions.checkRebuild = 'warn'
		try {
			state.parentTrigger++
			expect(callCount).toBe(1)
		} finally {
			sursautOptions.checkRebuild = original
		}
		expect(document.getElementById('child')?.getAttribute('data-calls')).toBe('1')
	})

	it('bare reactive read in body does NOT re-render (untracked body)', () => {
		let callCount = 0
		const state = reactive({ trigger: 0 })

		const myDir = (el: HTMLElement) => {
			callCount++
			el.setAttribute('data-calls', String(callCount))
		}

		const env = unreactive({ myDir })

		const Child = () => {
			state.trigger // body runs untracked — NOT a dependency
			return <div use:myDir />
		}

		const App = () => <Child />

		latch(container, <App />, env)
		expect(callCount).toBe(1)

		state.trigger++
		// Component body runs untracked — the bare read of state.trigger
		// was never tracked by the render effect.  No rebuild fence fires,
		// the directive is not re-called.
		expect(callCount).toBe(1)
	})

	it('isolates reactive directive extraction from render effect dependencies', () => {
		let renderCount = 0
		let callCount = 0
		const state = reactive({ arg: 1 })

		const myDir = (el: HTMLElement, arg: number) => {
			callCount++
			el.setAttribute('data-arg', String(arg))
		}

		const env = unreactive({ myDir })
		const attrs = c(() => ({ 'use:myDir': state.arg }))

		const App = () => {
			renderCount++
			return h('div', attrs)
		}

		const originalReactivity = sursautOptions.checkReactivity
		const originalRebuild = sursautOptions.checkRebuild
		sursautOptions.checkReactivity = 'error'
		sursautOptions.checkRebuild = 'error'
		try {
			latch(container, <App />, env)
			expect(renderCount).toBe(1)
			expect(callCount).toBe(1)
			expect(container.querySelector('div')?.getAttribute('data-arg')).toBe('1')

			expect(() => {
				state.arg = 2
			}).not.toThrow()

			expect(renderCount).toBe(1)
			expect(callCount).toBe(2)
			expect(container.querySelector('div')?.getAttribute('data-arg')).toBe('2')
		} finally {
			sursautOptions.checkReactivity = originalReactivity
			sursautOptions.checkRebuild = originalRebuild
		}
	})
})

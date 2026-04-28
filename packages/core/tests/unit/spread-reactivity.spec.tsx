// cache bust: 1771960600003
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { latch, document, collapse, c } from '../../src'
import { reactive, reactiveOptions } from 'mutts'

describe('Spread Reactivity', () => {
	let container: HTMLElement
	let unmount: (() => void) | undefined

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
	})

	afterEach(() => {
		unmount?.()
		container.remove()
	})

	it('deferred evaluation of spreads via arrow functions', async () => {
		const lLogs: unknown[] = []
		reactiveOptions.garbageCollected = (fn)=> lLogs.push(fn)
		reactiveOptions.beginChain = (targets) => {lLogs.push(`begin${targets.length}`)}
		reactiveOptions.endChain = () => {lLogs.push('end')}
		const state = reactive({
			attrs: { id: 'initial', class: 'foo' }
		})
		const Comp = (props: any) => {
			return <div id={props.id} class={props.class}>Child</div>
		}
		// Initial render
		unmount = latch(container, <Comp {...state.attrs} />)

		const div = container.querySelector('div > div')
		
		expect(div?.id).toBe('initial')
		expect(div?.className).toBe('foo')
		await Promise.resolve();
		await new Promise(r => setTimeout(r, 0));
		lLogs.length = 0

		state.attrs = { id: 'updated', class: 'bar' }

		expect(lLogs).toHaveLength(2)
		expect(div?.className).toBe('bar')
		expect(div?.getAttribute('id')).toBe('updated')
	})

	it('avoids render effect dependency warning on load for spreads', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
		const state = reactive({ a: 1, b: 2 })

		const App = () => {
			return <div {...state} />
		}

		unmount = latch(container, <App />)

		// Check if "render effect dependency" was logged for 'a' or 'b'
		const warnings = warnSpy.mock.calls.map(call => call[0])
		const hasSpreadWarnings = warnings.some(w =>
			typeof w === 'string' && w.includes('render effect dependency:') && (w.includes('a') || w.includes('b'))
		)

		expect(hasSpreadWarnings).toBe(false)
		warnSpy.mockRestore()
	})

	it('spread with nested getters updates when source changes', async () => {
		const state = reactive({ disabled: false })

		const model = {
			get button(): Record<string, unknown> {
				return {
					get disabled() {
						return state.disabled || undefined
					},
					get onClick() {
						return state.disabled ? undefined : () => {}
					},
				}
			},
		}

		unmount = latch(container, <button {...model.button}>Click</button>)

		const btn = container.querySelector('button')!
		expect(btn.disabled).toBe(false)

		state.disabled = true
		await new Promise((r) => setTimeout(r, 0))
		expect(btn.disabled).toBe(true)

		state.disabled = false
		await new Promise((r) => setTimeout(r, 0))
		expect(btn.disabled).toBe(false)
	})

	it('manual simulation of c(() => obj)', async () => {
		const state = reactive({
			attrs: { id: 'manual' }
		})

		const inAttrs = c(() => state.attrs)
		// Should resolve 'id' via the functional layer
		// We use collapse() because .get() returns a ReactiveProp for reactive layers
		expect(collapse(inAttrs.get('id'))).toBe('manual')

		state.attrs.id = 'updated'
		expect(collapse(inAttrs.get('id'))).toBe('updated')
	})

	it('stops reactive spread key discovery after unmount', async () => {
		const state = reactive<{ attrs: Record<string, string> }>({
			attrs: {},
		})

		unmount = latch(container, <button {...state.attrs}>Click</button>)
		const button = container.querySelector('button')!

		unmount()
		unmount = undefined

		state.attrs = { title: 'late' }
		await new Promise((r) => setTimeout(r, 0))

		expect(button.hasAttribute('title')).toBe(false)
	})
})

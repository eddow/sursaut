/**
 * Reactive prop updates propagate through JSX `r()` closures via the
 * `ReactiveProp` proxy returned by the props proxy.
 *
 * The props proxy returns `ReactiveProp` wrappers, not raw values.
 * When `props.variant` is used in JSX, babel wraps it in `r()` which
 * creates another `ReactiveProp` whose `.get()` fires in the attribute/
 * text effect — establishing tracking there, not in the render effect.
 *
 * `ReactiveProp` has `toString()` / `valueOf()` for transparent coercion
 * in string/number contexts, and `collapse()` recursively unwraps layers.
 */
import { document, latch } from '@sursaut/core'
import { reactive } from 'mutts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('reactive prop updates survive rebuild fence', () => {
	let container: HTMLElement
	let stop: (() => void) | undefined

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
	})

	afterEach(() => {
		stop?.()
		container.remove()
	})

	it('attr updates when prop is referenced directly in JSX', async () => {
		const state = reactive({ variant: 'primary' })

		function Child(props: { variant: string }) {
			return (
				<span data-variant={props.variant}>
					{props.variant}
				</span>
			)
		}

		function Parent() {
			return <div class="parent"><Child variant={state.variant} /></div>
		}

		stop = latch(container, <Parent />)

		await new Promise((r) => setTimeout(r, 0))
		const span = container.querySelector('span')!
		expect(span.getAttribute('data-variant')).toBe('primary')
		expect(span.textContent).toBe('primary')

		state.variant = 'danger'

		await new Promise((r) => setTimeout(r, 0))
		// With dependencyHook, the diagnostic fires but the attribute
		// setter effect still tracks state.variant correctly.
		expect(span.getAttribute('data-variant')).toBe('danger')
		expect(span.textContent).toBe('danger')
	})

	it('const-dereferenced primitive props do NOT update (design limitation)', async () => {
		const state = reactive({ label: 'Hello' })

		// const text = props.label captures a ReactiveProp. The extra
		// layer of r(() => text) indirection means the setter effect tracks
		// `text` (a stable reference) rather than `state.label`.
		// Primitive props should be used directly in JSX; const capture
		// is for object props that are accessed deeply.
		function Child(props: { label: string }) {
			const text = props.label
			return <span data-label={text}>{text}</span>
		}

		function Parent() {
			return <div class="parent"><Child label={state.label} /></div>
		}

		stop = latch(container, <Parent />)

		await new Promise((r) => setTimeout(r, 0))
		const span = container.querySelector('span')!
		expect(span.getAttribute('data-label')).toBe('Hello')

		state.label = 'World'
		await new Promise((r) => setTimeout(r, 0))
		expect(span.getAttribute('data-label')).toBe('Hello')
		expect(span.textContent).toBe('Hello')
	})
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	bindDialog,
	bindDrawer,
	bindToast,
	createOverlayStack,
	dialogSpec,
	drawerSpec,
	toastSpec,
} from './overlays'

afterEach(() => {
	if (vi.isFakeTimers()) {
		vi.runOnlyPendingTimers()
	}
	vi.useRealTimers()
	vi.clearAllTimers()
})

describe('Overlays', () => {
	describe('createOverlayStack', () => {
		it('should push and pop overlays', async () => {
			vi.useFakeTimers()
			const state = createOverlayStack()
			expect(state.stack.length).toBe(0)

			const promise = state.push({
				mode: 'modal',
				render: (close) => {
					return <button onClick={() => close('ok')}>Confirm</button>
				},
			})

			expect(state.stack.length).toBe(1)
			expect(state.stack[0].mode).toBe('modal')

			state.stack[0].resolve('ok')
			const result = await promise
			expect(result).toBe('ok')

			vi.advanceTimersByTime(400)
			expect(state.stack.length).toBe(0)
			vi.useRealTimers()
		})

		it('should handle backdrop logic', () => {
			const state = createOverlayStack({ backdropModes: ['modal'] })
			expect(state.hasBackdrop).toBe(false)

			state.push({ mode: 'modal', render: () => null })
			expect(state.hasBackdrop).toBe(true)

			state.push({ mode: 'toast', render: () => null })
			expect(state.hasBackdrop).toBe(true)
		})

		it('should dismiss on Escape', async () => {
			const state = createOverlayStack()
			const promise = state.push({
				mode: 'modal',
				dismissible: true,
				render: () => null,
			})

			const event = new KeyboardEvent('keydown', { key: 'Escape' })
			state.onKeydown(event)

			expect(await promise).toBe(null)
		})

		it('should NOT dismiss on Escape if dismissible is false', async () => {
			vi.useFakeTimers()
			const state = createOverlayStack()
			let resolved = false
			state
				.push({
					mode: 'modal',
					dismissible: false,
					render: () => null,
				})
				.then(() => (resolved = true))

			const event = new KeyboardEvent('keydown', { key: 'Escape' })
			state.onKeydown(event)

			vi.advanceTimersByTime(10)
			expect(resolved).toBe(false)
			vi.useRealTimers()
		})

		it('registerElement enables exit transition path (deferred removal)', async () => {
			vi.useFakeTimers()
			// exitClass causes applyTransition to defer removal until animationend/timeout
			const state = createOverlayStack({
				transitions: { modal: { duration: 200, exitClass: 'modal-out' } },
			})
			const promise = state.push({ mode: 'modal', render: () => null })
			const entry = state.stack[0]

			const el = document.createElement('div')
			document.body.appendChild(el)
			state.registerElement(entry.id, el)

			entry.resolve('done')
			// closing is set synchronously
			expect(entry.closing).toBe(true)
			// stack still has the entry while CSS transition runs
			expect(state.stack.length).toBe(1)

			expect(await promise).toBe('done')

			// advance past duration * 1.5 fallback timeout (200 * 1.5 = 300ms)
			vi.advanceTimersByTime(350)
			expect(state.stack.length).toBe(0)
			el.remove()
			vi.useRealTimers()
		})

		it('isClosing tracks closing state reactively', async () => {
			vi.useFakeTimers()
			const state = createOverlayStack()
			const promise = state.push({ mode: 'modal', render: () => null })
			const entry = state.stack[0]

			expect(state.isClosing(entry.id)).toBe(false)
			entry.resolve(null)
			expect(state.isClosing(entry.id)).toBe(true)

			await promise
			vi.advanceTimersByTime(400)
			expect(state.isClosing(entry.id)).toBe(false)
			vi.useRealTimers()
		})
	})

	describe('helpers', () => {
		it('bindDialog should push a modal', () => {
			const push = vi.fn().mockReturnValue(Promise.resolve('ok'))
			const dialog = bindDialog(push as any)

			dialog({ title: 'Test' })
			expect(push).toHaveBeenCalledWith(
				expect.objectContaining({
					mode: 'modal',
					props: expect.objectContaining({ title: 'Test' }),
				})
			)
		})

		it('bindToast should push a toast', () => {
			const push = vi.fn()
			const toast = bindToast(push as any)

			toast.success('Done')
			expect(push).toHaveBeenCalledWith(expect.objectContaining({ mode: 'toast' }))
		})
	})

	describe('spec builders', () => {
		it('dialogSpec passes titleId/descId in props', () => {
			const spec = dialogSpec({ title: 'Hi', message: 'Body' })
			expect(spec.props.titleId).toBeDefined()
			expect(spec.props.descId).toBeDefined()
			expect(spec.aria?.labelledby).toBe(spec.props.titleId)
			expect(spec.aria?.describedby).toBe(spec.props.descId)
		})

		it('dialogSpec omits titleId/descId when title/message absent', () => {
			const spec = dialogSpec({})
			expect(spec.props.titleId).toBeUndefined()
			expect(spec.props.descId).toBeUndefined()
			expect(spec.aria?.labelledby).toBeUndefined()
			expect(spec.aria?.describedby).toBeUndefined()
		})

		it('drawerSpec passes render through', () => {
			const render = vi.fn()
			const spec = drawerSpec({ children: null, render })
			expect(spec.render).toBe(render)
		})

		it('drawerSpec render is undefined when not provided', () => {
			const spec = drawerSpec({ children: null })
			expect(spec.render).toBeUndefined()
		})
	})
})

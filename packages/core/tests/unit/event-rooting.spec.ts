import { beforeEach, describe, expect, it } from 'vitest'
import { document, listen } from '../../src'

describe('event listener rooting', () => {
	let button: HTMLButtonElement

	beforeEach(() => {
		button = document.createElement('button')
	})

	it('removes direct addEventListener callbacks using the original listener reference', () => {
		let clicks = 0
		function onClick(this: EventTarget | null, evt: Event) {
			clicks++
			expect(this).toBe(button)
			expect(evt.currentTarget).toBe(button)
		}

		button.addEventListener('click', onClick)
		button.click()
		expect(clicks).toBe(1)

		button.removeEventListener('click', onClick)
		button.click()
		expect(clicks).toBe(1)
	})

	it('listen cleanup removes the rooted listener once', () => {
		let clicks = 0
		const cleanup = listen(button, 'click', () => {
			clicks++
		})

		button.click()
		expect(clicks).toBe(1)

		cleanup()
		button.click()
		expect(clicks).toBe(1)
	})
})

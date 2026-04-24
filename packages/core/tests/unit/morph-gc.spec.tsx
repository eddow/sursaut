/**
 * Test that project() effects are not prematurely garbage-collected.
 * project() uses ascend() to create nested root effects. These must be anchored
 * or they will be collected by GC, breaking reactivity for list items.
 *
 * Requires --expose-gc (NODE_OPTIONS='--expose-gc' in package.json test:unit).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { reactive, morph } from 'mutts'
import { latch, document } from '@sursaut/core'

const gc = typeof globalThis.gc === 'function' ? globalThis.gc : undefined
const itGC = gc ? it : it.skip

function tick(ms = 100) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

async function collectGarbages() {
	await tick()
	gc?.()
	await tick()
}

describe('Morph effect GC safety', () => {
	let container: HTMLElement

	beforeEach(() => {
		document.body.innerHTML = '<div id="app"></div>'
		container = document.getElementById('app') as HTMLElement
	})

	itGC('morph() list items survive garbage collection', async () => {
		const state = reactive({ list: ['A', 'B'] })
		const clicked = reactive({ item: '' })

		const App = () => (
			<div>
				{morph`gc-list`(state.list, (item) => (
					<button onClick={() => { clicked.item = item as string }}>
						{item as string}
					</button>
				))}
			</div>
		)

		latch(container, <App />)

		const buttons = container.querySelectorAll('button')
		expect(buttons.length).toBe(2)

		// Events work before GC
		buttons[0].click()
		expect(clicked.item).toBe('A')

		// Force GC
		await collectGarbages()

		// Events must still work after GC
		buttons[1].click()
		expect(clicked.item).toBe('B')

		// Reactivity must still work
		state.list.push('C')
		await tick()
		const newButtons = container.querySelectorAll('button')
		expect(newButtons.length).toBe(3)
		newButtons[2].click()
		expect(clicked.item).toBe('C')
	})
})

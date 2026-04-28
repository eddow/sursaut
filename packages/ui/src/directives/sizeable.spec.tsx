import { ReactiveProp } from '@sursaut/core'
import { markMounted, markUnmounted } from '@sursaut/core/testing'
import type { EffectAccess } from 'mutts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sizeable } from './sizeable'

const noopAccess = {} as EffectAccess

function rp(initial: number) {
	let v = initial
	return new ReactiveProp(
		() => v,
		(n) => {
			v = n
		}
	)
}

describe('sizeable directive', () => {
	let container: HTMLElement
	let parent: HTMLElement
	let element: HTMLElement
	let flexSibling: HTMLElement

	beforeEach(() => {
		container = document.createElement('div')
		parent = document.createElement('div')
		element = document.createElement('div')
		flexSibling = document.createElement('div')

		parent.style.display = 'flex'
		parent.appendChild(element)
		parent.appendChild(flexSibling)
		container.appendChild(parent)
		document.body.appendChild(container)

		markMounted(container)

		flexSibling.style.flex = '1'
	})

	afterEach(() => {
		markUnmounted(container)
		document.body.removeChild(container)
	})

	it('detects horizontal direction for flex row', () => {
		const cleanup = sizeable(300)(element, noopAccess)
		expect(element.classList.contains('sizeable')).toBe(true)
		expect(element.classList.contains('sizeable-right')).toBe(true)
		cleanup?.()
	})

	it('detects edge based on element position', () => {
		parent.appendChild(element) // Move to end — now after flex sibling
		const cleanup = sizeable(300)(element, noopAccess)
		expect(element.classList.contains('sizeable-left')).toBe(true)
		cleanup?.()
	})

	it('creates resize handle with correct cursor', () => {
		const cleanup = sizeable(300)(element, noopAccess)
		const handle = parent.querySelector('.sizeable-handle')
		expect(handle).toBeTruthy()
		expect(handle?.classList.contains('sizeable-handle-right')).toBe(true)
		expect((handle as HTMLElement).style.cursor).toBe('col-resize')
		cleanup?.()
	})

	it('initializes CSS variable from value', () => {
		const cleanup = sizeable(250)(element, noopAccess)
		expect(parent.style.getPropertyValue('--sizeable-width')).toBe('250px')
		cleanup?.()
	})

	it('updates CSS variable and writes back via ReactiveProp on drag', () => {
		const prop = rp(300)
		const cleanup = sizeable(prop)(element, noopAccess)
		const handle = parent.querySelector('.sizeable-handle') as HTMLElement

		handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 100 }))
		document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }))
		document.dispatchEvent(new MouseEvent('mouseup'))

		expect(parent.style.getPropertyValue('--sizeable-width')).toBe('50px')
		expect(prop.get()).toBe(50)
		cleanup?.()
	})

	it('warns when no flex:1 sibling found', () => {
		flexSibling.style.flex = '0'
		const consoleSpy = vi.spyOn(console, 'warn')
		const cleanup = sizeable(300)(element, noopAccess)
		expect(consoleSpy).toHaveBeenCalledWith('use:sizeable requires exactly one flex:1 sibling')
		cleanup?.()
		consoleSpy.mockRestore()
	})

	it('initializes CSS variable for vertical direction', () => {
		parent.style.flexDirection = 'column'
		const cleanup = sizeable(200)(element, noopAccess)
		expect(parent.style.getPropertyValue('--sizeable-height')).toBe('200px')
		cleanup?.()
	})

	it('supports vertical direction', () => {
		parent.style.flexDirection = 'column'
		const cleanup = sizeable(300)(element, noopAccess)
		expect(element.classList.contains('sizeable-bottom')).toBe(true)

		const handle = parent.querySelector('.sizeable-handle') as HTMLElement
		expect(handle?.classList.contains('sizeable-handle-bottom')).toBe(true)
		expect(handle?.style.cursor).toBe('row-resize')

		cleanup?.()
	})

	it('cleans up handle and classes on unmount', () => {
		const cleanup = sizeable(300)(element, noopAccess)
		expect(parent.querySelector('.sizeable-handle')).toBeTruthy()
		cleanup?.()
		expect(parent.querySelector('.sizeable-handle')).toBeNull()
		expect(element.classList.contains('sizeable')).toBe(false)
	})

	it('waits for parent insertion before setup', async () => {
		const unmounted = document.createElement('div')
		const flex = document.createElement('div')
		flex.style.flex = '1'

		parent.innerHTML = ''

		const cleanup = sizeable(300)(unmounted, noopAccess)
		expect(parent.querySelector('.sizeable-handle')).toBeNull()

		parent.appendChild(unmounted)
		parent.appendChild(flex)
		await Promise.resolve()

		expect(unmounted.classList.contains('sizeable')).toBe(true)
		expect(parent.querySelector('.sizeable-handle')).toBeTruthy()

		cleanup?.()
	})
})

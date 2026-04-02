import { document } from '@sursaut/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type LocalDragStopReason, startLocalDragSession } from './local-drag'
import {
	localDragAxisEnd,
	localDragAxisSize,
	localDragAxisStart,
	localDragDistanceToRect,
	localDragPointOnAxis,
	localDragRectContainsPoint,
	measureLocalDragTarget,
	resolveLocalDragCandidate,
	resolveLocalDragInsertion,
	resolveLocalDragSplit,
	resolveLocalDragTarget,
} from './local-drag-geometry'

describe('local drag', () => {
	afterEach(() => {
		document.body.innerHTML = ''
		document.body.style.userSelect = ''
		document.body.style.removeProperty('-webkit-user-select')
	})

	it('tracks mouse movement and stops on mouseup', () => {
		const element = document.createElement('div')
		document.body.appendChild(element)
		const moves: Array<{ x: number; y: number; dx: number; dy: number }> = []
		const stops: LocalDragStopReason[] = []
		element.addEventListener('mousedown', (event) => {
			startLocalDragSession({
				event,
				axis: 'horizontal',
				grabOffset: 12,
				onMove(snapshot) {
					moves.push({
						x: snapshot.current.x,
						y: snapshot.current.y,
						dx: snapshot.delta.x,
						dy: snapshot.delta.y,
					})
				},
				onStop(snapshot) {
					stops.push(snapshot.reason)
				},
			})
		})
		element.dispatchEvent(
			new MouseEvent('mousedown', {
				bubbles: true,
				clientX: 10,
				clientY: 20,
				buttons: 1,
			})
		)
		window.dispatchEvent(
			new MouseEvent('mousemove', {
				clientX: 40,
				clientY: 50,
				buttons: 1,
			})
		)
		window.dispatchEvent(
			new MouseEvent('mouseup', {
				clientX: 45,
				clientY: 60,
				buttons: 0,
			})
		)
		expect(moves).toEqual([{ x: 40, y: 50, dx: 30, dy: 30 }])
		expect(stops).toEqual(['up'])
	})

	it('stops when mouse buttons are lost during move', () => {
		const element = document.createElement('div')
		document.body.appendChild(element)
		const stops: LocalDragStopReason[] = []
		element.addEventListener('mousedown', (event) => {
			startLocalDragSession({
				event,
				onStop(snapshot) {
					stops.push(snapshot.reason)
				},
			})
		})
		element.dispatchEvent(
			new MouseEvent('mousedown', {
				bubbles: true,
				clientX: 0,
				clientY: 0,
				buttons: 1,
			})
		)
		window.dispatchEvent(
			new MouseEvent('mousemove', {
				clientX: 5,
				clientY: 5,
				buttons: 0,
			})
		)
		expect(stops).toEqual(['buttons'])
	})

	it('stops on window blur', () => {
		const element = document.createElement('div')
		document.body.appendChild(element)
		const stops: LocalDragStopReason[] = []
		element.addEventListener('mousedown', (event) => {
			startLocalDragSession({
				event,
				onStop(snapshot) {
					stops.push(snapshot.reason)
				},
			})
		})
		element.dispatchEvent(
			new MouseEvent('mousedown', {
				bubbles: true,
				clientX: 0,
				clientY: 0,
				buttons: 1,
			})
		)
		window.dispatchEvent(new Event('blur'))
		expect(stops).toEqual(['blur'])
	})

	it('stops on document hidden', () => {
		const element = document.createElement('div')
		document.body.appendChild(element)
		const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')
		const stops: LocalDragStopReason[] = []
		element.addEventListener('mousedown', (event) => {
			startLocalDragSession({
				event,
				onStop(snapshot) {
					stops.push(snapshot.reason)
				},
			})
		})
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'hidden',
		})
		element.dispatchEvent(
			new MouseEvent('mousedown', {
				bubbles: true,
				clientX: 0,
				clientY: 0,
				buttons: 1,
			})
		)
		document.dispatchEvent(new Event('visibilitychange'))
		if (visibility) {
			Object.defineProperty(document, 'visibilityState', visibility)
		} else {
			Object.defineProperty(document, 'visibilityState', {
				configurable: true,
				value: 'visible',
			})
		}
		expect(stops).toEqual(['hidden'])
	})

	it('can use pointer capture policy when started from pointer events', () => {
		const element = document.createElement('div')
		document.body.appendChild(element)
		const setCapture = vi.fn()
		const releaseCapture = vi.fn()
		const hasCapture = vi.fn(() => true)
		Object.defineProperties(element, {
			setPointerCapture: { configurable: true, value: setCapture },
			releasePointerCapture: { configurable: true, value: releaseCapture },
			hasPointerCapture: { configurable: true, value: hasCapture },
		})
		element.addEventListener('pointerdown', (event) => {
			startLocalDragSession({
				event,
				capture: 'pointer',
			})
		})
		element.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				clientX: 10,
				clientY: 10,
				buttons: 1,
				pointerId: 7,
			})
		)
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				clientX: 10,
				clientY: 10,
				buttons: 0,
				pointerId: 7,
			})
		)
		expect(setCapture).toHaveBeenCalledWith(7)
		expect(hasCapture).toHaveBeenCalledWith(7)
		expect(releaseCapture).toHaveBeenCalledWith(7)
	})

	it('shows a managed default preview and suppresses native feedback by default', () => {
		const element = document.createElement('div')
		document.body.appendChild(element)
		element.addEventListener('mousedown', (event) => {
			startLocalDragSession({ event })
		})
		const event = new MouseEvent('mousedown', {
			bubbles: true,
			cancelable: true,
			clientX: 12,
			clientY: 18,
			buttons: 1,
		})
		element.dispatchEvent(event)
		const preview = document.body.querySelector<HTMLElement>('[data-local-drag-preview="true"]')
		expect(event.defaultPrevented).toBe(true)
		expect(preview?.dataset.localDragPreviewKind).toBe('default')
		expect(preview?.textContent).toBe('Dragging')
		expect(document.body.style.userSelect).toBe('none')
		window.dispatchEvent(
			new MouseEvent('mouseup', {
				clientX: 12,
				clientY: 18,
				buttons: 0,
			})
		)
		expect(document.body.querySelector('[data-local-drag-preview="true"]')).toBeNull()
		expect(document.body.style.userSelect).toBe('')
	})

	it('uses the provided preview text during a managed drag', () => {
		const element = document.createElement('div')
		document.body.appendChild(element)
		element.addEventListener('mousedown', (event) => {
			startLocalDragSession({
				event,
				preview: 'Move toolbar',
			})
		})
		element.dispatchEvent(
			new MouseEvent('mousedown', {
				bubbles: true,
				cancelable: true,
				clientX: 8,
				clientY: 10,
				buttons: 1,
			})
		)
		const preview = document.body.querySelector<HTMLElement>('[data-local-drag-preview="true"]')
		expect(preview?.dataset.localDragPreviewKind).toBe('text')
		expect(preview?.textContent).toBe('Move toolbar')
		window.dispatchEvent(
			new MouseEvent('mouseup', {
				clientX: 8,
				clientY: 10,
				buttons: 0,
			})
		)
	})

	it('can leave preview handling native when requested', () => {
		const element = document.createElement('div')
		document.body.appendChild(element)
		element.addEventListener('mousedown', (event) => {
			startLocalDragSession({
				event,
				previewBehavior: 'native',
			})
		})
		const event = new MouseEvent('mousedown', {
			bubbles: true,
			cancelable: true,
			clientX: 20,
			clientY: 24,
			buttons: 1,
		})
		element.dispatchEvent(event)
		expect(event.defaultPrevented).toBe(false)
		expect(document.body.querySelector('[data-local-drag-preview="true"]')).toBeNull()
		expect(document.body.style.userSelect).toBe('')
		window.dispatchEvent(
			new MouseEvent('mouseup', {
				clientX: 20,
				clientY: 24,
				buttons: 0,
			})
		)
	})
})

describe('local drag geometry', () => {
	it('reads axis values from a rect and point', () => {
		const rect = { left: 10, right: 110, top: 20, bottom: 70, width: 100, height: 50 }
		expect(localDragAxisStart(rect, 'horizontal')).toBe(10)
		expect(localDragAxisEnd(rect, 'horizontal')).toBe(110)
		expect(localDragAxisSize(rect, 'vertical')).toBe(50)
		expect(localDragPointOnAxis({ x: 33, y: 44 }, 'vertical')).toBe(44)
	})

	it('measures a target from the DOM', () => {
		const element = document.createElement('div')
		const rect = { left: 1, right: 21, top: 2, bottom: 12, width: 20, height: 10 }
		vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)
		expect(measureLocalDragTarget('a', element)).toEqual({ id: 'a', rect })
	})

	it('resolves a clamped split value', () => {
		expect(resolveLocalDragSplit('horizontal', { x: 50, y: 0 }, 0, 100)).toBe(0.5)
		expect(resolveLocalDragSplit('horizontal', { x: -10, y: 0 }, 0, 100)).toBe(0)
		expect(resolveLocalDragSplit('vertical', { x: 0, y: 150 }, 0, 100)).toBe(1)
	})

	it('checks containment and distance in two dimensions', () => {
		const rect = { left: 10, right: 110, top: 20, bottom: 70, width: 100, height: 50 }
		expect(localDragRectContainsPoint(rect, { x: 50, y: 40 })).toBe(true)
		expect(localDragRectContainsPoint(rect, { x: 0, y: 40 })).toBe(false)
		expect(localDragDistanceToRect(rect, { x: 50, y: 40 })).toBe(0)
		expect(localDragDistanceToRect(rect, { x: 0, y: 40 })).toBe(10)
		expect(localDragDistanceToRect(rect, { x: 0, y: 0 })).toBeCloseTo(Math.hypot(10, 20))
	})

	it('resolves the nearest 2d target before doing axis-specific insertion', () => {
		const targets = [
			{ id: 'top', rect: { left: 0, right: 200, top: 0, bottom: 40, width: 200, height: 40 } },
			{ id: 'left', rect: { left: 0, right: 40, top: 50, bottom: 250, width: 40, height: 200 } },
		]
		expect(resolveLocalDragTarget(targets, { x: 30, y: 120 })).toEqual({
			targetId: 'left',
			targetIndex: 1,
			distance: 0,
			contained: true,
		})
		expect(resolveLocalDragTarget(targets, { x: 150, y: 20 })).toEqual({
			targetId: 'top',
			targetIndex: 0,
			distance: 0,
			contained: true,
		})
	})

	it('resolves candidates across cross-axis track targets', () => {
		const horizontal = {
			id: 'top',
			rect: { left: 0, right: 220, top: 0, bottom: 40, width: 220, height: 40 },
		}
		const vertical = {
			id: 'left',
			rect: { left: 0, right: 40, top: 50, bottom: 270, width: 40, height: 220 },
		}
		const target = resolveLocalDragCandidate(
			[horizontal, vertical],
			{ x: 20, y: 180 },
			(entry, state) => {
				if (!state.contained) return undefined
				const axis = entry.id === 'top' ? 'horizontal' : 'vertical'
				const insertion = resolveLocalDragInsertion([entry], { x: 20, y: 180 }, axis)
				return insertion ? { axis, insertion } : undefined
			}
		)
		expect(target).toEqual({
			targetId: 'left',
			targetIndex: 1,
			distance: 0,
			contained: true,
			value: {
				axis: 'vertical',
				insertion: {
					targetId: 'left',
					targetIndex: 0,
					index: 1,
					placement: 'after',
					distance: 20,
				},
			},
		})
	})

	it('resolves insertion by nearest midpoint', () => {
		const targets = [
			{ id: 'a', rect: { left: 0, right: 100, top: 0, bottom: 20, width: 100, height: 20 } },
			{ id: 'b', rect: { left: 120, right: 220, top: 0, bottom: 20, width: 100, height: 20 } },
		]
		expect(resolveLocalDragInsertion(targets, { x: 30, y: 0 }, 'horizontal')).toEqual({
			targetId: 'a',
			targetIndex: 0,
			index: 0,
			placement: 'before',
			distance: 20,
		})
		expect(resolveLocalDragInsertion(targets, { x: 180, y: 0 }, 'horizontal')).toEqual({
			targetId: 'b',
			targetIndex: 1,
			index: 2,
			placement: 'after',
			distance: 10,
		})
	})

	it('returns undefined when there are no targets', () => {
		expect(resolveLocalDragInsertion([], { x: 0, y: 0 }, 'horizontal')).toBeUndefined()
	})
})

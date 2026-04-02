import { document, h, rootEnv, SursautElement } from '@sursaut/core'
import { unwrap } from 'mutts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import './components'
import { beginPaletteCatalogInsertDrag, Parking } from './components'
import { createPaletteKeys } from './keys'
import { Palette, palettes } from './palette'
import type { PaletteConfig } from './types'

type PaletteRootEnv = typeof rootEnv & {
	paletteItemDrag?: (
		element: HTMLElement,
		target: Record<string, unknown>
	) => (() => void) | undefined
	paletteRoot?: (element: HTMLElement, palette: Palette) => (() => void) | undefined
}

function testPalette(run: () => void): Palette {
	return new Palette({
		tools: {
			run: {
				get can() {
					return true
				},
				run,
			},
		},
		keys: createPaletteKeys({
			N: 'run',
		}),
	})
}

function attachPaletteRoot(element: HTMLElement, palette: Palette): (() => void) | undefined {
	return (rootEnv as PaletteRootEnv).paletteRoot?.(element, palette)
}

function renderNodes(element: JSX.Element | JSX.Element[], scope: Record<string, unknown>) {
	const item = Array.isArray(element) ? element[0] : element
	if (!(item instanceof SursautElement)) throw new Error('Expected SursautElement')
	const nodes = item.render(scope)
	return Array.isArray(nodes) ? nodes : Array.from(nodes as Iterable<Node>)
}

describe('catalogue insert session', () => {
	afterEach(() => {
		palettes.catalogDrag = undefined
		palettes.dragging = undefined
	})

	it('tags the ephemeral shell so drop-after-move skips a second insert', () => {
		const palette = testPalette(() => {})
		const item = { tool: 'run' as const, editor: 'button' as const, config: {} }
		beginPaletteCatalogInsertDrag(palette, item)
		const session = palettes.dragging
		expect(session?.catalogInsert).toBe(true)
		expect(session?.catalogInsertSeedBorder).toBe(session?.border)
	})
})

describe('paletteRoot', () => {
	afterEach(() => {
		document.body.replaceChildren()
		palettes.catalogDrag = undefined
		palettes.editing = undefined
		palettes.dragging = undefined
		palettes.inspecting = undefined
	})

	it('ignores shortcuts triggered from editable descendants', () => {
		const run = vi.fn()
		const root = document.createElement('div')
		const input = document.createElement('input')
		root.appendChild(input)
		document.body.appendChild(root)
		const cleanup = attachPaletteRoot(root, testPalette(run))

		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true }))

		expect(run).not.toHaveBeenCalled()
		cleanup?.()
	})

	it('ignores shortcuts when a child already consumed the event', () => {
		const run = vi.fn()
		const root = document.createElement('div')
		const child = document.createElement('button')
		root.appendChild(child)
		document.body.appendChild(root)
		const cleanup = attachPaletteRoot(root, testPalette(run))

		child.addEventListener('keydown', (event) => {
			event.preventDefault()
		})
		child.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true }))

		expect(run).not.toHaveBeenCalled()
		cleanup?.()
	})

	it('runs bound command shortcuts from the palette root', () => {
		const run = vi.fn()
		const root = document.createElement('div')
		document.body.appendChild(root)
		const cleanup = attachPaletteRoot(root, testPalette(run))

		const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true })
		const stopPropagation = vi.spyOn(event, 'stopPropagation')
		root.dispatchEvent(event)

		expect(run).toHaveBeenCalledTimes(1)
		expect(event.defaultPrevented).toBe(true)
		expect(stopPropagation).toHaveBeenCalledTimes(1)
		cleanup?.()
	})

	it('does not run disabled command shortcuts but still consumes the event', () => {
		const run = vi.fn()
		const root = document.createElement('div')
		document.body.appendChild(root)
		const palette = new Palette({
			tools: {
				run: {
					get can() {
						return false
					},
					run,
				},
			},
			keys: createPaletteKeys({
				N: 'run',
			}),
		} satisfies PaletteConfig)
		const cleanup = attachPaletteRoot(root, palette)

		const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true })
		root.dispatchEvent(event)

		expect(run).not.toHaveBeenCalled()
		expect(event.defaultPrevented).toBe(true)
		cleanup?.()
	})

	it('toggles boolean tools from keyboard shortcuts', () => {
		const root = document.createElement('div')
		document.body.appendChild(root)
		const notifications = {
			type: 'boolean' as const,
			value: false,
			default: false,
		}
		const palette = new Palette({
			tools: {
				notifications,
			},
			keys: createPaletteKeys({
				N: 'notifications',
			}),
		} satisfies PaletteConfig)
		const cleanup = attachPaletteRoot(root, palette)

		root.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true }))
		expect(notifications.value).toBe(true)

		root.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true }))
		expect(notifications.value).toBe(false)
		cleanup?.()
	})

	it('removes the root listener on cleanup', () => {
		const run = vi.fn()
		const root = document.createElement('div')
		document.body.appendChild(root)
		const cleanup = attachPaletteRoot(root, testPalette(run))

		cleanup?.()
		root.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true, cancelable: true }))

		expect(run).not.toHaveBeenCalled()
	})

	it('reflects editing and dragging state on the root element', () => {
		const run = vi.fn()
		const root = document.createElement('div')
		const palette = testPalette(run)
		document.body.appendChild(root)
		const cleanup = attachPaletteRoot(root, palette)

		palettes.editing = palette
		expect(root.dataset.editing).toBe('true')
		expect(root.classList.contains('palette-editing')).toBe(true)

		palettes.dragging = {
			border: [],
			createdTracks: [],
			index: 0,
			palette,
			region: 'top',
			sourceItems: [],
			sourceBorder: [],
			sourceRegion: 'top',
			sourceTrack: [],
			sourceTrackIndex: 0,
			sourceTrackWasSingleton: false,
			toolbar: [],
			track: [],
			trackIndex: 0,
		}
		expect(root.dataset.dragging).toBe('true')
		expect(root.classList.contains('palette-dragging')).toBe(true)

		cleanup?.()
		palettes.editing = undefined
		palettes.dragging = undefined
		palettes.inspecting = undefined
	})

	it('clicks an item to inspect it without entering dragging state', () => {
		const root = document.createElement('div')
		const guard = document.createElement('div')
		const firstItem = { tool: 'run' }
		const secondItem = { tool: 'run' }
		const toolbar = [firstItem, secondItem]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		Object.defineProperties(guard, {
			setPointerCapture: { configurable: true, value: vi.fn() },
			releasePointerCapture: { configurable: true, value: vi.fn() },
			hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
		})
		root.appendChild(guard)
		document.body.appendChild(root)
		const palette = new Palette({
			tools: {
				run: {
					get can() {
						return true
					},
					run() {},
				},
			},
			keys: createPaletteKeys({
				N: 'run',
			}),
		} satisfies PaletteConfig)
		palettes.editing = palette
		const cleanup = (rootEnv as PaletteRootEnv).paletteItemDrag?.(guard, {
			border,
			direction: 'horizontal',
			item: firstItem,
			itemIndex: 0,
			palette,
			region: 'top',
			toolbar,
			track,
			trackIndex: 0,
		})
		guard?.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				button: 0,
				buttons: 1,
				pointerId: 1,
			})
		)
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				cancelable: true,
				button: 0,
				buttons: 0,
				pointerId: 1,
			})
		)

		expect(palettes.dragging).toBeUndefined()
		expect(unwrap(palettes.inspecting?.palette)).toBe(palette)
		expect(unwrap(palettes.inspecting?.item)).toBe(firstItem)
		cleanup?.()
	})

	it('keeps an item inspected when drag activates without moving it elsewhere', () => {
		const root = document.createElement('div')
		const guard = document.createElement('div')
		const firstItem = { tool: 'run' }
		const secondItem = { tool: 'run' }
		const toolbar = [firstItem, secondItem]
		const track = [{ space: 0, toolbar }]
		const border = [track]
		Object.defineProperties(guard, {
			setPointerCapture: { configurable: true, value: vi.fn() },
			releasePointerCapture: { configurable: true, value: vi.fn() },
			hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
		})
		root.appendChild(guard)
		document.body.appendChild(root)
		const palette = new Palette({
			tools: {
				run: {
					get can() {
						return true
					},
					run() {},
				},
			},
			keys: createPaletteKeys({
				N: 'run',
			}),
		} satisfies PaletteConfig)
		palettes.editing = palette
		const cleanup = (rootEnv as PaletteRootEnv).paletteItemDrag?.(guard, {
			border,
			direction: 'horizontal',
			item: firstItem,
			itemIndex: 0,
			palette,
			region: 'top',
			toolbar,
			track,
			trackIndex: 0,
		})
		guard.dispatchEvent(
			new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				button: 0,
				buttons: 1,
				clientX: 10,
				clientY: 10,
				pointerId: 1,
			})
		)
		window.dispatchEvent(
			new PointerEvent('pointermove', {
				bubbles: true,
				cancelable: true,
				buttons: 1,
				clientX: 20,
				clientY: 10,
				pointerId: 1,
			})
		)
		window.dispatchEvent(
			new PointerEvent('pointerup', {
				bubbles: true,
				cancelable: true,
				button: 0,
				buttons: 0,
				clientX: 20,
				clientY: 10,
				pointerId: 1,
			})
		)

		expect(palettes.dragging).toBeUndefined()
		expect(unwrap(palettes.inspecting?.palette)).toBe(palette)
		expect(unwrap(palettes.inspecting?.item)).toBe(firstItem)
		cleanup?.()
	})

	it('keeps parked toolbar content interactive while editing', () => {
		const run = vi.fn()
		const palette = new Palette({
			tools: {
				run: {
					get can() {
						return true
					},
					run,
				},
			},
			keys: createPaletteKeys({
				N: 'run',
			}),
			editor: () => h('button', { id: 'parked-run', onClick: () => run() }, 'Run'),
		} satisfies PaletteConfig)
		palettes.editing = palette

		const nodes = renderNodes(
			Parking(
				{
					toolbars: [[{ tool: 'run' }]],
				},
				{ palette }
			),
			{ palette }
		)
		const root = document.createElement('div')
		root.replaceChildren(...nodes)
		document.body.appendChild(root)

		const button = root.querySelector<HTMLButtonElement>('#parked-run')

		expect(button).toBeTruthy()
		button?.click()
		expect(run).toHaveBeenCalledTimes(1)
	})

	it('deletes a parked toolbar from parking while editing', () => {
		const palette = new Palette({
			tools: {
				run: {
					get can() {
						return true
					},
					run() {},
				},
			},
			keys: createPaletteKeys({
				N: 'run',
			}),
			editor: () => h('button', { id: 'parked-run' }, 'Run'),
		} satisfies PaletteConfig)
		palettes.editing = palette

		const nodes = renderNodes(
			Parking(
				{
					toolbars: [[{ tool: 'run' }]],
				},
				{ palette }
			),
			{ palette }
		)
		const root = document.createElement('div')
		root.replaceChildren(...nodes)
		document.body.appendChild(root)

		const removeButton = root.querySelector<HTMLButtonElement>('.palette-parking-remove')
		const parkedButton = root.querySelector<HTMLButtonElement>('#parked-run')

		expect(removeButton).toBeTruthy()
		expect(parkedButton).toBeTruthy()
		removeButton?.click()
		expect(root.querySelector('.palette-parking-remove')).toBeNull()
		expect(root.querySelector('#parked-run')).toBeNull()
	})
})

import { reactive } from 'mutts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPaletteKeys } from './keys'
import {
	isEditableTool,
	isEditing,
	isRunTool,
	Palette,
	PaletteError,
	palettes,
	paletteTool,
	paletteToolFamily,
	renderPaletteConfigurator,
	renderPaletteEditor,
	resolvePaletteEditor,
} from './palette'
import type { PaletteConfig, PaletteToolbarItem } from './types'

function createPalette(): Palette {
	return new Palette({
		tools: {
			reset: {
				label: 'Reset',
				get can() {
					return true
				},
				run() {},
			},
			notifications: {
				type: 'boolean',
				label: 'Notifications',
				value: false,
				default: false,
			},
			fontSize: {
				type: 'number',
				label: 'Font Size',
				value: 10,
				default: 10,
				min: 10,
				max: 12,
				step: 1,
			},
			theme: {
				type: 'enum',
				label: 'Theme',
				value: 'dark',
				default: 'dark',
				values: [
					{ value: 'light', label: 'Light', keywords: ['day'] },
					{ value: 'dark', label: 'Dark', can: false },
				],
			},
		},
		keys: createPaletteKeys({
			R: 'reset',
			N: 'notifications|true',
			'+': 'fontSize:inc',
		}),
	})
}

function editableTools(palette: Palette) {
	const notifications = palette.tools.notifications
	if (!isEditableTool(notifications) || notifications.type !== 'boolean')
		throw new Error('Expected boolean notifications tool')
	const fontSize = palette.tools.fontSize
	if (!isEditableTool(fontSize) || fontSize.type !== 'number')
		throw new Error('Expected numeric fontSize tool')
	return { fontSize, notifications }
}

describe('palette engine', () => {
	afterEach(() => {
		palettes.catalogDrag = undefined
		palettes.editing = undefined
		palettes.dragging = undefined
	})

	it('identifies tool families correctly', () => {
		const palette = createPalette()

		expect(isRunTool(palette.tools.reset)).toBe(true)
		expect(isEditableTool(palette.tools.reset)).toBe(false)
		expect(isEditableTool(palette.tools.notifications)).toBe(true)
		expect(paletteToolFamily(palette.tools.reset)).toBe('run')
		expect(paletteToolFamily(palette.tools.fontSize)).toBe('number')
	})

	it('resolves palette tool specs into runnable helpers', () => {
		const palette = createPalette()
		const { fontSize, notifications } = editableTools(palette)

		expect(palette.tool('reset')).toBe(palette.tools.reset)
		expect(paletteTool(palette, 'reset')).toBe(palette.tools.reset)

		const setterRunner = palette.tool('notifications|true')
		if (!isRunTool(setterRunner)) throw new Error('Expected setter runner')
		setterRunner.run()
		expect(notifications.value).toBe(true)
		setterRunner.run()
		expect(notifications.value).toBe(false)

		const actionRunner = palette.tool('fontSize:inc')
		if (!isRunTool(actionRunner)) throw new Error('Expected action runner')
		expect(actionRunner.can).toBe(true)
		actionRunner.run()
		expect(fontSize.value).toBe(11)
	})

	it('restores the previous editable value when the same setter is run twice', () => {
		const palette = createPalette()
		const { notifications } = editableTools(palette)
		notifications.value = true

		const setterRunner = paletteTool(palette, 'notifications|false')
		if (!isRunTool(setterRunner)) throw new Error('Expected setter runner')

		setterRunner.run()
		expect(notifications.value).toBe(false)

		setterRunner.run()
		expect(notifications.value).toBe(true)
	})

	it('exposes numeric action can state at the bounds', () => {
		const palette = createPalette()
		const { fontSize } = editableTools(palette)

		const incRunner = paletteTool(palette, 'fontSize:inc')
		if (!isRunTool(incRunner)) throw new Error('Expected increment runner')
		expect(incRunner.can).toBe(true)

		fontSize.value = 12
		expect(incRunner.can).toBe(false)
	})

	it('applies runner and setter wrappers when provided', () => {
		const runnerHook = vi.fn<(spec: string) => void>()
		const setterHook = vi.fn<(value: unknown) => void>()
		const palette = new Palette({
			...createPalette().config,
			runner(runner, _from, spec) {
				return {
					get can() {
						return runner.can
					},
					run() {
						runnerHook(spec)
						return runner.run()
					},
				}
			},
			setter(runner, _from, value) {
				return {
					get can() {
						return runner.can
					},
					run() {
						setterHook(value)
						return runner.run()
					},
				}
			},
		})

		const setterRunner = paletteTool(palette, 'notifications|true')
		if (!isRunTool(setterRunner)) throw new Error('Expected setter runner')
		setterRunner.run()
		expect(setterHook).toHaveBeenCalledWith(true)

		const actionRunner = paletteTool(palette, 'fontSize:inc=fast')
		if (!isRunTool(actionRunner)) throw new Error('Expected action runner')
		actionRunner.run()
		expect(runnerHook).toHaveBeenCalledWith('inc=fast')
	})

	it('throws palette errors for unknown tools and unsupported actions', () => {
		const palette = createPalette()

		expect(() => paletteTool(palette, 'missing')).toThrow(PaletteError)
		expect(() => paletteTool(palette, 'reset|true')).toThrow(PaletteError)
		expect(() => paletteTool(palette, 'fontSize:missing')).toThrow(PaletteError)
		expect(() => paletteTool(palette, 'theme:missing')).toThrow(PaletteError)
	})

	it('throws palette errors for unsupported editing actions', () => {
		const palette = createPalette()

		expect(() => paletteTool(palette, 'notifications:inc')).toThrow(PaletteError)
		expect(() => paletteTool(palette, 'fontSize|true')).toThrow(PaletteError)
	})

	it('resolves editor specs from item or default variant', () => {
		const palette = new Palette({
			...createPalette().config,
			editors: {
				run: {
					button: {
						editor: () => <div data-test="run-editor">run</div>,
					},
				},
			},
			editorDefaults: {
				run: 'button',
			},
		} satisfies PaletteConfig)
		const item = { tool: 'reset' } satisfies PaletteToolbarItem

		const spec = palette.resolveEditor(item, palette.tools.reset)
		expect(spec?.editor({ item, tool: palette.tools.reset, scope: {}, flags: {} })).toBeTruthy()
		expect(palette.renderEditor(item, palette.tools.reset, {})).toBeTruthy()
		expect(resolvePaletteEditor(palette, item, palette.tools.reset)).toBe(spec)
		expect(renderPaletteEditor(palette, item, palette.tools.reset, {})).toBeTruthy()
		expect(palette.renderConfigurator(item, palette.tools.reset, {})).toBeUndefined()
	})

	it('throws clear editor errors when variant configuration is missing or invalid', () => {
		const palette = new Palette({
			...createPalette().config,
			editors: {
				run: {
					button: {
						editor: () => <div>run</div>,
					},
				},
			},
		} satisfies PaletteConfig)

		expect(() => palette.resolveEditor({ tool: 'reset' }, palette.tools.reset)).toThrow(
			'No editor variant configured'
		)
		expect(() =>
			palette.resolveEditor({ tool: 'reset', editor: 'missing' }, palette.tools.reset)
		).toThrow('Unknown palette editor')
	})

	it('falls back to palette.editor when no registry editor is configured', () => {
		const render = vi.fn(() => <div data-test="fallback-editor">fallback</div>)
		const palette = new Palette({
			...createPalette().config,
			editor: render,
		} satisfies PaletteConfig)

		const rendered = palette.renderEditor({ tool: 'reset' }, palette.tools.reset, {})
		expect(rendered).toBeTruthy()
		expect(render).toHaveBeenCalledTimes(1)
	})

	it('renders configurators from editor specs or palette fallback', () => {
		const configure = vi.fn(() => <div data-test="run-configurator">config</div>)
		const fallback = vi.fn(() => <div data-test="fallback-configurator">fallback</div>)
		const palette = new Palette({
			...createPalette().config,
			editors: {
				run: {
					button: {
						editor: () => <div>run</div>,
						configure,
					},
				},
			},
			editorDefaults: {
				run: 'button',
			},
			configurator: fallback,
		} satisfies PaletteConfig)

		const runItem = { tool: 'reset' } satisfies PaletteToolbarItem
		expect(palette.renderConfigurator(runItem, palette.tools.reset, {})).toBeTruthy()
		expect(renderPaletteConfigurator(palette, runItem, palette.tools.reset, {})).toBeTruthy()
		expect(configure).toHaveBeenCalledTimes(2)

		const fallbackItem = { tool: 'notifications', editor: 'missing' } as PaletteToolbarItem
		expect(palette.renderConfigurator(fallbackItem, palette.tools.notifications, {})).toBeTruthy()
		expect(fallback).toHaveBeenCalledTimes(1)

		const fallbackPalette = new Palette({
			...createPalette().config,
			configurator: fallback,
		} satisfies PaletteConfig)
		expect(
			fallbackPalette.renderConfigurator({ tool: 'reset' }, fallbackPalette.tools.reset, {})
		).toBeTruthy()
		expect(fallback).toHaveBeenCalledTimes(2)
	})

	it('tracks the editing palette identity', () => {
		const first = createPalette()
		const second = createPalette()

		expect(first.editing).toBe(false)
		expect(isEditing(first)).toBe(false)
		palettes.editing = first
		expect(first.editing).toBe(true)
		expect(isEditing(first)).toBe(true)
		expect(second.editing).toBe(false)
		expect(isEditing(second)).toBe(false)
	})

	it('derives editability from config instead of maintained instance state', () => {
		const popup = reactive({ open: false })
		const palette = new Palette({
			...createPalette().config,
			get editable() {
				return popup.open
			},
		} satisfies PaletteConfig)

		palettes.editing = palette
		expect(palette.editing).toBe(false)
		expect(isEditing(palette)).toBe(false)

		popup.open = true
		expect(palette.editing).toBe(true)
		expect(isEditing(palette)).toBe(true)

		popup.open = false
		expect(palette.editing).toBe(false)
		expect(isEditing(palette)).toBe(false)
	})
})

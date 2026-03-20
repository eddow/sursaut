import { h } from '@sursaut/core'
import { describe, expect, it, vi } from 'vitest'
import {
	handlePaletteCommandBoxInputKeydown,
	handlePaletteCommandChipKeydown,
	Palette,
	paletteAddItemEntries,
	paletteCommandBoxModel,
	paletteCommandEntries,
	paletteDerivedVariants,
	paletteEnumSubsetValues,
} from './index'
import { createPaletteKeys } from './keys'
import type { PaletteConfig } from './types'

describe('paletteCommandBoxModel', () => {
	it('filters entries by free text, categories, and keyword tokens', () => {
		const model = paletteCommandBoxModel({
			entries: [
				{
					id: 'theme-dark',
					label: 'Theme Dark',
					keywords: ['theme', 'dark'],
					categories: ['appearance'],
					run() {},
				},
				{
					id: 'mode-command',
					label: 'Mode Command',
					keywords: ['mode', 'command'],
					categories: ['workspace'],
					run() {},
				},
			],
		})

		expect(model.results.map((entry) => entry.id)).toEqual(['mode-command', 'theme-dark'])

		model.search({ free: 'theme', categories: ['appearance'] })
		expect(model.results.map((entry) => entry.id)).toEqual(['theme-dark'])
		expect(model.query.free).toBe('theme')
		expect(Array.from(model.query.categories)).toEqual(['appearance'])

		model.keywords.addToken('dark')
		expect(Array.from(model.query.keywords)).toEqual(['dark'])
		expect(model.results.map((entry) => entry.id)).toEqual(['theme-dark'])
	})

	it('parses categories and known keywords from input while keeping remaining free text', () => {
		const model = paletteCommandBoxModel({
			entries: [
				{
					id: 'theme-light',
					label: 'Theme Light Accent',
					keywords: ['light'],
					categories: ['appearance'],
					run() {},
				},
			],
		})

		model.input.value = 'LIGHT #appearance accent light'

		expect(model.query.free).toBe('accent')
		expect(Array.from(model.query.keywords)).toEqual(['light'])
		expect(Array.from(model.query.categories)).toEqual(['appearance'])
		expect(model.results.map((entry) => entry.id)).toEqual(['theme-light'])
	})

	it('proposes only commands whose can state is true', () => {
		const model = paletteCommandBoxModel({
			entries: [
				{ id: 'enabled', label: 'Enabled Command', keywords: ['alpha'], can: true, run() {} },
				{ id: 'disabled', label: 'Disabled Command', keywords: ['alpine'], can: false, run() {} },
			],
		})

		expect(model.results.map((entry) => entry.id)).toEqual(['enabled'])

		model.input.value = 'al'
		expect(model.results.map((entry) => entry.id)).toEqual(['enabled'])
		expect(model.suggestions.map((entry) => entry.keyword)).toEqual(['alpha'])
	})

	it('ranks exact label matches ahead of prefix and generic searchable matches', () => {
		const model = paletteCommandBoxModel({
			entries: [
				{ id: 'contains', label: 'Beta Alpha', run() {} },
				{ id: 'exact', label: 'Alpha', run() {} },
				{ id: 'prefix', label: 'Alpha Beta', run() {} },
			],
		})

		model.input.value = 'alpha'

		expect(model.results.map((entry) => entry.id)).toEqual(['exact', 'prefix', 'contains'])
	})

	it('offers keyword suggestions and consumes matching suggestion on tab', () => {
		const model = paletteCommandBoxModel({
			entries: [
				{ id: 'theme-dark', label: 'Theme Dark', keywords: ['dark'], run() {} },
				{ id: 'theme-light', label: 'Theme Light', keywords: ['light'], run() {} },
			],
		})

		model.input.value = 'da'
		expect(model.suggestions.map((entry) => entry.keyword)).toEqual(['dark'])

		const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
		expect(model.handleKeyDown(event)).toBe(true)
		expect(event.defaultPrevented).toBe(true)
		expect(model.keywords.tokens.map((entry) => entry.keyword)).toEqual(['dark'])
		expect(model.input.value).toBe('')
	})

	it('hides category suggestions and excludes already active keywords from suggestions', () => {
		const model = paletteCommandBoxModel({
			entries: [
				{
					id: 'font-size',
					label: 'Font Size',
					keywords: ['font', 'type'],
					categories: ['appearance'],
					run() {},
				},
			],
		})

		model.input.value = '#app'
		expect(Array.from(model.suggestions)).toEqual([])

		model.input.value = 'fo'
		expect(model.suggestions.map((entry) => entry.keyword)).toEqual(['font'])

		model.keywords.addToken('font')
		expect(model.suggestions.map((entry) => entry.keyword)).toEqual([])
	})

	it('navigates and executes the selected result, then clears state', () => {
		const first = vi.fn()
		const second = vi.fn()
		const model = paletteCommandBoxModel({
			entries: [
				{
					id: 'first',
					label: 'First Command',
					categories: ['actions'],
					keywords: ['pinned'],
					run: first,
				},
				{
					id: 'second',
					label: 'Second Command',
					categories: ['actions'],
					keywords: ['pinned'],
					run: second,
				},
			],
		})

		expect(model.selection.index).toBe(-1)
		expect(
			model.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }))
		).toBe(true)
		expect(model.selection.item?.id).toBe('first')
		expect(
			model.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }))
		).toBe(true)
		expect(model.selection.item?.id).toBe('second')

		model.keywords.addToken('pinned')
		model.categories.toggle('actions')
		model.input.value = 'second'
		expect(
			model.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
		).toBe(true)

		expect(second).toHaveBeenCalledTimes(1)
		expect(model.input.value).toBe('')
		expect(model.keywords.tokens).toHaveLength(0)
		expect(model.categories.active).toHaveLength(0)
		expect(model.selection.index).toBe(-1)
	})

	it('selects the highlighted result without executing when enterAction is select', () => {
		const first = vi.fn()
		const second = vi.fn()
		const model = paletteCommandBoxModel({
			entries: [
				{ id: 'first', label: 'First Command', run: first },
				{ id: 'second', label: 'Second Command', run: second },
			],
			enterAction: 'select',
		})

		model.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }))
		model.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }))
		expect(model.selection.item?.id).toBe('second')

		expect(
			model.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
		).toBe(true)
		expect(first).not.toHaveBeenCalled()
		expect(second).not.toHaveBeenCalled()
		expect(model.selection.item?.id).toBe('second')

		model.execute()
		expect(second).toHaveBeenCalledTimes(1)
	})

	it('clears selection first and filters second on escape', () => {
		const model = paletteCommandBoxModel({
			entries: [
				{ id: 'alpha', label: 'Alpha', keywords: ['one'], run() {} },
				{ id: 'beta', label: 'Beta', keywords: ['two'], run() {} },
			],
		})

		model.input.value = 'a'
		model.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }))
		expect(model.selection.index).toBe(0)

		const clearSelection = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
		expect(model.handleKeyDown(clearSelection)).toBe(true)
		expect(model.selection.index).toBe(-1)
		expect(model.input.value).toBe('a')

		const clearFilters = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
		expect(model.handleKeyDown(clearFilters)).toBe(true)
		expect(model.input.value).toBe('')
	})

	it('uses backspace to remove the last keyword token before categories', () => {
		const model = paletteCommandBoxModel({
			entries: [{ id: 'alpha', label: 'Alpha', run() {} }],
		})

		model.categories.toggle('filters')
		model.keywords.addToken('alpha')

		const removeKeyword = new KeyboardEvent('keydown', {
			key: 'Backspace',
			cancelable: true,
		})
		expect(model.handleKeyDown(removeKeyword)).toBe(true)
		expect(model.keywords.tokens).toHaveLength(0)
		expect(Array.from(model.categories.active)).toEqual(['filters'])

		const removeCategory = new KeyboardEvent('keydown', {
			key: 'Backspace',
			cancelable: true,
		})
		expect(model.handleKeyDown(removeCategory)).toBe(true)
		expect(Array.from(model.categories.active)).toHaveLength(0)
	})

	it('restores neutral results after removing the last keyword token', () => {
		const model = paletteCommandBoxModel({
			entries: [
				{ id: 'preset', label: 'Apply Inspector Preset', run() {} },
				{ id: 'fontSize:inc', label: 'Increase Font Size', keywords: ['increase'], run() {} },
				{
					id: 'gameSpeed:inc',
					label: 'Increase Playback Speed',
					keywords: ['increase'],
					run() {},
				},
			],
		})

		expect(model.results.map((entry) => entry.id)).toEqual([
			'preset',
			'fontSize:inc',
			'gameSpeed:inc',
		])

		model.input.value = 'inc'
		model.keywords.addToken('increase')
		model.input.value = ''
		expect(model.keywords.tokens.map((token) => token.keyword)).toEqual(['increase'])
		expect(model.results.map((entry) => entry.id)).toEqual(['fontSize:inc', 'gameSpeed:inc'])

		model.keywords.removeToken('increase')
		expect(model.keywords.tokens).toHaveLength(0)
		expect(Array.from(model.query.keywords)).toEqual([])
		expect(model.query.free).toBe('')
		expect(model.results.map((entry) => entry.id)).toEqual([
			'preset',
			'fontSize:inc',
			'gameSpeed:inc',
		])
	})

	it('broadens results immediately when removing one of multiple keywords', () => {
		const model = paletteCommandBoxModel({
			entries: [
				{
					id: 'fontSize:inc',
					label: 'Increase Font Size',
					keywords: ['increase', 'font'],
					run() {},
				},
				{
					id: 'gameSpeed:inc',
					label: 'Increase Playback Speed',
					keywords: ['increase', 'speed'],
					run() {},
				},
			],
		})

		model.keywords.addToken('increase')
		model.keywords.addToken('font')
		expect(model.results.map((entry) => entry.id)).toEqual(['fontSize:inc'])

		model.keywords.removeToken('font')
		expect(model.keywords.tokens.map((token) => token.keyword)).toEqual(['increase'])
		expect(model.results.map((entry) => entry.id)).toEqual(['fontSize:inc', 'gameSpeed:inc'])
	})

	it('switches from manual search state back to local input edits', () => {
		const model = paletteCommandBoxModel({
			entries: [
				{ id: 'alpha', label: 'Alpha', keywords: ['one'], categories: ['first'], run() {} },
				{ id: 'beta', label: 'Beta', keywords: ['two'], categories: ['second'], run() {} },
			],
		})

		model.search({ free: 'alpha', keywords: ['one'], categories: ['first'] })
		expect(model.query.free).toBe('alpha')
		expect(Array.from(model.query.keywords)).toEqual(['one'])
		expect(Array.from(model.query.categories)).toEqual(['first'])

		model.input.value = 'beta'
		expect(model.query.free).toBe('beta')
		expect(Array.from(model.query.keywords)).toEqual([])
		expect(Array.from(model.query.categories)).toEqual([])
	})

	it('handles chip and input helper keydown wrappers', () => {
		const run = vi.fn()
		const model = paletteCommandBoxModel({
			entries: [{ id: 'alpha', label: 'Alpha', keywords: ['alpha'], run }],
		})

		model.keywords.addToken('alpha')
		const removeToken = new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true })
		expect(
			handlePaletteCommandChipKeydown({ commandBox: model, event: removeToken, token: 'alpha' })
		).toBe(true)
		expect(removeToken.defaultPrevented).toBe(true)
		expect(model.keywords.tokens).toHaveLength(0)

		const ignored = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true })
		expect(
			handlePaletteCommandChipKeydown({ commandBox: model, event: ignored, token: 'alpha' })
		).toBe(false)

		model.input.value = 'alpha'
		const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
		expect(
			handlePaletteCommandBoxInputKeydown({
				commandBox: model,
				event: enter,
				onAfterExecute: run,
			})
		).toBe(true)
		expect(run).toHaveBeenCalledTimes(2)
	})

	it('derives command entries from palette tools, values, and value actions', () => {
		const reset = vi.fn()
		const palette = new Palette({
			tools: {
				notifications: {
					type: 'boolean' as const,
					label: 'Notifications',
					categories: ['settings'],
					keywords: ['alerts'],
					get value() {
						return true
					},
					set value(_value: boolean) {},
					default: true,
				},
				theme: {
					type: 'enum' as const,
					label: 'Theme',
					categories: ['appearance'],
					get value() {
						return 'dark' as const
					},
					set value(_value: 'light' | 'dark') {},
					default: 'dark' as const,
					values: [
						{ value: 'light' as const, label: 'Light', keywords: ['day'] },
						{ value: 'dark' as const, label: 'Dark', keywords: ['night'] },
					],
				},
				fontSize: {
					type: 'number' as const,
					label: 'Font Size',
					categories: ['appearance'],
					get value() {
						return 12
					},
					set value(_value: number) {},
					default: 12,
					min: 10,
					max: 20,
					step: 1,
				},
				reset: {
					label: 'Reset Defaults',
					categories: ['presets'],
					get can() {
						return true
					},
					run: reset,
				},
			},
			keys: createPaletteKeys({
				R: 'reset',
				T: 'theme|light',
				'+': 'fontSize:inc',
			}),
		} satisfies PaletteConfig)
		const entries = paletteCommandEntries({ palette })

		expect(entries.find((entry) => entry.id === 'reset')?.label).toBe('Reset Defaults')
		expect(entries.find((entry) => entry.id === 'theme|light')?.label).toBe('Set Theme to Light')
		expect(entries.find((entry) => entry.id === 'theme|light')?.meta).toBe('T')
		expect(entries.find((entry) => entry.id === 'fontSize:inc')?.label).toBe('Increase Font Size')
		expect(entries.find((entry) => entry.id === 'notifications|false')?.label).toBe(
			'Disable Notifications'
		)
		expect(entries.find((entry) => entry.id === 'theme|light')?.keywords).toContain('day')
	})

	it('derives add-item entries and right-side variants from palette tools and editor-only items', () => {
		const palette = new Palette({
			tools: {
				theme: {
					type: 'enum' as const,
					label: 'Theme',
					icon: '🎨',
					get value() {
						return 'dark' as const
					},
					set value(_value: 'light' | 'dark') {},
					default: 'dark' as const,
					values: [
						{ value: 'light' as const, label: 'Light' },
						{ value: 'dark' as const, label: 'Dark' },
					],
				},
				fontSize: {
					type: 'number' as const,
					label: 'Font Size',
					get value() {
						return 12
					},
					set value(_value: number) {},
					default: 12,
					min: 10,
					max: 20,
					step: 1,
				},
				reset: {
					label: 'Reset Defaults',
					get can() {
						return true
					},
					run() {},
				},
			},
			keys: createPaletteKeys({ R: 'reset' }),
			editors: {
				item: {
					commandBox: {
						editor: () => h('div', {}),
					},
				},
			},
		} satisfies PaletteConfig)

		const entries = paletteAddItemEntries({ palette })
		expect(entries.find((entry) => entry.id === 'tool:theme')?.label).toBe('Theme')
		expect(entries.find((entry) => entry.id === 'item:commandBox')?.meta).toBe(
			'Add editor-only item'
		)

		const themeVariants = paletteDerivedVariants({
			palette,
			entry: entries.find((entry) => entry.id === 'tool:theme')!,
		})
		expect(themeVariants.map((entry) => entry.kind)).toEqual(['tool', 'set'])
		expect(themeVariants.find((entry) => entry.kind === 'set')?.valueType).toBe('enum')

		const numberVariants = paletteDerivedVariants({
			palette,
			entry: entries.find((entry) => entry.id === 'tool:fontSize')!,
		})
		expect(numberVariants.map((entry) => entry.kind)).toEqual(['tool', 'set', 'action', 'action'])
		expect(numberVariants.find((entry) => entry.action === 'inc')?.spec).toBe('fontSize:inc')
	})

	it('matches enum subset keywords from explicit keywords and dot-separated value names', () => {
		const values = paletteEnumSubsetValues({
			values: [
				{ value: 'layout.horizontal', label: 'Horizontal layout', keywords: ['row'] },
				{ value: 'layout.vertical', label: 'Vertical layout', keywords: ['column'] },
			],
			keywords: ['vertical'],
		})
		expect(values.map((entry) => entry.value)).toEqual(['layout.vertical'])

		const explicit = paletteEnumSubsetValues({
			values: [
				{ value: 'layout.horizontal', keywords: ['row'] },
				{ value: 'layout.vertical', keywords: ['column'] },
			],
			keywords: ['row'],
		})
		expect(explicit.map((entry) => entry.value)).toEqual(['layout.horizontal'])
	})
})

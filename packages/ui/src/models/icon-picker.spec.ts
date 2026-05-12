import { describe, expect, it, vi } from 'vitest'
import {
	commonEmojiIconItems,
	type IconPickerItem,
	type IconPickerValue,
	iconPickerModel,
	iconPickerValueEquals,
} from './icon-picker'

const items: readonly IconPickerItem[] = [
	{
		value: { value: '✅' },
		label: 'Check',
		group: 'Emoji',
		keywords: ['done', 'success'],
	},
	{
		value: { source: 'tabler', id: 'home' },
		label: 'Home',
		group: 'Navigation',
		keywords: ['house', 'start'],
	},
	{
		value: { source: 'lucide', id: 'search' },
		label: 'Search',
		group: 'Actions',
		keywords: ['find', 'lookup'],
	},
]

describe('iconPickerModel', () => {
	it('filters by label, id, source, group, and keywords', () => {
		expect(
			iconPickerModel({ items, query: 'check' }).filteredItems.map((item) => item.label)
		).toEqual(['Check'])
		expect(
			iconPickerModel({ items, query: 'home' }).filteredItems.map((item) => item.label)
		).toEqual(['Home'])
		expect(
			iconPickerModel({ items, query: 'lucide' }).filteredItems.map((item) => item.label)
		).toEqual(['Search'])
		expect(
			iconPickerModel({ items, query: 'navigation' }).filteredItems.map((item) => item.label)
		).toEqual(['Home'])
		expect(
			iconPickerModel({ items, query: 'lookup' }).filteredItems.map((item) => item.label)
		).toEqual(['Search'])
	})

	it('preserves item order after filtering', () => {
		const model = iconPickerModel({ items, query: 'e' })

		expect(model.filteredItems.map((item) => item.label)).toEqual(['Check', 'Home', 'Search'])
	})

	it('matches selected emoji and source-library items by durable value', () => {
		const emoji = iconPickerModel({ items, value: { value: '✅' } })
		const source = iconPickerModel({
			items,
			value: { source: 'tabler', id: 'home' },
		})

		expect(emoji.selectedItem?.label).toBe('Check')
		expect(source.selectedItem?.label).toBe('Home')
		expect(source.isSelected(items[1]!)).toBe(true)
		expect(source.isSelected(items[2]!)).toBe(false)
	})

	it('compares values by type-specific identity', () => {
		const emoji: IconPickerValue = { value: '✅' }
		const tablerHome: IconPickerValue = { source: 'tabler', id: 'home' }
		const lucideHome: IconPickerValue = { source: 'lucide', id: 'home' }

		expect(iconPickerValueEquals(emoji, { value: '✅' })).toBe(true)
		expect(iconPickerValueEquals(emoji, { source: 'emoji', id: '✅' })).toBe(false)
		expect(iconPickerValueEquals(tablerHome, { source: 'tabler', id: 'home' })).toBe(true)
		expect(iconPickerValueEquals(tablerHome, lucideHome)).toBe(false)
	})

	it('calls query and selection callbacks with typed values', () => {
		const onQueryChange = vi.fn()
		const onChange = vi.fn()
		const props = { items, query: '', onQueryChange, onChange }
		const model = iconPickerModel(props)
		const input = document.createElement('input')
		input.value = 'star'

		model.queryInput.onInput?.({ target: input } as unknown as Event)
		model.select(items[2]!)

		expect(onQueryChange).toHaveBeenCalledWith('star')
		expect(onChange).toHaveBeenCalledWith({ source: 'lucide', id: 'search' }, items[2])
	})

	it('updates local query and value when callbacks are not provided', () => {
		const props = { items, query: '', value: undefined as IconPickerValue | undefined }
		const model = iconPickerModel(props)
		const input = document.createElement('input')
		input.value = 'home'

		model.queryInput.onInput?.({ target: input } as unknown as Event)
		model.select(items[1]!)

		expect(props.query).toBe('home')
		expect(props.value).toEqual({ source: 'tabler', id: 'home' })
	})

	it('ships a common emoji catalog', () => {
		expect(
			commonEmojiIconItems.some((item) => 'value' in item.value && item.value.value === '⭐')
		).toBe(true)
	})
})

type IconPickerInputAttrs = JSX.BaseHTMLAttributes<HTMLInputElement> & JSX.InputString

export type IconPickerValue = { value: string } | { source: string; id: string }

export type IconPickerItem = {
	value: IconPickerValue
	label: string
	keywords?: readonly string[]
	group?: string
	preview?: string | JSX.Element | (() => JSX.Element)
}

export type IconPickerProps = {
	items: readonly IconPickerItem[]
	value?: IconPickerValue
	query?: string
	onQueryChange?: (query: string) => void
	onChange?: (value: IconPickerValue, item: IconPickerItem) => void
}

export type IconPickerModel = {
	readonly query: string
	readonly filteredItems: readonly IconPickerItem[]
	readonly selectedItem: IconPickerItem | undefined
	readonly queryInput: IconPickerInputAttrs
	readonly listbox: JSX.IntrinsicElements['div'] & { readonly role: 'listbox' }
	itemButton(item: IconPickerItem): JSX.IntrinsicElements['button'] & {
		readonly role: 'option'
		readonly 'aria-selected': 'true' | 'false'
	}
	isSelected(item: IconPickerItem): boolean
	select(item: IconPickerItem): void
}

export const commonEmojiIconItems: readonly IconPickerItem[] = [
	{ value: { value: '✅' }, label: 'Check', keywords: ['done', 'ok', 'yes'] },
	{ value: { value: '⭐' }, label: 'Star', keywords: ['favorite', 'rating'] },
	{ value: { value: '❤️' }, label: 'Heart', keywords: ['love', 'like'] },
	{ value: { value: '⚠️' }, label: 'Warning', keywords: ['alert', 'caution'] },
	{ value: { value: 'ℹ️' }, label: 'Info', keywords: ['information', 'help'] },
	{ value: { value: '🔍' }, label: 'Search', keywords: ['find', 'lookup'] },
	{ value: { value: '⚙️' }, label: 'Settings', keywords: ['gear', 'config'] },
	{ value: { value: '📁' }, label: 'Folder', keywords: ['directory', 'files'] },
	{ value: { value: '📄' }, label: 'Document', keywords: ['file', 'page'] },
	{ value: { value: '🔒' }, label: 'Lock', keywords: ['secure', 'private'] },
	{ value: { value: '🚀' }, label: 'Rocket', keywords: ['launch', 'ship'] },
	{ value: { value: '💡' }, label: 'Idea', keywords: ['light', 'bulb'] },
]

export function isSourceIconPickerValue(
	value: IconPickerValue
): value is { source: string; id: string } {
	return 'source' in value
}

export function iconPickerValueEquals(
	left: IconPickerValue | undefined,
	right: IconPickerValue | undefined
): boolean {
	if (!left || !right) return left === right
	if (isSourceIconPickerValue(left) || isSourceIconPickerValue(right)) {
		return (
			isSourceIconPickerValue(left) &&
			isSourceIconPickerValue(right) &&
			left.source === right.source &&
			left.id === right.id
		)
	}
	return left.value === right.value
}

function normalize(value: string): string {
	return value.trim().toLowerCase()
}

function queryTerms(query: string): string[] {
	return normalize(query)
		.split(/\s+/)
		.filter((term) => term.length > 0)
}

function searchableText(item: IconPickerItem): string {
	const valueParts = isSourceIconPickerValue(item.value)
		? [item.value.source, item.value.id]
		: [item.value.value]
	return [item.label, item.group, ...valueParts, ...(item.keywords ?? [])]
		.filter((part): part is string => typeof part === 'string' && part.length > 0)
		.join(' ')
		.toLowerCase()
}

function itemMatches(item: IconPickerItem, terms: readonly string[]): boolean {
	if (terms.length === 0) return true
	const haystack = searchableText(item)
	return terms.every((term) => haystack.includes(term))
}

function itemLabel(item: IconPickerItem): string {
	if (isSourceIconPickerValue(item.value))
		return `${item.label} (${item.value.source}/${item.value.id})`
	return `${item.label} (${item.value.value})`
}

export function iconPickerModel(props: IconPickerProps): IconPickerModel {
	const model: IconPickerModel = {
		get query() {
			return props.query ?? ''
		},
		get filteredItems() {
			const terms = queryTerms(model.query)
			return props.items.filter((item) => itemMatches(item, terms))
		},
		get selectedItem() {
			return props.items.find((item) => iconPickerValueEquals(item.value, props.value))
		},
		get queryInput() {
			return {
				type: 'search',
				value: model.query,
				'aria-label': 'Filter icons',
				autocomplete: 'off',
				get onInput() {
					return (event: Event) => {
						if (!(event.target instanceof HTMLInputElement)) return
						if (props.onQueryChange) props.onQueryChange(event.target.value)
						else props.query = event.target.value
					}
				},
			}
		},
		get listbox() {
			return {
				role: 'listbox' as const,
				'aria-label': 'Icons',
			}
		},
		itemButton(item) {
			return {
				type: 'button',
				role: 'option' as const,
				get 'aria-selected'() {
					return model.isSelected(item) ? 'true' : ('false' as 'true' | 'false')
				},
				'aria-label': itemLabel(item),
				onClick: () => model.select(item),
			}
		},
		isSelected(item) {
			return iconPickerValueEquals(item.value, props.value)
		},
		select(item) {
			if (!props.onChange) props.value = item.value
			props.onChange?.(item.value, item)
		},
	}
	return model
}

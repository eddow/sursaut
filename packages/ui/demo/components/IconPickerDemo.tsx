import {
	commonEmojiIconItems,
	type IconPickerItem,
	type IconPickerValue,
	iconPickerModel,
	isSourceIconPickerValue,
} from '@sursaut/ui'
import { reactive } from 'mutts'

const sourceIconItems: readonly IconPickerItem[] = [
	{
		value: { source: 'tabler', id: 'home' },
		label: 'Home',
		group: 'Tabler',
		keywords: ['house', 'navigation', 'start'],
		preview: 'H',
	},
	{
		value: { source: 'tabler', id: 'star' },
		label: 'Star',
		group: 'Tabler',
		keywords: ['favorite', 'rating'],
		preview: 'S',
	},
	{
		value: { source: 'lucide', id: 'search' },
		label: 'Search',
		group: 'Lucide',
		keywords: ['find', 'lookup', 'magnifier'],
		preview: 'Q',
	},
	{
		value: { source: 'lucide', id: 'settings' },
		label: 'Settings',
		group: 'Lucide',
		keywords: ['gear', 'config'],
		preview: 'G',
	},
]

const items: readonly IconPickerItem[] = [...commonEmojiIconItems, ...sourceIconItems]

function valueText(value: IconPickerValue | undefined): string {
	if (!value) return '(none)'
	if (isSourceIconPickerValue(value)) return `{ source: "${value.source}", id: "${value.id}" }`
	return `{ value: "${value.value}" }`
}

function renderPreview(item: IconPickerItem): JSX.Element {
	const preview =
		typeof item.preview === 'function'
			? item.preview()
			: item.preview ?? (isSourceIconPickerValue(item.value) ? item.value.id.slice(0, 1) : item.value.value)
	if (typeof preview !== 'string') return preview
	if (!isSourceIconPickerValue(item.value)) return <span aria-hidden="true">{preview}</span>
	return (
		<span
			aria-hidden="true"
			style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:6px;background:#0f172a;border:1px solid #475569;color:#bfdbfe;font-weight:700;font-size:13px;"
		>
			{preview}
		</span>
	)
}

export default function IconPickerDemo() {
	const state = reactive({
		query: '',
		value: undefined as IconPickerValue | undefined,
	})
	const model = iconPickerModel({
		items,
		get query() {
			return state.query
		},
		onQueryChange(query) {
			state.query = query
		},
		get value() {
			return state.value
		},
		onChange(value) {
			state.value = value
		},
	})

	return (
		<div data-test="icon-picker-demo" style="padding: 20px; width: 100%;">
			<h2>Icon Picker</h2>
			<p style="color: #94a3b8; margin-bottom: 18px;">
				Filter app-provided emoji and source-library icon items.
			</p>

			<label style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;max-width:420px;">
				<span style="font-weight:600;">Filter</span>
				<input
					data-test="icon-picker-filter"
					{...model.queryInput}
					placeholder="Try star, lucide, warning, lookup..."
					style="padding:10px 12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#e2e8f0;"
				/>
			</label>

			<div
				data-test="icon-picker-list"
				{...model.listbox}
				style="display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px;margin-bottom:18px;"
			>
				<for each={model.filteredItems}>
					{(item) => {
						const button = model.itemButton(item)
						return (
							<button
								data-test={`icon-picker-item-${isSourceIconPickerValue(item.value) ? `${item.value.source}-${item.value.id}` : item.label.toLowerCase()}`}
								{...button}
								style={`display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;border:1px solid ${model.isSelected(item) ? '#60a5fa' : '#475569'};background:${model.isSelected(item) ? '#1d4ed8' : '#0f172a'};color:#e2e8f0;cursor:pointer;text-align:left;min-width:0;`}
							>
								<span
									style={`line-height:1;flex:0 0 auto;${isSourceIconPickerValue(item.value) ? 'font-size:24px;' : 'font-size:16px;width:32px;text-align:center;'}`}
								>
									{renderPreview(item)}
								</span>
								<span style="display:flex;flex-direction:column;min-width:0;">
									<span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
										{item.label}
									</span>
									<span style="font-size:12px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
										{isSourceIconPickerValue(item.value) ? item.value.source : 'emoji'}
									</span>
								</span>
							</button>
						)
					}}
				</for>
			</div>

			<div style="display:flex;flex-direction:column;gap:6px;">
				<strong>Selected</strong>
				<code
					data-test="icon-picker-selected"
					style="display:block;padding:10px;border-radius:8px;background:#0f172a;color:#bfdbfe;border:1px solid #334155;"
				>
					{valueText(state.value)}
				</code>
				<span data-test="icon-picker-count" style="color:#94a3b8;font-size:14px;">
					{model.filteredItems.length} result(s)
				</span>
			</div>
		</div>
	)
}

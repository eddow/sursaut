import {
	type IconPickerProps as BaseIconPickerProps,
	type IconPickerItem,
	type IconPickerValue,
	iconPickerModel,
	isSourceIconPickerValue,
} from '@sursaut/ui'
import {
	type ComboboxProps,
	comboboxModel,
	type MultiselectItemState,
	type MultiselectProps,
	multiselectModel,
	type SelectProps,
	selectModel,
} from '@sursaut/ui/models'
import { reactive } from 'mutts'

export function Select(props: SelectProps) {
	const model = selectModel(props)
	return (
		<select {...props.el} {...model.select} style={props.fullWidth ? 'width:100%' : undefined}>
			{model.options}
		</select>
	)
}

export function Combobox(props: ComboboxProps) {
	const model = comboboxModel(props)
	const {
		options: _,
		el: __,
		variant: ___,
		valid: ____,
		validationMessage: _____,
		disabled: ______,
		...inputProps
	} = props
	return (
		<div style="display:flex;flex-direction:column;gap:0.25rem">
			<input type="text" {...inputProps} {...props.el} {...model.input} />
			{model.dataList}
		</div>
	)
}

export type MultiselectAdapterProps<T> = Omit<MultiselectProps<T>, 'renderItem'> & {
	label?: JSX.Children
	renderItem?: MultiselectProps<T>['renderItem']
}

const defaultRenderItem = <T,>(item: T, checked: boolean) => (
	<span style="display:flex;gap:0.5rem;align-items:center">
		<span style={`opacity:${checked ? 1 : 0}`}>✓</span>
		<span>{String(item)}</span>
	</span>
)

export function Multiselect<T>(props: MultiselectAdapterProps<T>) {
	const modelProps: MultiselectProps<T> = {
		get items() {
			return props.items
		},
		get value() {
			return props.value
		},
		get equals() {
			return props.equals
		},
		get onChange() {
			return props.onChange
		},
		get closeOnSelect() {
			return props.closeOnSelect
		},
		get variant() {
			return props.variant
		},
		get renderItem() {
			return props.renderItem ?? defaultRenderItem
		},
	}
	const model = multiselectModel(modelProps)
	return (
		<details use:mount={model.onMount} {...model.details}>
			<summary {...model.summary}>{props.label}</summary>
			<ul style="list-style:none;padding:0.5rem;margin:0">
				<for each={model.items}>
					{(item: MultiselectItemState<T>) =>
						item.render() !== false && (
							<li {...item.el} style="cursor:pointer;padding:0.25rem 0.5rem">
								{item.render()}
							</li>
						)
					}
				</for>
			</ul>
		</details>
	)
}

export type IconPickerProps = Omit<BaseIconPickerProps, 'query' | 'onQueryChange'> & {
	label?: JSX.Children
	placeholder?: string
	emptyLabel?: JSX.Children
	el?: JSX.IntrinsicElements['details']
}

function iconValueLabel(value: IconPickerValue): string {
	return isSourceIconPickerValue(value) ? `${value.source}/${value.id}` : 'emoji'
}

function renderIconPreview(item: IconPickerItem): JSX.Element {
	const preview =
		typeof item.preview === 'function'
			? item.preview()
			: (item.preview ??
				(isSourceIconPickerValue(item.value) ? item.value.id.slice(0, 1) : item.value.value))
	if (typeof preview !== 'string') return preview
	if (!isSourceIconPickerValue(item.value)) {
		return <span aria-hidden="true">{preview}</span>
	}
	return (
		<span
			aria-hidden="true"
			style="display:inline-flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border-radius:0.35rem;border:1px solid var(--pico-muted-border-color);font-size:0.75rem;font-weight:700;text-transform:uppercase;"
		>
			{preview}
		</span>
	)
}

export function IconPicker(props: IconPickerProps) {
	const state = reactive({
		query: '',
		value: props.value,
	})
	const model = iconPickerModel({
		get items() {
			return props.items
		},
		get query() {
			return state.query
		},
		onQueryChange(query) {
			state.query = query
		},
		get value() {
			return props.onChange ? props.value : state.value
		},
		onChange(value: IconPickerValue, item: IconPickerItem) {
			state.value = value
			props.onChange?.(value, item)
		},
	})

	return (
		<details
			{...props.el}
			style={`position:relative;display:inline-block;max-width:100%;${props.el?.style ?? ''}`}
		>
			<summary
				role="button"
				style="display:inline-flex;align-items:center;gap:0.5rem;list-style:none;margin:0;cursor:pointer;max-width:100%;"
			>
				<span if={model.selectedItem} style="font-size:1.2rem;line-height:1;">
					{model.selectedItem ? renderIconPreview(model.selectedItem) : null}
				</span>
				<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
					{model.selectedItem?.label ?? props.label ?? 'Choose icon'}
				</span>
			</summary>
			<div style="position:absolute;top:calc(100% + 0.25rem);left:0;z-index:10;display:grid;gap:0.5rem;width:min(24rem,calc(100vw - 2rem));max-height:min(26rem,70vh);overflow:auto;padding:0.75rem;border:1px solid var(--pico-muted-border-color);border-radius:var(--pico-border-radius);background:var(--pico-background-color);box-shadow:var(--pico-card-box-shadow);">
				<input
					{...model.queryInput}
					placeholder={props.placeholder ?? 'Filter icons...'}
					style="margin:0;"
				/>
				<div
					{...model.listbox}
					style="display:grid;grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr));gap:0.35rem;"
				>
					<for each={model.filteredItems}>
						{(item) => {
							const button = model.itemButton(item)
							return (
								<button
									{...button}
									onClick={(event: MouseEvent) => {
										button.onClick?.(event)
										const details = (event.currentTarget as HTMLElement).closest('details')
										if (details) details.open = false
									}}
									class={model.isSelected(item) ? 'primary' : 'secondary outline'}
									style="display:flex;align-items:center;gap:0.5rem;margin:0;padding:0.45rem 0.55rem;text-align:start;min-width:0;"
								>
									<span
										style={`line-height:1;flex:0 0 auto;${isSourceIconPickerValue(item.value) ? 'font-size:1.25rem;' : 'font-size:1rem;width:1.75rem;text-align:center;'}`}
									>
										{renderIconPreview(item)}
									</span>
									<span style="display:flex;flex-direction:column;min-width:0;">
										<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
											{item.label}
										</span>
										<small style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--pico-muted-color);">
											{iconValueLabel(item.value)}
										</small>
									</span>
								</button>
							)
						}}
					</for>
					<p if={model.filteredItems.length === 0} style="margin:0;color:var(--pico-muted-color);">
						{props.emptyLabel ?? 'No icons found.'}
					</p>
				</div>
			</div>
		</details>
	)
}

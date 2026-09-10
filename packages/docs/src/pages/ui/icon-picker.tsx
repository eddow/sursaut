import { IconPicker, Inline, Stack } from '@sursaut'
import { commonEmojiIconItems, type IconPickerValue } from '@sursaut/ui/models'
import { reactive } from 'mutts'
import { ApiTable, Demo, Section } from '../../components'

const basicSource = `import { IconPicker, commonEmojiIconItems } from '@sursaut'

const state = reactive<{ value: IconPickerValue | undefined }>({ value: undefined })

<IconPicker
  items={commonEmojiIconItems}
  value={state.value}
  onChange={(value) => (state.value = value)}
  label="Choose icon"
/>`

function IconPickerDemo() {
	const state = reactive<{ value: IconPickerValue | undefined }>({ value: undefined })
	return (
		<Stack gap="md">
			<IconPicker
				items={commonEmojiIconItems}
				value={state.value}
				onChange={(value: IconPickerValue) => (state.value = value)}
				label="Choose icon"
				placeholder="Filter icons..."
			/>
			<Inline gap="sm">
				<span style="opacity: 0.6">
					Selected: {state.value ? JSON.stringify(state.value) : 'none'}
				</span>
			</Inline>
		</Stack>
	)
}

export default function IconPickerPage() {
	return (
		<article>
			<h1>IconPicker</h1>
			<p>
				Searchable icon dropdown. <code>iconPickerModel()</code> owns query filtering and selection;
				the adapter renders a <code>{'<details>'}</code> with a search input and a{' '}
				<code>role="listbox"</code> grid. Values are <code>{'{ value }'}</code> (emoji/literal) or{' '}
				<code>{'{ source, id }'}</code> (icon-set reference).
			</p>

			<Section title="Playground">
				<Demo title="IconPicker" source={basicSource} component={<IconPickerDemo />} />
			</Section>

			<Section title="API Reference">
				<ApiTable
					props={[
						{
							name: 'items',
							type: 'readonly IconPickerItem[]',
							description: 'All icons: value + label + optional keywords/group/preview',
							required: true,
						},
						{
							name: 'value',
							type: 'IconPickerValue | undefined',
							description: 'Selected value; compared with iconPickerValueEquals',
							required: false,
						},
						{
							name: 'onChange',
							type: '(value, item) => void',
							description: 'Called on select',
							required: false,
						},
						{
							name: 'label',
							type: 'JSX.Children',
							description: 'Summary label when nothing selected. Default: Choose icon',
							required: false,
						},
						{
							name: 'placeholder',
							type: 'string',
							description: 'Search input placeholder',
							required: false,
						},
						{
							name: 'commonEmojiIconItems',
							type: 'readonly IconPickerItem[]',
							description: 'Built-in emoji set for demos and fallbacks',
							required: false,
						},
					]}
				/>
			</Section>
		</article>
	)
}

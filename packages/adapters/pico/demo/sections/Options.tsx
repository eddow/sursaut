import { commonEmojiIconItems, type IconPickerItem, type IconPickerValue } from '@sursaut/ui'
import { reactive } from 'mutts'
import { Combobox, IconPicker, Multiselect, Select } from '../../src/components'
import { DemoCard, DemoGrid, DemoSection, DemoState } from './shared'

export function SelectFixture() {
	return (
		<Select
			options={['alpha', 'beta']}
			disabled
			el={{ disabled: false, 'data-testid': 'select' }}
		/>
	)
}

export function ComboboxFixture() {
	return (
		<Combobox options={['alpha', 'beta']} el={{ list: 'manual-list', 'data-testid': 'combobox' }} />
	)
}

const iconItems: readonly IconPickerItem[] = [
	...commonEmojiIconItems,
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
]

const techItems = ['TypeScript', 'Sursaut', 'PicoCSS', 'Vitest']

function iconValueText(value: IconPickerValue | undefined): string {
	if (!value) return 'none'
	return 'source' in value ? `${value.source}/${value.id}` : value.value
}

export function IconPickerFixture() {
	return (
		<IconPicker
			items={iconItems}
			value={{ value: '⭐' }}
			el={{ 'data-testid': 'icon-picker' }}
		/>
	)
}

export default function OptionsSection() {
	const state = reactive({
		selectValue: 'beta',
		comboValue: 'alpha',
		items: new Set(['TypeScript', 'Sursaut']),
		icon: { value: '⭐' } as IconPickerValue,
	})

	return (
		<DemoSection
			title="Options"
			description="Select, combobox and multiselect grouped around generated list wiring and reactive selection state."
		>
			<DemoGrid>
				<DemoCard title="Select" footer={<DemoState label="Value" value={state.selectValue} />}>
					<Select
						options={['alpha', 'beta', 'gamma']}
						value={state.selectValue}
						onInput={(value: string) => {
							state.selectValue = value
						}}
					/>
				</DemoCard>
				<DemoCard title="Combobox" footer={<DemoState label="Typed" value={state.comboValue} />}>
					<Combobox
						options={['alpha', 'beta', 'gamma']}
						value={state.comboValue}
						onInput={(e: Event) => {
							if (e.target instanceof HTMLInputElement) state.comboValue = e.target.value
						}}
					/>
				</DemoCard>
				<DemoCard
					title="Multiselect"
					footer={<DemoState label="Chosen" value={Array.from(state.items).join(', ')} />}
				>
					<Multiselect<string>
						label="Tech stack"
						items={techItems}
						value={state.items}
						onChange={(value: Set<string>) => {
							state.items = value
						}}
						closeOnSelect={false}
					/>
				</DemoCard>
				<DemoCard title="Icon picker" footer={<DemoState label="Chosen" value={iconValueText(state.icon)} />}>
					<IconPicker
						label="Choose icon"
						items={iconItems}
						value={state.icon}
						onChange={(value: IconPickerValue) => {
							state.icon = value
						}}
					/>
				</DemoCard>
			</DemoGrid>
		</DemoSection>
	)
}

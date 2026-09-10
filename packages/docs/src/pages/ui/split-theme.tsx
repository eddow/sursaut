import { SplitButton, SplitRadioButton, ThemeToggle } from '@sursaut'
import { reactive } from 'mutts'
import { ApiTable, Code, Demo, Section } from '../../components'

const splitSource = `<SplitButton
  items={[
    { value: 'save', label: 'Save' },
    { value: 'save-as', label: 'Save as...' },
  ]}
  value={state.action}
  onValueChange={(v) => (state.action = v)}
>
  {state.action ?? 'Choose'}
</SplitButton>`

const radioSource = `<SplitRadioButton
  items={[
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
  ]}
  value={state.view}
  group={state.picked}
  onValueChange={(v) => (state.view = v)}
/>`

const toggleSource = `import { ThemeToggle } from '@sursaut'

const settings = reactive({ theme: 'auto' as const })

<DisplayProvider theme={settings.theme}>
  <ThemeToggle settings={settings} />
</DisplayProvider>`

function SplitDemo() {
	const state = reactive<{ action: string | undefined }>({ action: 'save' })
	return (
		<SplitButton
			items={[
				{ value: 'save', label: 'Save' },
				{ value: 'save-as', label: 'Save as...' },
			]}
			value={state.action}
			onValueChange={(v: string) => (state.action = v)}
		>
			{state.action ?? 'Choose'}
		</SplitButton>
	)
}

function SplitRadioDemo() {
	const state = reactive<{ view: string | undefined; picked: string | undefined }>({
		view: 'day',
		picked: 'day',
	})
	return (
		<SplitRadioButton
			items={[
				{ value: 'day', label: 'Day' },
				{ value: 'week', label: 'Week' },
			]}
			value={state.view}
			group={state.picked}
			onValueChange={(v: string) => (state.view = v)}
		/>
	)
}

function ToggleDemo() {
	const settings = reactive({ theme: 'auto' as const })
	return <ThemeToggle settings={settings} simple />
}

export default function SplitThemePage() {
	return (
		<article>
			<h1>SplitButton, SplitRadioButton, ThemeToggle</h1>
			<p>
				Compound buttons with a main action plus a menu trigger, and the theme switcher that mutates
				a reactive <code>{'{ theme }'}</code> object owned by you.
			</p>

			<Section title="SplitButton">
				<p>
					<code>splitButtonModel()</code> resolves <code>selected</code> from <code>value</code>,
					exposes <code>button</code> / <code>trigger</code> / <code>menu</code> /{' '}
					<code>items</code> spreadables plus <code>toggleMenu</code> / <code>closeMenu</code> /{' '}
					<code>clickSelected</code>. The adapter renders main + trigger joined (default) or
					separate.
				</p>
				<Demo title="SplitButton" source={splitSource} component={<SplitDemo />} />
			</Section>

			<Section title="SplitRadioButton">
				<p>
					Same shape with <code>role="radio"</code> semantics: <code>checked</code> derives from{' '}
					<code>group === selected.value</code>, menu items are <code>role="menuitemradio"</code>.
				</p>
				<Demo title="SplitRadioButton" source={radioSource} component={<SplitRadioDemo />} />
			</Section>

			<Section title="ThemeToggle">
				<p>
					Cycles <code>auto → light → dark → auto</code> by mutating <code>settings.theme</code>.
					Pair with <code>DisplayProvider</code> (kit), which owns the <code>data-theme</code> DOM
					attribute. <code>simple</code> hides the Auto dropdown.
				</p>
				<Demo title="ThemeToggle" source={toggleSource} component={<ToggleDemo />} />
			</Section>

			<Section title="API Reference">
				<ApiTable
					props={[
						{
							name: 'items',
							type: 'readonly { value, label?, disabled? }[]',
							description: 'Menu items; selected resolved by value match',
							required: true,
						},
						{
							name: 'value',
							type: 'Value | undefined',
							description: 'Selected item value',
							required: false,
						},
						{
							name: 'group',
							type: 'Value | undefined',
							description: 'SplitRadioButton only: checked = group === selected.value',
							required: false,
						},
						{
							name: 'onValueChange',
							type: '(value: Value) => void',
							description: 'Called on item activation',
							required: false,
						},
						{
							name: 'settings',
							type: '{ theme: ThemeValue }',
							description: 'ThemeToggle: reactive object mutated on user action',
							required: true,
						},
						{
							name: 'simple',
							type: 'boolean',
							description: 'ThemeToggle: light/dark only, no Auto dropdown',
							required: false,
						},
						{
							name: 'variant / outline',
							type: 'PicoVariant / boolean',
							description: 'Adapter visual props (pico)',
							required: false,
						},
					]}
				/>
				<p>
					Full model surface: <code>Select</code> via <code>selectModel()</code> (
					<code>select</code> + <code>options</code>), <code>Combobox</code> via{' '}
					<code>comboboxModel()</code> (<code>input.list</code> + <code>dataList</code>),{' '}
					<code>Multiselect</code> via <code>multiselectModel()</code> (<code>details</code>/
					<code>summary</code>/<code>onMount</code> + per-item <code>toggle</code>). See{' '}
					<code>/ui/forms</code> for live demos.
				</p>
				<Code code={`import { Select, Combobox, Multiselect } from '@sursaut'`} lang="tsx" />
			</Section>
		</article>
	)
}

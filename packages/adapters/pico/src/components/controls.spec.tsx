import { document, latch } from '@sursaut/core'
import { arranged } from '@sursaut/ui'
import { reactive } from 'mutts'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	CheckboxFixture,
	ProgressFixture,
	RadioFixture,
	SwitchFixture,
} from '../../demo/sections/FormControls'
import { ButtonGroup } from './button-group'
import { RadioButton } from './radiobutton'
import { SplitRadioButton } from './split-radio-button'
import { SplitButton } from './splitbutton'

function VerticalScope(props: { children?: JSX.Children }, scope: Record<string, unknown>) {
	arranged(scope, { orientation: 'vertical', density: 'compact' })
	return props.children
}

describe('control components', () => {
	let container: HTMLElement
	let stop: (() => void) | undefined

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
	})

	afterEach(() => {
		stop?.()
		stop = undefined
		container.remove()
		document.body.innerHTML = ''
	})

	it('keeps model-owned checkbox attributes over passthrough element props', () => {
		stop = latch(container, <CheckboxFixture />)

		const input = container.querySelector('[data-testid="checkbox"]') as HTMLInputElement
		expect(input.checked).toBe(true)
		expect(input.disabled).toBe(true)
	})

	it('keeps model-owned switch attributes over passthrough element props', () => {
		stop = latch(container, <SwitchFixture />)

		const input = container.querySelector('[data-testid="switch"]') as HTMLInputElement
		expect(input.getAttribute('role')).toBe('switch')
		expect(input.getAttribute('aria-checked')).not.toBe('false')
	})

	it('keeps model-owned radio attributes over passthrough element props', () => {
		stop = latch(container, <RadioFixture />)

		const input = container.querySelector('[data-testid="radio"]') as HTMLInputElement
		expect(input.checked).toBe(true)
		expect(input.disabled).toBe(true)
		expect(input.name).toBe('color')
	})

	it('updates selected styling when RadioButton group is bound directly to reactive state', () => {
		const state = reactive({ current: 'one' })

		stop = latch(
			container,
			<div>
				<RadioButton value="one" group={state.current} aria-label="One">
					One
				</RadioButton>
				<RadioButton value="two" group={state.current} aria-label="Two">
					Two
				</RadioButton>
			</div>
		)

		const buttons = container.querySelectorAll('button')
		const first = buttons[0] as HTMLButtonElement
		const second = buttons[1] as HTMLButtonElement

		expect(first.className).not.toContain('outline')
		expect(second.className).toContain('outline')

		second.click()

		expect(state.current).toBe('two')
		expect(first.className).toContain('outline')
		expect(second.className).not.toContain('outline')
	})

	it('opens and renders split button menu items', () => {
		stop = latch(
			container,
			<SplitButton
				value="save"
				items={[
					{ value: 'save', label: 'Save' },
					{ value: 'share', label: 'Share' },
				]}
			>
				Action
			</SplitButton>
		)

		const buttons = container.querySelectorAll('button')
		const trigger = buttons[1] as HTMLButtonElement

		trigger.click()

		const menuButtons = Array.from(container.querySelectorAll('button')).slice(2)
		expect(menuButtons).toHaveLength(2)
		expect(menuButtons[0]?.textContent).toContain('Save')
		expect(menuButtons[1]?.textContent).toContain('Share')
	})

	it('inherits arranged orientation in grouped controls', () => {
		stop = latch(
			container,
			<VerticalScope>
				<div>
					<ButtonGroup>
						<button type="button">One</button>
						<button type="button">Two</button>
					</ButtonGroup>
					<SplitButton
						value="save"
						items={[
							{ value: 'save', label: 'Save' },
							{ value: 'share', label: 'Share' },
						]}
					>
						Action
					</SplitButton>
				</div>
			</VerticalScope>
		)

		const group = container.querySelector('[role="group"]') as HTMLDivElement
		const split = Array.from(container.querySelectorAll('div')).find((element) =>
			element.className.includes('joined-true')
		) as HTMLDivElement | undefined

		expect(group.className).toContain('orientation-vertical')
		expect(group.style.flexDirection).toBe('column')
		expect(split?.className).toContain('orientation-vertical')
	})

	it('updates split radio checked styling from external group state without changing selected label', () => {
		const state = reactive({
			selected: 'light',
			group: 'light',
		})
		stop = latch(
			container,
			<SplitRadioButton
				value={state.selected}
				group={state.group}
				items={[
					{ value: 'light', label: 'Light' },
					{ value: 'dark', label: 'Dark' },
				]}
			>
				Theme
			</SplitRadioButton>
		)

		const buttons = container.querySelectorAll('button')
		const main = buttons[0] as HTMLButtonElement
		expect(main.className).not.toContain('outline')
		expect(main.textContent).toContain('Light')

		state.group = 'dark'

		expect(main.className).toContain('outline')
		expect(main.textContent).toContain('Light')
	})

	it('keeps model-owned progress attributes over passthrough element props', () => {
		stop = latch(container, <ProgressFixture />)

		const progress = container.querySelector('[data-testid="progress"]') as HTMLProgressElement
		expect(progress.value).toBe(40)
		expect(progress.max).toBe(100)
		expect(progress.getAttribute('role')).toBe('progressbar')
	})
})

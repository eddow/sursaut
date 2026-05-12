import { document, latch } from '@sursaut/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import OptionsSection, {
	ComboboxFixture,
	IconPickerFixture,
	SelectFixture,
} from '../../demo/sections/Options'

describe('options components', () => {
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

	it('keeps model-owned select attributes over passthrough element props', () => {
		stop = latch(container, <SelectFixture />)

		const select = container.querySelector('[data-testid="select"]') as HTMLSelectElement
		expect(select.disabled).toBe(true)
	})

	it('keeps the combobox generated list attribute over passthrough element props', () => {
		stop = latch(container, <ComboboxFixture />)

		const input = container.querySelector('[data-testid="combobox"]') as HTMLInputElement
		const list = input.getAttribute('list')
		expect(list).toBeTruthy()
		expect(list).not.toBe('manual-list')

		const datalist = container.querySelector('datalist') as HTMLDataListElement
		expect(datalist.id).toBe(list)
	})

	it('renders multiselect checkmarks and updates selection after clicking an option', () => {
		stop = latch(container, <OptionsSection />)

		const summary = Array.from(container.querySelectorAll('summary')).find(
			(el) => el.textContent?.trim() === 'Tech stack'
		) as HTMLElement
		expect(summary).toBeTruthy()

		summary.click()

		const rows = Array.from(container.querySelectorAll('li'))
		expect(rows.length).toBeGreaterThan(0)

		const typeScriptRow = rows.find((row) =>
			row.textContent?.includes('TypeScript')
		) as HTMLLIElement
		const vitestRow = rows.find((row) => row.textContent?.includes('Vitest')) as HTMLLIElement
		expect(typeScriptRow).toBeTruthy()
		expect(vitestRow).toBeTruthy()

		const typeScriptCheck = Array.from(typeScriptRow.querySelectorAll('span')).find(
			(span) => span.textContent === '✓'
		) as HTMLSpanElement
		const vitestCheck = Array.from(vitestRow.querySelectorAll('span')).find(
			(span) => span.textContent === '✓'
		) as HTMLSpanElement

		expect(typeScriptCheck).toBeTruthy()
		expect(typeScriptCheck.style.opacity).toBe('1')
		expect(vitestCheck).toBeTruthy()
		expect(vitestCheck.style.opacity).toBe('0')

		vitestRow.click()

		const updatedVitestRow = Array.from(container.querySelectorAll('li')).find((row) =>
			row.textContent?.includes('Vitest')
		) as HTMLLIElement
		const updatedVitestCheck = Array.from(updatedVitestRow.querySelectorAll('span')).find(
			(span) => span.textContent === '✓'
		) as HTMLSpanElement
		expect(updatedVitestCheck.style.opacity).toBe('1')
		const chosen = container.textContent ?? ''
		expect(chosen).toContain('TypeScript, Sursaut, Vitest')
	})

	it('renders icon picker as a choose button with a filterable selection panel', () => {
		stop = latch(container, <IconPickerFixture />)

		const picker = container.querySelector('[data-testid="icon-picker"]') as HTMLDetailsElement
		const summary = picker.querySelector('summary') as HTMLElement
		expect(summary.textContent).toContain('Star')

		summary.click()

		const input = picker.querySelector('input') as HTMLInputElement
		expect(input.type).toBe('search')
		input.value = 'lucide lookup'
		input.dispatchEvent(new Event('input', { bubbles: true }))

		const buttons = Array.from(picker.querySelectorAll('button[role="option"]'))
		expect(buttons).toHaveLength(1)
		expect(buttons[0]?.textContent).toContain('Search')

		;(buttons[0] as HTMLButtonElement).click()

		expect(picker.open).toBe(false)
		expect(summary.textContent).toContain('Search')
	})
})

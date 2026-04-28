import { type Page, test, expect } from './test'

const dt = (page: Page, id: string) => page.locator(`[data-test="${id}"]`)

test.describe('Overlay / Dialog', () => {
	test('open and close via cancel and confirm actions', async ({ page }) => {
		await page.goto('/overlay')

		const open = dt(page, 'open-overlay')
		const dialog = dt(page, 'overlay-dialog')
		const dismiss = dt(page, 'dismiss-overlay')
		const confirm = dt(page, 'confirm-overlay')

		await open.click()
		await expect(dialog).toBeVisible()
		await expect(dt(page, 'overlay-message')).toContainText('Sursaut overlay stack')

		await dismiss.click()
		await expect(dialog).not.toBeVisible()
		await expect(dt(page, 'overlay-result')).toContainText('null')

		await open.click()
		await expect(dialog).toBeVisible()
		await confirm.click()
		await expect(dialog).not.toBeVisible()
		await expect(dt(page, 'overlay-result')).toContainText('ok')
	})

	test('traps focus, closes on Escape, and restores focus to trigger', async ({ page }) => {
		await page.goto('/overlay')
		const open = dt(page, 'open-overlay')
		await open.focus()
		await open.press('Enter')
		await expect(dt(page, 'overlay-dialog')).toBeVisible()
		await expect(dt(page, 'confirm-overlay')).toBeFocused()

		await page.keyboard.press('Tab')
		await expect(dt(page, 'dismiss-overlay')).toBeFocused()
		await page.keyboard.press('Tab')
		await expect(dt(page, 'confirm-overlay')).toBeFocused()

		await page.keyboard.press('Escape')
		await expect(dt(page, 'overlay-dialog')).not.toBeVisible()
		await expect(open).toBeFocused()
	})
})

test.describe('Drawer', () => {
	test('open from left/right and dismiss via button/backdrop', async ({ page }) => {
		await page.goto('/drawer')

		await dt(page, 'open-drawer-left').click()
		await expect(dt(page, 'drawer-panel')).toBeVisible()
		await expect(dt(page, 'drawer-title')).toContainText('left')
		await expect(dt(page, 'drawer-body')).toContainText('left')
		await dt(page, 'close-drawer').click()
		await expect(dt(page, 'drawer-panel')).not.toBeVisible()

		await dt(page, 'open-drawer-right').click()
		await expect(dt(page, 'drawer-panel')).toBeVisible()
		await expect(dt(page, 'drawer-title')).toContainText('right')
		await dt(page, 'drawer-backdrop').click({ position: { x: 5, y: 5 } })
		await expect(dt(page, 'drawer-panel')).not.toBeVisible()
	})

	test('traps focus within the drawer and restores trigger focus on close', async ({ page }) => {
		await page.goto('/drawer')
		const trigger = dt(page, 'open-drawer-left')
		await trigger.focus()
		await trigger.press('Enter')
		await expect(dt(page, 'drawer-panel')).toBeVisible()
		await expect(dt(page, 'drawer-secondary')).toBeFocused()

		await page.keyboard.press('Tab')
		await expect(dt(page, 'close-drawer')).toBeFocused()
		await page.keyboard.press('Tab')
		await expect(dt(page, 'drawer-secondary')).toBeFocused()

		await page.keyboard.press('Escape')
		await expect(dt(page, 'drawer-panel')).not.toBeVisible()
		await expect(trigger).toBeFocused()
	})
})

test.describe('Toast', () => {
	test('shows variant text and supports manual dismiss', async ({ page }) => {
		const pageErrors: string[] = []
		page.on('pageerror', (error) => pageErrors.push(error.message))

		await page.goto('/toast')

		await dt(page, 'toast-success').click()
		expect(pageErrors).toEqual([])
		await expect(dt(page, 'toast-item')).toBeVisible()
		await expect(dt(page, 'toast-item')).toHaveAttribute('data-variant', 'success')
		await expect(dt(page, 'toast-text')).toContainText('success notification')

		await dt(page, 'toast-dismiss').click()
		await expect(dt(page, 'toast-item')).not.toBeVisible()
	})

	test('auto-dismisses after duration', async ({ page }) => {
		const pageErrors: string[] = []
		page.on('pageerror', (error) => pageErrors.push(error.message))

		await page.goto('/toast')
		await dt(page, 'toast-warning').click()
		expect(pageErrors).toEqual([])
		await expect(dt(page, 'toast-item')).toBeVisible()
		await expect(dt(page, 'toast-item')).not.toBeVisible({ timeout: 6000 })
	})
})

test.describe('Accordion', () => {
	test('single-value group switches from first to second on header click', async ({ page }) => {
		await page.goto('/accordion')

		await expect(dt(page, 'accordion-single-a')).toHaveJSProperty('open', true)
		await expect(dt(page, 'accordion-single-b')).toHaveJSProperty('open', false)

		await dt(page, 'accordion-single-summary-b').click()

		await expect(dt(page, 'accordion-single-a')).toHaveJSProperty('open', false)
		await expect(dt(page, 'accordion-single-b')).toHaveJSProperty('open', true)
	})

	test('exclusive and multi-open behavior plus programmatic controls', async ({ page }) => {
		await page.goto('/accordion')

		await expect(dt(page, 'accordion-single-a')).toHaveJSProperty('open', true)
		await dt(page, 'accordion-single-summary-b').click()
		await expect(dt(page, 'accordion-single-b')).toHaveJSProperty('open', true)
		await expect(dt(page, 'accordion-single-a')).toHaveJSProperty('open', false)

		await dt(page, 'accordion-single-clear').click()
		await expect(dt(page, 'accordion-single-a')).toHaveJSProperty('open', false)
		await expect(dt(page, 'accordion-single-b')).toHaveJSProperty('open', false)

		await dt(page, 'accordion-multi-open-all').click()
		await expect(dt(page, 'accordion-multi-a')).toHaveJSProperty('open', true)
		await expect(dt(page, 'accordion-multi-b')).toHaveJSProperty('open', true)
		await expect(dt(page, 'accordion-multi-c')).toHaveJSProperty('open', true)

		await dt(page, 'accordion-multi-clear').click()
		await expect(dt(page, 'accordion-multi-a')).toHaveJSProperty('open', false)
		await expect(dt(page, 'accordion-multi-b')).toHaveJSProperty('open', false)
		await expect(dt(page, 'accordion-multi-c')).toHaveJSProperty('open', false)
	})
})

test.describe('Menu', () => {
	test('open/close and outside click dismiss', async ({ page }) => {
		await page.goto('/menu')
		await expect(dt(page, 'menu-summary')).toHaveAttribute('aria-haspopup', 'menu')
		await expect(dt(page, 'menu-summary')).toHaveAttribute('aria-expanded', 'false')
		await dt(page, 'menu-summary').click()
		await expect(dt(page, 'menu-root')).toHaveJSProperty('open', true)
		await expect(dt(page, 'menu-summary')).toHaveAttribute('aria-expanded', 'true')
		await expect(dt(page, 'menu-edit')).toBeVisible()

		await page.mouse.click(5, 5)
		await expect(dt(page, 'menu-root')).toHaveJSProperty('open', false)
	})

	test('supports keyboard navigation and Escape dismiss', async ({ page }) => {
		await page.goto('/menu')
		await dt(page, 'menu-summary').focus()
		await page.keyboard.press('ArrowDown')
		await expect(dt(page, 'menu-root')).toHaveJSProperty('open', true)
		await expect(dt(page, 'menu-edit')).toBeFocused()

		await page.keyboard.press('ArrowDown')
		await expect(dt(page, 'menu-settings')).toBeFocused()
		await page.keyboard.press('End')
		await expect(dt(page, 'menu-logout')).toBeFocused()
		await page.keyboard.press('Home')
		await expect(dt(page, 'menu-edit')).toBeFocused()

		await page.keyboard.press('Escape')
		await expect(dt(page, 'menu-root')).toHaveJSProperty('open', false)
		await expect(dt(page, 'menu-summary')).toBeFocused()
	})
})

test.describe('CheckButton', () => {
	test('standalone primitive toggles and updates aria/readouts', async ({ page }) => {
		await page.goto('/checkbutton')
		await expect(dt(page, 'checkbutton-demo')).toBeVisible()

		await expect(dt(page, 'wifi-toggle')).toHaveAttribute('aria-checked', 'true')
		await expect(dt(page, 'bluetooth-toggle')).toHaveAttribute('aria-checked', 'false')
		await expect(dt(page, 'wifi-state')).toContainText('on')
		await expect(dt(page, 'bluetooth-state')).toContainText('off')

		await dt(page, 'wifi-toggle').click()
		await expect(dt(page, 'wifi-toggle')).toHaveAttribute('aria-checked', 'false')
		await expect(dt(page, 'wifi-state')).toContainText('off')

		await dt(page, 'bluetooth-toggle').click()
		await expect(dt(page, 'bluetooth-toggle')).toHaveAttribute('aria-checked', 'true')
		await expect(dt(page, 'bluetooth-state')).toContainText('on')
	})
})

test.describe('MultiSelect', () => {
	test('renders without runtime errors and supports select/clear', async ({ page }) => {
		const pageErrors: string[] = []
		page.on('pageerror', (error) => pageErrors.push(error.message))

		await page.goto('/multiselect')
		await expect(dt(page, 'multiselect-demo')).toBeVisible()
		expect(pageErrors).toEqual([])

		await expect(dt(page, 'multiselect-item-js')).toHaveCSS('background-color', 'rgb(51, 65, 85)')
		await expect(dt(page, 'multiselect-item-ts')).toHaveCSS('background-color', 'rgb(51, 65, 85)')
		await expect(dt(page, 'multiselect-item-rs')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

		await expect(dt(page, 'multiselect-count')).toContainText('2 selected')
		await dt(page, 'multiselect-toggle').click()
		await dt(page, 'multiselect-item-rs').click()
		await expect(dt(page, 'multiselect-count')).toContainText('3 selected')
		await expect(dt(page, 'multiselect-item-rs')).toHaveCSS('background-color', 'rgb(51, 65, 85)')

		await dt(page, 'multiselect-item-js').click()
		await expect(dt(page, 'multiselect-count')).toContainText('2 selected')
		await expect(dt(page, 'multiselect-item-js')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
		await expect(dt(page, 'multiselect-item-ts')).toHaveCSS('background-color', 'rgb(51, 65, 85)')
		await expect(dt(page, 'multiselect-item-rs')).toHaveCSS('background-color', 'rgb(51, 65, 85)')

		await dt(page, 'multiselect-clear').click()
		await expect(dt(page, 'multiselect-count')).toContainText('0 selected')
		await expect(dt(page, 'multiselect-selected')).toContainText('None')
		await expect(dt(page, 'multiselect-item-ts')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
		await expect(dt(page, 'multiselect-item-rs')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
	})
})

test.describe('Stars', () => {
	test('renders without runtime errors and updates single/range values', async ({ page }) => {
		const pageErrors: string[] = []
		page.on('pageerror', (error) => pageErrors.push(error.message))

		await page.goto('/stars')
		await expect(dt(page, 'stars-demo')).toBeVisible()
		expect(pageErrors).toEqual([])

		await expect(dt(page, 'stars-single')).toBeVisible()
		await expect(dt(page, 'star-rating')).toHaveAttribute('data-value', '4')
		await dt(page, 'star-action-single-2').click()
		await expect(dt(page, 'star-rating')).toHaveAttribute('data-value', '2')

		await expect(dt(page, 'stars-range')).toBeVisible()
		await expect(dt(page, 'star-range')).toHaveAttribute('data-value', '2-4')
		await dt(page, 'star-action-range-7').click()
		await expect(dt(page, 'star-range')).toHaveAttribute('data-value', '2-7')
		await dt(page, 'star-action-collapse-7').click()
		await expect(dt(page, 'star-range')).toHaveAttribute('data-value', '7-7')
	})
})

test.describe('Progress', () => {
	test('value updates over time and indeterminate progress is present', async ({ page }) => {
		await page.goto('/progress')
		await expect(dt(page, 'progress-demo')).toBeVisible()

		const initial = await dt(page, 'progress-value').textContent()
		await page.waitForTimeout(250)
		const after = await dt(page, 'progress-value').textContent()
		expect(after).not.toBe(initial)

		const progressBars = page.locator('progress')
		await expect(progressBars).toHaveCount(2)
		await expect(progressBars.nth(1)).not.toHaveAttribute('value', /.+/)
	})
})

test.describe('Palette', () => {
	test('palette route mounts without runtime errors', async ({ page }) => {
		const pageErrors: string[] = []
		page.on('pageerror', (error) => {
			pageErrors.push(String(error))
		})

		await page.goto('/palette')
		await page.waitForTimeout(250)

		expect(pageErrors.some((error) => error.includes('Max effect chain reached'))).toBe(false)
		await expect(dt(page, 'palette-demo')).toBeVisible()
	})

	test('removing a keyword chip keeps toolbar propositions visible and refreshed', async ({ page }) => {
		await page.goto('/palette')
		await expect(dt(page, 'palette-demo')).toBeVisible()

		const input = page.locator('.palette-demo-command-input').first()
		const suggestions = page.locator('.palette-demo-command-suggestion')
		const chips = page.locator('.palette-demo-command-chip')
		const results = page.locator('.palette-demo-command-result')
		const resultsPanel = page.locator('.palette-demo-command-results').first()

		await input.click()
		await input.fill('li')
		await expect(suggestions).toHaveText(['light'])
		await expect(resultsPanel).toContainText('Set Theme to Light')

		await suggestions.first().click()
		await expect(chips).toHaveText(['light'])
		await expect(results).toHaveCount(1)

		await chips.first().click()
		await expect(chips).toHaveCount(0)
		await expect(suggestions).toHaveCount(0)
		await expect(resultsPanel).toContainText('Increase Font Size')
	})

	test('removing one of multiple keywords broadens toolbar propositions', async ({ page }) => {
		await page.goto('/palette')
		await expect(dt(page, 'palette-demo')).toBeVisible()

		const input = page.locator('.palette-demo-command-input').first()
		const suggestions = page.locator('.palette-demo-command-suggestion')
		const chips = page.locator('.palette-demo-command-chip')
		const resultsPanel = page.locator('.palette-demo-command-results').first()

		await input.click()
		await input.fill('inc')
		await expect(suggestions).toContainText(['increase'])
		await suggestions.filter({ hasText: 'increase' }).first().click()
		await expect(chips).toContainText(['increase'])

		await input.fill('font')
		await expect(suggestions).toContainText(['font'])
		await suggestions.filter({ hasText: 'font' }).first().click()
		await expect(chips).toContainText(['increase', 'Font Size'])
		await expect(resultsPanel).toContainText('Increase Font Size')

		await chips.filter({ hasText: 'Font Size' }).first().click()
		await expect(chips).toContainText(['increase'])
		await expect(resultsPanel).toContainText('Increase Font Size')
		await expect(resultsPanel).toContainText('Increase Playback Speed')
	})

	test('keyboard-only suggestion, selection, and escape flows remain observable', async ({ page }) => {
		await page.goto('/palette')
		await expect(dt(page, 'palette-demo')).toBeVisible()

		const input = page.locator('.palette-demo-command-input').first()
		const chips = page.locator('.palette-demo-command-chip')
		const resultsPanel = page.locator('.palette-demo-command-results').first()

		await input.click()
		await input.fill('da')
		await input.press('Tab')
		await expect(chips).toContainText(['dark'])

		await input.fill('theme')
		await input.press('ArrowDown')
		await input.press('Escape')
		await expect(input).toHaveValue('theme')
		await input.press('Escape')
		await expect(input).toHaveValue('')
		await expect(resultsPanel).not.toBeVisible()
	})
})

test.describe('DisplayContext', () => {
	test('updates theme setting and reflects locale/direction context', async ({ page }) => {
		await page.goto('/display-context')
		await expect(dt(page, 'themetoggle-demo')).toBeVisible()
		await expect(dt(page, 'setting-theme')).toContainText('auto')
		await expect(dt(page, 'dc-theme')).toContainText('light')
		await expect(dt(page, 'dc-direction')).toContainText('ltr')
		await expect(dt(page, 'dc-locale')).toContainText('en-US')
		await expect(dt(page, 'theme-preview')).toHaveCSS('background-color', 'rgb(226, 232, 240)')
		await expect(dt(page, 'intl-number')).toContainText('1,234,567.89')

		await dt(page, 'themetoggle-menu-toggle').click()
		await expect(dt(page, 'themetoggle-menu')).toBeVisible()
		await expect(dt(page, 'theme-option-dark')).toBeVisible()
		await expect(dt(page, 'theme-option-auto')).toBeVisible()
		await dt(page, 'theme-option-dark').click()
		await expect(dt(page, 'setting-theme')).toContainText('dark')
		await expect(dt(page, 'dc-theme')).toContainText('dark')
		await expect(dt(page, 'theme-preview')).toHaveCSS('background-color', 'rgb(2, 6, 23)')

		await dt(page, 'set-dir-rtl').click()
		await dt(page, 'set-locale-fr').click()
		await expect(dt(page, 'dc-direction')).toContainText('rtl')
		await expect(dt(page, 'dc-locale')).toContainText('fr-FR')
		await expect(dt(page, 'intl-number')).toContainText('1 234 567,89')
	})
})

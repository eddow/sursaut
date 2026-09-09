import { type Page, test, expect } from './test'

const dt = (page: Page, id: string) => page.locator(`[data-test="${id}"]`)
const tabOrder = (page: Page) =>
	page.locator('[data-test="dockview-shell"]').evaluate((shell) => {
		return Array.from(shell.querySelectorAll('.dv-tabs-container [data-test]'))
			.map((element) => element.getAttribute('data-test'))
			.filter(
				(value): value is string =>
					value !== null && /^dockview-tab-(counter|notes)-\d+$/.test(value)
			)
	})

test.describe('Dockview Demo', () => {
	test.beforeEach(async ({ page }) => {
		// Clear the demo's localStorage persistence for a deterministic start.
		await page.goto('/dockview')
		await page.evaluate(() => localStorage.removeItem('sursaut:dockview-demo'))
		await page.reload()
		await expect(dt(page, 'dockview-demo')).toBeVisible()
		await expect(dt(page, 'dockview-api-state')).toContainText('API: ready')
	})

	test('renders initial panels and shows correct panel count', async ({ page }) => {
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 2')
	})

	test('counter widget updates shared context badge in custom tab', async ({ page }) => {
		// Activate counter tab and increment
		const inc = dt(page, 'dockview-counter-inc-counter-1')
		await inc.click()

		// Badge in custom tab should reflect the new value
		const badge = dt(page, 'dockview-tab-badge-counter-1')
		await expect(badge).toContainText('2')

		await inc.click()
		await expect(badge).toContainText('3')
	})

	test('notes widget updates shared context badge with character count', async ({ page }) => {
		// Click notes tab to activate it
		const tabTitle = dt(page, 'dockview-tab-title-notes-1')
		await tabTitle.click()

		const input = dt(page, 'dockview-notes-input-notes-1')
		await input.fill('Hello')

		const badge = dt(page, 'dockview-tab-badge-notes-1')
		await expect(badge).toContainText('5')
	})

	test('add counter panel increases panel count', async ({ page }) => {
		await dt(page, 'dockview-add-counter').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 3')

		// New counter widget should be present
		await expect(dt(page, 'dockview-counter-counter-2')).toBeVisible()
	})

	test('add notes panel increases panel count', async ({ page }) => {
		await dt(page, 'dockview-add-notes').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 3')

		// New notes widget should be present
		await expect(dt(page, 'dockview-notes-notes-2')).toBeVisible()
	})

	test('close active panel decreases panel count', async ({ page }) => {
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 2')
		await dt(page, 'dockview-close-active').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 1')
	})

	test('close panel via custom tab close button', async ({ page }) => {
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 2')
		await dt(page, 'dockview-tab-close-counter-1').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 1')
	})

	test('rename tab from widget updates tab title', async ({ page }) => {
		const inc = dt(page, 'dockview-counter-inc-counter-1')
		await inc.click()

		const rename = dt(page, 'dockview-counter-rename-counter-1')
		await rename.click()

		const tabTitle = dt(page, 'dockview-tab-title-counter-1')
		await expect(tabTitle).toContainText('Counter 2')
	})

	test('split active panel into a new group and close group without runtime errors', async ({ page }) => {
		const pageErrors: string[] = []
		page.on('pageerror', (error) => pageErrors.push(error.message))

		await dt(page, 'dockview-split-active-right').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 3')
		await expect(dt(page, 'dockview-counter-counter-2')).toBeVisible()

		await dt(page, 'dockview-group-close-demo-group').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 1')
		await expect(dt(page, 'dockview-counter-counter-2')).toBeVisible()
		expect(pageErrors).toEqual([])
	})

	test('user can reorder tabs and restore the saved order', async ({ page }) => {
		expect(await tabOrder(page)).toEqual(['dockview-tab-counter-1', 'dockview-tab-notes-1'])

		await dt(page, 'dockview-tab-counter-1').dragTo(dt(page, 'dockview-tab-notes-1'))
		await expect.poll(() => tabOrder(page)).toEqual(['dockview-tab-notes-1', 'dockview-tab-counter-1'])

		await dt(page, 'dockview-save-layout').click()
		await expect(dt(page, 'dockview-saved-layout')).toContainText('notes-1')

		await dt(page, 'dockview-tab-notes-1').dragTo(dt(page, 'dockview-tab-counter-1'))
		await expect.poll(() => tabOrder(page)).toEqual(['dockview-tab-counter-1', 'dockview-tab-notes-1'])

		await dt(page, 'dockview-restore-layout').click()
		await expect(dt(page, 'dockview-api-state')).toContainText('API: ready')
		await expect.poll(() => tabOrder(page)).toEqual(['dockview-tab-notes-1', 'dockview-tab-counter-1'])
	})

	test('save and restore layout preserves panels', async ({ page }) => {
		// Save current layout
		await dt(page, 'dockview-save-layout').click()
		const saved = dt(page, 'dockview-saved-layout')
		await expect(saved).not.toContainText('Nothing saved yet.')

		// Add a panel then reset
		await dt(page, 'dockview-add-counter').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 3')

		// Restore should go back to saved state (2 panels)
		await dt(page, 'dockview-restore-layout').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 2')
	})

	test('reset layout restores default state', async ({ page }) => {
		// Close a panel first
		await dt(page, 'dockview-close-active').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 1')

		// Reset should restore both panels
		await dt(page, 'dockview-reset-layout').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 2')
	})

	test('watermark overlay opens a panel from the empty state', async ({ page }) => {
		// Close all panels via the active-close button until the watermark shows
		await dt(page, 'dockview-close-active').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 1')
		await dt(page, 'dockview-close-active').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 0')
		await expect(dt(page, 'dockview-watermark')).toBeVisible()

		await dt(page, 'dockview-watermark-open').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 1')
		await expect(dt(page, 'dockview-watermark')).toBeHidden()
	})

	test('events log records panel add and active changes', async ({ page }) => {
		await dt(page, 'dockview-add-counter').click()
		await expect(dt(page, 'dockview-event-log')).toContainText('added counter-')
		await expect(dt(page, 'dockview-active-panel-state')).toContainText('counter-')
	})

	test('theme switcher applies the selected dockview theme', async ({ page }) => {
		await dt(page, 'dockview-theme-light').click()
		await expect(dt(page, 'dockview-shell').locator('.dockview-theme-light')).toBeVisible()
		await dt(page, 'dockview-theme-abyss').click()
		await expect(dt(page, 'dockview-shell').locator('.dockview-theme-abyss')).toBeVisible()
	})

	test('floating panels update the floating count and dock back', async ({ page }) => {
		await dt(page, 'dockview-open-floating').click()
		await expect(dt(page, 'dockview-panel-count')).toContainText('Panels: 3')
		await expect(dt(page, 'dockview-floating-state')).toContainText('Floating: 1')

		await dt(page, 'dockview-dock-all').click()
		await expect(dt(page, 'dockview-floating-state')).toContainText('Floating: 0')
	})
})

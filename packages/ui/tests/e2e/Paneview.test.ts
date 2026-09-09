import { type Page, test, expect } from './test'

const dt = (page: Page, id: string) => page.locator(`[data-test="${id}"]`)

test.describe('Paneview Demo', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/paneview')
		await expect(dt(page, 'paneview-demo')).toBeVisible()
		await expect(dt(page, 'paneview-pane-count')).toContainText('panes: 2', {
			timeout: 15000,
		})
	})

	test('renders seeded panes with custom and default headers', async ({ page }) => {
		await expect(dt(page, 'paneview-pane-text').first()).toContainText('First pane')
		await expect(dt(page, 'paneview-header-Pane A')).toBeVisible()
	})

	test('add pane increases pane count', async ({ page }) => {
		await dt(page, 'paneview-add-pane').click()
		await expect(dt(page, 'paneview-pane-count')).toContainText('panes: 3')
	})

	test('collapse toggle flips the expanded state', async ({ page }) => {
		await expect(dt(page, 'paneview-pane-toggle-expanded').first()).toContainText('collapse')
		await dt(page, 'paneview-pane-toggle-expanded').first().click()
		await expect(dt(page, 'paneview-pane-toggle-expanded').first()).toContainText('expand')
	})

	test('move first pane to last', async ({ page }) => {
		const first = await dt(page, 'paneview-pane-text').first().textContent()
		await dt(page, 'paneview-move-first-last').click()
		const last = await dt(page, 'paneview-pane-text').last().textContent()
		expect(last).toBe(first)
	})
})

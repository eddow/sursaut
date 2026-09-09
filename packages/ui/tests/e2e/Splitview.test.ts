import { type Page, test, expect } from './test'

const dt = (page: Page, id: string) => page.locator(`[data-test="${id}"]`)

test.describe('Splitview Demo', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/splitview')
		await expect(dt(page, 'splitview-demo')).toBeVisible()
		await expect(dt(page, 'splitview-view-count')).toContainText('views: 2', {
			timeout: 15000,
		})
	})

	test('renders seeded panes and shows view count', async ({ page }) => {
		await expect(dt(page, 'splitview-pane-text').first()).toContainText('Left pane')
		await expect(dt(page, 'splitview-active-view')).toContainText('active:')
	})

	test('add pane increases view count', async ({ page }) => {
		await dt(page, 'splitview-add-pane').click()
		await expect(dt(page, 'splitview-view-count')).toContainText('views: 3')
	})

	test('orientation toggle flips the split direction', async ({ page }) => {
		await expect(dt(page, 'splitview-toggle-orientation')).toContainText('horizontal')
		await dt(page, 'splitview-toggle-orientation').click()
		await expect(dt(page, 'splitview-toggle-orientation')).toContainText('vertical')
	})

	test('move first pane to last', async ({ page }) => {
		const first = await dt(page, 'splitview-pane-text').first().textContent()
		await dt(page, 'splitview-move-first-last').click()
		const last = await dt(page, 'splitview-pane-text').last().textContent()
		expect(last).toBe(first)
	})
})

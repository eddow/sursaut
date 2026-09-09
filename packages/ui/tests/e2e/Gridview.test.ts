import { type Page, test, expect } from './test'

const dt = (page: Page, id: string) => page.locator(`[data-test="${id}"]`)

test.describe('Gridview Demo', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/gridview')
		await expect(dt(page, 'gridview-demo')).toBeVisible()
		await expect(dt(page, 'gridview-cell-count')).toContainText('cells: 4', {
			timeout: 15000,
		})
	})

	test('renders seeded cells and shows cell count', async ({ page }) => {
		await expect(dt(page, 'gridview-cell-text').first()).toContainText('Top-left cell')
		await expect(dt(page, 'gridview-active-panel')).toContainText('active:')
	})

	test('add cell increases cell count', async ({ page }) => {
		await dt(page, 'gridview-add-cell').click()
		await expect(dt(page, 'gridview-cell-count')).toContainText('cells: 5')
	})

	test('orientation toggle flips the split direction', async ({ page }) => {
		await expect(dt(page, 'gridview-toggle-orientation')).toContainText('horizontal')
		await dt(page, 'gridview-toggle-orientation').click()
		await expect(dt(page, 'gridview-toggle-orientation')).toContainText('vertical')
	})

	test('move first cell below last', async ({ page }) => {
		const first = await dt(page, 'gridview-cell-text').first().textContent()
		await dt(page, 'gridview-move-first-last').click()
		const last = await dt(page, 'gridview-cell-text').last().textContent()
		expect(last).toBe(first)
	})
})

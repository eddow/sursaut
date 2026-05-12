import { type Page, expect, test } from './test'

const dt = (page: Page, id: string) => page.locator(`[data-test="${id}"]`)

test.describe('Icon Picker Demo', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/icon-picker')
	})

	test('filters and selects emoji and source-library icons', async ({ page }) => {
		await expect(dt(page, 'icon-picker-count')).toContainText('16 result')

		await dt(page, 'icon-picker-filter').fill('warning')
		await expect(dt(page, 'icon-picker-count')).toContainText('1 result')
		await dt(page, 'icon-picker-item-warning').click()
		await expect(dt(page, 'icon-picker-selected')).toContainText('{ value: "⚠️" }')

		await dt(page, 'icon-picker-filter').fill('lucide lookup')
		await expect(dt(page, 'icon-picker-count')).toContainText('1 result')
		await dt(page, 'icon-picker-item-lucide-search').click()
		await expect(dt(page, 'icon-picker-selected')).toContainText(
			'{ source: "lucide", id: "search" }'
		)

		await dt(page, 'icon-picker-filter').fill('tabler')
		await expect(dt(page, 'icon-picker-count')).toContainText('2 result')
	})
})

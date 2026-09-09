import { type Page, test, expect } from './test'

const dt = (page: Page, id: string) => page.locator(`[data-test="${id}"]`)

test.describe('Declarative Demo', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/declarative')
		await expect(dt(page, 'declarative-demo')).toBeVisible()
		await expect(dt(page, 'declarative-panel-n').first()).toContainText('panel #1', {
			timeout: 15000,
		})
	})

	test('renders the declarative panel without a widgets prop', async ({ page }) => {
		await expect(dt(page, 'declarative-basic').first()).toBeVisible()
		await expect(dt(page, 'declarative-panel-n').first()).toContainText('panel #1')
	})

	test('add panel opens another declarative panel', async ({ page }) => {
		await dt(page, 'declarative-add-panel').click()
		await expect(dt(page, 'declarative-panel-n').last()).toContainText('panel #2')
	})
})

import { type Page, test, expect } from './test'

const dt = (page: Page, id: string) => page.locator(`[data-test="${id}"]`)

test.describe('sizeable directive', () => {
	test('handle is rendered and panel has sizeable class', async ({ page }) => {
		await page.goto('/sizeable')
		const panel = dt(page, 'sizeable-panel')
		const container = dt(page, 'sizeable-container')
		await expect(panel).toHaveClass(/sizeable/)
		await expect(container.locator('.sizeable-handle')).toBeVisible()
	})

	test('drag handle resizes the panel and writes back to state', async ({ page }) => {
		await page.goto('/sizeable')

		const widthDisplay = dt(page, 'sizeable-width')
		await expect(widthDisplay).toContainText('200px')

		const handle = dt(page, 'sizeable-container').locator('.sizeable-handle')
		const box = await handle.boundingBox()
		if (!box) throw new Error('handle not found')

		const startX = box.x + box.width / 2
		const startY = box.y + box.height / 2
		const dragDelta = 80

		await page.mouse.move(startX, startY)
		await page.mouse.down()
		await page.mouse.move(startX + dragDelta, startY, { steps: 10 })
		await page.mouse.up()

		await expect(widthDisplay).toContainText('280px')
	})
})

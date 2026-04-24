import { test, expect } from '@playwright/test'

test.describe('node.isConnected', () => {
	test.beforeEach(async ({ page }) => {
		page.on('console', (msg) => {
			console.log(`[BROWSER LOG]: ${msg.text()}`)
		})
		await page.goto('/#IsMounted')
		await expect(page.locator('#tests h2')).toContainText('node.isConnected Test')
	})

	test('tracks mounting and unmounting reactively', async ({ page }) => {
		const mountedCount = page.locator('#mounted-count')
		const unmountedCount = page.locator('#unmounted-count')
		const status = page.locator('#is-mounted-status')
		const toggleBtn = page.locator('#toggle-mount')
		const container = page.locator('#mount-container')

		await expect(status).toHaveText('Non-existent')
		await expect(mountedCount).toHaveText('0')
		await expect(unmountedCount).toHaveText('0')
		await expect(container.locator('#tracked-element')).toHaveCount(0)

		await toggleBtn.click()
		await expect(status).toHaveText('Yes')
		await expect(mountedCount).toHaveText('1')
		await expect(unmountedCount).toHaveText('1')
		await expect(container.locator('#tracked-element')).toBeVisible()

		await toggleBtn.click()
		await expect(status).toHaveText('Non-existent')
		await expect(mountedCount).toHaveText('1')
		await expect(unmountedCount).toHaveText('2')
		await expect(container.locator('#tracked-element')).toHaveCount(0)

		await toggleBtn.click()
		await expect(status).toHaveText('Yes')
		await expect(mountedCount).toHaveText('2')
		await expect(unmountedCount).toHaveText('3')
	})
})

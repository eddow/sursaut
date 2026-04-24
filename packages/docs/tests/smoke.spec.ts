import { expect, test } from '@playwright/test'

test.describe('docs site', () => {
	test('landing loads', async ({ page }) => {
		await page.goto('/')
		await expect(page.getByRole('heading', { name: 'Sursaut Docs' })).toBeVisible()
	})

	test('deep link and reload', async ({ page }) => {
		await page.goto('/getting-started')
		await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible()
		await page.reload()
		await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible()
	})

	test('in-app navigation', async ({ page }) => {
		await page.goto('/')
		await page.getByRole('link', { name: 'Start here' }).click()
		await expect(page).toHaveURL(/getting-started/)
	})
})

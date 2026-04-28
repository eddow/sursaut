import { type Page, test, expect } from './test'

const dt = (page: Page, id: string) => page.locator(`[data-test="${id}"]`)

function collectDockviewLogs(page: Page) {
	const logs: string[] = []
	const errors: string[] = []
	page.on('console', (msg) => {
		const text = msg.text()
		if (text.includes('DockviewRouterDemo')) logs.push(text)
	})
	page.on('pageerror', (err) => errors.push(err.message))
	return { logs, errors }
}

test.describe('DockviewRouter', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dockview-router/notes/1')
		await expect(dt(page, 'dockview-router-demo')).toBeVisible()
		await expect(dt(page, 'dockview-router-notes-1')).toBeVisible({ timeout: 5000 })
	})

	test('navigation opens a new tab without destroying the dockview', async ({ page }) => {
		const { logs, errors } = collectDockviewLogs(page)

		const initsBefore = logs.filter((l) => l.includes('init:start')).length
		const disposesBefore = logs.filter((l) => l.includes('dispose')).length

		await dt(page, 'dockview-router-demo').locator('a', { hasText: 'Open Counter 1' }).click()
		await expect(dt(page, 'dockview-router-counter-1')).toBeVisible({ timeout: 5000 })

		expect(logs.filter((l) => l.includes('init:start')).length).toBe(initsBefore)
		expect(logs.filter((l) => l.includes('dispose')).length).toBe(disposesBefore)
		expect(errors).toEqual([])
	})

	test('multiple navigations accumulate tabs', async ({ page }) => {
		const { errors } = collectDockviewLogs(page)
		const tabCount = () => page.locator('.dv-tabs-container .dv-tab').count()

		await expect.poll(tabCount, { timeout: 5000 }).toBe(1)

		await dt(page, 'dockview-router-demo').locator('a', { hasText: 'Open Counter 1' }).click()
		await expect.poll(tabCount, { timeout: 5000 }).toBe(2)

		await dt(page, 'dockview-router-demo').locator('a', { hasText: 'Open Counter 2' }).click()
		await expect.poll(tabCount, { timeout: 5000 }).toBe(3)

		await dt(page, 'dockview-router-demo').locator('a', { hasText: 'Open Counter 1' }).click()
		await expect.poll(tabCount, { timeout: 5000 }).toBe(3)
		await expect(dt(page, 'dockview-router-counter-1')).toBeVisible({ timeout: 5000 })

		expect(errors).toEqual([])
	})

	test('counter panel reactivity: increment button updates count', async ({ page }) => {
		const { errors } = collectDockviewLogs(page)

		await dt(page, 'dockview-router-demo').locator('a', { hasText: 'Open Counter 1' }).click()
		await expect(dt(page, 'dockview-router-counter-1')).toBeVisible({ timeout: 5000 })

		const inc = dt(page, 'dockview-router-counter-inc-1')
		await inc.click()
		await expect(dt(page, 'dockview-router-counter-1').locator('div').filter({ hasText: /^\d+$/ }).first()).toContainText('2', { timeout: 3000 })
		await inc.click()
		await expect(dt(page, 'dockview-router-counter-1').locator('div').filter({ hasText: /^\d+$/ }).first()).toContainText('3', { timeout: 3000 })

		expect(errors).toEqual([])
	})

	test('notes panel reactivity: typing updates character count', async ({ page }) => {
		const { errors } = collectDockviewLogs(page)

		const input = dt(page, 'dockview-router-notes-input-1')
		await input.fill('hello')
		await expect(dt(page, 'dockview-router-notes-1').locator('div').filter({ hasText: /Characters:/ })).toContainText('5', { timeout: 3000 })

		expect(errors).toEqual([])
	})

	test('cross-panel navigation works (notes opens sibling counter)', async ({ page }) => {
		const { errors } = collectDockviewLogs(page)
		const tabCount = () => page.locator('.dv-tabs-container .dv-tab').count()

		await dt(page, 'dockview-router-notes-input-1').click()
		await dt(page, `dockview-router-counter-open-notes-1`).click({ timeout: 1000 }).catch(() => {
			// Counter panel has this button, not notes - navigate to counter first
		})

		// Navigate to counter first, then use its cross-nav button
		await dt(page, 'dockview-router-demo').locator('a', { hasText: 'Open Counter 1' }).click()
		await expect(dt(page, 'dockview-router-counter-1')).toBeVisible({ timeout: 5000 })
		await expect.poll(tabCount, { timeout: 5000 }).toBe(2)

		await dt(page, 'dockview-router-counter-open-notes-1').click()
		await expect(dt(page, 'dockview-router-notes-1')).toBeVisible({ timeout: 5000 })
		await expect.poll(tabCount, { timeout: 5000 }).toBe(2)
		await expect(page.locator('.dv-tab.dv-active-tab')).toContainText('Notes 1')
		expect(errors).toEqual([])
	})

	test('panel crash surfaces an error and the dockview stays interactive', async ({ page }) => {
		const { errors } = collectDockviewLogs(page)
		const panelErrors: string[] = []
		page.on('console', (msg) => {
			const text = msg.text()
			if (msg.type() === 'error' && text.includes('[Dockview] Panel error')) panelErrors.push(text)
		})

		await dt(page, 'dockview-router-demo').locator('a', { hasText: 'Open Crash 1' }).click()
		await expect
			.poll(() => panelErrors.some((error) => error.includes('Crash route 1 crashed')), {
				timeout: 5000,
			})
			.toBe(true)

		await dt(page, 'dockview-router-demo').locator('a', { hasText: 'Open Notes 1' }).click()
		await expect(dt(page, 'dockview-router-notes-1')).toBeVisible({ timeout: 5000 })

		expect(errors).toEqual([])
	})
})

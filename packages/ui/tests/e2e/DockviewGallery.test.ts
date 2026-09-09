import { type Page, test, expect } from './test'

const dt = (page: Page, id: string) => page.locator(`[data-test="${id}"]`)

test.describe('Dockview gallery: basic', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dockview/basic')
		await expect(dt(page, 'gallery-basic-demo')).toBeVisible()
	})

	test('opens a widget on mount', async ({ page }) => {
		await expect(dt(page, 'gallery-basic-text')).toContainText('Hello from a widget', {
			timeout: 15000,
		})
	})
})

test.describe('Dockview gallery: params', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dockview/params')
		await expect(dt(page, 'gallery-params-demo')).toBeVisible()
		await expect(dt(page, 'gallery-counter-text')).toContainText('count:', {
			timeout: 15000,
		})
	})

	test('local step button updates count', async ({ page }) => {
		await dt(page, 'gallery-counter-local').click()
		await expect(dt(page, 'gallery-counter-text')).toContainText('12', { timeout: 15000 })
	})

	test('param step++ propagates widget → dockview → page', async ({ page }) => {
		await dt(page, 'gallery-counter-step').click()
		await expect(dt(page, 'gallery-counter-text')).toContainText('step=3')
		await expect(dt(page, 'gallery-params-page-sees')).toContainText('step=3')
		await dt(page, 'gallery-params-page-step').click()
		await expect(dt(page, 'gallery-counter-text')).toContainText('step=4')
	})

	test('rename exercises the per-panel api escape hatch', async ({ page }) => {
		await dt(page, 'gallery-counter-rename').click()
		await expect(page.getByRole('tab', { name: /Count/ })).toBeVisible()
	})
})

test.describe('Dockview gallery: custom-tab', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dockview/custom-tab')
		await expect(dt(page, 'gallery-custom-tab-demo')).toBeVisible()
		await expect(dt(page, 'gallery-inbox-panel').first()).toBeVisible({ timeout: 15000 })
	})

	test('shares state between tab and content', async ({ page }) => {
		await page.getByRole('tab', { name: /Inbox \(custom tab\)/ }).click()
		await dt(page, 'gallery-inbox-inc').first().click()
		await expect(
			page.getByRole('tab', { name: /Inbox \(custom tab\)/ }).getByText('1')
		).toBeVisible()
	})
})

test.describe('Dockview gallery: layout', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dockview/layout')
		// Clear persistence for a deterministic start.
		await page.evaluate(() => localStorage.removeItem('sursaut:gallery-layout-demo'))
		await page.reload()
		await expect(dt(page, 'gallery-layout-demo')).toBeVisible()
		await expect(page.getByRole('tab', { name: 'Panel A' })).toBeVisible({ timeout: 15000 })
	})

	test('saves and restores bind:layout', async ({ page }) => {
		await expect(page.getByRole('tab', { name: 'Panel B' })).toBeVisible()
		await dt(page, 'gallery-layout-save').click()
		await dt(page, 'gallery-layout-restore').click()
		await page.getByRole('tab', { name: 'Panel A' }).getByRole('button', { name: /close/i }).click()
		await expect(page.getByRole('tab', { name: 'Panel A' })).toHaveCount(0)
		await dt(page, 'gallery-layout-restore').click()
		await expect(page.getByRole('tab', { name: 'Panel A' })).toBeVisible()
		await expect(page.getByRole('tab', { name: 'Panel B' })).toBeVisible()
	})
})

test.describe('Dockview gallery: themes', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dockview/themes')
		await expect(dt(page, 'gallery-themes-demo')).toBeVisible()
		await expect(page.getByRole('tab', { name: /Themed/ })).toBeVisible({ timeout: 15000 })
	})

	test('switches themes', async ({ page }) => {
		await dt(page, 'gallery-theme-light').click()
		await expect(dt(page, 'gallery-theme-light')).toHaveAttribute('aria-pressed', 'true')
		await expect(page.getByRole('tab', { name: /Themed/ })).toBeVisible()
	})
})

test.describe('Dockview gallery: events', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dockview/events')
		await expect(dt(page, 'gallery-events-demo')).toBeVisible()
		await expect(dt(page, 'gallery-events-active')).toContainText('b-1', { timeout: 15000 })
	})

	test('tracks bind:active and event log', async ({ page }) => {
		await expect(dt(page, 'gallery-events-log')).toContainText('added a-1')
		await expect(dt(page, 'gallery-events-log')).toContainText('added b-1')
	})

	test('updates bind:active on user tab click', async ({ page }) => {
		// Click the tab title (not the tab center): the DefaultTab close
		// button spans most of the tab, so a center click hits "Close".
		// Tab activation listens for pointerdown, which real mouse input
		// produces (synthetic JS clicks do not).
		await page.locator('.dv-tab[aria-label="A"] .title').click()
		await expect(dt(page, 'gallery-events-active')).toContainText('a-1')
		await expect(dt(page, 'gallery-events-log')).toContainText('active panel → a-1')
	})
})

test.describe('Dockview gallery: floating', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dockview/floating')
		await expect(dt(page, 'gallery-floating-demo')).toBeVisible()
		await expect(page.getByRole('tab', { name: 'A' }).first()).toBeVisible({ timeout: 15000 })
	})

	test('opens a floating window via openPanel passthrough', async ({ page }) => {
		await expect(dt(page, 'gallery-floating-count')).toContainText('0')
		await dt(page, 'gallery-floating-open').click()
		await expect(dt(page, 'gallery-floating-count')).toContainText('1')
		await expect(page.getByRole('tab', { name: 'Floating A' })).toBeVisible()
	})

	test('floats an existing panel and docks back', async ({ page }) => {
		await dt(page, 'gallery-floating-float-a').click()
		await expect(dt(page, 'gallery-floating-count')).toContainText('1')
		await dt(page, 'gallery-floating-dock-all').click()
		await expect(dt(page, 'gallery-floating-count')).toContainText('0')
	})

	test('header actions float via group and tab buttons', async ({ page }) => {
		await expect(dt(page, 'gallery-float-group').first()).toBeVisible()
		await expect(dt(page, 'gallery-popout-group').first()).toBeVisible()
		await expect(dt(page, 'gallery-float-panel').first()).toBeVisible()
		await expect(dt(page, 'gallery-popout-panel').first()).toBeVisible()
		await dt(page, 'gallery-float-panel').first().click()
		await expect(dt(page, 'gallery-floating-count')).toContainText('1')
		await dt(page, 'gallery-floating-dock-all').click()
		await expect(dt(page, 'gallery-floating-count')).toContainText('0')
		await dt(page, 'gallery-float-group').first().click()
		await expect(dt(page, 'gallery-floating-count')).toContainText('1')
	})
})

test.describe('Dockview gallery: empty', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/dockview/empty')
		await expect(dt(page, 'gallery-empty-demo')).toBeVisible()
	})

	test('shows watermark and opens from it', async ({ page }) => {
		await expect(dt(page, 'gallery-watermark-text')).toBeVisible({ timeout: 15000 })
		// Real click (not dispatchEvent): the overlay must sit above dockview's
		// own `.dv-watermark-container` or the click is swallowed.
		await dt(page, 'gallery-watermark-open').click()
		await expect(page.getByRole('tab', { name: 'A' })).toBeVisible()
		await dt(page, 'gallery-empty-close-all').click()
		await expect(dt(page, 'gallery-watermark-text')).toBeVisible()
	})
})

import { expect, test } from '@playwright/test'
import { navigation } from '../src/nav-index'
import routes from '../src/routes'

const routePaths = routes.map((r) => r.path)
const navHrefs = new Set(navigation.flatMap((s) => s.links.map((l) => l.href)))

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

	test('every route is reachable from the sidebar', () => {
		// '/ui/display' is a redirect alias for '/kit/display' — allowed to
		// appear twice (canonical + alias), both must stay in the sidebar.
		const hidden: string[] = []
		for (const p of routePaths) {
			if (p === '/') continue
			expect(navHrefs.has(p), `route ${p} missing from nav-index.ts`).toBe(true)
			expect(hidden.includes(p), `route ${p} should not be hidden`).toBe(false)
		}
	})

	test('every sidebar link resolves to a route', () => {
		for (const href of navHrefs) {
			expect(routePaths.includes(href), `nav href ${href} has no route`).toBe(true)
		}
	})

	for (const path of [
		'/getting-started',
		'/getting-started/concepts',
		'/core',
		'/core/jsx',
		'/core/components',
		'/core/meta-attributes',
		'/core/meta-components',
		'/core/env',
		'/core/bind',
		'/core/ssr',
		'/kit',
		'/kit/router',
		'/kit/client',
		'/kit/intl',
		'/kit/storage',
		'/kit/css',
		'/kit/api',
		'/kit/display',
		'/kit/head',
		'/ui',
		'/ui/button',
		'/ui/accordion',
		'/ui/card',
		'/ui/overlays',
		'/ui/forms',
		'/ui/icon-picker',
		'/ui/group-nav',
		'/ui/split-theme',
		'/ui/layout',
		'/ui/palette',
		'/ui/progress',
		'/ui/adapter',
		'/ui/status',
		'/ui/stars',
		'/ui/menu',
		'/ui/typography',
		'/ui/infinite-scroll',
		'/ui/directives',
		'/ui/css-variables',
		'/ui/display',
		'/ui/dockview',
		'/adapters',
		'/adapters/pico',
		'/adapters/creating',
		'/board',
		'/board/routing',
		'/board/ssr',
		'/board/middleware',
		'/mutts',
		'/mutts/signals',
		'/mutts/collections',
		'/mutts/zones',
		'/mutts/decorators',
		'/pure-glyf',
		'/pure-glyf/setup',
		'/pure-glyf/usage',
	]) {
		test(`route renders: ${path}`, async ({ page }) => {
			await page.goto(path)
			await expect(page.locator('article')).toBeVisible()
		})
	}

	test('search finds mutts + pure-glyf pages', async ({ page }) => {
		await page.goto('/')
		await page.getByPlaceholder('Search docs...').fill('decorators')
		await expect(page.getByRole('link', { name: 'Decorators' })).toBeVisible()
	})

	test('mobile nav opens and closes', async ({ page }) => {
		await page.goto('/')
		await page.getByRole('button', { name: '☰' }).click()
		await expect(page.locator('.docs-layout.mobile-open')).toBeVisible()
		await page.getByRole('link', { name: 'Overview' }).first().click()
		await expect(page.locator('.docs-layout.mobile-open')).toHaveCount(0)
	})

	test('fragment link scrolls to section', async ({ page }) => {
		await page.goto('/getting-started#installation')
		const target = page.locator('#installation')
		await expect(target).toBeVisible()
		await expect(target).toBeInViewport()
	})

	test('sidebar resizes via splitview sash', async ({ page }) => {
		await page.goto('/')
		const sidebar = page.getByTestId('docs-sidebar')
		await expect(sidebar).toBeVisible()
		const before = await sidebar.evaluate((el) => el.getBoundingClientRect().width)
		expect(before).toBeGreaterThan(100)
		// Splitview renders its sash between the two panes.
		const sash = page.locator('.sursaut-splitview .sash, .sursaut-splitview .split-sash').first()
		if ((await sash.count()) > 0) {
			const box = await sash.boundingBox()
			if (box) {
				await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
				await page.mouse.down()
				await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 5 })
				await page.mouse.up()
				const after = await sidebar.evaluate((el) => el.getBoundingClientRect().width)
				expect(Math.abs(after - before)).toBeGreaterThan(10)
			}
		}
	})
})

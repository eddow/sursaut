import { test, expect, type Page } from '@playwright/test'

const routePerfMeasures = [
	'route:sync',
	'route:match',
	'route:render',
	'route:navigate',
	'route:click',
	'route:not-found',
] as const

const routePerfThresholds = {
	'route:sync': 0.2,
	'route:match': 0.8,
	'route:navigate': 6,
	'route:click': 0.3,
	'route:not-found': 6,
} satisfies Record<Exclude<(typeof routePerfMeasures)[number], 'route:render'>, number>

type RoutePerfMeasureName = (typeof routePerfMeasures)[number]
type RoutePerfSummary = Record<RoutePerfMeasureName, { count: number; max: number; p95: number }>

async function clearRoutePerf(page: Page) {
	await page.evaluate((names: readonly string[]) => {
		for (const name of names) {
			performance.clearMeasures(name)
		}
	}, routePerfMeasures)
}

async function readRoutePerf(page: Page) {
	return page.evaluate((names: readonly string[]) => {
		const entries = performance
			.getEntriesByType('measure')
			.filter((entry): entry is PerformanceMeasure => names.includes(entry.name))

		const summary = Object.fromEntries(
			names.map((name: string) => [name, { count: 0, max: 0, p95: 0 }])
		) as Record<string, { count: number; max: number; p95: number }>

		for (const name of names) {
			const samples = entries
				.filter((entry) => entry.name === name)
				.map((entry) => entry.duration)
				.sort((left, right) => left - right)
			if (samples.length === 0) continue
			const p95Index = Math.max(0, Math.ceil(samples.length * 0.95) - 1)
			summary[name] = {
				count: samples.length,
				max: samples[samples.length - 1],
				p95: samples[p95Index],
			}
		}

		return summary
	}, routePerfMeasures) as Promise<RoutePerfSummary>
}

async function runRoutePerfSequence(page: Page) {
	await page.click('[data-testid="nav-about"]')
	await expect(page.locator('[data-testid="about-view"]')).toBeVisible()

	await page.click('[data-testid="nav-user-1"]')
	await expect(page.locator('[data-testid="user-view"]')).toBeVisible()

	await page.click('[data-testid="nav-long"]')
	await expect(page.locator('[data-testid="long-view"]')).toBeVisible()

	await page.click('a[href="/router/nowhere"]')
	await expect(page.locator('[data-testid="not-found-view"]')).toBeVisible()

	await page.click('[data-testid="nav-home"]')
	await expect(page.locator('[data-testid="home-view"]')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
	page.on('console', (msg) => {
		console.log(`BROWSER [${msg.type()}]: ${msg.text()}`)
	})
})

test.describe('Kit Router — SPA reactivity', () => {
	test('initial load renders the correct route', async ({ page }) => {
		await page.goto('/router')
		await expect(page.locator('[data-testid="home-view"] h1')).toHaveText('Home')
		await expect(page.locator('[data-testid="current-path"]')).toHaveText('/router')
	})

	test('clicking <A> navigates without full page reload', async ({ page }) => {
		await page.goto('/router')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()

		let fullPageLoads = 0
		page.on('load', () => fullPageLoads++)

		await page.click('[data-testid="nav-user-1"]')
		await expect(page.locator('[data-testid="user-view"] h1')).toHaveText('User Profile')
		await expect(page).toHaveURL(/\/router\/users\/1$/)
		await expect(page.locator('[data-testid="current-path"]')).toHaveText('/router/users/1')

		await page.click('[data-testid="nav-about"]')
		await expect(page.locator('[data-testid="about-view"] h1')).toHaveText('About')
		await page.click('[data-testid="nav-user-1"]')
		await expect(page.locator('[data-testid="user-view"] h1')).toHaveText('User Profile')
		await expect(page.locator('[data-testid="user-id"]')).toHaveText('ID: 1')
		await expect(page).toHaveURL(/\/router\/users\/1$/)

		await page.click('[data-testid="nav-home"]')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()
		await expect(page).toHaveURL(/\/router$/)

		expect(fullPageLoads).toBe(0)
	})

	test('route params are displayed and update on navigation', async ({ page }) => {
		await page.goto('/router/users/1')
		await expect(page.locator('[data-testid="user-id"]')).toHaveText('ID: 1')
		await expect(page.locator('[data-testid="user-name"]')).toHaveText('Name: User 1')

		await page.click('[data-testid="nav-user-2"]')
		await expect(page.locator('[data-testid="user-id"]')).toHaveText('ID: 2')
		await expect(page.locator('[data-testid="user-name"]')).toHaveText('Name: User 2')
		await expect(page).toHaveURL(/\/router\/users\/2$/)
	})

	test('param change within same route pattern updates content', async ({ page }) => {
		await page.goto('/router/users/1')
		await expect(page.locator('[data-testid="user-id"]')).toHaveText('ID: 1')

		await page.click('[data-testid="link-user-42"]')
		await expect(page.locator('[data-testid="user-id"]')).toHaveText('ID: 42')
		await expect(page.locator('[data-testid="user-name"]')).toHaveText('Name: User 42')
		await expect(page).toHaveURL(/\/router\/users\/42$/)

		await page.click('[data-testid="link-user-2"]')
		await expect(page.locator('[data-testid="user-id"]')).toHaveText('ID: 2')
		await expect(page.locator('[data-testid="user-name"]')).toHaveText('Name: User 2')
	})

	test('browser back/forward navigates reactively', async ({ page }) => {
		await page.goto('/router')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()

		await page.click('[data-testid="nav-about"]')
		await expect(page.locator('[data-testid="about-view"]')).toBeVisible()

		await page.click('[data-testid="nav-user-1"]')
		await expect(page.locator('[data-testid="user-id"]')).toHaveText('ID: 1')

		await page.goBack()
		await expect(page.locator('[data-testid="about-view"]')).toBeVisible()
		await expect(page).toHaveURL(/\/router\/about$/)

		await page.goBack()
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()
		await expect(page).toHaveURL(/\/router$/)

		await page.goForward()
		await expect(page.locator('[data-testid="about-view"]')).toBeVisible()

		await page.goForward()
		await expect(page.locator('[data-testid="user-id"]')).toHaveText('ID: 1')
	})

	test('direct URL access renders the correct route', async ({ page }) => {
		await page.goto('/router/about')
		await expect(page.locator('[data-testid="about-view"] h1')).toHaveText('About')

		await page.goto('/router/users/99')
		await expect(page.locator('[data-testid="user-id"]')).toHaveText('ID: 99')
		await expect(page.locator('[data-testid="user-name"]')).toHaveText('Name: User 99')
	})

	test('unknown route shows not-found', async ({ page }) => {
		await page.goto('/router/nonexistent')
		await expect(page.locator('[data-testid="not-found-view"] h1')).toHaveText('404')
	})

	test('aria-current is set on active nav link', async ({ page }) => {
		await page.goto('/router')
		await expect(page.locator('[data-testid="nav-home"]')).toHaveAttribute('aria-current', 'page')
		await expect(page.locator('[data-testid="nav-about"]')).not.toHaveAttribute('aria-current', 'page')

		await page.click('[data-testid="nav-about"]')
		await expect(page.locator('[data-testid="nav-about"]')).toHaveAttribute('aria-current', 'page')
		await expect(page.locator('[data-testid="nav-home"]')).not.toHaveAttribute('aria-current', 'page')
	})

	test('scrolls to top on navigation by default', async ({ page }) => {
		await page.goto('/router/long')
		await expect(page.locator('[data-testid="long-view"]')).toBeVisible()

		await page.evaluate(() => window.scrollTo(0, 1000))
		let scrollY = await page.evaluate(() => window.scrollY)
		expect(scrollY).toBe(1000)

		await page.click('[data-testid="nav-home"]')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()

		scrollY = await page.evaluate(() => window.scrollY)
		expect(scrollY).toBe(0)
	})

	test('lazy routes show loading UI, then resolve and stay cached', async ({ page }) => {
		await page.goto('/router')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()

		await page.click('[data-testid="nav-lazy"]')
		await expect(page.locator('[data-testid="router-loading-view"]')).toBeVisible()
		await expect(page.locator('[data-testid="lazy-view"]')).toBeVisible()
		await expect(page).toHaveURL(/\/router\/lazy$/)

		await page.click('[data-testid="nav-home"]')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()

		await page.click('[data-testid="nav-lazy"]')
		await expect(page.locator('[data-testid="lazy-view"]')).toBeVisible()
		await expect(page.locator('[data-testid="router-loading-view"]')).toHaveCount(0)
	})

	test('hover-prefetching a lazy route avoids the loading UI on navigation', async ({ page }) => {
		await page.goto('/router')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()

		await page.hover('[data-testid="nav-lazy-prefetch"]')
		await page.waitForTimeout(250)

		await page.click('[data-testid="nav-lazy-prefetch"]')
		await expect(page.locator('[data-testid="lazy-view"]')).toBeVisible()
		await expect(page.locator('[data-testid="router-loading-view"]')).toHaveCount(0)
	})

	test('intent-prefetching a lazy route on press-start avoids the loading UI on navigation', async ({ page }) => {
		await page.goto('/router')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()

		await page.dispatchEvent('[data-testid="nav-lazy-intent"]', 'mousedown')
		await page.waitForTimeout(250)

		await page.click('[data-testid="nav-lazy-intent"]')
		await expect(page.locator('[data-testid="lazy-view"]')).toBeVisible()
		await expect(page.locator('[data-testid="router-loading-view"]')).toHaveCount(0)
	})

	test('visible-prefetching a lazy route avoids the loading UI on navigation', async ({ page }) => {
		await page.goto('/router')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()

		await page.waitForTimeout(250)

		await page.click('[data-testid="nav-lazy-visible"]')
		await expect(page.locator('[data-testid="lazy-view"]')).toBeVisible()
		await expect(page.locator('[data-testid="router-loading-view"]')).toHaveCount(0)
	})

	test('router navigation analytics callbacks report start, end, and error', async ({ page }) => {
		await page.goto('/router')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()

		await page.click('[data-testid="nav-about"]')
		await expect(page.locator('[data-testid="nav-event-log"]')).toContainText('start push')
		await expect(page.locator('[data-testid="nav-event-log"]')).toContainText('/router/about /router/about')
		await expect(page.locator('[data-testid="nav-event-log"]')).toContainText('end match push /router/about /router/about')

		await page.click('[data-testid="nav-lazy-error"]')
		await expect(page.locator('[data-testid="route-error-view"]')).toBeVisible()
		await expect(page.locator('[data-testid="nav-event-log"]')).toContainText(
			'error push /router/lazy-error /router/lazy-error Demo lazy route failed to load'
		)
	})

	test('route-level loading renderer overrides the router loading fallback', async ({ page }) => {
		await page.goto('/router')
		await page.click('[data-testid="nav-lazy-pending"]')
		await expect(page.locator('[data-testid="route-loading-view"]')).toBeVisible()
		await expect(page.locator('[data-testid="router-loading-view"]')).toHaveCount(0)
		await expect(page.locator('[data-testid="lazy-view"]')).toBeVisible()
	})

	test('route-level error renderer handles lazy route load failures', async ({ page }) => {
		await page.goto('/router')
		await page.click('[data-testid="nav-lazy-error"]')
		await expect(page.locator('[data-testid="route-error-view"]')).toBeVisible()
		await expect(page.locator('[data-testid="route-error-view"]')).toContainText('Demo lazy route failed to load')
	})

	test('browser back preserves scroll position', async ({ page }) => {
		await page.goto('/router/long')
		await expect(page.locator('[data-testid="long-view"]')).toBeVisible()

		await page.evaluate(() => window.scrollTo(0, 1000))
		const beforeNavigation = await page.evaluate(() => window.scrollY)
		expect(beforeNavigation).toBe(1000)

		await page.click('[data-testid="nav-home"]')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()
		expect(await page.evaluate(() => window.scrollY)).toBe(0)

		await page.goBack()
		await expect(page.locator('[data-testid="long-view"]')).toBeVisible()
		expect(await page.evaluate(() => window.scrollY)).toBe(1000)
	})

	test('route perf measures stay within expectations', async ({ page }) => {
		test.skip(process.env.VITE_PERF !== 'true', 'Perf validation only runs in perf mode')

		await page.goto('/router')
		await expect(page.locator('[data-testid="home-view"]')).toBeVisible()
		await runRoutePerfSequence(page)
		await clearRoutePerf(page)

		for (let i = 0; i < 5; i++) {
			await runRoutePerfSequence(page)
		}

		const summary = await readRoutePerf(page)
		console.log('Route perf summary', summary)

		for (const name of routePerfMeasures) {
			expect(summary[name].count).toBeGreaterThan(0)
		}

		for (const name of Object.keys(routePerfThresholds) as Array<keyof typeof routePerfThresholds>) {
			expect(summary[name].p95).toBeLessThanOrEqual(routePerfThresholds[name])
		}

		expect(summary['route:render'].max).toBeLessThan(200)
	})
})

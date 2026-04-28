/**
 * Router component logic tests.
 * Tests the reactive matching + view selection without the full DOM rendering pipeline.
 */
import { h, latch, SursautElement } from '@sursaut/core'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { setPlatform } from '../platform/shared'
import { createTestAdapter } from '../platform/test'
import { matchRoute, Router, routeMatcher } from './components'
import { linkModel } from './link-model'

describe('Router matchRoute wrapper', () => {
	const routes = [
		{ path: '/users/[id]' as const },
		{ path: '/posts/[...slug]' as const },
		{ path: '/' as const },
	]

	test('matches static route', () => {
		const result = matchRoute('/', routes)
		expect(result).not.toBeNull()
		expect(result!.definition.path).toBe('/')
		expect(result!.params).toEqual({})
		expect(result!.unusedPath).toBe('')
	})

	test('matches dynamic route with params', () => {
		const result = matchRoute('/users/42', routes)
		expect(result).not.toBeNull()
		expect(result!.definition.path).toBe('/users/[id]')
		expect(result!.params).toEqual({ id: '42' })
	})

	test('matches catch-all route', () => {
		const result = matchRoute('/posts/2024/hello-world', routes)
		expect(result).not.toBeNull()
		expect(result!.definition.path).toBe('/posts/[...slug]')
		expect(result!.params.slug).toBe('2024/hello-world')
	})

	test('unmatched route falls through to root with unusedPath', () => {
		const result = matchRoute('/unknown/deep/path', routes)
		// `/` matches but leaves unusedPath — Router component filters these out
		expect(result).not.toBeNull()
		expect(result!.definition.path).toBe('/')
		expect(result!.unusedPath).toBe('/unknown/deep/path')
	})
})

describe('routeMatcher (pre-compiled)', () => {
	const routes = [{ path: '/a' as const }, { path: '/b' as const }, { path: '/' as const }]
	const matcher = routeMatcher(routes)

	test('matches different routes on successive calls', () => {
		const a = matcher('/a')
		expect(a).not.toBeNull()
		expect(a!.definition.path).toBe('/a')

		const b = matcher('/b')
		expect(b).not.toBeNull()
		expect(b!.definition.path).toBe('/b')

		const root = matcher('/')
		expect(root).not.toBeNull()
		expect(root!.definition.path).toBe('/')
	})

	test('unmatched path falls through to root with unusedPath', () => {
		const result = matcher('/nope')
		expect(result).not.toBeNull()
		expect(result!.definition.path).toBe('/')
		expect(result!.unusedPath).toBe('/nope')
	})

	test('returns null when no root route exists', () => {
		const noRoot = routeMatcher([{ path: '/a' as const }])
		expect(noRoot('/nope')).toBeNull()
	})

	test('ignores hash fragments when selecting the matching route', () => {
		const result = matcher('/a#details')
		expect(result).not.toBeNull()
		expect(result!.definition.path).toBe('/a')
		expect(result!.unusedPath).toBe('#details')
	})
})

describe('Router reactive view selection', () => {
	test('different definitions produce different identity checks', () => {
		const routes = [
			{ path: '/display' as const, label: 'Display' },
			{ path: '/forms' as const, label: 'Forms' },
			{ path: '/' as const, label: 'Home' },
		]
		const matcher = routeMatcher(routes)

		const home = matcher('/')!
		const display = matcher('/display')!
		const forms = matcher('/forms')!

		// The Router uses definition identity to skip re-render on same route
		expect(home.definition).not.toBe(display.definition)
		expect(display.definition).not.toBe(forms.definition)

		// Same URL → same definition object
		const home2 = matcher('/')!
		expect(home2.definition).toBe(home.definition)
	})

	test('keeps a catch-all branch view mounted while routeSpecification updates reactively', async () => {
		const adapter = createTestAdapter('http://localhost/dockview-router/notes/1')
		setPlatform(adapter)
		const mutableClient = adapter.client as unknown as {
			url: {
				href: string
				origin: string
				pathname: string
				search: string
				hash: string
				segments: string[]
				query: Record<string, string>
			}
			history: { length: number; navigation: 'load' | 'push' | 'replace' | 'pop' }
		}
		let renders = 0
		let routeScope: Record<PropertyKey, unknown> | undefined
		const scope = adapter.client as unknown as Record<PropertyKey, unknown>
		const routes = [
			{
				path: '/dockview-router/[...route]' as const,
				view: (
					spec: { params: Record<string, string> },
					currentScope: Record<PropertyKey, unknown>
				) => {
					renders += 1
					routeScope = currentScope
					const initialRoute = spec.params.route
					return h(
						'div',
						{ 'data-test': 'branch-value' },
						SursautElement.text(
							() =>
								(
									routeScope?.routeSpecification as
										| {
												current: { params: Record<string, string> } | null
										  }
										| undefined
								)?.current?.params.route ?? initialRoute
						)
					)
				},
			},
		]
		const stop = latch(
			document.body,
			h(Router, {
				routes,
				notFound: () => h('div', { 'data-test': 'branch-value' }, 'missing'),
			}),
			scope
		)

		expect(document.querySelector('[data-test="branch-value"]')?.textContent).toBe('notes/1')
		expect(renders).toBe(1)

		mutableClient.url.href = 'http://localhost/dockview-router/counter/2'
		mutableClient.url.pathname = '/dockview-router/counter/2'
		mutableClient.url.search = ''
		mutableClient.url.hash = ''
		mutableClient.url.segments = ['dockview-router', 'counter', '2']
		mutableClient.url.query = {}
		mutableClient.history.navigation = 'push'
		await Promise.resolve()

		expect(
			(
				routeScope?.routeSpecification as
					| {
							current: { params: Record<string, string> } | null
					  }
					| undefined
			)?.current?.params.route
		).toBe('counter/2')
		expect(renders).toBe(1)

		stop()
	})

	test('re-renders a parameterized route when params change', async () => {
		const adapter = createTestAdapter('http://localhost/users/1')
		setPlatform(adapter)
		const mutableClient = adapter.client as unknown as {
			url: {
				href: string
				origin: string
				pathname: string
				search: string
				hash: string
				segments: string[]
				query: Record<string, string>
			}
			history: { length: number; navigation: 'load' | 'push' | 'replace' | 'pop' }
		}
		let renders = 0
		const stop = latch(
			document.body,
			h(Router, {
				routes: [
					{
						path: '/users/[id]' as const,
						view: (spec: { params: Record<string, string> }) => {
							renders += 1
							return h('div', { 'data-test': 'user-id' }, `ID: ${spec.params.id}`)
						},
					},
				],
				notFound: () => h('div', { 'data-test': 'user-id' }, 'missing'),
			}),
			adapter.client as unknown as Record<PropertyKey, unknown>
		)

		expect(document.querySelector('[data-test="user-id"]')?.textContent).toBe('ID: 1')
		expect(renders).toBe(1)

		mutableClient.url.href = 'http://localhost/users/42'
		mutableClient.url.pathname = '/users/42'
		mutableClient.url.search = ''
		mutableClient.url.hash = ''
		mutableClient.url.segments = ['users', '42']
		mutableClient.url.query = {}
		mutableClient.history.navigation = 'push'
		await Promise.resolve()

		expect(document.querySelector('[data-test="user-id"]')?.textContent).toBe('ID: 42')
		expect(renders).toBeGreaterThan(1)

		stop()
	})

	test('keeps nested routers reactive inside a mounted catch-all branch', async () => {
		const adapter = createTestAdapter('http://localhost/router/users/1')
		setPlatform(adapter)
		const mutableClient = adapter.client as unknown as {
			url: {
				href: string
				origin: string
				pathname: string
				search: string
				hash: string
				segments: string[]
				query: Record<string, string>
			}
			history: { length: number; navigation: 'load' | 'push' | 'replace' | 'pop' }
		}
		const innerRoutes = [
			{
				path: '/router/users/[id]' as const,
				view: (spec: { params: Record<string, string> }) =>
					h('div', { 'data-test': 'nested-user-id' }, `ID: ${spec.params.id}`),
			},
		]
		const stop = latch(
			document.body,
			h(Router, {
				routes: [
					{
						path: '/router/[...rest]' as const,
						view: () =>
							h(Router, {
								routes: innerRoutes,
								notFound: () => h('div', { 'data-test': 'nested-user-id' }, 'inner missing'),
							}),
					},
				],
				notFound: () => h('div', { 'data-test': 'nested-user-id' }, 'outer missing'),
			}),
			adapter.client as unknown as Record<PropertyKey, unknown>
		)

		expect(document.querySelector('[data-test="nested-user-id"]')?.textContent).toBe('ID: 1')

		mutableClient.url.href = 'http://localhost/router/users/42'
		mutableClient.url.pathname = '/router/users/42'
		mutableClient.url.search = ''
		mutableClient.url.hash = ''
		mutableClient.url.segments = ['router', 'users', '42']
		mutableClient.url.query = {}
		mutableClient.history.navigation = 'push'
		await Promise.resolve()

		expect(document.querySelector('[data-test="nested-user-id"]')?.textContent).toBe('ID: 42')

		stop()
	})

	test('renders the matched route when pathname carries a fragment suffix', () => {
		const adapter = createTestAdapter('http://localhost/docs')
		setPlatform(adapter)
		const mutableClient = adapter.client as unknown as {
			url: {
				href: string
				origin: string
				pathname: string
				search: string
				hash: string
				segments: string[]
				query: Record<string, string>
			}
			history: { length: number; navigation: 'load' | 'push' | 'replace' | 'pop' }
		}
		mutableClient.url.href = 'http://localhost/docs#section'
		mutableClient.url.pathname = '/docs#section'
		mutableClient.url.search = ''
		mutableClient.url.hash = '#section'
		mutableClient.url.segments = ['docs']
		mutableClient.url.query = {}
		mutableClient.history.navigation = 'push'

		const stop = latch(
			document.body,
			h(Router, {
				routes: [
					{
						path: '/docs' as const,
						view: () => h('div', { 'data-test': 'fragment-match' }, 'docs route'),
					},
				],
				notFound: () => h('div', { 'data-test': 'fragment-match' }, 'not found'),
			}),
			adapter.client as unknown as Record<PropertyKey, unknown>
		)

		expect(document.querySelector('[data-test="fragment-match"]')?.textContent).toBe('docs route')

		stop()
	})
})

describe('linkModel aria-current', () => {
	beforeEach(() => setPlatform(createTestAdapter('http://localhost/docs')))
	afterEach(() => setPlatform(null as never))

	test('matches plain href against pathname', () => {
		expect(linkModel({ href: '/docs' })['aria-current']).toBe('page')
	})

	test('strips hash from href before comparing to pathname', () => {
		expect(linkModel({ href: '/docs#section' })['aria-current']).toBe('page')
	})

	test('hash-only href returns undefined (no path to match)', () => {
		expect(linkModel({ href: '#section' })['aria-current']).toBeUndefined()
	})

	test('fragment href on a different page is not active', () => {
		expect(linkModel({ href: '/other#section' })['aria-current']).toBeUndefined()
	})
})

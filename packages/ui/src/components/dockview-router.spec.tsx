import { h, SursautElement } from '@sursaut/core'
import type { DockviewApi } from 'dockview'
import { describe, expect, it, vi } from 'vitest'
import { type DockviewRouteWidgetParams, dockviewRouterInternals } from './dockview-router'

type DemoRoute = { readonly path: string }

function renderToText(element: JSX.Element | JSX.Element[]) {
	const item = Array.isArray(element) ? element[0] : element
	if (!(item instanceof SursautElement)) throw new Error('Expected SursautElement')
	const nodes = item.render({})
	const array = Array.isArray(nodes) ? nodes : Array.from(nodes as Iterable<Node>)
	return array.map((node) => node.textContent ?? '').join('')
}

function createRoutes() {
	return [
		{
			path: '/users/[id]',
			view: (spec: { params: Record<string, string> }) => h('div', {}, `User ${spec.params.id}`),
			title: (params: Record<string, string>) => `User ${params.id}`,
		},
		{
			path: '/lazy',
			lazy: async () => ({ default: () => h('div', {}, 'Lazy') }),
		},
	] as const
}

describe('dockviewRouterInternals', () => {
	it('creates one route widget per route path and keeps extra widgets', () => {
		const routes = createRoutes()
		const widgets = dockviewRouterInternals.createRouteWidgets(
			{
				routes,
				extraWidgets: { custom: () => h('div', {}, 'Custom') },
			},
			{
				matcher: vi.fn(),
				open: vi.fn(),
				close: vi.fn(),
				activate: vi.fn(),
				clear: vi.fn(),
				active: null,
				opened: [],
				state: { active: null, opened: [] },
			}
		)

		expect(Object.keys(widgets).sort()).toEqual(['/lazy', '/users/[id]', 'custom'])
	})

	it('renders eager route widgets from the matched url', () => {
		const routes = createRoutes()
		const model = {
			matcher: vi.fn((url: string) =>
				url === '/users/42'
					? {
							definition: routes[0],
							params: { id: '42' },
							unusedPath: '',
						}
					: null
			),
			open: vi.fn(),
			close: vi.fn(),
			activate: vi.fn(),
			clear: vi.fn(),
			active: null,
			opened: [],
			state: { active: null, opened: [] },
		}
		const widgets = dockviewRouterInternals.createRouteWidgets({ routes }, model as never)
		const widget = widgets['/users/[id]']

		const output = widget(
			{
				title: 'User 42',
				size: { width: 100, height: 100 },
				context: {},
				params: {
					url: '/users/42',
					routeId: '/users/42',
					id: '42',
				} satisfies DockviewRouteWidgetParams,
			},
			{}
		)

		expect(renderToText(output)).toContain('User 42')
	})

	it('falls back to loading placeholder for lazy routes in the shell', () => {
		const routes = createRoutes()
		const model = {
			matcher: vi.fn(() => ({ definition: routes[1], params: {}, unusedPath: '' })),
			open: vi.fn(),
			close: vi.fn(),
			activate: vi.fn(),
			clear: vi.fn(),
			active: null,
			opened: [],
			state: { active: null, opened: [] },
		}
		const widgets = dockviewRouterInternals.createRouteWidgets({ routes }, model as never)
		const widget = widgets['/lazy']

		const output = widget(
			{
				title: 'Lazy',
				size: { width: 100, height: 100 },
				context: {},
				params: { url: '/lazy', routeId: '/lazy' } satisfies DockviewRouteWidgetParams,
			},
			{}
		)

		expect(renderToText(output)).toContain('Loading route…')
	})

	it('opens matched routes into dockview panels using route-derived params', () => {
		const panel = { id: '/users/42', api: { setActive: vi.fn() } }
		const api = {
			panels: [],
			activePanel: null,
			addPanel: vi.fn(() => panel),
		} as unknown as DockviewApi
		const opened = {
			id: '/users/42',
			url: '/users/42',
			title: 'User 42',
			match: {
				definition: createRoutes()[0],
				params: { id: '42' },
				unusedPath: '',
			},
		}

		dockviewRouterInternals.openRoutePanel(api, opened as never)

		expect(api.addPanel as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
			expect.objectContaining({
				id: '/users/42',
				title: 'User 42',
				component: '/users/[id]',
				params: { id: '42', url: '/users/42', routeId: '/users/42' },
			})
		)
	})

	it('syncs the active dockview route back to the client URL only when needed', () => {
		const replace = vi.fn()

		expect(dockviewRouterInternals.syncActiveRouteToUrl('/users/42', '/start', '', replace)).toBe(
			true
		)
		expect(replace).toHaveBeenCalledWith('/users/42')
		expect(
			dockviewRouterInternals.syncActiveRouteToUrl('/users/42', '/users/42', '', replace)
		).toBe(false)
	})

	it('normalizes, strips, and prepends a base branch for nested routing', () => {
		expect(dockviewRouterInternals.normalizeBase('/dockview-router/')).toBe('/dockview-router')
		expect(
			dockviewRouterInternals.stripBase('/dockview-router/notes/1?tab=a', '/dockview-router')
		).toBe('/notes/1?tab=a')
		expect(dockviewRouterInternals.stripBase('/dockview-router', '/dockview-router')).toBe('/')
		expect(dockviewRouterInternals.prependBase('/notes/1?tab=a', '/dockview-router')).toBe(
			'/dockview-router/notes/1?tab=a'
		)
	})

	it('syncs the active dockview route back to the full client URL when a base is configured', () => {
		const replace = vi.fn()

		expect(
			dockviewRouterInternals.syncActiveRouteToUrl(
				'/notes/1',
				'/counter/1',
				'/dockview-router',
				replace
			)
		).toBe(true)
		expect(replace).toHaveBeenCalledWith('/dockview-router/notes/1')
	})

	it('opens a new tab when no existing panel matches the URL', () => {
		const opened = {
			id: '/users/42#2',
			url: '/users/42',
			title: 'User 42',
			match: { definition: createRoutes()[0], params: { id: '42' }, unusedPath: '' },
		}
		const api = {
			panels: [{ id: '/users/1#1', params: { url: '/users/1' }, api: { setActive: vi.fn() } }],
			activePanel: null,
			addPanel: vi.fn(() => ({ id: '/users/42#2', api: { setActive: vi.fn() } })),
		} as unknown as DockviewApi
		const model = {
			active: {
				id: '/users/1#1',
				url: '/users/1',
				title: 'User 1',
				match: { definition: createRoutes()[0], params: { id: '1' }, unusedPath: '' },
			},
			opened: [],
			state: { active: null, opened: [] },
			matcher: vi.fn(),
			open: vi.fn(() => opened),
			close: vi.fn(),
			activate: vi.fn(),
			clear: vi.fn(),
		}

		const result = dockviewRouterInternals.syncClientRouteToDockview(api, model as never, {
			url: '/users/42',
			navigation: 'push',
		})

		expect(result).toBe(opened)
		expect(model.open).toHaveBeenCalledWith('/users/42')
		expect(api.addPanel as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1)
	})

	it('reuses an existing tab on push navigation when the URL is already open', () => {
		const existing = {
			id: '/users/42#2',
			url: '/users/42',
			title: 'User 42',
			match: { definition: createRoutes()[0], params: { id: '42' }, unusedPath: '' },
		}
		const openPanel = vi.fn()
		const setActive = vi.fn()
		const api = {
			panels: [
				{
					id: existing.id,
					group: { model: { openPanel } },
					api: { setActive },
					params: { url: '/users/42' },
				},
			],
			activePanel: null,
			addPanel: vi.fn(),
		} as unknown as DockviewApi
		const model = {
			active: {
				id: '/users/1#1',
				url: '/users/1',
				title: 'User 1',
				match: { definition: createRoutes()[0], params: { id: '1' }, unusedPath: '' },
			},
			opened: [existing],
			state: { active: null, opened: [] },
			matcher: vi.fn(),
			open: vi.fn(),
			close: vi.fn(),
			activate: vi.fn(),
			clear: vi.fn(),
		}

		const result = dockviewRouterInternals.syncClientRouteToDockview(api, model as never, {
			url: '/users/42',
			navigation: 'push',
		})

		expect(result).toBeNull()
		expect(model.activate).toHaveBeenCalledWith(existing.id)
		expect(setActive).toHaveBeenCalledTimes(1)
		expect(openPanel).toHaveBeenCalledTimes(1)
		expect(openPanel).toHaveBeenCalledWith(api.panels[0])
		expect(model.open).not.toHaveBeenCalled()
		expect(api.addPanel as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
	})

	it('clears a previous router runtime error after successful existing-tab reuse', () => {
		const existing = {
			id: '/users/42#2',
			url: '/users/42',
			title: 'User 42',
			match: { definition: createRoutes()[0], params: { id: '42' }, unusedPath: '' },
		}
		const openPanel = vi.fn()
		const setActive = vi.fn()
		const clearError = vi.fn()
		const reportError = vi.fn()
		const api = {
			panels: [
				{
					id: existing.id,
					group: { model: { openPanel } },
					api: { setActive },
					params: { url: '/users/42' },
				},
			],
			activePanel: null,
			addPanel: vi.fn(),
		} as unknown as DockviewApi
		const model = {
			active: null,
			opened: [existing],
			state: { active: null, opened: [] },
			matcher: vi.fn(),
			open: vi.fn(),
			close: vi.fn(),
			activate: vi.fn(),
			clear: vi.fn(),
		}

		const result = dockviewRouterInternals.syncClientRouteToDockview(
			api,
			model as never,
			{ url: '/users/42', navigation: 'push' },
			undefined,
			reportError,
			clearError
		)

		expect(result).toBeNull()
		expect(reportError).not.toHaveBeenCalled()
		expect(clearError).toHaveBeenCalledTimes(1)
	})

	it('reuses an existing tab on replace navigation when the URL is already open', () => {
		const existing = {
			id: '/users/42#2',
			url: '/users/42',
			title: 'User 42',
			match: { definition: createRoutes()[0], params: { id: '42' }, unusedPath: '' },
		}
		const openPanel = vi.fn()
		const setActive = vi.fn()
		const api = {
			panels: [
				{
					id: existing.id,
					group: { model: { openPanel } },
					api: { setActive },
					params: { url: '/users/42' },
				},
			],
			activePanel: null,
			addPanel: vi.fn(),
		} as unknown as DockviewApi
		const model = {
			active: {
				id: '/users/1#1',
				url: '/users/1',
				title: 'User 1',
				match: { definition: createRoutes()[0], params: { id: '1' }, unusedPath: '' },
			},
			opened: [existing],
			state: { active: null, opened: [] },
			matcher: vi.fn(),
			open: vi.fn(),
			close: vi.fn(),
			activate: vi.fn(),
			clear: vi.fn(),
		}

		const result = dockviewRouterInternals.syncClientRouteToDockview(api, model as never, {
			url: '/users/42',
			navigation: 'replace',
		})

		expect(result).toBeNull()
		expect(model.activate).toHaveBeenCalledWith(existing.id)
		expect(setActive).toHaveBeenCalledTimes(1)
		expect(openPanel).toHaveBeenCalledTimes(1)
		expect(openPanel).toHaveBeenCalledWith(api.panels[0])
		expect(model.open).not.toHaveBeenCalled()
		expect(api.addPanel as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
	})

	it('reconciles the model with dockview panel removal and active panel changes', () => {
		const active = {
			id: '/users/2#1',
			url: '/users/2',
			title: 'User 2',
			match: { definition: createRoutes()[0], params: { id: '2' }, unusedPath: '' },
		}
		const model: {
			active: typeof active | null
			opened: Array<{
				id: string
				url: string
				title: string
				match: typeof active.match
			}>
			matcher: ReturnType<typeof vi.fn>
			open: ReturnType<typeof vi.fn>
			close: ReturnType<typeof vi.fn>
			activate: ReturnType<typeof vi.fn>
			clear: ReturnType<typeof vi.fn>
		} = {
			active: null,
			opened: [
				{
					id: '/users/1#1',
					url: '/users/1',
					title: 'User 1',
					match: { definition: createRoutes()[0], params: { id: '1' }, unusedPath: '' },
				},
				active,
			],
			matcher: vi.fn(),
			open: vi.fn(),
			close: vi.fn(),
			activate: vi.fn(() => {
				model.active = active
			}),
			clear: vi.fn(),
		}
		const api = {
			panels: [{ id: '/users/2#1', api: { setActive: vi.fn() } }],
			activePanel: { id: '/users/2#1', api: { setActive: vi.fn() } },
		} as unknown as DockviewApi

		const result = dockviewRouterInternals.reconcileDockviewRouteState(api, model as never)

		expect(model.close).toHaveBeenCalledWith('/users/1#1')
		expect(model.activate).toHaveBeenCalledWith('/users/2#1')
		expect(result).toBe(active)
	})

	it('returns undefined when openRoutePanel hits a synchronous addPanel error', () => {
		const error = new Error('add failed')
		const api = {
			panels: [],
			activePanel: null,
			addPanel: vi.fn(() => {
				throw error
			}),
		} as unknown as DockviewApi
		const opened = {
			id: '/users/42',
			url: '/users/42',
			title: 'User 42',
			match: {
				definition: createRoutes()[0],
				params: { id: '42' },
				unusedPath: '',
			},
		}
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

		const result = dockviewRouterInternals.openRoutePanel(api, opened as never)

		expect(result).toBeUndefined()
		expect(consoleError).toHaveBeenCalledWith(
			'[DockviewRouter] openRoutePanel error:',
			'/users/42',
			error
		)
		consoleError.mockRestore()
	})

	it('returns null when reusing an existing tab throws while focusing it', () => {
		const error = new Error('focus failed')
		const existing = {
			id: '/users/42#2',
			url: '/users/42',
			title: 'User 42',
			match: { definition: createRoutes()[0], params: { id: '42' }, unusedPath: '' },
		}
		const api = {
			panels: [
				{
					id: existing.id,
					group: {
						model: {
							openPanel: vi.fn(() => {
								throw error
							}),
						},
					},
					api: { setActive: vi.fn() },
					params: { url: '/users/42' },
				},
			],
			activePanel: null,
			addPanel: vi.fn(),
		} as unknown as DockviewApi
		const model = {
			active: null,
			opened: [existing],
			state: { active: null, opened: [] },
			matcher: vi.fn(),
			open: vi.fn(),
			close: vi.fn(),
			activate: vi.fn(),
			clear: vi.fn(),
		}
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
		const reportError = vi.fn()
		const clearError = vi.fn()

		const result = dockviewRouterInternals.syncClientRouteToDockview(
			api,
			model as never,
			{
				url: '/users/42',
				navigation: 'push',
			},
			undefined,
			reportError,
			clearError
		)

		expect(result).toBeNull()
		expect(model.activate).toHaveBeenCalledWith(existing.id)
		expect(model.open).not.toHaveBeenCalled()
		expect(api.addPanel as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
		expect(clearError).not.toHaveBeenCalled()
		expect(consoleError).toHaveBeenCalledWith(
			'[DockviewRouter] openPanel error:',
			existing.id,
			error
		)
		expect(reportError).toHaveBeenCalledWith(
			dockviewRouterInternals.formatDockviewRouterError('openPanel', existing.id, error),
			error
		)
		consoleError.mockRestore()
	})
})

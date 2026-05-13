import { describe, it, expect } from 'vitest';

// Test all main exports from @sursaut/kit
import {
	// Router exports
	routerModel,
	routeMatcher,
	parsePathSegment,
	buildRoute,
	Router,
	setRouterPathnamePrefix,
	getRouterPathnamePrefix,
	defineRoute,
	// Intl exports
	Number as IntlNumber,
	Date as IntlDate,
	RelativeTime,
	List,
	Plural,
	DisplayNames,
	resolveLocale,
	cachedIntl,
	// DOM exports
	DisplayProvider,
	useDisplayContext,
	// Models exports
	linkModel,
} from '@sursaut/kit';

describe('@sursaut/kit integration', () => {
	describe('Router exports', () => {
		it('should export routerModel', () => {
			expect(routerModel).toBeDefined();
			expect(typeof routerModel).toBe('function');
		});

		it('should export routeMatcher', () => {
			expect(routeMatcher).toBeDefined();
			expect(typeof routeMatcher).toBe('function');
		});

		it('should export parsePathSegment', () => {
			expect(parsePathSegment).toBeDefined();
			expect(typeof parsePathSegment).toBe('function');
		});

		it('should export buildRoute', () => {
			expect(buildRoute).toBeDefined();
			expect(typeof buildRoute).toBe('function');
		});

		it('should export Router', () => {
			expect(Router).toBeDefined();
			expect(typeof Router).toBe('function');
		});

		it('should export setRouterPathnamePrefix', () => {
			expect(setRouterPathnamePrefix).toBeDefined();
			expect(typeof setRouterPathnamePrefix).toBe('function');
		});

		it('should export getRouterPathnamePrefix', () => {
			expect(getRouterPathnamePrefix).toBeDefined();
			expect(typeof getRouterPathnamePrefix).toBe('function');
		});

		it('should export defineRoute', () => {
			expect(defineRoute).toBeDefined();
			expect(typeof defineRoute).toBe('function');
		});
	});

	describe('Intl exports', () => {
		it('should export IntlNumber', () => {
			expect(IntlNumber).toBeDefined();
			expect(typeof IntlNumber).toBe('function');
		});

		it('should export IntlDate', () => {
			expect(IntlDate).toBeDefined();
			expect(typeof IntlDate).toBe('function');
		});

		it('should export RelativeTime', () => {
			expect(RelativeTime).toBeDefined();
			expect(typeof RelativeTime).toBe('function');
		});

		it('should export List', () => {
			expect(List).toBeDefined();
			expect(typeof List).toBe('function');
		});

		it('should export Plural', () => {
			expect(Plural).toBeDefined();
			expect(typeof Plural).toBe('function');
		});

		it('should export DisplayNames', () => {
			expect(DisplayNames).toBeDefined();
			expect(typeof DisplayNames).toBe('function');
		});

		it('should export resolveLocale', () => {
			expect(resolveLocale).toBeDefined();
			expect(typeof resolveLocale).toBe('function');
		});

		it('should export cachedIntl', () => {
			expect(cachedIntl).toBeDefined();
			expect(typeof cachedIntl).toBe('function');
		});
	});

	describe('DOM exports', () => {
		it('should export DisplayProvider', () => {
			expect(DisplayProvider).toBeDefined();
			expect(typeof DisplayProvider).toBe('function');
		});

		it('should export useDisplayContext', () => {
			expect(useDisplayContext).toBeDefined();
			expect(typeof useDisplayContext).toBe('function');
		});
	});

	describe('Models exports', () => {
		it('should export linkModel', () => {
			expect(linkModel).toBeDefined();
			expect(typeof linkModel).toBe('function');
		});
	});

	describe('routeMatcher functionality', () => {
		it('should match a static route', () => {
			const matcher = routeMatcher([
				{ path: '/hello' },
				{ path: '/users/[id]' }
			]);
			const match = matcher('/hello');
			expect(match).toBeDefined();
			expect(match!.definition.path).toBe('/hello');
		});

		it('should match a dynamic route with params', () => {
			const matcher = routeMatcher([
				{ path: '/users/[id]' }
			]);
			const match = matcher('/users/42');
			expect(match).toBeDefined();
			expect(match!.params.id).toBe('42');
		});
	});

	describe('parsePathSegment functionality', () => {
		it('should parse a param segment', () => {
			const parsed = parsePathSegment('[id]');
			expect(parsed.kind).toBe('param');
			expect(parsed.name).toBe('id');
		});

		it('should parse a literal segment', () => {
			const parsed = parsePathSegment('users');
			expect(parsed.kind).toBe('literal');
		});

		it('should parse a catch-all segment', () => {
			const parsed = parsePathSegment('[...slug]');
			expect(parsed.kind).toBe('catchAll');
			expect(parsed.name).toBe('slug');
		});
	});

	describe('linkModel functionality', () => {
		it('should create a link model with click handler and aria-current', () => {
			const model = linkModel({ href: '/test' });
			expect(model).toBeDefined();
			expect(typeof model.onClick).toBe('function');
			expect('aria-current' in model).toBe(true);
			expect(typeof model.use).toBe('function');
		});
	});
});

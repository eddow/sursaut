import { afterEach, describe, expect, it } from 'vitest'
import {
	getRouterPathnamePrefix,
	setRouterPathnamePrefix,
	toAppPath,
	toHistoryPath,
} from './pathname-base'

describe('pathname-base', () => {
	afterEach(() => {
		setRouterPathnamePrefix('/')
	})

	it('defaults to root', () => {
		setRouterPathnamePrefix('/')
		expect(getRouterPathnamePrefix()).toBe('')
		expect(toAppPath('/kit')).toBe('/kit')
		expect(toHistoryPath('/kit')).toBe('/kit')
	})

	it('strips Vite-style base /docs/', () => {
		setRouterPathnamePrefix('/docs/')
		expect(getRouterPathnamePrefix()).toBe('/docs')
		expect(toAppPath('/docs')).toBe('/')
		expect(toAppPath('/docs/')).toBe('/')
		expect(toAppPath('/docs/kit')).toBe('/kit')
		expect(toHistoryPath('/kit')).toBe('/docs/kit')
		expect(toHistoryPath('/')).toBe('/docs')
	})

	it('accepts base without trailing slash', () => {
		setRouterPathnamePrefix('/docs')
		expect(getRouterPathnamePrefix()).toBe('/docs')
		expect(toAppPath('/docs/getting-started')).toBe('/getting-started')
	})
})

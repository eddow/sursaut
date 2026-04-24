/**
 * Test CSS injection functionality
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __injectCSS, __resetCssInjectionTestState, getSSRStyles } from '../css'

describe('CSS Injection', () => {
	// We need to manage the global document object carefully
	const originalDocument = global.document

	beforeEach(() => {
		__resetCssInjectionTestState()
		if (typeof document !== 'undefined') {
			document.head.innerHTML = ''
			document.body.innerHTML = ''
		}
	})

	afterEach(() => {
		global.document = originalDocument
	})

	describe('Server Side Rendering', () => {
		beforeEach(() => {
			// @ts-expect-error
			global.document = undefined
		})

		it('should collect styles on server without errors', () => {
			const css1 = '.test-ssr { color: red; }'
			const cleanup = __injectCSS(css1)

			const output = getSSRStyles()
			expect(output).toContain(css1)
			expect(output).toContain('data-hydrated-hashes')
			cleanup()
		})

		it('should deduplicate styles on server', () => {
			const css2 = '.test-dedupe { color: blue; }'
			const cleanupA = __injectCSS(css2)
			const cleanupB = __injectCSS(css2)
			const output = getSSRStyles()
			const occurrences = output.split(css2).length - 1
			expect(occurrences).toBe(1)
			cleanupA()
			expect(getSSRStyles()).toContain(css2)
			cleanupB()
			expect(getSSRStyles()).not.toContain(css2)
		})
	})

	describe('Client Side DOM', () => {
		beforeEach(() => {
			if (originalDocument) global.document = originalDocument
		})

		it('should keep DOM style until the last identical injection is cleaned up', () => {
			if (!originalDocument) return
			const css = `.test-dom-${Math.random().toString(36).slice(2)} { color: green; }`
			const cleanupA = __injectCSS(css)
			const cleanupB = __injectCSS(css)
			const style = document.head.querySelector('style')

			expect(style?.textContent).toContain(css)
			expect(document.head.querySelectorAll('style')).toHaveLength(1)

			cleanupA()
			expect(document.head.querySelector('style')?.textContent).toContain(css)

			cleanupB()
			expect(document.head.querySelectorAll('style')).toHaveLength(0)
		})
	})
})

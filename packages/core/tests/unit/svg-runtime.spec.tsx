import { describe, expect, it } from 'vitest'
import { h } from '@sursaut/core'

describe('SVG runtime semantics', () => {
	it('creates descendant SVG elements in the SVG namespace', () => {
		const svg = (
			<svg>
				<circle data-testid="circle" />
			</svg>
		).render()[0] as SVGSVGElement
		const circle = svg.querySelector('[data-testid="circle"]')!

		expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg')
		expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg')
	})

	it('preserves case-sensitive SVG attribute names', () => {
		const svg = h('svg', { viewBox: '0 0 10 10' }).render()[0] as SVGSVGElement

		expect(svg.getAttribute('viewBox')).toBe('0 0 10 10')
		expect(svg.hasAttribute('viewbox')).toBe(false)
	})
})

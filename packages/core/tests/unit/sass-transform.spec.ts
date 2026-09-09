import { describe, it, expect } from 'vitest'
import { transformSync } from '@babel/core'
import babelPluginJsx from '@babel/plugin-transform-react-jsx'
import babelPluginTs from '@babel/plugin-transform-typescript'
import { sursautBabelPlugin } from '../../src/plugin/babel'

function transform(code: string): string {
	const result = transformSync(code, {
		filename: 'test.tsx',
		plugins: [
			[sursautBabelPlugin],
			[babelPluginJsx, { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment', throwIfNamespace: false }],
			[babelPluginTs, { isTSX: true, allowDeclareFields: true }],
		],
		generatorOpts: { compact: true },
	})
	return result?.code ?? ''
}

describe('sass/scss tagged-template compilation', () => {
	it('compiles indented sass to plain CSS', () => {
		const out = transform('sass`.a\\n  color: red\\n  &:hover\\n    color: blue`')
		// nested `&:hover` is resolved to the `.a:hover` selector
		expect(out).toContain('.a:hover')
		expect(out).toContain('color: red')
		expect(out).toContain('color: blue')
		// indentation syntax + parent selector are gone
		expect(out).not.toContain('&:hover')
	})

	it('compiles scss (flavored member form) to plain CSS', () => {
		const out = transform('componentStyle.scss`.a { color: red; &:hover { color: blue; } }`')
		expect(out).toContain('.a:hover')
		expect(out).toContain('color: red')
		expect(out).toContain('color: blue')
		expect(out).not.toContain('&:hover')
	})

	it('leaves plain css template literals verbatim', () => {
		const out = transform('componentStyle.css`.a { color: red; }`')
		expect(out).toContain('.a { color: red; }')
	})

	it('throws on invalid sass with a build-code-frame error', () => {
		expect(() => transform('sass`.a\\n  color: red\\n}`')).toThrow(/sass\/indented compilation failed/)
	})
})
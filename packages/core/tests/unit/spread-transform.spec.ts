import { describe, it, expect } from 'vitest'
import { transformSync } from '@babel/core'
import babelPluginJsx from '@babel/plugin-transform-react-jsx'
import babelPluginTs from '@babel/plugin-transform-typescript'
import { sursautBabelPlugin, sursautSpreadPlugin } from '../../src/plugin/babel'

function transform(code: string): string {
	const result = transformSync(code, {
		filename: 'test.tsx',
		plugins: [
			[sursautBabelPlugin],
			[babelPluginJsx, { runtime: 'classic', pragma: 'h', pragmaFrag: 'Fragment', throwIfNamespace: false }],
			[sursautSpreadPlugin],
			[babelPluginTs, { isTSX: true, allowDeclareFields: true }],
		],
		generatorOpts: { compact: true },
	})
	return result?.code ?? ''
}

describe('spread attribute babel transform', () => {
	it('wraps single spread in c(() => x)', () => {
		const out = transform(`<Comp {...state.attrs} />`)
		expect(out).toContain('c(()=>state.attrs)')
		expect(out).not.toContain('_extends')
	})

	it('wraps spread with other attrs: mixed case via sursautSpreadPlugin', () => {
		const out = transform(`<Comp id="x" {...state.attrs} />`)
		expect(out).toContain('_extends({id:"x"},')
		expect(out).toContain('_sursaut_c(()=>state.attrs)')
	})

	it('wraps spread of a plain identifier', () => {
		const out = transform(`<div {...props} />`)
		expect(out).toContain('c(()=>props)')
	})

	it('wraps spread of a call expression', () => {
		const out = transform(`<div {...getProps()} />`)
		expect(out).toContain('c(()=>getProps())')
	})

	it('auto-imports c from @sursaut/core', () => {
		const out = transform(`<div {...state} />`)
		expect(out).toMatch(/import\s*\{[^}]*\bc\b[^}]*\}.*from"@sursaut\/core"/)
	})

	it('does not import c when no composite helper is emitted', () => {
		const out = transform(`<div id="x" />`)
		expect(out).not.toMatch(/import\s*\{[^}]*\bc\b[^}]*\}.*from"@sursaut\/core"/)
	})

	it('does not import Fragment when the file has no fragments', () => {
		const out = transform(`<div id="x" />`)
		expect(out).not.toMatch(/import\s*\{[^}]*\bFragment\b[^}]*\}.*from"@sursaut\/core"/)
	})

	it('imports Fragment when the file uses JSX fragments', () => {
		const out = transform(`<>ok</>`)
		expect(out).toMatch(/import\s*\{[^}]*\bFragment\b[^}]*\}.*from"@sursaut\/core"/)
	})

	it('wraps JSX fragment expression children in r() (rebuild-fence fix)', () => {
		const out = transform(`<>{actionLabel(props.item.key, props.item.fallback)}</>`)
		expect(out).toContain('_sursaut_r(()=>actionLabel(props.item.key,props.item.fallback))')
		expect(out).not.toContain('actionLabel(props.item.key,props.item.fallback),')
	})

	it('wraps mixed fragment children (expression + element) in r()', () => {
		const out = transform(`<>{expr}<span if={!props.item.last}> / </span></>`)
		expect(out).toContain('_sursaut_r(()=>expr)')
		expect(out).toContain('if:_sursaut_r(()=>!props.item.last)')
	})

	it('wraps multiple spreads in a single c() with multiple arguments', () => {
		const out = transform(`<Comp value={state.count} {...counts[state.locale]} />`)
		expect(out).toContain('_extends({value:_sursaut_r(()=>state.count,val=>state.count=val)},')
		expect(out).toContain('_sursaut_c(()=>counts[state.locale])')
	})

	it('does not transform regular object spreads outside JSX', () => {
		const out = transform(`const merged = { ...a, ...b }`)
		expect(out).not.toContain('c(')
		expect(out).toContain('...a')
		expect(out).toContain('...b')
	})

	it('rewrites `this={lval}` into callback setter (not ReactiveProp)', () => {
		const out = transform(`<div this={state.ref} />`)
		expect(out).toContain('this:mounted=>state.ref=mounted')
		expect(out).not.toContain('this:r(')
	})

	it('keeps `this={callback}` as callback', () => {
		const out = transform(`<div this={(mounted) => track(mounted)} />`)
		expect(out).toContain('this:mounted=>track(mounted)')
		expect(out).not.toContain('this:r(')
	})

	it('keeps member-expression attrs on standard getter/setter ReactiveProp emission', () => {
		const out = transform(`<div value={state.count} />`)
		expect(out).toContain('value:_sursaut_r(()=>state.count,val=>state.count=val)')
		expect(out).not.toContain('_sursaut_r(state,"count")')
	})
})

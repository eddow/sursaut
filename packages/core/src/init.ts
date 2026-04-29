import { Fragment, h } from './lib/jsx-factory'

export default function setGlobals() {
	const g = typeof globalThis !== 'undefined' ? globalThis : ({} as any)
	g.h = h
	g.Fragment = Fragment

	const GLOBAL_SURSAUT_KEY = '__SURSAUT_CORE_INSTANCE__'
	if (g[GLOBAL_SURSAUT_KEY]) {
		const existing = g[GLOBAL_SURSAUT_KEY]
		throw new Error(
			`[Sursaut] Multiple instances of @sursaut/core detected!\n` +
				`First loaded: ${JSON.stringify(existing)}\n` +
				`This causes instanceof checks to fail (e.g. ReactiveProp). ` +
				`Ensure @sursaut/core is fully externalized in library builds.`
		)
	}
	g[GLOBAL_SURSAUT_KEY] = { version: '1.0.0', timestamp: Date.now() }
}

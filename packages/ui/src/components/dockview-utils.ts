/** Structural helpers for dockview renderers (ported from dockview-svelte `core/utils.ts`). */

/**
 * Env key under which each layout publishes its declarative-widget context.
 * Mirrors svelte `DOCKVIEW_CONTEXT_KEY` (there a `Symbol`, here too) — read by
 * `<DvWidget>` via its scope chain (`extend` prototype inheritance, same idiom
 * as `DisplayProvider`'s `DISPLAY_KEY`).
 */
export const DOCKVIEW_CONTEXT_KEY: unique symbol = Symbol('dockview-context')

/** Layouts that can host declarative `<DvWidget>` children. */
export type DvWidgetLayoutKind = 'dockview' | 'splitview' | 'gridview' | 'paneview'

/**
 * Context published by each layout for descendant `<DvWidget>`s.
 * `api` is populated once the layout mounts; the registry functions are stable.
 * (mirrors svelte `DockviewContext` / `SplitviewContext` / …).
 */
export interface DvWidgetLayoutContext {
	/** The parent api, available after mount. */
	api: unknown
	/** Register (or override) a widget type at runtime. */
	registerWidget: (key: string, def: Record<string, unknown>) => void
	/** Remove a widget type (used when a `<DvWidget>` child is destroyed). */
	unregisterWidget: (key: string) => void
	/** The layout this context belongs to (used by `<DvWidget>` to validate snippets). */
	kind: DvWidgetLayoutKind
}

/** True for plain objects (not arrays, not null, not class instances). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null) return false
	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}

/** Structural deep equality for JSON-like data (plain objects, arrays, primitives). */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
		return false
	}

	const aIsArray = Array.isArray(a)
	const bIsArray = Array.isArray(b)
	if (aIsArray !== bIsArray) return false

	if (aIsArray && bIsArray) {
		if (a.length !== b.length) return false
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false
		}
		return true
	}

	const aKeys = Object.keys(a)
	const bKeys = Object.keys(b)
	if (aKeys.length !== bKeys.length) return false
	for (const key of aKeys) {
		if (!Object.hasOwn(b, key)) return false
		if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
			return false
		}
	}
	return true
}

/**
 * Deep-merge `partial` into `target` in place.
 *
 * Nested plain objects are recursed into (preserving object identity so that
 * existing reactive subscriptions survive); leaf values are assigned only when
 * they actually differ, so a no-op merge triggers no reactivity.
 */
export function mergeInto(target: Record<string, unknown>, partial: Record<string, unknown>): void {
	for (const key of Object.keys(partial)) {
		const value = partial[key]
		const current = target[key]
		if (isPlainObject(value) && isPlainObject(current)) {
			mergeInto(current, value)
		} else if (!deepEqual(value, current)) {
			target[key] = value
		}
	}
}

/**
 * Structural clone of JSON-like params that preserves `undefined` values and
 * `NaN` (unlike `JSON.parse(JSON.stringify(x))`, which drops `undefined` keys
 * and coerces `NaN → null`). Used to snapshot panel params for no-op guarding,
 * where a lossy clone would silently rewrite valid data.
 */
export function cloneParams<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map(cloneParams) as unknown as T
	}
	if (isPlainObject(value)) {
		const out: Record<string, unknown> = {}
		for (const [k, v] of Object.entries(value)) {
			out[k] = cloneParams(v)
		}
		return out as T
	}
	return value
}

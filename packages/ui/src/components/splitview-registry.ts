import type { SplitviewWidget } from './splitview'

/**
 * A single splitview registry entry. No `tab`/`title` — splitview panes have
 * no headers (mirrors svelte `SplitviewWidgetDefinition`).
 */
export interface SplitviewWidgetDefinition {
	/** Content widget rendered inside the split pane. */
	component: SplitviewWidget<any>
}

/** The splitview widget registry: a map of widget key → definition. */
export type SplitviewWidgets = Record<string, SplitviewWidgetDefinition>

/**
 * Mutable widget registry consulted by the splitview factory and `openPanel`.
 * Seeded from the `widgets` prop, extended at runtime via `registerWidget`.
 */
export class SplitviewWidgetRegistry {
	private map = new Map<string, SplitviewWidgetDefinition>()

	/** Register or replace a widget definition. */
	register(key: string, def: SplitviewWidgetDefinition): void {
		this.map.set(key, def)
	}

	/** Remove a widget definition. */
	unregister(key: string): void {
		this.map.delete(key)
	}

	/** Get a widget definition by key, or `undefined` if unknown. */
	get(key: string): SplitviewWidgetDefinition | undefined {
		return this.map.get(key)
	}

	/** True if a widget with the given key is registered. */
	has(key: string): boolean {
		return this.map.has(key)
	}

	/** Seed the registry from a `{ [key]: definition }` object. */
	seed(widgets: Record<string, SplitviewWidgetDefinition>): void {
		for (const [key, def] of Object.entries(widgets)) {
			this.map.set(key, def)
		}
	}
}

/**
 * Identity helper that preserves literal keys via a `const` type param.
 * Inference is automatic — pass a plain object to `widgets` instead.
 *
 * @deprecated Pass a plain object to `widgets` instead — inference is automatic.
 */
export function defineSplitviewWidgets<const W extends SplitviewWidgets>(w: W): W {
	return w
}

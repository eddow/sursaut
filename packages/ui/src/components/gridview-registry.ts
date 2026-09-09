import type { GridviewWidget } from './gridview'

/**
 * A single gridview registry entry. No `tab`/`title` — grid cells have
 * no headers (mirrors svelte `GridviewWidgetDefinition`).
 */
export interface GridviewWidgetDefinition {
	/** Content widget rendered inside the grid cell. */
	component: GridviewWidget<any>
}

/** The gridview widget registry: a map of widget key → definition. */
export type GridviewWidgets = Record<string, GridviewWidgetDefinition>

/**
 * Mutable widget registry consulted by the gridview factory and `openPanel`.
 * Seeded from the `widgets` prop, extended at runtime via `registerWidget`.
 */
export class GridviewWidgetRegistry {
	private map = new Map<string, GridviewWidgetDefinition>()

	/** Register or replace a widget definition. */
	register(key: string, def: GridviewWidgetDefinition): void {
		this.map.set(key, def)
	}

	/** Remove a widget definition. */
	unregister(key: string): void {
		this.map.delete(key)
	}

	/** Get a widget definition by key, or `undefined` if unknown. */
	get(key: string): GridviewWidgetDefinition | undefined {
		return this.map.get(key)
	}

	/** True if a widget with the given key is registered. */
	has(key: string): boolean {
		return this.map.has(key)
	}

	/** Seed the registry from a `{ [key]: definition }` object. */
	seed(widgets: Record<string, GridviewWidgetDefinition>): void {
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
export function defineGridviewWidgets<const W extends GridviewWidgets>(w: W): W {
	return w
}

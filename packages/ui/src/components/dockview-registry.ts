import type { DockviewWidget } from './dockview'

/**
 * A single registry entry: one panel *type*, keyed by its widget key.
 * The header (`tab`) and default `title` live on the same definition as the
 * content so they can never drift (mirrors svelte `WidgetDefinition`).
 *
 * `C` preserves the content widget's generic signature so `ParamsOf` can infer
 * its params type for a typed `openPanel` (see `DockviewHandle`).
 */
export interface DockviewWidgetDefinition<
	C extends DockviewWidget<any, any> = DockviewWidget<any, any>,
> {
	/** Content widget rendered inside the panel body. */
	component: C
	/** Header widget for this definition. Omit to use the built-in default tab. */
	tab?: DockviewWidget<any, any>
	/** Default title for this widget (tier 2 in the resolution chain). */
	title?: string
}

/** The widget registry: a map of widget key → definition. */
export type DockviewWidgets = Record<string, DockviewWidgetDefinition>

/**
 * Mutable widget registry consulted by the renderer factories and `openPanel`.
 * Seeded from the `widgets` prop, extended at runtime via `registerWidget`.
 */
export class DockviewWidgetRegistry {
	private map = new Map<string, DockviewWidgetDefinition>()

	/** Register or replace a widget definition. */
	register(key: string, def: DockviewWidgetDefinition): void {
		this.map.set(key, def)
	}

	/** Remove a widget definition. */
	unregister(key: string): void {
		this.map.delete(key)
	}

	/** Get a widget definition by key, or `undefined` if unknown. */
	get(key: string): DockviewWidgetDefinition | undefined {
		return this.map.get(key)
	}

	/** True if a widget with the given key is registered. */
	has(key: string): boolean {
		return this.map.has(key)
	}

	/** Seed the registry from a `{ [key]: definition }` object. */
	seed(widgets: Record<string, DockviewWidgetDefinition>): void {
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
export function defineDockviewWidgets<const W extends DockviewWidgets>(w: W): W {
	return w
}

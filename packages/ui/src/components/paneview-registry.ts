import type { PaneviewWidget } from './paneview'

/**
 * A single paneview registry entry: one pane *type*, keyed by its widget key.
 * The header lives on the same definition as the body so they can never drift.
 * Omit `header` to use dockview's built-in default header (plain title text).
 * (mirrors svelte `PaneviewWidgetDefinition`).
 */
export interface PaneviewWidgetDefinition {
	/** Body component rendered inside the pane. */
	component: PaneviewWidget<any>
	/** Header component for this pane. Omit to use dockview's default header. */
	header?: PaneviewWidget<any>
	/** Default title for this pane (tier 2 in the resolution chain). */
	title?: string
}

/** The paneview widget registry: a map of widget key → definition. */
export type PaneviewWidgets = Record<string, PaneviewWidgetDefinition>

/**
 * Mutable widget registry consulted by the paneview factory and `openPanel`.
 * Seeded from the `widgets` prop, extended at runtime via `registerWidget`.
 */
export class PaneviewWidgetRegistry {
	private map = new Map<string, PaneviewWidgetDefinition>()

	/** Register or replace a widget definition. */
	register(key: string, def: PaneviewWidgetDefinition): void {
		this.map.set(key, def)
	}

	/** Remove a widget definition. */
	unregister(key: string): void {
		this.map.delete(key)
	}

	/** Get a widget definition by key, or `undefined` if unknown. */
	get(key: string): PaneviewWidgetDefinition | undefined {
		return this.map.get(key)
	}

	/** True if a widget with the given key is registered. */
	has(key: string): boolean {
		return this.map.has(key)
	}

	/** Seed the registry from a `{ [key]: definition }` object. */
	seed(widgets: Record<string, PaneviewWidgetDefinition>): void {
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
export function definePaneviewWidgets<const W extends PaneviewWidgets>(w: W): W {
	return w
}

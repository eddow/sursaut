import type { StyleInput } from '@sursaut/core'
import { link } from 'mutts'
import { perf, recordPerf } from '../perf'
import { client } from '../platform/shared'
import { prefetchRoute } from './lazy-cache'
import { getRouterPathnamePrefix, toAppPath, toHistoryPath } from './pathname-base'

// ── Types ────────────────────────────────────────────────────────────────────

export type LinkProps = JSX.IntrinsicElements['a'] & {
	/** Whether to show underline decoration. @default true */
	underline?: boolean
	/** Match any sub-route: aria-current="page" when pathname starts with href. @default false */
	matchPrefix?: boolean
	/** Prefetch strategy for lazy route modules. */
	prefetch?: true | 'hover' | 'intent' | 'visible'
	use?: (target: Node | Node[]) => void
	onMousedown?: (event: MouseEvent) => void
	onMouseenter?: (event: MouseEvent) => void
	onFocus?: (event: FocusEvent) => void
}

export type LinkModel = {
	/** Whether underline is shown */
	readonly style: StyleInput
	/** Mount hook for visibility-driven prefetch */
	readonly use: (target: Node | Node[]) => void
	/** Click handler — intercepts internal hrefs for SPA navigation */
	readonly onClick: (event: MouseEvent) => void
	/** Press-start handler for intent-prefetch strategies */
	readonly onMousedown: (event: MouseEvent) => void
	/** Hover/focus handler for prefetch strategies */
	readonly onMouseenter: (event: MouseEvent) => void
	/** Focus handler for prefetch strategies */
	readonly onFocus: (event: FocusEvent) => void
	/** aria-current value — 'page' when href matches current pathname */
	readonly 'aria-current': 'page' | undefined
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Headless link model — router-aware anchor behavior.
 *
 * Intercepts clicks on internal hrefs (starting with `/`) and uses `client.navigate()`.
 * Automatically computes `aria-current="page"` when href matches current pathname.
 *
 * @example
 * ```tsx
 * export function Link(props: LinkProps) {
 *   const model = linkModel(props)
 *   return (
 *     <a
 *       href={props.href}
 *       onClick={model.onClick}
 *       aria-current={model.ariaCurrent}
 *       style={model.underline ? undefined : { textDecoration: 'none' }}
 *       {...props.el}
 *     >
 *       {props.children}
 *     </a>
 *   )
 * }
 * ```
 */
export function linkModel(props: LinkProps): LinkModel {
	function shouldPrefetch(kind: 'hover' | 'intent' | 'visible'): boolean {
		if (props.prefetch === true) return kind === 'hover' || kind === 'intent'
		return props.prefetch === kind
	}

	function prefetch() {
		const href = props.href
		if (typeof href === 'string' && href.startsWith('/')) {
			void prefetchRoute(href)
		}
	}

	return {
		get style() {
			return props.underline !== false ? undefined : { textDecoration: 'none' }
		},
		use(target: Node | Node[]) {
			props.use?.(target)
			if (!shouldPrefetch('visible')) return

			const host = Array.isArray(target) ? target[0] : target
			if (!(host instanceof Element)) {
				prefetch()
				return
			}

			if (typeof IntersectionObserver === 'undefined') {
				prefetch()
				return
			}

			const observer = new IntersectionObserver((entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return
				observer.disconnect()
				prefetch()
			})

			observer.observe(host)
			link(host, () => observer.disconnect())
		},
		onClick(event: MouseEvent) {
			props.onClick?.(event)
			if (!event || event.defaultPrevented) return
			const href = props.href
			if (typeof href === 'string' && href.startsWith('/')) {
				event.preventDefault()
				const startedAt = perf?.now()
				if (startedAt != null) recordPerf('route:click', startedAt)
				client.navigate(toHistoryPath(href))
			}
		},
		onMousedown(event: MouseEvent) {
			props.onMousedown?.(event)
			if (shouldPrefetch('intent')) prefetch()
		},
		onMouseenter(event: MouseEvent) {
			props.onMouseenter?.(event as never)
			if (shouldPrefetch('hover')) prefetch()
		},
		onFocus(event: FocusEvent) {
			props.onFocus?.(event as never)
			if (shouldPrefetch('hover') || shouldPrefetch('intent')) prefetch()
		},
		get 'aria-current'() {
			const href = props.href
			if (typeof href !== 'string') return undefined
			const hrefPath = href.split('#')[0]
			if (!hrefPath) return undefined
			const pathname =
				getRouterPathnamePrefix() === '' ? client.url.pathname : toAppPath(client.url.pathname)
			if (props.matchPrefix)
				return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`) ? 'page' : undefined
			return pathname === hrefPath ? 'page' : undefined
		},
	}
}

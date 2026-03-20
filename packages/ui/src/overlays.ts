import { listen } from '@sursaut/core'
import { reactive } from 'mutts'

// ── Overlay Manager Types ────────────────────────────────────────────────────

export type OverlayMode = string

export interface OverlaySpec<T = unknown> {
	/** Unique ID for tracking. Generated if not provided. */
	id?: string
	/** Stacking and layout behavior. */
	mode: OverlayMode
	/** Renders the overlay content. If not provided, adapter must handle the mode. */
	render?: (close: (value: T) => void) => JSX.Children
	/** Custom properties passed to the overlay. */
	props?: any
	/** Whether backdrop click / Escape dismisses the overlay. */
	dismissible?: boolean
	/**
	 * Auto-focus strategy when overlay opens.
	 * - `true`: first focusable element
	 * - `false`: no auto-focus
	 * - `'container'`: focus the container itself
	 * - `'first-button'` / `'first-input'`: focus first matching element
	 * - any CSS selector string
	 */
	autoFocus?: boolean | string
	/** A11y labels */
	aria?: {
		label?: string
		labelledby?: string
		describedby?: string
	}
}

export interface OverlayEntry extends OverlaySpec {
	id: string
	resolve: (value: unknown) => void
	closing?: boolean
}

export type PushOverlayFunction = <T>(spec: OverlaySpec<T>) => Promise<T | null>

// ── Transition system ────────────────────────────────────────────────────────

export interface TransitionConfig {
	/** Duration in ms — used as timeout fallback. @default 300 */
	duration?: number
	/** CSS class added during enter animation */
	enterClass?: string
	/** CSS class added during exit animation */
	exitClass?: string
	/** CSS class added alongside enter/exit class (e.g. 'is-animating') */
	activeClass?: string
}

/**
 * Applies CSS class-based enter/exit transition to an element.
 * Listens for `animationend`/`transitionend`; falls back to a timeout.
 * Returns a cleanup function.
 *
 * @example
 * ```ts
 * applyTransition(dialogEl, 'exit', { exitClass: 'dialog-out', duration: 300 }, () => {
 *   dialogEl.remove()
 * })
 * ```
 */
export function applyTransition(
	element: HTMLElement,
	type: 'enter' | 'exit',
	config: TransitionConfig,
	onComplete?: () => void
): () => void {
	const className = type === 'enter' ? config.enterClass : config.exitClass
	const duration = config.duration ?? 300

	if (!className) {
		onComplete?.()
		return () => {}
	}

	element.classList.add(className)
	if (config.activeClass) element.classList.add(config.activeClass)

	let completed = false
	let timeoutId: ReturnType<typeof setTimeout> | undefined

	const complete = () => {
		if (completed) return
		completed = true
		if (timeoutId !== undefined) clearTimeout(timeoutId)
		element.removeEventListener('animationend', handleAnimationEnd)
		element.removeEventListener('transitionend', handleTransitionEnd)
		if (className) element.classList.remove(className)
		if (config.activeClass) element.classList.remove(config.activeClass)
		onComplete?.()
	}

	const handleAnimationEnd = (e: AnimationEvent) => {
		if (e.target === element) complete()
	}
	const handleTransitionEnd = (e: TransitionEvent) => {
		if (e.target === element) complete()
	}

	element.addEventListener('animationend', handleAnimationEnd, { once: true })
	element.addEventListener('transitionend', handleTransitionEnd, { once: true })
	timeoutId = setTimeout(complete, duration * 1.5)

	return () => {
		if (!completed) complete()
	}
}

// ── Focus trap / auto-focus helpers ──────────────────────────────────────────

const FOCUSABLE_SELECTOR =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Applies auto-focus to a container based on the given strategy.
 * Called after the overlay is mounted (typically in a `requestAnimationFrame`).
 */
export function applyAutoFocus(container: HTMLElement, strategy: boolean | string): void {
	if (strategy === false) return
	if (strategy === true || strategy === 'first') {
		const el = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
		if (el) el.focus()
		else {
			container.tabIndex = -1
			container.focus()
		}
	} else if (strategy === 'container') {
		container.tabIndex = -1
		container.focus()
	} else if (strategy === 'first-button') {
		container.querySelector<HTMLElement>('button:not([disabled])')?.focus()
	} else if (strategy === 'first-input') {
		container
			.querySelector<HTMLElement>(
				'input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
			)
			?.focus()
	} else {
		container.querySelector<HTMLElement>(strategy)?.focus()
	}
}

/**
 * Traps Tab focus within a container.
 * Returns a cleanup function that removes the keydown listener.
 */
export function trapFocus(container: HTMLElement): () => void {
	const onKeydown = (e: KeyboardEvent) => {
		if (e.key !== 'Tab') return
		const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
		if (focusables.length === 0) return
		const first = focusables[0]!
		const last = focusables[focusables.length - 1]!
		if (e.shiftKey) {
			if (document.activeElement === first) {
				last.focus()
				e.preventDefault()
			}
		} else {
			if (document.activeElement === last) {
				first.focus()
				e.preventDefault()
			}
		}
	}
	return listen(container, 'keydown', onKeydown as EventListener)
}

// ── Overlay stack logic (framework-agnostic) ─────────────────────────────────

export interface OverlayStackOptions {
	/** Modes that show a backdrop. @default ['modal', 'drawer-left', 'drawer-right'] */
	backdropModes?: string[]
	/** Transition config per mode (optional) */
	transitions?: Partial<Record<string, TransitionConfig>>
}

export interface OverlayStackState {
	/** Current overlay stack */
	readonly stack: OverlayEntry[]
	/** Whether a backdrop should be shown */
	readonly hasBackdrop: boolean
	/** Push a new overlay onto the stack */
	readonly push: PushOverlayFunction
	/** Register the mounted DOM element for an overlay (enables CSS exit transitions) */
	readonly registerElement: (id: string, el: HTMLElement) => void
	/** Whether the overlay with the given id is in the closing (exit animation) state */
	isClosing(id: string): boolean
	/** Keydown handler — wire to the overlay manager container */
	readonly onKeydown: (e: KeyboardEvent) => void
	/** Backdrop click handler */
	readonly onBackdropClick: (e: MouseEvent) => void
}

/**
 * Creates an overlay stack state object.
 * The adapter owns the JSX rendering; this provides the pure logic.
 *
 * @example
 * ```tsx
 * const WithOverlays = (props: WithOverlaysProps, env: Env) => {
 *   const state = createOverlayStack({ backdropModes: ['modal', 'drawer-left', 'drawer-right'] })
 *   env.overlay = state.push
 *   return (
 *     <fragment>
 *       {props.children}
 *       <div onKeydown={state.onKeydown}>
 *         <div if={state.hasBackdrop} onClick={state.onBackdropClick} />
 *         <for each={state.stack}>{(entry) => entry.render(entry.resolve)}</for>
 *       </div>
 *     </fragment>
 *   )
 * }
 * ```
 */
export function createOverlayStack(options: OverlayStackOptions = {}): OverlayStackState {
	const backdropModes = options.backdropModes ?? ['modal', 'drawer-left', 'drawer-right']
	const stack = reactive<OverlayEntry[]>([])
	// Separate reactive set for closing IDs — avoids rebuild-fence issues when
	// mutating entry objects that are already tracked inside a <for> render.
	const closingIds = reactive(new Set<string>())
	const overlayElements = new Map<string, HTMLElement>()

	const push: PushOverlayFunction = <T>(spec: OverlaySpec<T>): Promise<T | null> => {
		return new Promise((resolve) => {
			const id = spec.id ?? Math.random().toString(36).slice(2, 9)
			const entry: OverlayEntry = {
				...spec,
				id,
				closing: false,
				resolve: (value: unknown) => {
					const index = stack.findIndex((e) => e.id === id)
					if (index !== -1) {
						entry.closing = true
						closingIds.add(id)
						const config = options.transitions?.[entry.mode] ?? { duration: 300 }
						const el = overlayElements.get(id)
						if (el) {
							applyTransition(el, 'exit', config, () => {
								const idx = stack.findIndex((e) => e.id === id)
								if (idx !== -1) stack.splice(idx, 1)
								overlayElements.delete(id)
								closingIds.delete(id)
							})
						} else {
							setTimeout(() => {
								const idx = stack.findIndex((e) => e.id === id)
								if (idx !== -1) stack.splice(idx, 1)
								closingIds.delete(id)
							}, config.duration ?? 300)
						}
					}
					resolve(value as T | null)
				},
			}
			stack.push(entry)
		})
	}

	return {
		stack,
		get hasBackdrop() {
			return stack.some((e) => backdropModes.includes(e.mode))
		},
		push,
		registerElement: (id: string, el: HTMLElement) => overlayElements.set(id, el),
		isClosing: (id: string) => closingIds.has(id),
		get onKeydown() {
			return (e: KeyboardEvent) => {
				if (stack.length === 0) return
				const top = stack[stack.length - 1]!
				if (e.key === 'Escape' && top.dismissible !== false) {
					top.resolve(null)
					e.stopPropagation()
					e.preventDefault()
				}
			}
		},
		get onBackdropClick() {
			return (e: MouseEvent) => {
				if (e.target !== e.currentTarget) return
				const top = stack[stack.length - 1]
				if (top && top.dismissible !== false) top.resolve(null)
			}
		},
	}
}

// ── Dialog spec builder ───────────────────────────────────────────────────────

export interface DialogButton {
	text: string
	variant?: string
	disabled?: boolean
	onClick?: () => unknown
}

export interface DialogOptions {
	title?: JSX.Children
	message?: JSX.Children
	size?: 'sm' | 'md' | 'lg'
	buttons?: Record<string, string | DialogButton>
	dismissible?: boolean
	variant?: string
	/** Render function — if provided, overrides title/message/buttons */
	render?: (close: (value: unknown) => void) => JSX.Children
}

/**
 * Builds an `OverlaySpec` for a modal dialog.
 * The adapter owns the JSX structure; this provides the spec metadata.
 */
export function dialogSpec(options: DialogOptions | string): OverlaySpec {
	const opts = typeof options === 'string' ? { message: options } : options
	const titleId = opts.title ? `dialog-title-${Math.random().toString(36).slice(2, 7)}` : undefined
	const descId = opts.message ? `dialog-desc-${Math.random().toString(36).slice(2, 7)}` : undefined
	return {
		mode: 'modal',
		dismissible: opts.dismissible ?? true,
		autoFocus: true,
		aria: {
			labelledby: titleId,
			describedby: descId,
		},
		props: { ...opts, titleId, descId },
		render: opts.render,
	}
}

// ── Toast spec builder ────────────────────────────────────────────────────────

export interface ToastOptions {
	message: JSX.Children
	variant?: 'success' | 'danger' | 'warning' | 'primary' | 'secondary'
	/** Auto-close duration in ms. 0 = no auto-close. @default 3000 */
	duration?: number
	/** Render function — if provided, overrides message */
	render?: (close: (value: unknown) => void) => JSX.Children
}

/**
 * Builds an `OverlaySpec` for a toast notification.
 */
export function toastSpec(options: ToastOptions | string): OverlaySpec {
	const opts = typeof options === 'string' ? { message: options } : options
	const duration = opts.duration ?? 3000
	return {
		mode: 'toast',
		dismissible: false,
		autoFocus: false,
		props: opts,
		render: (close) => {
			if (duration > 0) {
				setTimeout(() => close(null), duration)
			}
			return opts.render?.(close) ?? opts.message
		},
	}
}

// ── Drawer spec builder ───────────────────────────────────────────────────────

export interface DrawerOptions {
	title?: JSX.Children
	children: JSX.Children
	footer?: JSX.Children
	side?: 'left' | 'right'
	dismissible?: boolean
	/** Render function — if provided, overrides children */
	render?: (close: (value: unknown) => void) => JSX.Children
}

/**
 * Builds an `OverlaySpec` for a drawer.
 */
export function drawerSpec(options: DrawerOptions): OverlaySpec {
	const side = options.side ?? 'left'
	const titleId = `drawer-title-${Math.random().toString(36).slice(2, 7)}`
	return {
		mode: `drawer-${side}`,
		dismissible: options.dismissible ?? true,
		autoFocus: true,
		aria: {
			labelledby: options.title ? titleId : undefined,
		},
		props: { ...options, titleId },
		render: options.render,
	}
}

// ── Convenience binders (adapter-agnostic) ────────────────────────────────────

export type DialogHelper = {
	(options: DialogOptions | string): Promise<string | null>
	confirm(message: string | { title?: string; message: string }): Promise<boolean>
}

export type ToastHelper = {
	(options: ToastOptions | string): Promise<unknown>
	success(msg: JSX.Children): Promise<unknown>
	error(msg: JSX.Children): Promise<unknown>
	warn(msg: JSX.Children): Promise<unknown>
	info(msg: JSX.Children): Promise<unknown>
}

export type DrawerHelper = (options: DrawerOptions) => Promise<unknown>

/**
 * Binds a dialog helper to a push function.
 * The adapter calls this to expose `env.dialog(...)`.
 */
export function bindDialog(push: PushOverlayFunction): DialogHelper {
	const fn = (options: DialogOptions | string) =>
		push(dialogSpec(options)) as Promise<string | null>
	fn.confirm = async (message: string | { title?: string; message: string }): Promise<boolean> => {
		const opts = typeof message === 'string' ? { message } : message
		const result = await push(
			dialogSpec({
				...opts,
				buttons: {
					cancel: { text: 'Cancel', variant: 'secondary' },
					ok: { text: 'Confirm', variant: 'primary' },
				},
			})
		)
		return result === 'ok'
	}
	return fn
}

/**
 * Binds a toast helper to a push function.
 */
export function bindToast(push: PushOverlayFunction): ToastHelper {
	const fn = (options: ToastOptions | string) => push(toastSpec(options))
	fn.success = (msg: JSX.Children) => push(toastSpec({ message: msg, variant: 'success' }))
	fn.error = (msg: JSX.Children) => push(toastSpec({ message: msg, variant: 'danger' }))
	fn.warn = (msg: JSX.Children) => push(toastSpec({ message: msg, variant: 'warning' }))
	fn.info = (msg: JSX.Children) => push(toastSpec({ message: msg, variant: 'primary' }))
	return fn
}

/**
 * Binds a drawer helper to a push function.
 */
export function bindDrawer(push: PushOverlayFunction): DrawerHelper {
	return (options: DrawerOptions) => push(drawerSpec(options))
}

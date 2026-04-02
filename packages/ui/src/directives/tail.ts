import { resolveElement } from './shared'

/**
 * `use:tail` directive — keeps a scrollable container pinned to the bottom
 * as content grows, unless the user scrolls away. Re-engages when the user
 * scrolls back to the bottom.
 *
 * Also preserves scroll position when element is hidden/shown via scrollKeep.
 *
 * @example
 * ```tsx
 * <div use:tail style="overflow-y: auto; height: 300px">
 *   <for each={messages}>{(msg) => <p>{msg.text}</p>}</for>
 * </div>
 * ```
 */
export function tail(target: Node | Node[], value?: boolean): (() => void) | undefined {
	const element = resolveElement(target)
	if (!element) return
	if (value === false) return
	// TODO: should use scrollKeep to keep the scrolling position on unload/reload
	const THRESHOLD = 30
	let trailing = true
	let lastScrollTop = element.scrollTop
	let wasVisible =
		element.offsetParent !== null && element.style.display !== 'none' && document.contains(element)

	const isAtBottom = () =>
		element.scrollHeight - element.scrollTop - element.clientHeight < THRESHOLD

	const isVisible = () =>
		element.offsetParent !== null && element.style.display !== 'none' && document.contains(element)

	const onScroll = () => {
		trailing = isAtBottom()
		lastScrollTop = element.scrollTop
	}

	const scrollToEnd = () => {
		if (trailing) element.scrollTop = element.scrollHeight
	}

	const restoreScroll = () => {
		if (trailing) element.scrollTop = element.scrollHeight
		else element.scrollTop = lastScrollTop
	}

	const checkVisibility = () => {
		const visible = isVisible()
		if (!wasVisible && visible) requestAnimationFrame(restoreScroll)
		if (wasVisible && !visible) lastScrollTop = element.scrollTop
		wasVisible = visible
	}

	const observer = new MutationObserver(() => {
		requestAnimationFrame(scrollToEnd)
	})
	const visibilityCheckInterval = setInterval(checkVisibility, 50)

	element.addEventListener('scroll', onScroll, { passive: true })
	observer.observe(element, { childList: true, subtree: true })

	return () => {
		element.removeEventListener('scroll', onScroll)
		observer.disconnect()
		clearInterval(visibilityCheckInterval)
	}
}

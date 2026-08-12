import { document, latch, rootEnv } from '@sursaut/core'
import { effect, reactive } from 'mutts'
import { Toolbar } from './components'
import type {
	PaletteDrawerToolbarItem,
	PaletteEditorContext,
	PaletteEditorSpec,
	PaletteItem,
	PaletteSchema,
	PaletteToolbar,
} from './types'

/** Shape of a drawer-compatible toolbar item (editor-only, carries a child toolbar). */
type DrawerItem = PaletteDrawerToolbarItem & { toolbar: PaletteToolbar }

/**
 * Shared signal: bump `version` to collapse all open drawer popups.
 *
 * Consumers watch a reactive value (e.g. `interactionMode.selectedAction`)
 * and bump this counter when they want drawers to close.
 */
export const paletteDrawerCollapse = reactive({ version: 0 })

/**
 * Icon renderer provided by the palette consumer.
 *
 * Receives the raw icon value from the item config and returns a JSX element.
 * If omitted, the icon is rendered as-is (plain string or element).
 */
export type PaletteDrawerIconRenderer = (
	icon: string | JSX.Element | (() => JSX.Element) | undefined
) => JSX.Element | undefined

/**
 * Configuration options for creating a drawer editor spec.
 */
export interface PaletteDrawerEditorOptions<
	TSchema extends PaletteSchema = PaletteSchema,
	TItem extends PaletteItem<TSchema> = PaletteItem<TSchema>,
> {
	/**
	 * Optional icon renderer. Called for the trigger button's icon.
	 * Consumers (Anarkai, Pico) inject their own icon component here.
	 */
	renderIcon?: PaletteDrawerIconRenderer

	/**
	 * CSS class for the drawer trigger button.
	 *
	 * @default 'sursaut-palette-drawer__trigger'
	 */
	triggerClass?: string

	/**
	 * CSS class for the popup overlay (fixed backdrop).
	 *
	 * @default 'sursaut-palette-drawer__overlay'
	 */
	overlayClass?: string

	/**
	 * CSS class for the popup container.
	 *
	 * @default 'sursaut-palette-drawer__popup'
	 */
	popupClass?: string

	/**
	 * Extra CSS class values appended to the popup container.
	 * Useful for axis-specific styling (e.g. `is-vertical` / `is-horizontal` are
	 * appended automatically based on the child direction).
	 */
	popupExtraClass?: (childAxis: 'horizontal' | 'vertical') => string | undefined

	/**
	 * Target element for the portal. Defaults to `document.body`.
	 */
	portalContainer?: HTMLElement

	/**
	 * Optional render function for the trigger button content.
	 * Receives the resolved icon element and label text, returns JSX for the button interior.
	 * Override to customize trigger layout (e.g. add a chevron, suppress label, etc.).
	 *
	 * @default renders icon + label
	 */
	renderTrigger?: (opts: {
		icon: JSX.Element | undefined
		label: string
		hint?: string
		open: boolean
		parentAxis?: 'horizontal' | 'vertical'
	}) => JSX.Element

	/**
	 * Optional inline style properties applied to the trigger button element.
	 * Allows consumers (e.g. Anarkai) to override parent toolbar button rules
	 * that would otherwise force a fixed square size via CSS.
	 */
	triggerStyle?: Record<string, string | number | undefined>
}

function resolveDrawerItem(item: PaletteItem): DrawerItem | undefined {
	if (item.editor !== 'drawer') return undefined
	const drawer = item as Partial<DrawerItem>
	if (!Array.isArray(drawer.toolbar)) return undefined
	return item as DrawerItem
}

/**
 * Creates a generic `PaletteEditorSpec` for the `"drawer"` editor variant.
 *
 * ## Perpendicular-direction contract
 *
 * The child popup toolbar direction is computed by **inverting** the parent axis:
 *
 * | Parent axis (`surface.axis`) | Child direction |
 * |---|---|
 * | `'horizontal'` | `'vertical'` |
 * | `'vertical'` | `'horizontal'` |
 *
 * The correct `PaletteScope.region` is propagated into the popup root so that
 * **nested drawers** inside the popup inherit the correct axis and continue
 * the perpendicular pattern at each depth level.
 *
 * ## Scope propagation
 *
 * The parent `PaletteScope` (containing `palette` and parent `region`) is
 * propagated to the popup portal via `latch()`'s `env` parameter. Without this,
 * the child `<Toolbar>` component throws `"No palette to expose"`.
 *
 * @example
 * ```ts
 * import { createPaletteDrawerEditor } from '@sursaut/ui/palette'
 * const editor = createPaletteDrawerEditor({ renderIcon: myIconRenderer })
 * ```
 */
export function createPaletteDrawerEditor<
	TSchema extends PaletteSchema = PaletteSchema,
	TItem extends PaletteItem<TSchema> = PaletteItem<TSchema>,
>(
	options: PaletteDrawerEditorOptions<TSchema, TItem> = {}
): PaletteEditorSpec<undefined, TItem, TSchema> {
	const {
		renderIcon,
		triggerClass = 'sursaut-palette-drawer__trigger',
		overlayClass = 'sursaut-palette-drawer__overlay',
		popupClass = 'sursaut-palette-drawer__popup',
		popupExtraClass,
		portalContainer,
		renderTrigger: customTrigger,
		triggerStyle: customTriggerStyle,
	} = options

	return {
		editor(context: PaletteEditorContext<undefined, TItem, TSchema>): JSX.Element {
			const item = resolveDrawerItem(context.item as PaletteItem)
			if (!item) return <span />

			const config = item.config as Record<string, unknown> | undefined
			const icon = (config?.icon ?? undefined) as
				| string
				| JSX.Element
				| (() => JSX.Element)
				| undefined
			const label = (typeof config?.label === 'string' ? config.label : undefined) ?? ''
			const hint = typeof config?.hint === 'string' ? config.hint : undefined

			const resolvedIcon = renderIcon ? renderIcon(icon) : (icon as JSX.Element | undefined)
			const title = hint ?? label

			const ui = reactive({ left: 0, top: 0, open: false })
			let trigger: HTMLButtonElement | undefined
			const parentAxis: 'horizontal' | 'vertical' =
				context.surface?.axis === 'both' ? 'horizontal' : (context.surface?.axis ?? 'horizontal')
			const childDirection = () => (parentAxis === 'vertical' ? 'horizontal' : 'vertical')

			const syncPopup = () => {
				if (!trigger) return
				const rect = trigger.getBoundingClientRect()
				const offset = 6
				if (parentAxis === 'vertical') {
					ui.left = rect.right + offset
					ui.top = rect.top
					return
				}
				ui.left = rect.left
				ui.top = rect.bottom + offset
			}

			effect`palette-drawer-popup`(() => {
				if (!ui.open) return
				syncPopup()
				const host = document.createElement('div')
				const container = portalContainer ?? document.body
				container.appendChild(host)
				const childDir = childDirection()
				const drawerEnv = Object.create(rootEnv) as Record<string, unknown>
				drawerEnv.palette = context.scope.palette
				drawerEnv.region = childDir === 'vertical' ? 'left' : 'top'

				const extraClass = popupExtraClass?.(childDir)
				const stopLatch = latch(
					host,
					<div class={overlayClass} onClick={() => (ui.open = false)}>
						<div
							class={[popupClass, `is-${childDir}`, extraClass]}
							style={{ left: `${ui.left}px`, top: `${ui.top}px` }}
							onClick={(event: Event) => event.stopPropagation()}
						>
							<Toolbar direction={childDir} toolbar={item.toolbar} />
						</div>
					</div>,
					drawerEnv
				)

				const onKey = (event: KeyboardEvent) => {
					if (event.key !== 'Escape') return
					ui.open = false
					trigger?.focus()
				}
				const onLayout = () => syncPopup()
				window.addEventListener('resize', onLayout)
				window.addEventListener('scroll', onLayout, true)
				window.addEventListener('keydown', onKey)
				return () => {
					window.removeEventListener('resize', onLayout)
					window.removeEventListener('scroll', onLayout, true)
					window.removeEventListener('keydown', onKey)
					stopLatch()
					host.remove()
				}
			})

			const triggerInterior = customTrigger ? (
				customTrigger({
					icon: resolvedIcon,
					label,
					hint,
					open: ui.open,
					parentAxis,
				})
			) : (
				<fragment>
					<span if={resolvedIcon}>{resolvedIcon}</span>
					<span if={label}>{label}</span>
				</fragment>
			)

			return (
				<button
					this={trigger}
					type="button"
					class={triggerClass}
					style={customTriggerStyle}
					aria-label={label || title}
					aria-expanded={ui.open ? 'true' : 'false'}
					title={title}
					onClick={() => {
						if (!ui.open) syncPopup()
						ui.open = !ui.open
					}}
				>
					{triggerInterior}
				</button>
			)
		},
		flags: { footprint: 'horizontal' },
	}
}

/**
 * Default drawer editor spec (no consumer-specific customization).
 *
 * Consumers should call `createPaletteDrawerEditor({ renderIcon, ... })` to
 * get a version wired to their own icon system.
 *
 * @see createPaletteDrawerEditor
 */
export const paletteDefaultDrawerEditor: PaletteEditorSpec<undefined> = createPaletteDrawerEditor()

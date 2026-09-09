import type { DockviewWidget } from '@sursaut/ui/dockview'

type BadgeContext = {
	unread?: number
}

export const BadgeTab: DockviewWidget<Record<string, unknown>, BadgeContext> = (props, scope) => {
	return (
		<div data-test="gallery-badge-tab" class="tab" style="display: flex; align-items: center; gap: 8px;">
			<span data-test="gallery-badge-title">{props.title}</span>
			{props.context.unread ? (
				<span
					data-test="gallery-badge-count"
					style="background: #d33; color: #fff; border-radius: 999px; padding: 0 6px; font-size: 11px;"
				>
					{String(props.context.unread)}
				</span>
			) : null}
			<button data-test="gallery-badge-close" type="button" aria-label="Close" onClick={() => scope.panelApi?.close()}>
				×
			</button>
		</div>
	)
}

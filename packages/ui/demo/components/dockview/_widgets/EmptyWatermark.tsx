import type { DockviewWatermarkProps } from '@sursaut/ui/dockview'

export const EmptyWatermark = (props: DockviewWatermarkProps) => {
	return (
		<div
			data-test="gallery-watermark"
			style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; height: 100%; color: #94a3b8;"
		>
			<p data-test="gallery-watermark-text" style="margin: 0;">
				Empty dock — open a panel to begin
			</p>
			<button
				data-test="gallery-watermark-open"
				type="button"
				style="background: #2563eb; color: white; border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer;"
				onClick={() => props.openPanel('a', { params: { text: 'Opened from empty state' } })}
			>
				open panel
			</button>
		</div>
	)
}

import type { DockviewWidget } from '@sursaut/ui/dockview'

type InboxContext = {
	unread?: number
}

export const InboxPanel: DockviewWidget<Record<string, unknown>, InboxContext> = (props) => {
	const unread = () => Number(props.context.unread ?? 0)
	return (
		<div
			data-test="gallery-inbox-panel"
			style="padding: 16px; height: 100%; box-sizing: border-box; background: #0f172a; color: white; display: flex; flex-direction: column; gap: 12px;"
		>
			<p>
				unread: <strong data-test="gallery-inbox-unread">{String(unread())}</strong>
			</p>
			<button
				data-test="gallery-inbox-inc"
				onClick={() => {
					props.context.unread = unread() + 1
				}}
			>
				unread++ (tab badge updates)
			</button>
		</div>
	)
}

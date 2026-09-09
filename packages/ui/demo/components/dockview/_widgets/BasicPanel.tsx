import type { DockviewWidget } from '@sursaut/ui/dockview'

type BasicParams = {
	text?: string
}

export const BasicPanel: DockviewWidget<BasicParams> = (props) => {
	return (
		<div
			data-test="gallery-basic-panel"
			style="padding: 16px; height: 100%; box-sizing: border-box; background: #0f172a; color: white;"
		>
			<p data-test="gallery-basic-text">{props.params.text ?? 'Hello from a widget'}</p>
			<p data-test="gallery-basic-size" style="opacity: 0.7; font-size: 12px;">
				size: {props.size.width} × {props.size.height}
			</p>
		</div>
	)
}

import { ReactiveProp } from '@sursaut/core'
import { sizeable } from '@sursaut/ui'
import { reactive } from 'mutts'
import '../../src/styles/sizeable.sass'

export default function SizeableDemo() {
	const state = reactive({ width: 200 })
	const width = new ReactiveProp(
		() => state.width,
		(v) => {
			state.width = v
		}
	)
	const dir = sizeable(width)
	return (
		<div data-test="sizeable-demo">
			<p style="color: #94a3b8; margin-bottom: 16px;">
				Drag the right edge of the sidebar to resize it. Width persists in state.
			</p>
			<div
				data-test="sizeable-container"
				style="display: flex; height: 200px; border: 1px solid #334155; border-radius: 8px; overflow: hidden;"
			>
				<div
					data-test="sizeable-panel"
					use={dir}
					style="background: #0f172a; width: var(--sizeable-width, 200px); min-width: 80px; max-width: 500px; flex-shrink: 0;"
				>
					<div style="padding: 12px; color: #94a3b8; font-size: 13px;">Sidebar</div>
				</div>
				<div style="flex: 1 1 0%; background: #1e293b; padding: 12px; color: #94a3b8; font-size: 13px; overflow: auto;">
					Main content
				</div>
			</div>
			<p data-test="sizeable-width" style="color: #94a3b8; margin-top: 12px; font-size: 13px;">
				Width: {state.width}px
			</p>
		</div>
	)
}

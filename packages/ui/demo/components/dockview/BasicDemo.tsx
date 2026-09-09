import { Dockview, type DockviewHandle } from '@sursaut/ui/dockview'
import { themeAbyss } from 'dockview'
import { reactive } from 'mutts'
import { BasicPanel } from './_widgets/BasicPanel'

const widgets = {
	basic: { component: BasicPanel, title: 'Basic' },
}

export default function BasicDemo() {
	const state = reactive<{ handle: DockviewHandle | undefined }>({ handle: undefined })

	const onReady = (_api: unknown, handle?: DockviewHandle) => {
		if (handle) {
			state.handle = handle
			handle.openPanel('basic', { params: { text: 'Hello from a widget' } })
		}
	}

	return (
		<div data-test="gallery-basic-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>Basic: open a widget</h2>
			<div data-test="gallery-basic-shell" style="height: 40vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;">
				<Dockview
					handle={state.handle}
					widgets={widgets}
					options={{ theme: themeAbyss }}
					el={{ style: 'height: 100%; width: 100%;' }}
					onReady={onReady}
				/>
			</div>
		</div>
	)
}

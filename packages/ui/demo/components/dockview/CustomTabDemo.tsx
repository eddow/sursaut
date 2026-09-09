import { Dockview, type DockviewHandle } from '@sursaut/ui/dockview'
import { themeAbyss } from 'dockview'
import { reactive } from 'mutts'
import { BadgeTab } from './_widgets/BadgeTab'
import { InboxPanel } from './_widgets/InboxPanel'

const widgets = {
	inbox: { component: InboxPanel, tab: BadgeTab, title: 'Inbox' },
	plain: { component: InboxPanel, title: 'Plain' },
}

export default function CustomTabDemo() {
	const state = reactive<{ handle: DockviewHandle | undefined }>({ handle: undefined })

	const onReady = (_api: unknown, handle?: DockviewHandle) => {
		if (handle) {
			state.handle = handle
			handle.openPanel('inbox', { title: 'Inbox (custom tab)' })
			handle.openPanel('plain', { title: 'Plain (default tab)' })
		}
	}

	return (
		<div data-test="gallery-custom-tab-demo" style="padding: 20px; background: #0f172a; border-radius: 8px; color: white;">
			<h2>Custom tab + shared state</h2>
			<p style="color: #94a3b8; max-width: 72ch;">
				Tab and content receive the <em>same</em> state — <code>context.unread</code> set in
				the content renders as a badge in the tab.
			</p>
			<div data-test="gallery-custom-tab-shell" style="height: 40vh; border: 1px solid #334155; border-radius: 12px; overflow: hidden; background: #020617;">
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

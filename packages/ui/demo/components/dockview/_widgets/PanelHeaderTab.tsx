import type { DockviewWidget } from '@sursaut/ui/dockview'

export const PanelHeaderTab: DockviewWidget = (props, scope) => {
	const floatPanel = () => {
		const api = scope.dockviewApi
		const id = scope.panelApi?.id
		if (!api || !id) return
		const panel = api.getPanel(id)
		if (panel) api.addFloatingGroup(panel)
	}
	const popoutPanel = () => {
		const api = scope.dockviewApi
		const id = scope.panelApi?.id
		if (!api || !id) return
		const panel = api.getPanel(id)
		if (panel) void api.addPopoutGroup(panel)
	}
	return (
		<div data-test="gallery-panel-tab" class="tab" style="display: flex; align-items: center; gap: 4px;">
			<span data-test="gallery-panel-tab-title" class="title" title={props.title}>
				{props.title}
			</span>
			<button data-test="gallery-float-panel" type="button" title="Float panel" aria-label="Float panel" onClick={floatPanel}>
				⧉
			</button>
			<button data-test="gallery-popout-panel" type="button" title="Popout panel" aria-label="Popout panel" onClick={popoutPanel}>
				↗
			</button>
			<button data-test="gallery-panel-tab-close" type="button" aria-label="Close" onClick={() => scope.panelApi?.close()}>
				×
			</button>
		</div>
	)
}

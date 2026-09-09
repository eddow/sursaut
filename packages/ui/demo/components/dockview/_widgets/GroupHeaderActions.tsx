import type { DockviewHeaderAction } from '@sursaut/ui/dockview'

export const GroupHeaderActions: DockviewHeaderAction = ({ group }, scope) => {
	return (
		<div data-test={`gallery-group-actions-${group.id}`} style="display: flex; align-items: center; gap: 4px; padding-right: 4px;">
			<button
				data-test="gallery-float-group"
				type="button"
				title="Float group"
				aria-label="Float group"
				style="background: transparent; border: none; cursor: pointer; color: inherit; opacity: 0.7;"
				onClick={() => scope.dockviewApi?.addFloatingGroup(group)}
			>
				⧉
			</button>
			<button
				data-test="gallery-popout-group"
				type="button"
				title="Popout group"
				aria-label="Popout group"
				style="background: transparent; border: none; cursor: pointer; color: inherit; opacity: 0.7;"
				onClick={() => scope.dockviewApi?.addPopoutGroup(group)}
			>
				↗
			</button>
		</div>
	)
}

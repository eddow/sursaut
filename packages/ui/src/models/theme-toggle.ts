import { document, listen } from '@sursaut/core'
import { reactive } from 'mutts'

export type ThemeValue = 'auto' | 'light' | 'dark'

export type ThemeToggleProps = {
	/** Reactive object with a `theme` property — mutated on user action */
	settings: { theme: ThemeValue }
	/** Resolved theme from DisplayContext (never 'auto') */
	resolvedTheme: string
	/** Custom labels per theme key */
	labels?: Record<string, string>
	/** Label for the 'auto' option. Default: 'Auto' */
	autoLabel?: string
	/** Additional themes beyond dark/light */
	themes?: string[]
}

export type ThemeToggleModel = {
	/** Whether the setting is currently 'auto' */
	readonly isAuto: boolean
	/** The current setting ('auto' | 'light' | 'dark') */
	readonly themeSetting: ThemeValue
	/** Label for the current setting (e.g. "Auto (Light)") */
	readonly currentLabel: string
	/** All available theme options for a dropdown */
	readonly allThemes: string[]
	/** Toggle between light/dark (ignores auto) */
	toggle(): void
	/** Set a specific theme */
	select(theme: ThemeValue): void
	/** Set to auto */
	selectAuto(): void
	/** Spreadable attrs for the main toggle button */
	readonly button: {
		readonly 'aria-label': string
		readonly type: 'button'
		readonly onClick: () => void
	}
	/** Dropdown menu open state */
	menuOpen: boolean
	/** Spreadable attrs for the dropdown trigger button */
	readonly dropdownButton: {
		readonly type: 'button'
		readonly 'aria-haspopup': 'menu'
		readonly 'aria-expanded': boolean
		readonly onClick: (e: MouseEvent) => void
	}
	/** Attrs for a theme option button */
	optionButton(theme: string): {
		readonly type: 'button'
		readonly role: 'menuitemradio'
		readonly 'aria-checked': boolean
		readonly onClick: () => void
	}
	/** Attrs for the auto option button */
	readonly autoButton: {
		readonly type: 'button'
		readonly role: 'menuitemradio'
		readonly 'aria-checked': boolean
		readonly onClick: () => void
	}
	/** use= callback for click-outside handling */
	readonly clickOutside: (el: HTMLElement) => () => void
}

const DEFAULT_LABELS: Record<string, string> = {
	light: 'Light',
	dark: 'Dark',
	auto: 'Auto',
}

export function themeToggleModel(props: ThemeToggleProps): ThemeToggleModel {
	const state = reactive({
		menuOpen: false,
	})

	const getLabel = (theme: string) => {
		if (theme === 'auto') return props.autoLabel ?? DEFAULT_LABELS.auto
		return props.labels?.[theme] ?? DEFAULT_LABELS[theme] ?? theme
	}

	const model: ThemeToggleModel = {
		get isAuto() {
			return props.settings.theme === 'auto'
		},
		get themeSetting() {
			return props.settings.theme
		},
		get currentLabel() {
			const label = getLabel(props.settings.theme)
			if (props.settings.theme === 'auto') {
				const resolved = getLabel(props.resolvedTheme)
				return `${label} (${resolved})`
			}
			return label
		},
		get allThemes() {
			return props.themes ?? ['light', 'dark']
		},

		toggle() {
			// Toggle between light/dark based on RESOLVED theme
			props.settings.theme = props.resolvedTheme === 'dark' ? 'light' : 'dark'
		},

		select(theme: ThemeValue) {
			props.settings.theme = theme
			state.menuOpen = false
		},

		selectAuto() {
			props.settings.theme = 'auto'
			state.menuOpen = false
		},

		get button() {
			const label = this.currentLabel
			const toggle = () => model.toggle()
			return {
				'aria-label': `Current theme: ${label}. Click to toggle.`,
				type: 'button' as const,
				onClick: toggle,
			}
		},

		get menuOpen() {
			return state.menuOpen
		},
		set menuOpen(v: boolean) {
			state.menuOpen = v
		},

		get dropdownButton() {
			return {
				type: 'button' as const,
				'aria-haspopup': 'menu' as const,
				'aria-expanded': state.menuOpen,
				onClick: (e: MouseEvent) => {
					e.stopPropagation()
					state.menuOpen = !state.menuOpen
				},
			}
		},

		optionButton(theme: string) {
			return {
				type: 'button' as const,
				role: 'menuitemradio' as const,
				'aria-checked': props.settings.theme === theme,
				onClick: () => model.select(theme as ThemeValue),
			}
		},

		get autoButton() {
			return {
				type: 'button' as const,
				role: 'menuitemradio' as const,
				'aria-checked': props.settings.theme === 'auto',
				onClick: () => model.selectAuto(),
			}
		},

		clickOutside: (el: HTMLElement) => {
			const handler = (e: MouseEvent) => {
				if (state.menuOpen && !el.contains(e.target as Node)) {
					state.menuOpen = false
				}
			}
			return listen(document, 'click', handler as EventListener)
		},
	}

	return model
}

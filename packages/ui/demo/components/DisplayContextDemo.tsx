import type { Env } from '@sursaut/core'
import { DisplayProvider, useDisplayContext } from '@sursaut/kit'
import { Date as IntlDate, Number as IntlNumber } from '@sursaut/kit'
import { type ThemeValue, themeToggleModel } from '@sursaut/ui'
import { reactive } from 'mutts'

type ThemeSettings = { theme: ThemeValue }

function ThemeToggleControls(props: { settings: ThemeSettings }, env: Env) {
	const dc = useDisplayContext(env)
	const model = themeToggleModel({
		settings: props.settings,
		get resolvedTheme() {
			return dc.theme
		},
		labels: { light: 'Day Mode', dark: 'Night Mode' },
	})

	return (
		<div
			style="display: flex; align-items: center; gap: 12px; position: relative;"
			use={model.clickOutside}
		>
			<button
				data-test="themetoggle-main"
				style="padding: 10px; background: #334155; border: 1px solid #475569; border-radius: 8px; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px;"
				aria-label={model.button['aria-label']}
				type={model.button.type}
				onClick={model.button.onClick}
			>
				{dc.theme === 'dark' ? '🌙' : '☀️'}
				<span data-test="themetoggle-current">{model.currentLabel}</span>
			</button>

			<button
				data-test="themetoggle-menu-toggle"
				style="padding: 10px; background: #334155; border: 1px solid #475569; border-radius: 8px; color: white; cursor: pointer;"
				type="button"
				aria-haspopup="menu"
				aria-expanded={model.menuOpen}
				onClick={(e) => {
					e.stopPropagation()
					model.menuOpen = !model.menuOpen
				}}
			>
				▾
			</button>

			<div
				if={model.menuOpen}
				data-test="themetoggle-menu"
				style="position: absolute; top: 100%; right: 0; margin-top: 8px; background: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 4px; min-width: 140px; z-index: 100; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);"
			>
				<for each={model.allThemes}>
					{(theme) => (
						<button
							data-test={`theme-option-${theme}`}
							style={`width: 100%; text-align: left; padding: 8px 12px; background: ${props.settings.theme === theme ? '#3b82f6' : 'transparent'}; border: none; border-radius: 4px; color: white; cursor: pointer;`}
							type="button"
							role="menuitemradio"
							aria-checked={props.settings.theme === theme}
							onClick={() => model.select(theme as ThemeValue)}
						>
							{theme === 'light' ? '☀️ Light' : '🌙 Dark'}
						</button>
					)}
				</for>
				<div style="height: 1px; background: #334155; margin: 4px 0;" />
				<button
					data-test="theme-option-auto"
					style={`width: 100%; text-align: left; padding: 8px 12px; background: ${props.settings.theme === 'auto' ? '#3b82f6' : 'transparent'}; border: none; border-radius: 4px; color: white; cursor: pointer;`}
					type="button"
					role="menuitemradio"
					aria-checked={props.settings.theme === 'auto'}
					onClick={() => model.selectAuto()}
				>
					🖥️ Auto
				</button>
			</div>
		</div>
	)
}

export default function DisplayContextDemo() {
	const settings = reactive<ThemeSettings>({ theme: 'auto' })
	const state = reactive({
		direction: 'ltr' as 'ltr' | 'rtl',
		locale: 'en-US',
	})

	return (
		<DisplayProvider theme={settings.theme} direction={state.direction} locale={state.locale}>
			<div
				data-test="themetoggle-demo"
				style="padding: 20px; background: #1e293b; border-radius: 8px; color: white;"
			>
				<h2>Display Context Demo</h2>
				<p style="color: #94a3b8; margin-top: 0; margin-bottom: 14px;">
					Theme controls with active locale + direction context.
				</p>

				<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
					<button data-test="set-dir-ltr" onClick={() => (state.direction = 'ltr')}>
						LTR
					</button>
					<button data-test="set-dir-rtl" onClick={() => (state.direction = 'rtl')}>
						RTL
					</button>
					<button data-test="set-locale-en" onClick={() => (state.locale = 'en-US')}>
						en-US
					</button>
					<button data-test="set-locale-fr" onClick={() => (state.locale = 'fr-FR')}>
						fr-FR
					</button>
				</div>

				<ThemeToggleControls settings={settings} />

				<DisplayContextIllustration />

				<p style="margin-top: 16px; font-size: 14px; color: #94a3b8;">
					Setting:{' '}
					<code data-test="setting-theme" data-value={settings.theme} style="color: white;">
						{settings.theme}
					</code>
					<br />
					Direction: <ContextValue testId="dc-direction" selector="direction" />
					<br />
					Locale: <ContextValue testId="dc-locale" selector="locale" />
				</p>
			</div>
		</DisplayProvider>
	)
}

function DisplayContextIllustration(_props: {}, env: Env) {
	const dc = useDisplayContext(env)
	const view = {
		get previewStyle() {
			const dark = dc.theme === 'dark'
			return `margin-top: 16px; padding: 14px; border-radius: 10px; border: 1px solid ${dc.direction === 'rtl' ? '#a78bfa' : '#475569'}; background: ${dark ? '#020617' : '#e2e8f0'}; color: ${dark ? '#f8fafc' : '#0f172a'}; transition: all 0.2s;`
		},
		get intlStyle() {
			return `margin-top: 16px; display: grid; gap: 8px; color: ${dc.theme === 'dark' ? '#cbd5e1' : '#334155'}; font-size: 14px;`
		},
	}
	return (
		<>
			<div data-test="theme-preview" style={view.previewStyle}>
				<div data-test="theme-preview-label" style="font-weight: 600; margin-bottom: 4px;">
					Resolved theme: <ContextValue testId="dc-theme" selector="theme" />
				</div>
				<div style="font-size: 13px; opacity: 0.85;">
					Direction-sensitive border + locale-sensitive examples below.
				</div>
			</div>

			<div style={view.intlStyle}>
				<div>
					Number:{' '}
					<span data-test="intl-number">
						<IntlNumber value={1234567.89} maximumFractionDigits={2} />
					</span>
				</div>
				<div>
					Date:{' '}
					<span data-test="intl-date">
						<IntlDate
							value="2024-05-06T14:30:00.000Z"
							timeZone="UTC"
							year="numeric"
							month="long"
							day="numeric"
						/>
					</span>
				</div>
			</div>
		</>
	)
}

function ContextValue(
	props: { testId: string; selector: 'theme' | 'direction' | 'locale' },
	env: Env
) {
	const dc = useDisplayContext(env)
	const get = {
		get value() {
			return props.selector === 'theme'
				? dc.theme
				: props.selector === 'direction'
					? dc.direction
					: dc.locale
		},
	}
	return (
		<code data-test={props.testId} data-value={get.value} style="color: white;">
			{get.value}
		</code>
	)
}

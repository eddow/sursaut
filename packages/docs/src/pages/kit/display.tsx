import { ApiTable, Code, PackageHeader, Section } from '../../components'

const basicUsage = `import { DisplayProvider } from '@sursaut/kit'
import { ThemeToggle } from '@sursaut'
import { reactive } from 'mutts'

const settings = reactive({ theme: 'auto' as const })

function Header() {
  return (
    <DisplayProvider theme={settings.theme}>
      <header>
        <ThemeToggle settings={settings} />
      </header>
    </DisplayProvider>
  )
}`

const themeState = `import type { Env } from '@sursaut/core'
import { useDisplayContext } from '@sursaut/kit'

function ThemeLabel(_props: {}, env: Env) {
  const dc = useDisplayContext(env)
  return <span>{dc.theme}</span>
}`

const envSnippet = `import { DisplayProvider } from '@sursaut/kit'

// DisplayProvider resolves 'auto' against the parent provider or system defaults.
// It sets data-theme, dir, and lang on its own DOM element.
<DisplayProvider theme="auto" direction="auto" locale="auto" timeZone="auto">
  <App />
</DisplayProvider>`

export default function DisplayPage() {
	return (
		<article>
			<PackageHeader
				name="@sursaut/kit"
				description="Theme management and display utilities."
				install="pnpm add @sursaut/kit @sursaut/ui @sursaut/adapter-pico"
			/>

			<Section title="Theme Toggle">
				<p>
					The <code>ThemeToggle</code> component provides a UI for switching between Light, Dark,
					and Auto themes. It mutates a reactive <code>{'{ theme }'}</code> object that you own,
					while <code>DisplayProvider</code> itself comes from <code>@sursaut/kit</code>.
				</p>
				<Code code={basicUsage} lang="tsx" />

				<ApiTable
					props={[
						{
							name: 'settings',
							type: '{ theme: ThemeValue }',
							description: 'Reactive object read and mutated by the toggle.',
						},
						{
							name: 'simple',
							type: 'boolean',
							description:
								'If true, shows a simple toggle (light/dark) without the dropdown for Auto.',
						},
						{
							name: 'el',
							type: "JSX.IntrinsicElements['button']",
							description: 'Pass-through attributes for the trigger button.',
						},
					]}
				/>
			</Section>

			<Section title="Reactive Theme State">
				<p>
					Read resolved display values from env with <code>useDisplayContext()</code>. This gives
					you <code>theme</code>, <code>direction</code>, <code>locale</code>, and{' '}
					<code>timeZone</code> for the current subtree.
				</p>
				<Code code={themeState} lang="tsx" />
			</Section>

			<Section title="Env & DisplayProvider">
				<p>
					<code>DisplayProvider</code> lives in <code>@sursaut/kit</code> and is re-exported by the
					front-end barrel. It resolves <code>auto</code> values against the parent provider or
					system defaults, then writes the resolved values onto its own DOM wrapper.
				</p>
				<Code code={envSnippet} lang="tsx" />
			</Section>
		</article>
	)
}

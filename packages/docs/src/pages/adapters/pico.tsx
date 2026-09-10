import { Code, PackageHeader, Section } from '../../components'

const install = `pnpm add @sursaut/core @sursaut/kit @sursaut/ui @sursaut/adapter-pico @picocss/pico mutts

// vite.config.ts
import { sursautBarrelPlugin, sursautMinimalPackage } from '@sursaut/core/plugin'

export default defineConfig({
  plugins: [
    ...sursautMinimalPackage(),
    sursautBarrelPlugin({
      skeleton: 'front-end',
      adapter: '@sursaut/adapter-pico',
    }),
  ],
})

// The adapter re-exports PicoCSS base styles, so no extra CSS import is needed.
// Semantic variants (success/danger/...) come from '@sursaut/adapter-pico/css'.`

const variantTable = `import { picoButtonClass, picoComponent } from '@sursaut/adapter-pico'
import { uiComponent } from '@sursaut/ui'

// PicoVariant = 'primary' | 'secondary' | 'contrast' | 'danger' | 'success' | 'ghost'
picoButtonClass('primary')            // 'btn btn-primary'
picoButtonClass('danger', true)       // 'btn outline btn-danger'

// Wrap a headless model with Pico classes:
export const Button = picoComponent(function Button(props) {
  return <button class={picoButtonClass(props.variant ?? 'secondary', props.outline)} />
})

// picoComponent = uiComponent(PICO_VARIANTS): generates Button.primary,
// Button.danger, ... dot-syntax from the variant list.`

const tooltipSnippet = `// Register once on your env (adapter directive, not in @sursaut/ui):
import { tooltip } from '@sursaut/adapter-pico'
Object.assign(rootEnv, { tooltip })

// Pure-CSS tooltip via Pico's data-tooltip / data-placement:
<button use:tooltip="Save">Save</button>
<button use:tooltip={{ text: 'Delete', placement: 'bottom' }}>Delete</button>`

const iconSnippet = `// Icon factory: pure-glyf class names render as <span class={name} />
import { registerGlyfIconFactory } from 'pure-glyf/sursaut'
import { tablerSun } from 'pure-glyf/icons'

registerGlyfIconFactory()

<Button icon={tablerSun}>Themed</Button>`

export default function PicoAdapterPage() {
	return (
		<article>
			<PackageHeader
				name="@sursaut/adapter-pico"
				description="Adapter for the PicoCSS framework."
			/>

			<Section title="Installation">
				<Code code={install} lang="tsx" />
			</Section>

			<Section title="Variant bridge">
				<p>
					PicoCSS uses semantic color names mapped to CSS variables (<code>primary</code>,{' '}
					<code>secondary</code>, <code>contrast</code>, <code>danger</code> →{' '}
					<code>--pico-del-color</code>, <code>success</code> → <code>--pico-ins-color</code>,{' '}
					<code>ghost</code>). <code>picoButtonClass()</code> composes <code>btn</code> /{' '}
					<code>outline</code> / <code>btn-{'{variant}'}</code> classes;{' '}
					<code>picoComponent()</code> generates the <code>Button.primary</code> dot-syntax from
					that list.
				</p>
				<Code code={variantTable} lang="tsx" />
			</Section>

			<Section title="Tooltip directive">
				<p>
					The adapter's only directive. <code>use:tooltip</code> sets <code>data-tooltip</code>/
					<code>data-placement</code> and lets PicoCSS do the rest — no JS positioning. Cleanup
					removes both attributes.
				</p>
				<Code code={tooltipSnippet} lang="tsx" />
			</Section>

			<Section title="Icon factory">
				<p>
					Works out of the box with pure-glyf: <code>registerGlyfIconFactory()</code> renders icon
					names as sized <code>{'<span>'}</code> elements, so <code>icon={'{name}'}</code> props
					just work.
				</p>
				<Code code={iconSnippet} lang="tsx" />
			</Section>
		</article>
	)
}

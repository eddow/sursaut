import { Code, PackageHeader, Section } from '../../components'

const adapterPattern = `// vite.config.ts
import { sursautBarrelPlugin, sursautMinimalPackage } from '@sursaut/core/plugin'

export default defineConfig({
  plugins: [
    ...sursautMinimalPackage(),
    sursautBarrelPlugin({
      name: '@sursaut',
      skeleton: 'front-end',
      adapter: '@sursaut/adapter-pico',
    }),
  ],
})

// app.tsx
import { Button } from '@sursaut'

<Button.primary>Save</Button.primary>`

const wrapperSnippet = `import { gather } from '@sursaut/ui'
import { type ButtonProps as BaseButtonProps, buttonModel } from '@sursaut/ui/models'
import { picoComponent, type PicoButtonLikeProps, picoButtonClass } from '../factory'

export type ButtonProps = PicoButtonLikeProps<BaseButtonProps>

export const Button = picoComponent(function Button(props: ButtonProps) {
  const model = buttonModel(props)

  return (
    <button {...props.el} class={picoButtonClass(props.variant ?? 'secondary', props.outline)} {...model.button}>
      {model.icon && <span {...model.icon.span}>{model.icon.element}</span>}
      {model.hasLabel && gather(props.children)}
    </button>
  )
})`

export default function AdaptersIndexPage() {
	return (
		<article>
			<PackageHeader
				name="Adapters"
				description="The secret to framework-agnostic UI. Adapters decouple component logic from specific CSS frameworks."
			/>

			<Section title="The Pattern">
				<p>
					Sursaut keeps behavior and visuals separate. <code>@sursaut/ui</code> owns models,
					directives, and overlay logic; an adapter such as <code>@sursaut/adapter-pico</code>
					wraps those models with concrete DOM shape and framework classes.
				</p>
				<p>
					The app itself normally imports through a generated <code>@sursaut</code> barrel, so you
					can swap adapters without changing application imports.
				</p>
				<Code code={adapterPattern} lang="tsx" />
			</Section>

			<Section title="Wrapper Components">
				<p>
					Adapters are ordinary packages exporting components built on top of headless models. The
					common pattern is: narrow adapter-side props, call the model, then render DOM and classes.
				</p>
				<Code code={wrapperSnippet} lang="tsx" />
			</Section>

			<Section title="Consumption">
				<p>
					Consumers do not install or mutate a global adapter registry. They pick an adapter at
					build time, import from <code>@sursaut</code> or the adapter package, and use the
					resulting components directly. There is no <code>getAdapter()</code> /{' '}
					<code>setAdapter()</code> or <code>UiComponents</code> registry in the current source —
					older drafts described one; the barrel plugin replaced it.
				</p>
			</Section>
		</article>
	)
}

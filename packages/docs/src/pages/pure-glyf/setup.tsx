import { Code, PackageHeader, Section } from '../../components'

const pluginSnippet = `// vite.config.ts
import { pureGlyfPlugin } from 'pure-glyf/plugin'

export default defineConfig({
  plugins: [
    pureGlyfPlugin({
      // Prefix -> directory of SVG sources (recursive scan)
      icons: { Tabler: './icons/tabler', App: './src/assets' },
      // optional: dts defaults to '.generated-types/pure-glyf.d.ts'
    }),
  ],
})`

const pipelineSnippet = `// Build pipeline per prefix directory:
//   scan *.svg (recursive) -> toPascalCase names -> svgToDataUri (optimized encoder)
//   -> virtual modules 'pure-glyf/icons' + 'pure-glyf/icons.css'
//   -> .d.ts with one constant per icon (written to disk for IDE support)
//
// Dev: regenerates + full-reload on change. Prod: generated once at build.`

const namingSnippet = `// icons/tabler/sun.svg + icons/tabler/moon-stars.svg with prefix Tabler:
//   -> tablerSun, tablerMoonStars (camelCase: prefix + PascalCase path)
import { tablerSun } from 'pure-glyf/icons'`

export default function PureGlyfSetupPage() {
	return (
		<article>
			<PackageHeader
				name="Pure-glyf Setup"
				description="Vite plugin: SVG directories to tree-shakeable icon modules."
				install="pnpm add pure-glyf"
			/>

			<Section title="Plugin">
				<Code code={pluginSnippet} lang="tsx" />
			</Section>

			<Section title="Pipeline">
				<Code code={pipelineSnippet} lang="text" />
			</Section>

			<Section title="Naming">
				<Code code={namingSnippet} lang="tsx" />
			</Section>
		</article>
	)
}

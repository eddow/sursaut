import { Code, PackageHeader, Section } from '../../components'

const importsCode = `import {
  Ide,
  Palette,
  Parking,
  Toolbar,
  ToolbarBorder,
  ToolbarTrack,
  createPaletteKeys,
  paletteAddItemEntries,
  paletteCommandBoxModel,
  paletteCommandEntries,
  paletteDerivedVariants,
  type PaletteToolbarItem,
} from '@sursaut/ui/palette'
import { PicoPaletteCommandBox, picoPalettePreset } from '@sursaut/adapter-pico'`

const createCode = `const tools = {
  notifications: {
    label: 'Notifications',
    icon: 'bell',
    type: 'boolean',
    value: true,
    default: true,
  },
  theme: {
    label: 'Theme',
    icon: 'sun',
    type: 'enum',
    value: 'system',
    default: 'system',
    values: [
      { value: 'system', label: 'System' },
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ],
  },
  zoom: {
    label: 'Zoom',
    icon: 'search',
    type: 'number',
    value: 100,
    default: 100,
    min: 50,
    max: 200,
    step: 10,
  },
  command: {
    label: 'Command palette',
    icon: 'terminal',
    can: true,
    run() {
      console.log('open command box')
    },
  },
}

const palette = new Palette({
  tools,
  keys: createPaletteKeys({
    P: 'command',
    '+': 'zoom:inc',
    '-': 'zoom:dec',
    D: 'theme|dark',
  }),
  editable: true,
  ...picoPalettePreset,
})`

const layoutCode = `const top: PaletteToolbarItem[] = [
  { tool: 'command', editor: 'button' },
  { tool: 'notifications', editor: 'toggle' },
  { tool: 'theme', editor: 'select' },
]

<Ide
  palette={palette}
  config={{
    top: [{ space: 1, toolbar: top }],
    left: [],
    right: [],
    bottom: [],
  }}
>
  <main>Application content</main>
</Ide>`

const commandBoxCode = `const entries = paletteCommandEntries({ palette })
const commandBox = paletteCommandBoxModel({
  entries,
  placeholder: 'Search tools and commands',
})

<PicoPaletteCommandBox
  commandBox={commandBox}
  palette={palette}
  expanded
/>`

const addItemCode = `const sources = paletteAddItemEntries({ palette })
const derived = paletteDerivedVariants({
  palette,
  entry: sources[0],
})

// derived now contains insertable variants such as:
// - the base tool item
// - set variants (tool|value)
// - numeric actions like tool:inc / tool:dec`

export default function PalettePage() {
	return (
		<article>
			<PackageHeader
				name="@sursaut/ui/palette"
				description="Headless palette runtime, layout primitives, and command-box helpers for tool-driven UI surfaces."
			/>

			<p>
				The palette API lives on the dedicated <code>@sursaut/ui/palette</code> subpath. It is not a
				root <code>@sursaut</code> barrel component. You build a palette with{' '}
				<code>new Palette(...)</code>, configure key bindings and editor registries, then render it
				with headless layout components.
			</p>

			<Section title="Imports">
				<p>
					Import the runtime and layout primitives from <code>@sursaut/ui/palette</code>. If you
					want ready-made Pico editor variants, pair them with the palette helpers exported by{' '}
					<code>@sursaut/adapter-pico</code>.
				</p>
				<Code code={importsCode} lang="tsx" />
			</Section>

			<Section title="Create a palette">
				<p>
					A palette owns a typed <code>tools</code> registry plus configuration for keyboard
					bindings, editability, and editor resolution.
				</p>
				<Code code={createCode} lang="tsx" />
				<ul>
					<li>
						<code>tool</code> specs can reference a direct tool id, a setter like{' '}
						<code>theme|dark</code>, or an action like <code>zoom:inc</code>.
					</li>
					<li>
						Built-in generic actions currently apply to numeric tools through{' '}
						<code>valueActions</code>.
					</li>
					<li>
						<code>picoPalettePreset</code> supplies a ready-to-use Pico editor registry and default
						variants.
					</li>
				</ul>
			</Section>

			<Section title="Layout components">
				<p>The palette subpath exports a small hierarchy of headless layout renderers:</p>
				<ul>
					<li>
						<code>Toolbar</code> renders one toolbar
					</li>
					<li>
						<code>ToolbarTrack</code> renders one whole stack / track of toolbars
					</li>
					<li>
						<code>ToolbarBorder</code> renders all tracks for one region
					</li>
					<li>
						<code>Parking</code> renders parked toolbars outside the main borders
					</li>
					<li>
						<code>Ide</code> renders the complete four-region shell around your application content
					</li>
				</ul>
				<Code code={layoutCode} lang="tsx" />
			</Section>

			<Section title="Command box helpers">
				<p>
					The palette package exposes headless helpers for building searchable command UIs rather
					than shipping one fixed command dialog.
				</p>
				<Code code={commandBoxCode} lang="tsx" />
				<ul>
					<li>
						<code>paletteCommandEntries()</code> derives executable entries from tools
					</li>
					<li>
						<code>paletteCommandBoxModel()</code> adds search, selection, and keyboard behavior
					</li>
					<li>
						<code>PicoPaletteCommandBox</code> is an adapter-level ready-made UI for that model
					</li>
				</ul>
			</Section>

			<Section title="Add-item flow">
				<p>Use the add-item helpers when your palette supports user-editable toolbars.</p>
				<Code code={addItemCode} lang="tsx" />
				<ul>
					<li>
						<code>paletteAddItemEntries()</code> returns source entries for tool-backed and
						editor-only items
					</li>
					<li>
						<code>paletteDerivedVariants()</code> expands one source into insertable variants
					</li>
				</ul>
			</Section>
		</article>
	)
}

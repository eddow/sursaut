# Palette

The palette system is exported from the `@sursaut/ui/palette` subpath.

It is **not** a small collection of isolated models anymore. The current API is centered on:

- a runtime `Palette` instance
- typed tool and toolbar-item schemas
- headless layout components such as `Ide`, `Toolbar`, `ToolbarTrack`, `ToolbarBorder`, and `Parking`
- command-box helpers for search, execution, and add-item flows

## Import surface

```ts
import {
	createPaletteKeys,
	Ide,
	Parking,
	Palette,
	Toolbar,
	ToolbarBorder,
	ToolbarTrack,
	paletteAddItemEntries,
	paletteCommandBoxModel,
	paletteCommandEntries,
	paletteDerivedVariants,
	paletteEnumSubsetValues,
	type PaletteConfig,
	type PaletteItem,
	type PaletteSchema,
	type PaletteToolbarItem,
} from '@sursaut/ui/palette'
```

## Concepts

### Tools

A palette exposes a `tools` record. Each tool is one of four shapes:

- `PaletteToolRun`
- `PaletteToolBool`
- `PaletteToolNumber`
- `PaletteToolEnum`

In practice:

- run tools expose `run()` and `can`
- boolean / number / enum tools expose mutable `value`, a `default`, and a `type`
- number tools may also define `min`, `max`, and `step`
- enum tools expose a finite `values` list

### Toolbar items

A toolbar item is either:

- a tool-backed item: `{ tool: 'toolId', editor?: 'variant', config?: ... }`
- an editor-only item: `{ editor: 'variant', config?: ... }`

Tool-backed items may also use a richer tool spec string:

- `toolId`
- `toolId|value`
- `toolId:action`

Examples:

- `theme`
- `theme|dark`
- `fontSize:inc`

`toolId|value` creates a setter runner for editable tools.

`toolId:action` resolves a built-in or customized action runner. The built-in generic actions currently live on numeric tools (`inc` and `dec`).

### Layout

The IDE layout is hierarchical:

- an `IdeConfig` owns four optional region borders: `top`, `right`, `bottom`, `left`
- a border is a stack of tracks
- a track is an array of toolbar slots
- each toolbar slot has a normalized `space` value and a `toolbar` item array

The relevant exported layout types are:

- `PaletteToolbar`
- `PaletteTrack`
- `PaletteBorder`
- `PaletteBorders`
- `PaletteRegion`

## Creating a palette

A palette instance is created with `new Palette(config)`.

```ts
const palette = new Palette({
	tools,
	keys: createPaletteKeys({
		N: 'notifications',
		'+': 'fontSize:inc',
		'-': 'fontSize:dec',
	}),
	editors,
	editorDefaults: {
		run: 'button',
		boolean: 'toggle',
		number: 'slider',
		enum: 'select',
	},
})
```

`PaletteConfig` includes:

- `tools`
- `keys`
- `editable?`
- `editors?`
- `editorDefaults?`
- `editor?`
- `configurator?`
- `runner?`
- `setter?`

### `editable`

`editable` controls whether the palette can enter layout-editing mode.

`palette.editing` is true only when:

- `config.editable !== false`
- and the shared `palettes.editing` state points at that palette

## Editors and configurators

The palette resolves item rendering through `editors`.

The registry is keyed **first by tool family**, then by editor variant:

- `run`
- `boolean`
- `number`
- `enum`
- `item` for editor-only items

Each variant is a `PaletteEditorSpec`:

```ts
type PaletteEditorSpec = {
	readonly editor: (context) => JSX.Element
	readonly configure?: (context) => JSX.Element
	readonly flags?: {
		readonly footprint?: 'square' | 'free' | 'horizontal' | 'vertical'
	}
}
```

The context passed to `editor` and `configure` contains:

- `item`
- `tool`
- `scope`
- `flags`

At runtime you can also call:

- `palette.resolveEditor(item, tool)`
- `palette.renderEditor(item, tool, scope)`
- `palette.renderConfigurator(item, tool, scope)`

The same helpers are re-exported as:

- `resolvePaletteEditor(...)`
- `renderPaletteEditor(...)`
- `renderPaletteConfigurator(...)`

## Layout components

The `@sursaut/ui/palette` entry exports headless palette layout components:

- `Ide`
- `Toolbar`
- `ToolbarBorder`
- `ToolbarTrack`
- `Parking`

### `Ide`

`Ide` mounts the four palette borders around a center area.

```tsx
<Ide palette={palette} config={config}>
	<div>Application content</div>
</Ide>
```

`IdeProps` includes passthrough element props for the root, center, borders, tracks, spaces, and toolbars.

### `Toolbar`

`Toolbar` renders a single toolbar item array in a specific arranged direction.

Use it when you want to render one toolbar directly instead of the full four-border IDE.

### `ToolbarTrack`

`ToolbarTrack` renders one complete track.

That means it takes a track value containing multiple toolbar slots and renders them in one region/direction, including the inter-toolbar spacing metadata carried by each slot.

Use it when:

- you already have a `PaletteTrack`
- you want to render one stack/row of toolbars yourself
- you do not need the whole border or IDE shell

### `ToolbarBorder`

`ToolbarBorder` renders a whole border made of multiple tracks.

Use it when:

- you already have one region border such as `config.left` or `config.top`
- you want the palette border behavior without mounting the full `Ide`
- you need to render all tracks for a single region in one call

### `Parking`

`Parking` renders parked toolbars outside the main borders.

Use it for temporary storage, presets, or side staging areas while editing toolbars.

## Which layout component should I use?

- `Toolbar` for one toolbar
- `ToolbarTrack` for one toolbar stack / one track
- `ToolbarBorder` for all tracks in one region
- `Parking` for parked toolbars outside the main borders
- `Ide` for the complete four-region layout around application content

## Command entries and command boxes

The palette package does not hardcode one command-box UI. Instead it gives you headless helpers.

### `paletteCommandEntries`

Build executable command entries from the current palette tools.

It derives entries for:

- runnable tools
- boolean setters
- enum setters
- numeric actions such as `inc` and `dec`

### `paletteCommandBoxModel`

Creates a headless search-and-execute model over a list of entries.

The model exposes:

- `input`
- `query`
- `results`
- `suggestions`
- `categories`
- `keywords`
- `selection`
- `select()`
- `execute()`
- `search()`
- `handleKeyDown()`

The package also exports two small DOM bridge helpers:

- `setPaletteCommandBoxInput(model, event)`
- `handlePaletteCommandBoxInputKeydown({ commandBox, event, onAfterExecute })`

For removable chips there is:

- `handlePaletteCommandChipKeydown({ commandBox, event, token, type })`

## Add-item flow helpers

The add-item flow is also headless and split into composable helpers.

### `paletteAddItemEntries`

Build the list of source entries that can insert either:

- a tool-backed item
- an editor-only item

### `paletteDerivedVariants`

Expands one source entry into insertable variants, for example:

- the plain tool item
- a `set` variant for boolean / enum / number tools
- derived numeric actions such as `inc` / `dec`

### `paletteEnumSubsetValues`

Filters enum values by keyword matches using the same keyword expansion used by the command box.

This is useful when one editor variant should expose only a subset of an enum tool’s values.

## Keyboard bindings

Palette key bindings are normalized with:

- `createPaletteKeys`
- `normalizePaletteKeystroke`
- `paletteKeystrokeFromEvent`

Normalization rules:

- modifiers are ordered as `Ctrl`, `Alt`, `Shift`, `Meta`
- common aliases such as `cmd`, `command`, and `escape` are normalized
- single-character keys are uppercased

## Shared runtime state

The package exports a shared reactive `palettes` object used by the layout components during editing and inspection.

It may contain:

- `dragging`
- `editing`
- `inspecting`

Use `isEditing(palette)` to check whether a palette is the currently active editable palette.

## Notes

- palette rendering is headless; adapters and demos own the actual visual language
- `@sursaut/ui/palette` is the public entry point; the palette API is not exported from `@sursaut/ui`
- editor registries are keyed by tool family first, then variant name
- editor-only items live under `editors.item`
- the command-box and add-item systems are library primitives, not demo-only code

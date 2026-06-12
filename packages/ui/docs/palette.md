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
	beginPaletteCatalogInsertDrag,
	createPaletteDrawerEditor,
	createPaletteKeys,
	Ide,
	isEditing,
	notifyPaletteCatalogNativeDragStarted,
	Palette,
	paletteAddItemEntries,
	paletteCatalogEntries,
	paletteCommandBoxModel,
	paletteCommandEntries,
	paletteDefaultDrawerEditor,
	paletteDerivedVariants,
	paletteEnumSubsetValues,
	palettes,
	paletteToolbarItemFromCatalogPayload,
	PALETTE_CATALOG_DRAG_MIME,
	Parking,
	parsePaletteCatalogDragPayload,
	serializePaletteCatalogDragPayload,
	Toolbar,
	ToolbarBorder,
	ToolbarTrack,
	type PaletteConfig,
	type PaletteDrawerEditorOptions,
	type PaletteDrawerIconRenderer,
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
- `surface` — the axis/region context for axis-aware configuration

At runtime you can also call:

- `palette.resolveEditor(item, tool)`
- `palette.renderEditor(item, tool, scope)`
- `palette.renderConfigurator(item, tool, scope)`
- `palette.describeItemConfiguration(target, surface)` — compute a headless configuration descriptor

The same helpers are re-exported as:

The same helpers are re-exported as:

- `resolvePaletteEditor(...)`
- `renderPaletteEditor(...)`
- `renderPaletteConfigurator(...)`

### Supplying adapter editor presets

Adapters provide pre-built editor registries and defaults. For example, the Pico adapter exports:

```ts
import { picoPalettePreset } from '@sursaut/adapter-pico'

const palette = new Palette({
	tools: { ... },
	keys: createPaletteKeys({ ... }),
	...picoPalettePreset, // spreads `editors` and `editorDefaults`
})
```

`picoPalettePreset` is typed as `Pick<PaletteConfig, 'editors' | 'editorDefaults'>` and provides:

- `editors`: a complete `PaletteEditorRegistry` with Pico-styled editor components for every tool family (`boolean`, `enum`, `number`, `run`, `item`)
- `editorDefaults`: the default editor variant for each family (`{ boolean: 'toggle', enum: 'select', number: 'slider', run: 'button' }`)

Adapters can also export individual pieces:

```ts
import { picoPaletteEditors } from '@sursaut/adapter-pico'
// picoPaletteEditors is the full PaletteEditorRegistry
```

If you are building a custom adapter, follow the same pattern: provide a `PaletteEditorRegistry` keyed by tool family and variant name, with each entry containing an `editor` render function, an optional `configure` configurator function, and optional `flags`.

### Item configuration descriptor

The palette exports a headless function that computes a `PaletteItemConfigurationDescriptor` — a structured summary of everything a configurator UI needs to render. Adapters consume this descriptor to build configuration panels.

```ts
const desc = palette.describeItemConfiguration(
    { item, toolbar, index, region },
    { axis: 'horizontal' }
)
```

The descriptor contains:

- **`title`** / **`subtitle`** — derived from the item's tool spec and config label
- **`structure`** — structural actions (`moveBackward`, `moveForward`, `removable`) based on the item's position in its toolbar
- **`presentation`** — editor variant choices (`editorChoices`), filtered by the item's tool family and the current surface axis; also `showText` and `compact` toggles
- **`bindings`** — optional keyboard shortcut information

Editor choices are computed from `PaletteConfig.editorCapabilities` (if supplied) or the built-in `paletteDefaultEditorCapabilities` registry:

```ts
import { paletteDefaultEditorCapabilities } from '@sursaut/ui/palette'
// 12 built-in capability descriptors: button, splitButton, toggle, flip,
// radio, select, segmented, splitRadio, slider, stepper, stars, commandBox
```

Each capability declares which tool `families` it supports and which `supportedAxes` are valid. Capabilities whose families don't match or whose axis is incompatible are excluded from `editorChoices`.

To supply a custom capability set:

```ts
const palette = new Palette({
    tools,
    keys,
    editorCapabilities: {
        ...paletteDefaultEditorCapabilities,
        myCustomVariant: {
            id: 'myCustomVariant',
            label: 'Custom',
            families: ['enum'],
            supportedAxes: 'horizontal',
        },
    },
})
```

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
const top: PaletteToolbarItem[] = [
	{ tool: 'command', editor: 'button' },
	{ tool: 'notifications', editor: 'toggle' },
	{ tool: 'theme', editor: 'select' },
]

// config is a named variable so it can be reactive and serializable.
// Wrap with reactive() in real apps to enable edit-mode mutation and
// localStorage persistence.
const config = {
	top: [[{ space: 1, toolbar: top }]],
	left: [],
	right: [],
	bottom: [],
}

<Ide palette={palette} config={config}>
	<main>Application content</main>
</Ide>
```

`IdeProps.config` expects an `IdeConfig`: an object with four optional `PaletteBorder` entries. A `PaletteBorder` is a stack of tracks (`PaletteTrack[]`), and each track is an array of toolbar slots. The double-nested array `top: [[{ space: 1, toolbar: top }]]` shows one track containing one toolbar slot.

The `config` variable is intentionally a standalone value: wrap it with `reactive()` to make the layout editable, and serialize it for `localStorage` persistence. All four regions (`top`, `right`, `bottom`, `left`) are optional — omit any region you don't need.

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

It is used for temporary toolbar storage during edit mode. Think of it as a staging area where toolbars can be held before being placed into a border, or where toolbars removed from a border can be temporarily stored instead of being deleted.

Minimal usage:

```tsx
<Parking
	toolbars={parkedToolbars}
	el:class="palette-parking-area"
	space:class="palette-drop-zone"
	toolbar:class="palette-parking-toolbar"
/>
```

- `toolbars` accepts an array of `PaletteToolbar` arrays (the same shape as the toolbar slots inside tracks)
- `el`, `space`, and `toolbar` are passthrough class/element props for styling

In edit mode, toolbars can be dragged from parking into a border region, or from a border into parking for temporary removal.

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

### Command entries vs. add-item entries vs. catalogue entries

The palette exports three related but distinct helpers for building entry lists:

| Helper | Purpose | Used in |
|--------|---------|---------|
| `paletteCommandEntries` | Build executable command entries for search-and-run workflows | Command box execution |
| `paletteAddItemEntries` | Build source entries for the add-item insertion flow | Add-to-toolbar panel |
| `paletteCatalogEntries` | Build entries for the drag-from-catalogue flow | Catalogue sidebar / drag source |

`paletteCommandEntries` derives entries for runnable tools, boolean setters, enum setters, and numeric actions. These entries are fed to `paletteCommandBoxModel` for keyboard search and execution.

`paletteAddItemEntries` lists tools and editor-only items that can be inserted into a toolbar. Each entry can be expanded into derived variants via `paletteDerivedVariants`.

`paletteCatalogEntries` wraps `paletteAddItemEntries` output into draggable catalogue entries with MIME-typed payloads (see "Catalogue drag payloads" below).

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

This is useful when one editor variant should expose only a subset of an enum tool's values.

### Catalogue drag payloads

The add-item catalogue supports native HTML5 drag and drop. When a catalogue entry is dragged, it serializes a MIME-typed payload:

```ts
import {
	PALETTE_CATALOG_DRAG_MIME,
	serializePaletteCatalogDragPayload,
	parsePaletteCatalogDragPayload,
	paletteToolbarItemFromCatalogPayload,
} from '@sursaut/ui/palette'
```

The flow:

1. **Serialize** — `serializePaletteCatalogDragPayload(variant)` creates a JSON string containing enough information to reconstruct a toolbar item.
2. **Drag** — The serialized payload is attached to the `DataTransfer` object under `PALETTE_CATALOG_DRAG_MIME` (`"application/x-sursaut-palette-catalog"`).
3. **Parse** — On the drop side, `parsePaletteCatalogDragPayload(dataTransfer)` reads the payload back.
4. **Convert** — `paletteToolbarItemFromCatalogPayload(palette, payload)` turns the parsed payload into a proper `PaletteToolbarItem` ready for insertion.

For the catalogue native drag start, call:

```ts
notifyPaletteCatalogNativeDragStarted(palettes, palette)
```

This marks the shared `palettes` state so that drop zones know a catalogue drag is in progress, distinct from an internal toolbar-item drag.

For catalogue insert drag (creating ephemeral source tracks during the drag), use:

```ts
beginPaletteCatalogInsertDrag(palettes, payload, palette)
```

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

### Entering and exiting edit mode

The shared reactive `palettes` object owns the editing state:

```ts
// Enter edit mode
palettes.editing = myPalette

// Exit edit mode
palettes.editing = undefined
```

Only one palette can be in edit mode at a time. Setting `palettes.editing` clears any previous editing palette.

A palette's editing state is **guarded** by its config: `palette.editing` is `true` only when both `config.editable !== false` **and** `palettes.editing === palette`.

In practice, an edit toggle button typically alternates:

```tsx
<button onClick={() => {
	palettes.editing = isEditing(myPalette) ? undefined : myPalette
}}>
	{isEditing(myPalette) ? 'Done' : 'Edit'}
</button>
```

When edit mode is active, toolbar items become draggable, item insertion zones appear, and clicking a toolbar item opens its configuration panel (see "Editors and configurators" above).

## Drawer editor

The `drawer` editor variant (`editor: 'drawer'`) is an **editor-only** item (no tool bound) that renders a trigger button opening a **perpendicular** child toolbar popup.

### Perpendicular-direction contract

The drawer editor reads the **parent** toolbar axis from `PaletteEditorContext.surface.axis` (derived from the scope's `region`) and computes the child popup direction by **inverting** it:

| Parent axis | Child popup direction |
|---|---|
| `'horizontal'` | `'vertical'` |
| `'vertical'` | `'horizontal'` |

Nested drawers (drawer inside drawer popup) continue this pattern at each depth level. To enable this, the editor must propagate the parent `PaletteScope` (containing `palette` and a derived `region`) into the popup root so the child `Toolbar` can resolve tools and nested drawers can read their own `surface.axis`.

### Type: `PaletteDrawerToolbarItem`

```ts
type PaletteDrawerToolbarItem = {
  readonly editor: 'drawer'
  readonly toolbar: PaletteToolbar    // child items
  config?: {
    readonly icon?: string | JSX.Element | (() => JSX.Element)
    readonly label?: string
    readonly hint?: string
    readonly tone?: string
    readonly open?: 'click' | 'hover' | 'press'
    readonly placement?: 'start' | 'center' | 'end'
  }
}
```

The `toolbar` field holds the child items rendered inside the popup. These items can themselves be drawer items for arbitrarily deep nesting.

### Factory: `createPaletteDrawerEditor()`

Sursaut ships a generic drawer editor factory in `drawer-editor.tsx`, exported from `@sursaut/ui/palette`:

```ts
import {
  createPaletteDrawerEditor,
  type PaletteDrawerEditorOptions,
  type PaletteDrawerIconRenderer,
} from '@sursaut/ui/palette'
```

`createPaletteDrawerEditor(options?)` returns a `PaletteEditorSpec` for the `"drawer"` variant. Options:

| Option | Type | Purpose |
|---|---|---|
| `renderIcon` | `(icon) => JSX.Element` | Consumer-specific icon renderer |
| `renderTrigger` | `(opts) => JSX.Element` | Custom trigger button interior |
| `triggerStyle` | `Record<string, string>` | Inline styles for the trigger button |
| `triggerClass` | `string` | CSS class for the trigger (default `sursaut-palette-drawer__trigger`) |
| `overlayClass` | `string` | CSS class for the fixed backdrop overlay |
| `popupClass` | `string` | CSS class for the popup container |
| `popupExtraClass` | `(axis) => string` | Per-axis extra class (e.g. adapter-specific theme) |
| `portalContainer` | `HTMLElement` | Target for the portal root (default `document.body`) |

A zero-config default is also exported:

```ts
import { paletteDefaultDrawerEditor } from '@sursaut/ui/palette'
// Equivalent to createPaletteDrawerEditor() with no custom options
```

### Consumer usage (Anarkai example)

Register the drawer editor in the `item` family:

```ts
editors: {
  item: {
    drawer: createPaletteDrawerEditor({
      renderIcon: myIconFn,
      triggerClass: 'my-drawer-trigger',
      renderTrigger({ icon, label, hint }) { ... },
    }),
  },
}
```

Adapters that need custom styling (Pico, etc.) should use the factory with their own `renderIcon`, CSS classes, and `renderTrigger`.

### Scope propagation

The editor creates a new root scope for the popup via `latch()`'s `env` parameter:

```ts
const drawerEnv = Object.create(rootEnv)
drawerEnv.palette = context.scope.palette
drawerEnv.region = childDir === 'vertical' ? 'left' : 'top'
```

Without `palette`, the child `Toolbar` throws `"No palette to expose"`. Without `region`, nested drawers inside the popup won't know their parent axis.

### CSS

Base CSS for drawer components is included in `palette.css`:

- `.sursaut-palette-drawer__overlay` — fixed full-viewport backdrop (z-index 210)
- `.sursaut-palette-drawer__trigger` — trigger button layout
- `.sursaut-palette-drawer__popup` — popup container with max-width/height and scroll
- `.sursaut-palette-drawer__popup.is-vertical` / `is-horizontal` — flex-direction control
- `.sursaut-palette-drawer__popup .toolbar::before { content: none }` — suppresses the editing hover highlight that would cause phantom scrollbars inside the popup

### Collapse signal

When a consumer wants to programmatically close all open drawer popups (e.g. after
a variant is picked), bump the shared reactive signal:

```ts
import { paletteDrawerCollapse } from '@sursaut/ui/palette'

// In a tool setter, keybinding handler, or anywhere a selection completes:
paletteDrawerCollapse.version++
```

Every drawer created by `createPaletteDrawerEditor` watches `paletteDrawerCollapse`
at **component scope** (not inside the popup effect), so all open drawers react
in the same synchronous tick — regardless of nesting depth.

The signal is also available as a plain reactive object for consumers that prefer
to import it directly:

```ts
import { paletteDrawerCollapse } from '@sursaut/ui/palette'
// { version: number } — bumping version closes all drawers
```

### See also

- `PaletteDrawerToolbarItem`, `PaletteDrawerState` — full JSDoc in `types.ts`
- `PaletteEditorContext`, `PaletteSurfaceContext` — per-axis context for editor implementations
- `sursaut/LLM.md` — drawer editor overview in the LLM cheat sheet

## Notes

- palette rendering is headless; adapters and demos own the actual visual language
- `@sursaut/ui/palette` is the public entry point; the palette API is not exported from `@sursaut/ui`
- editor registries are keyed by tool family first, then variant name
- editor-only items live under `editors.item`
- the command-box and add-item systems are library primitives, not demo-only code

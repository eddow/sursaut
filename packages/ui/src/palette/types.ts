/**
 * Shared base properties for all palette tools.
 */
type PaletteToolBase = {
	/**
	 * Optional categories for grouping related tools.
	 */
	readonly categories?: string[]
	/**
	 * Optional icon for visual representation.
	 */
	readonly icon?: string | JSX.Element | (() => JSX.Element)
	/**
	 * Optional keywords for search and filtering.
	 */
	readonly keywords?: string[]
	/**
	 * Optional human-readable label.
	 */
	readonly label?: string
}

/**
 * Shared element passthrough accepted by palette layout components.
 */
export interface PaletteComponentProps {
	/**
	 * Optional passthrough element props.
	 */
	readonly el?: JSX.IntrinsicElements['div']
}

/**
 * Runnable palette command.
 *
 * These tools expose an imperative `run()` action and a reactive `can` flag.
 */
export type PaletteToolRun = PaletteToolBase & {
	/**
	 * Execute the tool's action.
	 */
	run(): void
	/**
	 * Whether the tool is currently enabled.
	 */
	readonly can: boolean
}

/**
 * Read-only status shape shared by editable tools.
 */
export type PaletteToolStatus<T> = PaletteToolBase & {
	/**
	 * The current value of the tool.
	 */
	readonly value: T
	/**
	 * The type of the tool (e.g. 'boolean', 'number', etc.).
	 */
	type: string
}

/**
 * Mutable palette value with a restorable default.
 */
export type PaletteToolEdit<T> = PaletteToolStatus<T> & {
	/**
	 * The current value of the tool.
	 */
	value: T
	/**
	 * The default value of the tool.
	 */
	readonly default: T
}

/**
 * Boolean on/off palette value.
 */
export type PaletteToolBool = PaletteToolEdit<boolean> & {
	/**
	 * The type of the tool.
	 */
	type: 'boolean'
}

/**
 * Numeric palette value optionally constrained by `min`, `max`, and `step`.
 */
export type PaletteToolNumber = PaletteToolEdit<number> & {
	/**
	 * The type of the tool.
	 */
	type: 'number'
	/**
	 * Optional minimum value.
	 */
	min?: number
	/**
	 * Optional maximum value.
	 */
	max?: number
	/**
	 * Optional step value.
	 */
	step?: number
}

export type PaletteToolEnumValue<T extends string = string> = {
	/**
	 * The value of the enum option.
	 */
	readonly value: T
	/**
	 * Optional enablement flag.
	 */
	readonly can?: boolean
	/**
	 * Optional categories for grouping related enum options.
	 */
	readonly categories?: string[]
	/**
	 * Optional icon for visual representation.
	 */
	readonly icon?: string | JSX.Element | (() => JSX.Element)
	/**
	 * Optional human-readable label.
	 */
	readonly label?: string
	/**
	 * Optional keywords for search and filtering.
	 */
	readonly keywords?: string[]
}

/**
 * Enumerated palette value with a finite list of selectable choices.
 */
export type PaletteToolEnum<T extends string = string> = PaletteToolEdit<T> & {
	/**
	 * The type of the tool.
	 */
	type: 'enum'
	/**
	 * The list of enum options.
	 */
	readonly values: readonly PaletteToolEnumValue<T>[]
	/**
	 * How this enum appears in the palette command box **catalog** (drag-from-list) mode.
	 *
	 * - **Omitted (default):** one catalogue row whose **label is the tool label** (e.g. “Action”) and drags the editor `(set)` variant; run mode still lists one executable command per value.
	 * - `per-value`: one catalogue row per option (`{label} → {value} (preset)`), same as legacy behaviour.
	 */
	readonly commandBoxEnumCommands?: 'per-value'
}

export type PaletteAnyTool = PaletteToolRun | PaletteToolBool | PaletteToolNumber | PaletteToolEnum
export type PaletteTools = Record<string, PaletteAnyTool>
export type PaletteTool<TTools extends PaletteTools = PaletteTools> = TTools[keyof TTools & string]
export type PaletteEditableTool<TTools extends PaletteTools = PaletteTools> = Exclude<
	PaletteTool<TTools>,
	PaletteToolRun
>
export type PaletteToolFamily<TTools extends PaletteTools = PaletteTools> =
	| 'run'
	| PaletteEditableTool<TTools>['type']

export type PaletteToolByFamily<
	TTools extends PaletteTools = PaletteTools,
	TFamily extends PaletteToolFamily<TTools> = PaletteToolFamily<TTools>,
> = TFamily extends 'run' ? PaletteToolRun : Extract<PaletteEditableTool<TTools>, { type: TFamily }>

export type PaletteEditableToolByFamily<
	TTools extends PaletteTools = PaletteTools,
	TFamily extends PaletteEditableTool<TTools>['type'] = PaletteEditableTool<TTools>['type'],
> = Extract<PaletteEditableTool<TTools>, { type: TFamily }>

export type PaletteKeystroke = string

export type PaletteKeyBindings = Record<PaletteKeystroke, string>

/**
 * Normalized keyboard binding registry for palette command specs.
 */
export interface PaletteKeys {
	/**
	 * The keyboard bindings.
	 */
	readonly bindings: PaletteKeyBindings
	/**
	 * Find keystrokes bound to a specific tool.
	 */
	findByTool(toolId: string): readonly PaletteKeystroke[]
	/**
	 * Resolve a keyboard event to a bound tool spec.
	 */
	resolve(event: KeyboardEvent): string | undefined
}

/**
 * Type-level contract for a palette instance.
 *
 * `tools` defines the available command/value tools, `editorConfigs` the per-item
 * config payloads keyed by editor variant, and `item` the toolbar item union.
 */
export interface PaletteSchema<
	TTools extends PaletteTools = PaletteTools,
	TEditorConfigs extends Record<string, unknown> = Record<string, unknown>,
	TItem extends PaletteToolbarItem<
		keyof TTools & string,
		keyof TEditorConfigs & string,
		TEditorConfigs[keyof TEditorConfigs & string]
	> = PaletteToolbarItemByEditor<TEditorConfigs, keyof TTools & string>,
> {
	/**
	 * The available tools.
	 */
	readonly tools: TTools
	/**
	 * The editor config payloads.
	 */
	readonly editorConfigs: TEditorConfigs
	/**
	 * The toolbar item union.
	 */
	readonly item: TItem
}

export type PaletteToolbarItemBase = Record<PropertyKey, unknown>

/**
 * String form used by palette items and key bindings to reference tools.
 *
 * - `toolId` resolves the original tool.
 * - `toolId|value` builds a setter runner for editable tools.
 * - `toolId:action` builds an action runner such as `fontSize:inc`.
 */
export type PaletteToolSpec<TTool extends string = string> =
	| TTool
	| `${TTool}|${string}`
	| `${TTool}:${string}`

/**
 * Toolbar item bound to a palette tool, optionally selecting an editor variant.
 */
export type PaletteToolToolbarItem<
	TTool extends string = string,
	TEditor extends string = string,
	TConfig = unknown,
> = PaletteToolbarItemBase & {
	/**
	 * The tool spec.
	 */
	readonly tool: PaletteToolSpec<TTool>
	/**
	 * Optional editor variant.
	 */
	editor?: TEditor
	/**
	 * Optional config payload.
	 */
	config?: TConfig
}

export type PaletteEditorOnlyToolbarItem<
	TEditor extends string = string,
	TConfig = unknown,
> = PaletteToolbarItemBase & {
	/**
	 * No tool is bound to this item.
	 */
	readonly tool?: undefined
	/**
	 * The editor variant.
	 */
	editor: TEditor
	/**
	 * Optional config payload.
	 */
	config?: TConfig
}

/**
 * Union of tool-backed items and editor-only items.
 */
export type PaletteToolbarItem<
	TTool extends string = string,
	TEditor extends string = string,
	TConfig = unknown,
> = PaletteToolToolbarItem<TTool, TEditor, TConfig> | PaletteEditorOnlyToolbarItem<TEditor, TConfig>

export type PaletteToolbarItemByEditor<
	TEditors extends Record<string, unknown>,
	TTool extends string = string,
> = {
	[K in keyof TEditors & string]: PaletteToolbarItem<TTool, K, TEditors[K]>
}[keyof TEditors & string]

export type PaletteToolbar<TItem extends PaletteToolbarItem = PaletteToolbarItem> = TItem[]

/**
 * One linear track of toolbars separated by normalized spacing values.
 */
export type PaletteTrack<TItem extends PaletteToolbarItem = PaletteToolbarItem> = {
	/**
	 * The spacing value.
	 */
	space: number
	/**
	 * The toolbar.
	 */
	toolbar: PaletteToolbar<TItem>
}[]

/**
 * Stack of tracks mounted on a single IDE region.
 */
export type PaletteBorder<TItem extends PaletteToolbarItem = PaletteToolbarItem> =
	PaletteTrack<TItem>[]

/**
 * Named palette docking regions around an IDE surface.
 */
export type PaletteRegion = 'top' | 'right' | 'bottom' | 'left'

/**
 * Full border layout for a palette IDE.
 */
export type PaletteBorders<TItem extends PaletteToolbarItem = PaletteToolbarItem> = {
	[K in PaletteRegion]: PaletteBorder<TItem>
}

export type PaletteItem<TSchema extends PaletteSchema = PaletteSchema> = TSchema['item']
export type PaletteEditorConfigs<TSchema extends PaletteSchema = PaletteSchema> =
	TSchema['editorConfigs']
export type PaletteToolId<TSchema extends PaletteSchema = PaletteSchema> = keyof TSchema['tools'] &
	string
export type PaletteToolOf<TSchema extends PaletteSchema = PaletteSchema> = PaletteTool<
	TSchema['tools']
>
export type PaletteEditableToolOf<TSchema extends PaletteSchema = PaletteSchema> =
	PaletteEditableTool<TSchema['tools']>
export type PaletteToolFamilyOf<TSchema extends PaletteSchema = PaletteSchema> = PaletteToolFamily<
	TSchema['tools']
>
export type PaletteToolByFamilyOf<
	TSchema extends PaletteSchema = PaletteSchema,
	TFamily extends PaletteToolFamilyOf<TSchema> = PaletteToolFamilyOf<TSchema>,
> = PaletteToolByFamily<TSchema['tools'], TFamily>
export type PaletteEditableToolByFamilyOf<
	TSchema extends PaletteSchema = PaletteSchema,
	TFamily extends PaletteEditableToolOf<TSchema>['type'] = PaletteEditableToolOf<TSchema>['type'],
> = PaletteEditableToolByFamily<TSchema['tools'], TFamily>
export type PaletteToolItem<
	TSchema extends PaletteSchema = PaletteSchema,
	TFamily extends PaletteToolFamilyOf<TSchema> = PaletteToolFamilyOf<TSchema>,
> = {
	[K in PaletteToolId<TSchema>]: TSchema['tools'][K] extends PaletteToolByFamilyOf<TSchema, TFamily>
		? Extract<TSchema['item'], { tool: K }>
		: never
}[PaletteToolId<TSchema>]
export type PaletteEditorOnlyItem<TSchema extends PaletteSchema = PaletteSchema> = Extract<
	TSchema['item'],
	{ tool?: undefined }
>

export type PaletteOf<TSchema extends PaletteSchema = PaletteSchema> = Palette<TSchema>

/**
 * Rendering scope shared across palette editors and layout components.
 */
export type PaletteScope<TSchema extends PaletteSchema = PaletteSchema> = Record<
	string,
	unknown
> & {
	/**
	 * The palette instance.
	 */
	palette?: Palette<TSchema>
	/**
	 * The docking region.
	 */
	region?: PaletteRegion
}

export type PaletteEditorFootprint = 'square' | 'free' | 'horizontal' | 'vertical'

/**
 * Optional layout hints declared by an editor implementation.
 */
export interface PaletteEditorFlags {
	/**
	 * The footprint hint.
	 */
	readonly footprint?: PaletteEditorFootprint
}

/**
 * Context received by palette editors and configurators.
 */
export interface PaletteEditorContext<
	TTool extends PaletteAnyTool | undefined = PaletteAnyTool | undefined,
	TItem extends PaletteToolbarItem = PaletteToolbarItem,
	TSchema extends PaletteSchema = PaletteSchema,
> {
	/**
	 * The toolbar item.
	 */
	readonly item: TItem
	/**
	 * The tool instance.
	 */
	readonly tool: TTool
	/**
	 * The rendering scope.
	 */
	readonly scope: PaletteScope<TSchema>
	/**
	 * The layout hints.
	 */
	readonly flags: PaletteEditorFlags
}

/**
 * Render function for a palette toolbar item.
 */
export type PaletteEditorComponent<
	TTool extends PaletteAnyTool | undefined = PaletteAnyTool | undefined,
	TItem extends PaletteToolbarItem = PaletteToolbarItem,
	TSchema extends PaletteSchema = PaletteSchema,
> = (context: PaletteEditorContext<TTool, TItem, TSchema>) => JSX.Element

/**
 * Optional item inspector/configuration panel renderer.
 */
export type PaletteConfiguratorComponent<
	TTool extends PaletteAnyTool | undefined = PaletteAnyTool | undefined,
	TItem extends PaletteToolbarItem = PaletteToolbarItem,
	TSchema extends PaletteSchema = PaletteSchema,
> = (context: PaletteEditorContext<TTool, TItem, TSchema>) => JSX.Element

/**
 * Registered editor variant for a tool family or editor-only item kind.
 */
export interface PaletteEditorSpec<
	TTool extends PaletteAnyTool | undefined = PaletteAnyTool | undefined,
	TItem extends PaletteToolbarItem = PaletteToolbarItem,
	TSchema extends PaletteSchema = PaletteSchema,
> {
	/**
	 * The editor render function.
	 */
	readonly editor: PaletteEditorComponent<TTool, TItem, TSchema>
	/**
	 * Optional configurator render function.
	 */
	readonly configure?: PaletteConfiguratorComponent<TTool, TItem, TSchema>
	/**
	 * Optional layout hints.
	 */
	readonly flags?: PaletteEditorFlags
}

/**
 * Registry of editor variants for a specific tool family.
 */
export type PaletteEditorFamilyRegistry<
	TSchema extends PaletteSchema = PaletteSchema,
	TFamily extends PaletteToolFamilyOf<TSchema> = PaletteToolFamilyOf<TSchema>,
> = Record<
	string,
	PaletteEditorSpec<
		PaletteToolByFamilyOf<TSchema, TFamily>,
		PaletteToolItem<TSchema, TFamily>,
		TSchema
	>
>

/**
 * Registry for items that do not resolve any palette tool.
 */
export type PaletteEditorOnlyRegistry<TSchema extends PaletteSchema = PaletteSchema> = Record<
	string,
	PaletteEditorSpec<undefined, PaletteEditorOnlyItem<TSchema>, TSchema>
>

/**
 * Complete editor registry keyed first by tool family, then by variant name.
 */
export type PaletteEditorRegistry<TSchema extends PaletteSchema = PaletteSchema> = {
	[K in PaletteToolFamilyOf<TSchema>]?: PaletteEditorFamilyRegistry<TSchema, K>
} & {
	item?: PaletteEditorOnlyRegistry<TSchema>
}

/**
 * Runtime configuration used to construct a `Palette` instance.
 */
export interface PaletteConfig<TSchema extends PaletteSchema = PaletteSchema> {
	/**
	 * The available tools.
	 */
	readonly tools: TSchema['tools']
	/**
	 * The keyboard bindings.
	 */
	readonly keys: PaletteKeys
	/**
	 * Whether the palette is editable.
	 */
	readonly editable?: boolean
	/**
	 * The editor registry.
	 */
	readonly editors?: PaletteEditorRegistry<TSchema>
	/**
	 * Default editor variants for each tool family.
	 */
	readonly editorDefaults?: Partial<Record<PaletteToolFamilyOf<TSchema>, string>>
	/**
	 * Optional editor render function.
	 */
	readonly editor?: (
		item: PaletteItem<TSchema>,
		tool: PaletteToolOf<TSchema> | undefined,
		scope: PaletteScope<TSchema>
	) => JSX.Element
	/**
	 * Optional configurator render function.
	 */
	readonly configurator?: (
		item: PaletteItem<TSchema>,
		tool: PaletteToolOf<TSchema> | undefined,
		scope: PaletteScope<TSchema>
	) => JSX.Element | undefined
	/**
	 * Optional runner factory for creating tool runners.
	 */
	readonly runner?: <TTool extends PaletteEditableToolOf<TSchema>>(
		runner: PaletteToolRun,
		from: TTool,
		spec: string
	) => PaletteToolRun
	/**
	 * Optional setter factory for creating tool setters.
	 */
	readonly setter?: <TTool extends PaletteEditableToolOf<TSchema>>(
		runner: PaletteToolRun,
		from: TTool,
		value: TTool['value']
	) => PaletteToolRun
}

export interface PaletteBase {
	/**
	 * The palette ID.
	 */
	readonly id: string
	/**
	 * Dispose of the palette instance.
	 */
	dispose(): void
}

/**
 * Runtime palette object used by the layout components and command helpers.
 */
export interface Palette<TSchema extends PaletteSchema = PaletteSchema> {
	/**
	 * The palette ID.
	 */
	readonly id: string
	/**
	 * The runtime configuration.
	 */
	readonly config: PaletteConfig<TSchema>
	/**
	 * The available tools.
	 */
	readonly tools: TSchema['tools']
	/**
	 * The keyboard bindings.
	 */
	readonly keys: PaletteKeys
	/**
	 * The editor registry.
	 */
	readonly editors?: PaletteEditorRegistry<TSchema>
	/**
	 * Default editor variants for each tool family.
	 */
	readonly editorDefaults?: Partial<Record<PaletteToolFamilyOf<TSchema>, string>>
	/**
	 * Optional editor render function.
	 */
	readonly editor?: PaletteConfig<TSchema>['editor']
	/**
	 * Optional configurator render function.
	 */
	readonly configurator?: PaletteConfig<TSchema>['configurator']
	/**
	 * Optional runner factory for creating tool runners.
	 */
	readonly runner?: PaletteConfig<TSchema>['runner']
	/**
	 * Optional setter factory for creating tool setters.
	 */
	readonly setter?: PaletteConfig<TSchema>['setter']
	/**
	 * Whether the palette is currently editing.
	 */
	readonly editing: boolean
	/**
	 * Resolve a tool spec to a tool instance.
	 */
	tool(spec: string): PaletteToolOf<TSchema>
	/**
	 * Resolve an editor for a given item and tool.
	 */
	resolveEditor<
		TTool extends PaletteToolOf<TSchema> | undefined,
		TItem extends PaletteItem<TSchema>,
	>(item: TItem, tool: TTool): PaletteEditorSpec<TTool, TItem, TSchema> | undefined
	/**
	 * Render an editor for a given item and tool.
	 */
	renderEditor<
		TTool extends PaletteToolOf<TSchema> | undefined,
		TItem extends PaletteItem<TSchema>,
	>(item: TItem, tool: TTool, scope: PaletteScope<TSchema>): JSX.Element
	/**
	 * Render a configurator for a given item and tool.
	 */
	renderConfigurator<
		TTool extends PaletteToolOf<TSchema> | undefined,
		TItem extends PaletteItem<TSchema>,
	>(item: TItem, tool: TTool, scope: PaletteScope<TSchema>): JSX.Element | undefined
	/**
	 * Dispose of the palette instance.
	 */
	dispose(): void
}

/**
 * Shared drag session state used by the palette layout components while editing.
 */
export interface PaletteDragging<TPalette extends Palette = Palette> {
	/**
	 * The border layout.
	 */
	border: TPalette extends Palette<infer TSchema>
		? PaletteBorder<PaletteItem<TSchema>>
		: PaletteBorder
	/**
	 * The created tracks.
	 */
	createdTracks: TPalette extends Palette<infer TSchema>
		? PaletteTrack<PaletteItem<TSchema>>[]
		: PaletteTrack[]
	/**
	 * The index of the current track.
	 */
	index: number
	/**
	 * The palette instance.
	 */
	palette: TPalette
	/**
	 * The docking region.
	 */
	region: PaletteRegion
	/**
	 * The source items.
	 */
	sourceItems: TPalette extends Palette<infer TSchema>
		? PaletteToolbar<PaletteItem<TSchema>>
		: PaletteToolbar
	/**
	 * The source border layout.
	 */
	sourceBorder: TPalette extends Palette<infer TSchema>
		? PaletteBorder<PaletteItem<TSchema>>
		: PaletteBorder
	/**
	 * The source docking region.
	 */
	sourceRegion: PaletteRegion
	/**
	 * The source track.
	 */
	sourceTrack: TPalette extends Palette<infer TSchema>
		? PaletteTrack<PaletteItem<TSchema>>
		: PaletteTrack
	/**
	 * The index of the source track.
	 */
	sourceTrackIndex: number
	/**
	 * Whether the source track was a singleton.
	 */
	sourceTrackWasSingleton: boolean
	/**
	 * The toolbar.
	 */
	toolbar: TPalette extends Palette<infer TSchema>
		? PaletteToolbar<PaletteItem<TSchema>>
		: PaletteToolbar
	/**
	 * Optional toolbar preview.
	 */
	toolbarPreview?: {
		/**
		 * The count of items in the preview.
		 */
		count: number
		/**
		 * The index of the preview.
		 */
		index: number
		/**
		 * The source border layout.
		 */
		source: {
			/**
			 * The border layout.
			 */
			border: TPalette extends Palette<infer TSchema>
				? PaletteBorder<PaletteItem<TSchema>>
				: PaletteBorder
			/**
			 * Whether the track was removed.
			 */
			removedTrack: boolean
			/**
			 * The track.
			 */
			track: TPalette extends Palette<infer TSchema>
				? PaletteTrack<PaletteItem<TSchema>>
				: PaletteTrack
			/**
			 * The index of the track.
			 */
			trackIndex: number
			/**
			 * The snapshot of the track.
			 */
			snapshot: TPalette extends Palette<infer TSchema>
				? PaletteTrack<PaletteItem<TSchema>>
				: PaletteTrack
		}
		/**
		 * The toolbar.
		 */
		toolbar: TPalette extends Palette<infer TSchema>
			? PaletteToolbar<PaletteItem<TSchema>>
			: PaletteToolbar
	}
	/**
	 * Command-box catalogue insert: ephemeral source track, same preview/finalize path as pointer drag.
	 */
	readonly catalogInsert?: true
	/**
	 * Native catalogue drag pointer bookkeeping (HTML5 drag); mirrors pointer-down grab for resize math.
	 */
	catalogInsertPointer?: {
		dragStart: { x: number; y: number }
		grabAnchor?: number
	}
	/**
	 * Border array from `beginPaletteCatalogInsertDrag` (reference identity).
	 * After `moveToolbarToTrack` / `moveToolbarToStack`, `border` is the real shell and no longer equals this seed.
	 */
	catalogInsertSeedBorder?: TPalette extends Palette<infer TSchema>
		? PaletteBorder<PaletteItem<TSchema>>
		: PaletteBorder
	/**
	 * The track.
	 */
	track: TPalette extends Palette<infer TSchema> ? PaletteTrack<PaletteItem<TSchema>> : PaletteTrack
	/**
	 * The index of the track.
	 */
	trackIndex: number
}

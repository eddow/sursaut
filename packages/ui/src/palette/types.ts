type PaletteToolBase = {
	readonly categories?: string[]
	readonly icon?: string
	readonly keywords?: string[]
	readonly label?: string
}

export interface PaletteComponentProps {
	readonly el?: JSX.IntrinsicElements['div']
}

export type PaletteToolRun = PaletteToolBase & { run(): void; readonly can: boolean }
export type PaletteToolStatus<T> = PaletteToolBase & { readonly value: T; type: string }
export type PaletteToolEdit<T> = PaletteToolStatus<T> & { value: T; readonly default: T }

export type PaletteToolBool = PaletteToolEdit<boolean> & { type: 'boolean' }
export type PaletteToolNumber = PaletteToolEdit<number> & {
	type: 'number'
	min?: number
	max?: number
	step?: number
}
export type PaletteToolEnumValue<T extends string = string> = {
	readonly value: T
	readonly can?: boolean
	readonly categories?: string[]
	readonly icon?: string
	readonly label?: string
	readonly keywords?: string[]
}

export type PaletteToolEnum<T extends string = string> = PaletteToolEdit<T> & {
	type: 'enum'
	readonly values: readonly PaletteToolEnumValue<T>[]
}

export type PaletteAnyTool = PaletteToolRun | PaletteToolBool | PaletteToolNumber | PaletteToolEnum
export type PaletteTools = Record<string, PaletteAnyTool>
export type PaletteTool<TTools extends PaletteTools = PaletteTools> = TTools[keyof TTools & string]
export type PaletteEditableTool<TTools extends PaletteTools = PaletteTools> = Exclude<
	PaletteTool<TTools>,
	PaletteToolRun
>
export type PaletteToolFamily<TTools extends PaletteTools = PaletteTools> =
	| PaletteEditableTool<TTools>['type']
	| 'run'
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

export interface PaletteKeys {
	readonly bindings: PaletteKeyBindings
	findByTool(toolId: string): readonly PaletteKeystroke[]
	resolve(event: KeyboardEvent): string | undefined
}

export interface PaletteSchema<
	TTools extends PaletteTools = PaletteTools,
	TEditorConfigs extends Record<string, unknown> = Record<string, unknown>,
	TItem extends PaletteToolbarItem<
		keyof TTools & string,
		keyof TEditorConfigs & string,
		TEditorConfigs[keyof TEditorConfigs & string]
	> = PaletteToolbarItemByEditor<TEditorConfigs, keyof TTools & string>,
> {
	readonly tools: TTools
	readonly editorConfigs: TEditorConfigs
	readonly item: TItem
}

export type PaletteToolbarItemBase = Record<PropertyKey, unknown>

export type PaletteToolSpec<TTool extends string = string> =
	| TTool
	| `${TTool}|${string}`
	| `${TTool}:${string}`

export type PaletteToolToolbarItem<
	TTool extends string = string,
	TEditor extends string = string,
	TConfig = unknown,
> = PaletteToolbarItemBase & {
	readonly tool: PaletteToolSpec<TTool>
	editor?: TEditor
	config?: TConfig
}

export type PaletteEditorOnlyToolbarItem<
	TEditor extends string = string,
	TConfig = unknown,
> = PaletteToolbarItemBase & {
	readonly tool?: undefined
	editor: TEditor
	config?: TConfig
}

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

export type PaletteTrack<TItem extends PaletteToolbarItem = PaletteToolbarItem> = {
	space: number
	toolbar: PaletteToolbar<TItem>
}[]

export type PaletteBorder<TItem extends PaletteToolbarItem = PaletteToolbarItem> =
	PaletteTrack<TItem>[]

export type PaletteRegion = 'top' | 'right' | 'bottom' | 'left'

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

export type PaletteScope<TSchema extends PaletteSchema = PaletteSchema> = Record<
	string,
	unknown
> & {
	palette?: Palette<TSchema>
	region?: PaletteRegion
}

export type PaletteEditorFootprint = 'square' | 'free' | 'horizontal' | 'vertical'

export interface PaletteEditorFlags {
	readonly footprint?: PaletteEditorFootprint
}

export interface PaletteEditorContext<
	TTool extends PaletteAnyTool | undefined = PaletteAnyTool | undefined,
	TItem extends PaletteToolbarItem = PaletteToolbarItem,
	TSchema extends PaletteSchema = PaletteSchema,
> {
	readonly item: TItem
	readonly tool: TTool
	readonly scope: PaletteScope<TSchema>
	readonly flags: PaletteEditorFlags
}

export type PaletteEditorComponent<
	TTool extends PaletteAnyTool | undefined = PaletteAnyTool | undefined,
	TItem extends PaletteToolbarItem = PaletteToolbarItem,
	TSchema extends PaletteSchema = PaletteSchema,
> = (context: PaletteEditorContext<TTool, TItem, TSchema>) => JSX.Element

export type PaletteConfiguratorComponent<
	TTool extends PaletteAnyTool | undefined = PaletteAnyTool | undefined,
	TItem extends PaletteToolbarItem = PaletteToolbarItem,
	TSchema extends PaletteSchema = PaletteSchema,
> = (context: PaletteEditorContext<TTool, TItem, TSchema>) => JSX.Element

export interface PaletteEditorSpec<
	TTool extends PaletteAnyTool | undefined = PaletteAnyTool | undefined,
	TItem extends PaletteToolbarItem = PaletteToolbarItem,
	TSchema extends PaletteSchema = PaletteSchema,
> {
	readonly editor: PaletteEditorComponent<TTool, TItem, TSchema>
	readonly configure?: PaletteConfiguratorComponent<TTool, TItem, TSchema>
	readonly flags?: PaletteEditorFlags
}

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

export type PaletteEditorOnlyRegistry<TSchema extends PaletteSchema = PaletteSchema> = Record<
	string,
	PaletteEditorSpec<undefined, PaletteEditorOnlyItem<TSchema>, TSchema>
>

export type PaletteEditorRegistry<TSchema extends PaletteSchema = PaletteSchema> = {
	[K in PaletteToolFamilyOf<TSchema>]?: PaletteEditorFamilyRegistry<TSchema, K>
} & {
	item?: PaletteEditorOnlyRegistry<TSchema>
}

export interface PaletteConfig<TSchema extends PaletteSchema = PaletteSchema> {
	readonly tools: TSchema['tools']
	readonly keys: PaletteKeys
	readonly editable?: boolean
	readonly editors?: PaletteEditorRegistry<TSchema>
	readonly editorDefaults?: Partial<Record<PaletteToolFamilyOf<TSchema>, string>>
	readonly editor?: (
		item: PaletteItem<TSchema>,
		tool: PaletteToolOf<TSchema> | undefined,
		scope: PaletteScope<TSchema>
	) => JSX.Element
	readonly configurator?: (
		item: PaletteItem<TSchema>,
		tool: PaletteToolOf<TSchema> | undefined,
		scope: PaletteScope<TSchema>
	) => JSX.Element | undefined
	readonly runner?: <TTool extends PaletteEditableToolOf<TSchema>>(
		runner: PaletteToolRun,
		from: TTool,
		spec: string
	) => PaletteToolRun
	readonly setter?: <TTool extends PaletteEditableToolOf<TSchema>>(
		runner: PaletteToolRun,
		from: TTool,
		value: TTool['value']
	) => PaletteToolRun
}

export interface PaletteBase {
	readonly id: string
	dispose(): void
}

export interface Palette<TSchema extends PaletteSchema = PaletteSchema> {
	readonly id: string
	readonly config: PaletteConfig<TSchema>
	readonly tools: TSchema['tools']
	readonly keys: PaletteKeys
	readonly editors?: PaletteEditorRegistry<TSchema>
	readonly editorDefaults?: Partial<Record<PaletteToolFamilyOf<TSchema>, string>>
	readonly editor?: PaletteConfig<TSchema>['editor']
	readonly configurator?: PaletteConfig<TSchema>['configurator']
	readonly runner?: PaletteConfig<TSchema>['runner']
	readonly setter?: PaletteConfig<TSchema>['setter']
	readonly editing: boolean
	tool(spec: string): PaletteToolOf<TSchema>
	resolveEditor<
		TTool extends PaletteToolOf<TSchema> | undefined,
		TItem extends PaletteItem<TSchema>,
	>(item: TItem, tool: TTool): PaletteEditorSpec<TTool, TItem, TSchema> | undefined
	renderEditor<
		TTool extends PaletteToolOf<TSchema> | undefined,
		TItem extends PaletteItem<TSchema>,
	>(item: TItem, tool: TTool, scope: PaletteScope<TSchema>): JSX.Element
	renderConfigurator<
		TTool extends PaletteToolOf<TSchema> | undefined,
		TItem extends PaletteItem<TSchema>,
	>(item: TItem, tool: TTool, scope: PaletteScope<TSchema>): JSX.Element | undefined
	dispose(): void
}

export interface PaletteDragging<TPalette extends Palette = Palette> {
	border: TPalette extends Palette<infer TSchema>
		? PaletteBorder<PaletteItem<TSchema>>
		: PaletteBorder
	createdTracks: TPalette extends Palette<infer TSchema>
		? PaletteTrack<PaletteItem<TSchema>>[]
		: PaletteTrack[]
	index: number
	palette: TPalette
	region: PaletteRegion
	sourceItems: TPalette extends Palette<infer TSchema>
		? PaletteToolbar<PaletteItem<TSchema>>
		: PaletteToolbar
	sourceBorder: TPalette extends Palette<infer TSchema>
		? PaletteBorder<PaletteItem<TSchema>>
		: PaletteBorder
	sourceRegion: PaletteRegion
	sourceTrack: TPalette extends Palette<infer TSchema>
		? PaletteTrack<PaletteItem<TSchema>>
		: PaletteTrack
	sourceTrackIndex: number
	sourceTrackWasSingleton: boolean
	toolbar: TPalette extends Palette<infer TSchema>
		? PaletteToolbar<PaletteItem<TSchema>>
		: PaletteToolbar
	toolbarPreview?: {
		count: number
		index: number
		source: {
			border: TPalette extends Palette<infer TSchema>
				? PaletteBorder<PaletteItem<TSchema>>
				: PaletteBorder
			removedTrack: boolean
			track: TPalette extends Palette<infer TSchema>
				? PaletteTrack<PaletteItem<TSchema>>
				: PaletteTrack
			trackIndex: number
			snapshot: TPalette extends Palette<infer TSchema>
				? PaletteTrack<PaletteItem<TSchema>>
				: PaletteTrack
		}
		toolbar: TPalette extends Palette<infer TSchema>
			? PaletteToolbar<PaletteItem<TSchema>>
			: PaletteToolbar
	}
	track: TPalette extends Palette<infer TSchema> ? PaletteTrack<PaletteItem<TSchema>> : PaletteTrack
	trackIndex: number
}

import { componentStyle } from '@sursaut/kit'
import { effect, reactive, unwrap } from 'mutts'
import type { IdeProps, ToolbarProps } from './components'
import { Ide as PaletteIdeComponent, Toolbar as PaletteToolbarComponent } from './components'
import type {
	PaletteBase,
	PaletteConfig,
	PaletteDragging,
	PaletteEditableTool,
	PaletteEditableToolByFamily,
	PaletteEditableToolOf,
	PaletteEditorSpec,
	Palette as PaletteInstance,
	PaletteItem,
	PaletteOf,
	PaletteRegion,
	PaletteSchema,
	PaletteScope,
	PaletteTool,
	PaletteToolbarItem,
	PaletteToolEdit,
	PaletteToolEnumValue,
	PaletteToolFamily,
	PaletteToolNumber,
	PaletteToolOf,
	PaletteToolRun,
	PaletteTools,
	PaletteToolToolbarItem,
} from './types'

/**
 * Factory signature used by `valueActions` to derive runnable commands from editable tools.
 */
export type PaletteValueAction<TTool extends PaletteEditableTool = PaletteEditableTool> = (
	tool: TTool,
	arg?: string
) => PaletteToolRun

/**
 * Registry of built-in value actions keyed by editable tool family.
 */
export type PaletteValueActions = {
	[K in PaletteEditableToolOf['type']]: Record<
		string,
		PaletteValueAction<PaletteEditableToolByFamily<PaletteTools, K>>
	>
}

/**
 * Built-in palette actions used by `toolId:action` specs.
 *
 * Today only numeric tools provide generic actions (`inc` and `dec`).
 */
export const valueActions: PaletteValueActions = {
	// No need for valueActions for bool now - checkbutton is better than a "toggle" button
	number: {
		inc(type: PaletteToolNumber) {
			return {
				get can() {
					return type.max === undefined || type.value < type.max
				},
				run() {
					type.value += type.step ?? 1
				},
			}
		},
		dec(type: PaletteToolNumber) {
			return {
				get can() {
					return type.min === undefined || type.value > type.min
				},
				run() {
					type.value -= type.step ?? 1
				},
			}
		},
	},
	enum: {},
	boolean: {},
}

/**
 * Reader functions used to parse serialized values for each editable tool family.
 */
export const valueReader: {
	[K in PaletteEditableToolOf['type']]: (
		s: string
	) => PaletteEditableToolByFamily<PaletteTools, K>['value']
} = {
	number: Number,
	enum: (i) => i,
	boolean: (s) => ['1', 'true'].includes(s.toLowerCase()),
}

/**
 * Error thrown when a palette tool spec, editor variant, or tool family cannot be resolved.
 */
export class PaletteError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'PaletteError'
	}
}

let nextPaletteId = 0

/**
 * Returns a CSS style function that can be used to customize the appearance of a palette instance.
 */
function paletteInstanceStyle(id: string): () => void {
	return componentStyle.css`
    [data-palette-id='${id}'].editing .toolbar[data-palette-id='${id}'] {
      cursor: grab;
    }

    [data-palette-id='${id}'].editing .toolbar[data-palette-id='${id}']:hover {
      z-index: 2;
    }

    [data-palette-id='${id}'].editing .toolbar[data-palette-id='${id}']:hover::before {
      opacity: 1;
      background: rgba(96, 165, 250, 0.12);
      box-shadow:
        0 0 0 1px rgba(191, 219, 254, 0.45),
        0 0 0 5px rgba(96, 165, 250, 0.18);
    }

    [data-palette-id='${id}'].editing
      .toolbar-item-guard[data-palette-id='${id}']:hover {
      background: rgba(96, 165, 250, 0.12);
      box-shadow:
        0 0 0 1px rgba(191, 219, 254, 0.42),
        0 0 0 3px rgba(96, 165, 250, 0.14);
    }

    [data-palette-id='${id}'].editing
      .toolbar-item-guard[data-palette-id='${id}']:active {
      background: rgba(59, 130, 246, 0.12);
      box-shadow:
        0 0 0 1px rgba(191, 219, 254, 0.52),
        0 0 0 4px rgba(96, 165, 250, 0.18);
    }
  `
}

/**
 * Runtime palette object.
 *
 * Construct it with a `PaletteConfig`, then hand it to `Ide`, `Toolbar`, command-box helpers,
 * or your own adapter-specific editors.
 */
export class Palette<TSchema extends PaletteSchema = PaletteSchema>
	implements PaletteInstance<TSchema>
{
	readonly id: string
	readonly config: PaletteConfig<TSchema>
	readonly #disposeStyle: () => void

	constructor(config: PaletteConfig<TSchema>) {
		this.config = config
		this.id = `palette-${++nextPaletteId}`
		this.#disposeStyle = paletteInstanceStyle(this.id)
	}

	get tools() {
		return this.config.tools
	}

	get keys() {
		return this.config.keys
	}

	get editors() {
		return this.config.editors
	}

	get editorDefaults() {
		return this.config.editorDefaults
	}

	get editor() {
		return this.config.editor
	}

	get configurator() {
		return this.config.configurator
	}

	get runner() {
		return this.config.runner
	}

	get setter() {
		return this.config.setter
	}

	get editing() {
		return this.config.editable !== false && unwrap(palettes.editing) === unwrap(this)
	}

	/**
	 * Resolve a palette tool spec string into a palette tool object.
	 */
	tool(spec: string): PaletteToolOf<TSchema> {
		const pipeIndex = spec.indexOf('|')
		if (pipeIndex >= 0) {
			const toolId = spec.slice(0, pipeIndex)
			const tool = resolveEditableTool(this.tools, toolId)
			return paletteSetterRunner(
				this,
				tool as unknown as PaletteEditableToolByFamily<
					TSchema['tools'],
					PaletteEditableToolOf<TSchema>['type']
				>,
				spec.slice(pipeIndex + 1)
			) as PaletteToolOf<TSchema>
		}

		const colonIndex = spec.indexOf(':')
		if (colonIndex >= 0) {
			const toolId = spec.slice(0, colonIndex)
			const actionDesc = spec.slice(colonIndex + 1)
			const argIndex = actionDesc.indexOf('=')
			const action = argIndex >= 0 ? actionDesc.slice(0, argIndex) : actionDesc
			const arg = argIndex >= 0 ? actionDesc.slice(argIndex + 1) : undefined
			const tool = resolveEditableTool(this.tools, toolId)
			return paletteActionRunner(
				this,
				tool as unknown as PaletteEditableToolByFamily<
					TSchema['tools'],
					PaletteEditableToolOf<TSchema>['type']
				>,
				action,
				arg,
				actionDesc
			) as PaletteToolOf<TSchema>
		}

		return resolveTool(this.tools, spec) as PaletteToolOf<TSchema>
	}

	/**
	 * Resolve the editor spec that would be used for a given item.
	 */
	resolveEditor<
		TTool extends PaletteToolOf<TSchema> | undefined,
		TItem extends PaletteItem<TSchema>,
	>(item: TItem, tool: TTool): PaletteEditorSpec<TTool, TItem, TSchema> | undefined {
		if (!hasPaletteItemTool(item)) {
			const spec = this.editors?.item?.[item.editor]
			if (!spec) throw new PaletteError(`Unknown palette item editor "${item.editor}"`)
			return spec as unknown as PaletteEditorSpec<TTool, TItem, TSchema>
		}
		if (!tool) throw new PaletteError(`No palette tool provided for palette item "${item.tool}"`)
		const family = paletteToolFamily(tool) as PaletteToolFamily<TSchema['tools']>
		const registry = this.editors?.[family]
		if (!registry) return undefined
		const variant = item.editor ?? this.editorDefaults?.[family]
		if (!variant)
			throw new PaletteError(`No editor variant configured for palette tool "${item.tool}"`)
		const spec = registry[variant]
		if (!spec)
			throw new PaletteError(
				`Unknown palette editor "${variant}" for ${family} tool "${item.tool}"`
			)
		return spec as unknown as PaletteEditorSpec<TTool, TItem, TSchema>
	}

	/**
	 * Render an item editor through the palette's configured editor registry.
	 */
	renderEditor<
		TTool extends PaletteToolOf<TSchema> | undefined,
		TItem extends PaletteItem<TSchema>,
	>(item: TItem, tool: TTool, scope: PaletteScope<TSchema>): JSX.Element {
		const spec = this.resolveEditor(item, tool)
		if (spec) return spec.editor({ item, tool, scope, flags: spec.flags ?? {} })
		if (this.editor) return this.editor(item, tool, scope)
		if (!hasPaletteItemTool(item))
			throw new PaletteError(`No editor available for palette item "${item.editor}"`)
		throw new PaletteError(`No editor available for palette tool "${item.tool}"`)
	}

	/**
	 * Render an item configurator through the palette's configured editor registry.
	 */
	renderConfigurator<
		TTool extends PaletteToolOf<TSchema> | undefined,
		TItem extends PaletteItem<TSchema>,
	>(item: TItem, tool: TTool, scope: PaletteScope<TSchema>): JSX.Element | undefined {
		const spec = this.resolveEditor(item, tool)
		if (spec?.configure) return spec.configure({ item, tool, scope, flags: spec.flags ?? {} })
		if (this.configurator) return this.configurator(item, tool, scope)
		return undefined
	}

	/**
	 * Toolbar component factory.
	 */
	readonly Toolbar = (
		props: ToolbarProps<PaletteItem<TSchema>>,
		scope: PaletteScope<TSchema> = {}
	) => {
		scope.palette = this
		return PaletteToolbarComponent(props, scope as PaletteScope)
	}

	/**
	 * Ide component factory.
	 */
	readonly Ide = (
		props: Omit<IdeProps<TSchema>, 'palette'>,
		scope: Record<string, unknown> = {}
	) => {
		return PaletteIdeComponent(
			{ ...props, palette: this as unknown as Palette<PaletteSchema> },
			scope
		)
	}

	dispose() {
		this.#disposeStyle()
	}
}

const returnValues = new WeakMap<PaletteToolEdit<unknown>, unknown>()

/**
 * Split a string into individual keywords.
 */
function splitPaletteKeywords(value: string): string[] {
	return value
		.split('.')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
}

/**
 * Expand an enum value into the searchable keywords used by the palette command box.
 */
export function paletteEnumValueKeywords<TValue extends string>(
	value: PaletteToolEnumValue<TValue>
): string[] {
	const result = new Set<string>()
	for (const entry of [
		value.value,
		value.label,
		...(value.categories ?? []),
		...(value.keywords ?? []),
	]) {
		if (typeof entry !== 'string') continue
		const normalized = entry.trim()
		if (!normalized) continue
		result.add(normalized)
		for (const part of splitPaletteKeywords(normalized)) result.add(part)
	}
	return Array.from(result)
}

/**
 * Setter function used to update an editable tool's value.
 */
function setter(edit: PaletteToolEdit<unknown>, value: unknown): PaletteToolRun {
	return {
		can: true,
		run() {
			if (edit.value === value) {
				edit.value = returnValues.has(edit) ? returnValues.get(edit) : edit.default
			} else {
				returnValues.set(edit, edit.value)
				edit.value = value
				const stopRestore = effect`palette.setter.restore`(() => {
					void edit.value
					return () => {
						stopRestore()
						if (returnValues.get(edit) === value) returnValues.delete(edit)
					}
				})
			}
		},
	}
}

/**
 * Type guard for runnable palette tools.
 */
export function isRunTool<TTools extends PaletteTools>(
	tool: PaletteTool<TTools>
): tool is Extract<PaletteTool<TTools>, PaletteToolRun> {
	return 'run' in tool
}

/**
 * Type guard for editable palette tools.
 */
export function isEditableTool<TTools extends PaletteTools>(
	tool: PaletteTool<TTools>
): tool is PaletteEditableTool<TTools> {
	return 'type' in tool
}

/**
 * Resolve the family key used by editor registries and command helpers.
 */
export function paletteToolFamily<TTools extends PaletteTools>(
	tool: PaletteTool<TTools>
): PaletteToolFamily<TTools> {
	return (
		isRunTool(tool) ? 'run' : (tool as PaletteEditableTool<TTools>).type
	) as PaletteToolFamily<TTools>
}

/**
 * Type guard for toolbar items that reference an actual palette tool.
 */
export function hasPaletteItemTool<TTool extends string, TEditor extends string, TConfig>(
	item: PaletteToolbarItem<TTool, TEditor, TConfig>
): item is PaletteToolToolbarItem<TTool, TEditor, TConfig> {
	return typeof item.tool === 'string'
}

/**
 * Resolve the editor spec that would be used for a given item.
 */
export function resolvePaletteEditor<
	TSchema extends PaletteSchema,
	TTool extends PaletteToolOf<TSchema> | undefined,
	TItem extends PaletteItem<TSchema>,
>(
	palette: PaletteOf<TSchema>,
	item: TItem,
	tool: TTool
): PaletteEditorSpec<TTool, TItem, TSchema> | undefined {
	return palette.resolveEditor(item, tool)
}

/**
 * Render an item editor through the palette's configured editor registry.
 */
export function renderPaletteEditor<
	TSchema extends PaletteSchema,
	TTool extends PaletteToolOf<TSchema> | undefined,
	TItem extends PaletteItem<TSchema>,
>(
	palette: PaletteOf<TSchema>,
	item: TItem,
	tool: TTool,
	scope: PaletteScope<TSchema>
): JSX.Element {
	return palette.renderEditor(item, tool, scope)
}

/**
 * Render an item configurator through the palette's configured editor registry.
 */
export function renderPaletteConfigurator<
	TSchema extends PaletteSchema,
	TTool extends PaletteToolOf<TSchema> | undefined,
	TItem extends PaletteItem<TSchema>,
>(
	palette: PaletteOf<TSchema>,
	item: TItem,
	tool: TTool,
	scope: PaletteScope<TSchema>
): JSX.Element | undefined {
	return palette.renderConfigurator(item, tool, scope)
}

/**
 * Resolve a palette tool by its ID.
 */
function resolveTool<TTools extends PaletteTools>(
	tools: TTools,
	toolId: string
): PaletteTool<TTools> {
	const tool = tools[toolId as keyof TTools & string]
	if (!tool) throw new PaletteError(`Unknown palette tool "${toolId}"`)
	return tool as PaletteTool<TTools>
}

/**
 * Resolve an editable palette tool by its ID and optional family.
 */
function resolveEditableTool<
	TTools extends PaletteTools,
	TFamily extends PaletteEditableTool<TTools>['type'],
>(
	tools: TTools,
	toolId: string,
	family?: TFamily
): PaletteEditableToolByFamily<TTools, TFamily> | PaletteEditableTool<TTools> {
	const tool = resolveTool(tools, toolId)
	if (!isEditableTool(tool))
		throw new PaletteError(`Palette tool "${toolId}" does not support editing`)
	if (family && tool.type !== family)
		throw new PaletteError(`Palette tool "${toolId}" is "${tool.type}", expected "${family}"`)
	return tool as PaletteEditableToolByFamily<TTools, TFamily> | PaletteEditableTool<TTools>
}

/**
 * Create a setter runner for an editable tool.
 */
function paletteSetterRunner<
	TSchema extends PaletteSchema,
	TFamily extends PaletteEditableToolOf<TSchema>['type'],
>(
	palette: PaletteOf<TSchema>,
	tool: PaletteEditableToolByFamily<TSchema['tools'], TFamily>,
	serialized: string
): PaletteToolRun {
	const value = valueReader[tool.type](serialized) as PaletteEditableToolByFamily<
		TSchema['tools'],
		TFamily
	>['value']
	if (tool.type === 'number' && (!Number.isFinite(value) || serialized.trim() === ''))
		throw new PaletteError(`Invalid palette value "${serialized}" for tool "${tool.type}"`)
	const runner = setter(tool, value)
	return palette.setter ? palette.setter(runner, tool, value) : runner
}

/**
 * Create an action runner for an editable tool.
 */
function paletteActionRunner<
	TSchema extends PaletteSchema,
	TFamily extends PaletteEditableToolOf<TSchema>['type'],
>(
	palette: PaletteOf<TSchema>,
	tool: PaletteEditableToolByFamily<TSchema['tools'], TFamily>,
	action: string,
	arg?: string,
	spec?: string
): PaletteToolRun {
	const valueAction = valueActions[tool.type][action] as
		| PaletteValueAction<PaletteEditableToolByFamily<TSchema['tools'], TFamily>>
		| undefined
	if (!valueAction)
		throw new PaletteError(`Unknown palette action "${action}" for tool "${tool.type}"`)
	const runner = valueAction(tool, arg)
	return palette.runner ? palette.runner(runner, tool, spec ?? action) : runner
}

/**
 * Resolve a palette tool spec string through a palette instance.
 */
export function paletteTool<TSchema extends PaletteSchema>(
	palette: PaletteOf<TSchema>,
	runnerDesc: string
): PaletteToolOf<TSchema> {
	return palette.tool(runnerDesc)
}

/**
 * Global reactive palette UI state shared by layout components while editing and inspecting.
 */
export const palettes = reactive<{
	/** Native HTML5 drag from the command-box catalogue (separate from pointer toolbar reordering). */
	catalogDrag?: { palette: PaletteBase }
	dragging?: PaletteDragging
	editing?: PaletteBase
	inspecting?: {
		item: PaletteToolbarItem
		palette: PaletteBase
		region?: PaletteRegion
	}
}>({})

let catalogNativeDragEndListenerRegistered = false

function ensureCatalogNativeDragEndListener(): void {
	if (typeof window === 'undefined' || catalogNativeDragEndListenerRegistered) return
	catalogNativeDragEndListenerRegistered = true
	window.addEventListener(
		'dragend',
		() => {
			if (palettes.catalogDrag) delete palettes.catalogDrag
		},
		true
	)
}

/**
 * Mark a palette as having an active native (HTML5) catalogue drag so IDE drop zones stay hittable and highlighted.
 * Cleared automatically on `window` `dragend` (capture).
 */
export function notifyPaletteCatalogNativeDragStarted(palette: PaletteBase): void {
	ensureCatalogNativeDragEndListener()
	palettes.catalogDrag = { palette }
}

/**
 * Check whether a palette is the currently edited palette.
 */
export function isEditing(palette: PaletteBase | undefined): boolean {
	return palette instanceof Palette ? palette.editing : unwrap(palettes.editing) === unwrap(palette)
}

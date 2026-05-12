import { componentStyle } from '@sursaut/kit'
import { effect, reactive, unwrap } from 'mutts'
import type { IdeProps, ToolbarProps } from './components'
import { Ide as PaletteIdeComponent, Toolbar as PaletteToolbarComponent } from './components'
import type {
	PaletteBase,
	PaletteBorder,
	PaletteBorders,
	PaletteConfig,
	PaletteConfiguredItemTarget,
	PaletteDragging,
	PaletteEditableTool,
	PaletteEditableToolByFamily,
	PaletteEditableToolOf,
	PaletteEditorCapability,
	PaletteEditorSpec,
	Palette as PaletteInstance,
	PaletteItem,
	PaletteItemBindingSection,
	PaletteItemConfigurationDescriptor,
	PaletteOf,
	PaletteRegion,
	PaletteSchema,
	PaletteScope,
	PaletteSurfaceContext,
	PaletteTool,
	PaletteToolbar,
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
	>(
		item: TItem,
		tool: TTool,
		surface?: PaletteSurfaceContext
	): PaletteEditorSpec<TTool, TItem, TSchema> | undefined {
		if (!hasPaletteItemTool(item)) {
			const spec = this.editors?.item?.[item.editor]
			if (!spec) throw new PaletteError(`Unknown palette item editor "${item.editor}"`)
			return spec as unknown as PaletteEditorSpec<TTool, TItem, TSchema>
		}
		if (!tool) throw new PaletteError(`No palette tool provided for palette item "${item.tool}"`)
		const family = paletteToolFamily(tool) as PaletteToolFamily<TSchema['tools']>
		const registry = this.editors?.[family]
		if (!registry) return undefined
		let variant = item.editor ?? this.editorDefaults?.[family]
		if (!variant)
			throw new PaletteError(`No editor variant configured for palette tool "${item.tool}"`)

		// Validate against capabilities if surface is provided
		if (surface) {
			const caps = this.config.editorCapabilities ?? paletteDefaultEditorCapabilities
			const cap = caps?.[variant]
			if (cap) {
				const toolObj = hasPaletteItemTool(item) ? this.tool(item.tool) : undefined
				let needsFallback = false

				// Check family
				if (!cap.families.includes(family as PaletteToolFamily)) {
					needsFallback = true
				}
				// Check supportedAxes
				else if (
					cap.supportedAxes &&
					cap.supportedAxes !== 'both' &&
					cap.supportedAxes !== surface.axis
				) {
					needsFallback = true
				}
				// Check accepts callback
				else if (
					cap.accepts &&
					!cap.accepts({
						palette: this as unknown as Palette<PaletteSchema>,
						item,
						tool: toolObj as PaletteTool | undefined,
						surface,
					})
				) {
					needsFallback = true
				}

				// Fall back to first compact capability for the same family
				if (needsFallback) {
					const fallbackCap = Object.values(caps).find(
						(c) =>
							c.compact &&
							c.families.includes(family as PaletteToolFamily) &&
							(!c.supportedAxes ||
								c.supportedAxes === 'both' ||
								c.supportedAxes === surface.axis) &&
							(!c.accepts ||
								c.accepts({
									palette: this as unknown as Palette<PaletteSchema>,
									item,
									tool: toolObj as PaletteTool | undefined,
									surface,
								}))
					)
					if (fallbackCap) {
						variant = fallbackCap.id
					}
				}
			}
		}

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
		const surface: PaletteSurfaceContext = {
			axis: scope.region === 'left' || scope.region === 'right' ? 'vertical' : 'horizontal',
			region: scope.region,
		}
		const spec = this.resolveEditor(item, tool, surface)
		if (spec) return spec.editor({ item, tool, scope, flags: spec.flags ?? {}, surface })
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
		const surface: PaletteSurfaceContext = {
			axis: scope.region === 'left' || scope.region === 'right' ? 'vertical' : 'horizontal',
			region: scope.region,
		}
		const spec = this.resolveEditor(item, tool, surface)
		// Compute editor choices and inject into scope for adapters
		const desc = this.describeItemConfiguration(
			{ item, toolbar: [item], index: 0, region: scope.region },
			surface
		)
		const augmentedScope = { ...scope, editorChoices: desc.presentation.editorChoices }
		if (spec?.configure)
			return spec.configure({ item, tool, scope: augmentedScope, flags: spec.flags ?? {}, surface })
		if (this.configurator) return this.configurator(item, tool, augmentedScope)
		return undefined
	}

	/**
	 * Compute a headless configuration descriptor for a toolbar item.
	 *
	 * Adapters consume this descriptor to render item configuration UI.
	 * The palette owns the semantics; adapters own the rendering.
	 */
	describeItemConfiguration(
		target: PaletteConfiguredItemTarget,
		surface: PaletteSurfaceContext
	): PaletteItemConfigurationDescriptor {
		const { item, toolbar, index, region } = target
		const tool = hasPaletteItemTool(item) ? this.tool(item.tool) : undefined
		const displayRegion = region ?? surface.region
		const toolFamily = tool ? paletteToolFamily(tool) : 'item'
		const editorChoices: { id: string; label: string; selected: boolean }[] = []
		const descriptor: PaletteItemConfigurationDescriptor = {
			target,
			surface: { axis: surface.axis, region: displayRegion },
			title:
				((item.config as Record<string, unknown> | undefined)?.label as string | undefined) ??
				(hasPaletteItemTool(item) ? item.tool : item.editor),
			subtitle: hasPaletteItemTool(item) ? item.tool : undefined,
			structure: {
				moveBackward: { enabled: index > 0 },
				moveForward: { enabled: index < toolbar.length - 1 },
				removable: true,
			},
			presentation: {
				currentEditor: item.editor,
				editorChoices,
			},
		}

		// Compute editor choices from capabilities
		const caps = this.config.editorCapabilities ?? paletteDefaultEditorCapabilities
		if (toolFamily) {
			const family = toolFamily as string
			for (const cap of Object.values(caps)) {
				if (cap.hidden) continue
				if (!cap.families.includes(family as PaletteToolFamily)) continue
				if (cap.supportedAxes && cap.supportedAxes !== 'both' && cap.supportedAxes !== surface.axis)
					continue
				if (
					cap.accepts &&
					!cap.accepts({ palette: this as unknown as Palette<PaletteSchema>, item, tool, surface })
				)
					continue
				editorChoices.push({
					id: cap.id,
					label: cap.label,
					selected: cap.id === item.editor,
				})
			}
		}

		// Bindings placeholder
		if (hasPaletteItemTool(item)) {
			const strokes = this.keys.findByTool(item.tool)
			if (strokes.length > 0) {
				const descriptorMutable = descriptor as { bindings?: PaletteItemBindingSection }
				descriptorMutable.bindings = { shortcut: strokes[0] }
			}
		}

		return descriptor
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

/**
 * Built-in editor capability descriptors.
 *
 * Adapters may supply their own via `PaletteConfig.editorCapabilities`
 * to override or extend these defaults.
 */
export const paletteDefaultEditorCapabilities: Record<string, PaletteEditorCapability> = {
	button: { id: 'button', label: 'Button', families: ['run'], supportedAxes: 'both' },
	splitButton: {
		id: 'splitButton',
		label: 'Split button',
		families: ['run'],
		supportedAxes: 'both',
	},
	toggle: {
		id: 'toggle',
		label: 'Toggle',
		families: ['boolean'],
		supportedAxes: 'both',
		compact: true,
	},
	flip: { id: 'flip', label: 'Flip', families: ['enum'], supportedAxes: 'both', compact: true },
	radio: { id: 'radio', label: 'Radio', families: ['enum'], supportedAxes: 'both' },
	select: {
		id: 'select',
		label: 'Select',
		families: ['enum'],
		supportedAxes: 'both',
		compact: true,
	},
	segmented: {
		id: 'segmented',
		label: 'Segmented',
		families: ['enum'],
		supportedAxes: 'both',
		compact: true,
	},
	splitRadio: { id: 'splitRadio', label: 'Split radio', families: ['enum'], supportedAxes: 'both' },
	slider: { id: 'slider', label: 'Slider', families: ['number'], supportedAxes: 'horizontal' },
	stepper: {
		id: 'stepper',
		label: 'Stepper',
		families: ['number'],
		supportedAxes: 'both',
		compact: true,
	},
	stars: {
		id: 'stars',
		label: 'Stars',
		families: ['number'],
		supportedAxes: 'both',
		compact: true,
	},
	commandBox: { id: 'commandBox', label: 'Command box', families: ['item'], supportedAxes: 'both' },
	drawer: { id: 'drawer', label: 'Drawer', families: ['item'], supportedAxes: 'both' },
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

/**
 * Resolve where an item would move within or across toolbars given a direction.
 *
 * This is a simple placement target resolution function that determines the target
 * location for an item when moving forward or backward. It handles:
 * - Same-toolbar moves (within the same region and track)
 * - Cross-toolbar moves (between tracks within the same region)
 * - Cross-region moves (between different docking regions)
 *
 * @param borders - The full border layout containing all regions and their toolbars
 * @param item - The toolbar item being moved (used for reference, not modified)
 * @param source - The current location of the item (region and track index)
 * @param direction - The direction of movement ('forward' or 'backward')
 * @returns The target location (region and track index), or null if no valid target exists
 *
 * @example
 * ```ts
 * const target = resolveItemPlacementTarget(
 *   borders,
 *   item,
 *   { region: 'top', trackIndex: 0 },
 *   'forward'
 * )
 * if (target) {
 *   // Move item to target.region, target.trackIndex
 * }
 * ```
 */
export function resolveItemPlacementTarget(
	borders: PaletteBorders,
	_item: PaletteToolbarItem,
	source: { region: PaletteRegion; trackIndex: number },
	direction: 'forward' | 'backward'
): { region: PaletteRegion; trackIndex: number } | null {
	const regions: PaletteRegion[] = ['top', 'right', 'bottom', 'left']
	const sourceRegionIndex = regions.indexOf(source.region)

	if (sourceRegionIndex === -1) {
		return null
	}

	// Flatten all tracks across all regions into a linear sequence
	const allTracks: { region: PaletteRegion; trackIndex: number; toolbar: PaletteToolbar }[] = []
	for (const region of regions) {
		const border = borders[region]
		for (let trackIndex = 0; trackIndex < border.length; trackIndex++) {
			const track = border[trackIndex]
			// PaletteTrack is an array of { space, toolbar } objects
			// We use the first toolbar entry for this track
			const toolbar = track[0]?.toolbar ?? []
			allTracks.push({ region, trackIndex, toolbar })
		}
	}

	// Find the current track index in the flattened sequence
	const currentTrackIndex = allTracks.findIndex(
		(t) => t.region === source.region && t.trackIndex === source.trackIndex
	)

	if (currentTrackIndex === -1) {
		return null
	}

	// Calculate target track index based on direction
	let targetTrackIndex: number
	if (direction === 'forward') {
		targetTrackIndex = currentTrackIndex + 1
	} else {
		targetTrackIndex = currentTrackIndex - 1
	}

	// Check if target is valid
	if (targetTrackIndex < 0 || targetTrackIndex >= allTracks.length) {
		return null
	}

	const targetTrack = allTracks[targetTrackIndex]
	return {
		region: targetTrack.region,
		trackIndex: targetTrack.trackIndex,
	}
}

// ── Layout Serialization ──

import type { SerializedPaletteLayout } from './types'

/**
 * Serialize a palette border layout to a stable, JSON-serializable format.
 *
 * This function strips object identity from reactive arrays and converts them
 * to plain arrays, preserving only serializable primitives (strings, numbers,
 * booleans, plain objects).
 *
 * @param config - The palette border layout to serialize
 * @returns A serialized layout suitable for JSON persistence
 */
export function serializePaletteLayout(config: PaletteBorders): SerializedPaletteLayout {
	const regions: PaletteRegion[] = ['top', 'right', 'bottom', 'left']

	const borders: Record<PaletteRegion, SerializedPaletteLayout['borders'][PaletteRegion]> =
		{} as any

	for (const region of regions) {
		// PaletteBorder is PaletteTrack[], and PaletteTrack is { space, toolbar }[]
		// So config[region] is a 2D array where each element is { space, toolbar }[]
		borders[region] = config[region].flatMap((track) => {
			return track.map((trackElement) => ({
				space: trackElement.space,
				toolbar: trackElement.toolbar.map((item) => {
					const serialized: {
						tool?: string
						editor?: string
						config?: Record<string, unknown>
					} = {}

					if ('tool' in item && item.tool !== undefined) {
						serialized.tool = item.tool
					}
					if ('editor' in item && item.editor !== undefined) {
						serialized.editor = item.editor
					}
					if ('config' in item && item.config !== undefined) {
						serialized.config = item.config as Record<string, unknown>
					}

					return serialized
				}),
			}))
		}) as SerializedPaletteLayout['borders'][PaletteRegion]
	}

	return {
		version: 1,
		borders,
	}
}

/**
 * Validate that an unknown value is a properly structured SerializedPaletteLayout.
 *
 * This function performs runtime validation to ensure the layout has:
 * - The correct version (1)
 * - Valid palette regions
 * - Properly shaped toolbar items
 *
 * @param layout - The value to validate
 * @returns True if the value is a valid SerializedPaletteLayout
 */
export function validatePaletteLayout(layout: unknown): layout is SerializedPaletteLayout {
	if (typeof layout !== 'object' || layout === null) {
		return false
	}

	const obj = layout as Record<string, unknown>

	// Check version
	if (obj.version !== 1) {
		return false
	}

	// Check borders
	if (typeof obj.borders !== 'object' || obj.borders === null) {
		return false
	}

	const borders = obj.borders as Record<string, unknown>
	const regions: PaletteRegion[] = ['top', 'right', 'bottom', 'left']

	for (const region of regions) {
		const border = borders[region]
		if (!Array.isArray(border)) {
			return false
		}

		for (const track of border) {
			if (typeof track !== 'object' || track === null) {
				return false
			}

			const trackObj = track as Record<string, unknown>

			// Check space
			if (typeof trackObj.space !== 'number') {
				return false
			}

			// Check toolbar
			if (!Array.isArray(trackObj.toolbar)) {
				return false
			}

			for (const item of trackObj.toolbar) {
				if (typeof item !== 'object' || item === null) {
					return false
				}

				const itemObj = item as Record<string, unknown>

				// Validate tool (optional string)
				if (itemObj.tool !== undefined && typeof itemObj.tool !== 'string') {
					return false
				}

				// Validate editor (optional string)
				if (itemObj.editor !== undefined && typeof itemObj.editor !== 'string') {
					return false
				}

				// Validate config (optional plain object)
				if (itemObj.config !== undefined) {
					if (typeof itemObj.config !== 'object' || itemObj.config === null) {
						return false
					}
					// Ensure config is a plain object (not array, not null)
					if (Array.isArray(itemObj.config)) {
						return false
					}
				}
			}
		}
	}

	// Check parking (optional)
	if (obj.parking !== undefined) {
		if (!Array.isArray(obj.parking)) {
			return false
		}

		for (const toolbar of obj.parking) {
			if (!Array.isArray(toolbar)) {
				return false
			}

			for (const item of toolbar) {
				if (typeof item !== 'object' || item === null) {
					return false
				}

				const itemObj = item as Record<string, unknown>

				// Validate tool (optional string)
				if (itemObj.tool !== undefined && typeof itemObj.tool !== 'string') {
					return false
				}

				// Validate editor (optional string)
				if (itemObj.editor !== undefined && typeof itemObj.editor !== 'string') {
					return false
				}

				// Validate config (optional plain object)
				if (itemObj.config !== undefined) {
					if (typeof itemObj.config !== 'object' || itemObj.config === null) {
						return false
					}
					if (Array.isArray(itemObj.config)) {
						return false
					}
				}
			}
		}
	}

	return true
}

/**
 * Hydrate a serialized palette layout into reactive PaletteBorders.
 *
 * This function creates reactive arrays from the serialized layout, using
 * the palette's tool/editor registry to validate references.
 *
 * @param palette - The palette instance for tool/editor validation
 * @param layout - The serialized layout to hydrate
 * @returns Reactive PaletteBorders ready for use in the palette
 */
export function hydratePaletteLayout(
	_palette: Palette,
	layout: SerializedPaletteLayout
): PaletteBorders {
	const regions: PaletteRegion[] = ['top', 'right', 'bottom', 'left']

	const borders: Partial<PaletteBorders> = {}

	for (const region of regions) {
		const serializedBorder = layout.borders[region]

		// PaletteBorder is PaletteTrack[], and PaletteTrack is { space, toolbar }[]
		const border: PaletteBorder = reactive(
			serializedBorder.map((track) => {
				return reactive([
					{
						space: track.space,
						toolbar: reactive(
							track.toolbar.map((item) => {
								// Create the item with all properties at once to avoid readonly assignment issues
								const result: Record<string, unknown> = {}

								if (item.tool !== undefined) {
									result.tool = item.tool
								}
								if (item.editor !== undefined) {
									result.editor = item.editor
								}
								if (item.config !== undefined) {
									result.config = item.config
								}

								return result as PaletteToolbarItem
							})
						),
					},
				])
			})
		)

		borders[region] = border
	}

	return borders as PaletteBorders
}

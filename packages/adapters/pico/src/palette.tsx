import { Icon } from '@sursaut/ui'
import {
	handlePaletteCommandBoxInputKeydown,
	handlePaletteCommandChipKeydown,
	type PaletteCommandBoxModel,
	type PaletteConfig,
	type PaletteEditorContext,
	type PaletteEditorRegistry,
	type PaletteSchema,
	type PaletteScope,
	type PaletteTool,
	type PaletteToolbarItem,
	type PaletteTools,
	palettes,
	paletteToolFamily,
	setPaletteCommandBoxInput,
} from '@sursaut/ui/palette'
import { reactive, unwrap } from 'mutts'
import { Button } from './components/button'
import { ButtonGroup } from './components/button-group'
import { CheckButton } from './components/checkbutton'
import { Select } from './components/options'
import { RadioButton } from './components/radiobutton'
import { SplitRadioButton } from './components/split-radio-button'
import { SplitButton } from './components/splitbutton'
import { Stars } from './components/stars'

export type PicoPaletteTone = 'neutral' | 'accent'
export type PicoPaletteChoiceDisplay = 'icon' | 'text' | 'both'

export type PicoPaletteItemConfigBase = {
	icon?: string | JSX.Element | (() => JSX.Element)
	label?: string
	hint?: string
	tone?: PicoPaletteTone
}

export type PicoPaletteEnumConfig = PicoPaletteItemConfigBase & {
	choiceDisplay?: PicoPaletteChoiceDisplay
	values?: readonly string[]
	keywords?: readonly string[]
}

export type PicoPaletteEditorConfigByVariant = {
	button: PicoPaletteItemConfigBase
	commandBox: PicoPaletteItemConfigBase
	flip: PicoPaletteEnumConfig
	radio: PicoPaletteEnumConfig
	select: PicoPaletteEnumConfig
	segmented: PicoPaletteEnumConfig
	slider: PicoPaletteItemConfigBase
	splitButton: PicoPaletteItemConfigBase
	splitRadio: PicoPaletteEnumConfig
	stars: PicoPaletteItemConfigBase
	stepper: PicoPaletteItemConfigBase
	toggle: PicoPaletteItemConfigBase
}

export type PicoPaletteEditorVariant = keyof PicoPaletteEditorConfigByVariant

export type PicoPaletteToolbarItem<TTool extends string = string> = PaletteToolbarItem<
	TTool,
	PicoPaletteEditorVariant,
	PicoPaletteEditorConfigByVariant[PicoPaletteEditorVariant]
>

export type PicoPaletteSchema<
	TTools extends PaletteTools = PaletteTools,
	TItem extends PicoPaletteToolbarItem<keyof TTools & string> = PicoPaletteToolbarItem<
		keyof TTools & string
	>,
> = PaletteSchema<TTools, PicoPaletteEditorConfigByVariant, TItem>

export type PicoPaletteCommandBoxProps = {
	readonly commandBox: PaletteCommandBoxModel
	readonly editable?: boolean
	readonly palette?: PicoPaletteInstance
	readonly icon?: string | JSX.Element
	readonly title?: string
	readonly expanded: boolean
	readonly floating?: boolean
	readonly onInputFocus?: () => void
	readonly onInputBlur?: (event: FocusEvent) => void
	readonly onEscapeOrExecute?: () => void
	readonly onEntryPick?: (entryId: string) => void
	readonly onInputMount?: (input: HTMLInputElement) => void
	readonly onSuggestionPick?: () => void
	readonly selectOnPick?: boolean
}

type PicoPaletteScopeExtras = {
	commandBox?: PaletteCommandBoxModel
	commandBoxExpanded?: boolean
	commandBoxEditable?: boolean
	commandBoxFloating?: boolean
	commandBoxIcon?: string | JSX.Element
	commandBoxSelectOnPick?: boolean
	onCommandBoxEntryPick?: (entryId: string) => void
	onCommandBoxEscapeOrExecute?: () => void
	onCommandBoxFocus?: () => void
	onCommandBoxBlur?: (event: FocusEvent) => void
	onCommandBoxInputMount?: (input: HTMLInputElement) => void
	onCommandBoxSuggestionPick?: () => void
}

type PicoPaletteEditorOption = {
	label: string
	value: PicoPaletteEditorVariant
}

type PicoPaletteAnyItem = PicoPaletteToolbarItem
type PicoPaletteRunTool = Extract<PaletteTool, { run(): void }>
type PicoPaletteBooleanTool = Extract<PaletteTool, { type: 'boolean' }>
type PicoPaletteEnumTool = Extract<PaletteTool, { type: 'enum' }>
type PicoPaletteNumberTool = Extract<PaletteTool, { type: 'number' }>
type PicoPaletteInstance = NonNullable<PaletteScope<PicoPaletteSchema>['palette']>

const picoPaletteEditorLabels = {
	button: 'Button',
	commandBox: 'Command box',
	flip: 'Flip',
	radio: 'Radio',
	select: 'Select',
	segmented: 'Segmented',
	slider: 'Slider',
	splitButton: 'Split button',
	splitRadio: 'Split radio',
	stars: 'Stars',
	stepper: 'Stepper',
	toggle: 'Toggle',
} satisfies Record<PicoPaletteEditorVariant, string>

const picoPaletteEditorDefaults = {
	boolean: 'toggle',
	enum: 'select',
	number: 'slider',
	run: 'button',
} as const

const toneButtonVariant = {
	accent: 'primary',
	neutral: 'secondary',
} as const

const emojiPattern = /\p{Extended_Pictographic}/u
const iconNamePattern = /^[a-z0-9]+(?:[-_:][a-z0-9]+)*$/i
const glyfClassPattern = /(?:^|\s)(?:pure-glyf-icon|glyf-[^\s]+)(?=$|\s)/

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === 'object' && value !== null
}

function renderIcon(
	icon: string | JSX.Element | (() => JSX.Element) | undefined,
	fallback?: string
): JSX.Element | undefined {
	const value = icon ?? fallback
	if (!value) return undefined
	if (typeof value !== 'string') return value
	if (glyfClassPattern.test(value))
		return <span class={value} aria-hidden="true" style={{ fontSize: '1em' }} />
	if (!emojiPattern.test(value) && (iconNamePattern.test(value) || glyfClassPattern.test(value)))
		return <Icon name={value} size="1em" />
	return <>{value}</>
}

function itemConfig(
	item: PicoPaletteAnyItem
): PicoPaletteEditorConfigByVariant[PicoPaletteEditorVariant] | undefined {
	return isRecord(item.config) ? item.config : undefined
}

function ensureItemConfig(
	item: PicoPaletteAnyItem
): PicoPaletteEditorConfigByVariant[PicoPaletteEditorVariant] {
	if (!isRecord(item.config)) item.config = {}
	return item.config
}

function enumConfig(item: PicoPaletteAnyItem): PicoPaletteEnumConfig | undefined {
	const config = itemConfig(item)
	return config ? (config as PicoPaletteEnumConfig) : undefined
}

function itemMeta(item: PicoPaletteAnyItem) {
	const config = itemConfig(item)
	return {
		get icon() {
			return config?.icon
		},
		get hint() {
			return typeof config?.hint === 'string' ? config.hint : undefined
		},
		get label() {
			return typeof config?.label === 'string' ? config.label : (item.tool ?? item.editor)
		},
		get tone() {
			return config?.tone === 'accent' ? 'accent' : 'neutral'
		},
	}
}

function titleForItem(item: PicoPaletteAnyItem, suffix?: string): string {
	const meta = itemMeta(item)
	return suffix ? `${meta.label} · ${suffix}` : meta.label
}

function choiceDisplay(item: PicoPaletteAnyItem): PicoPaletteChoiceDisplay {
	const display = enumConfig(item)?.choiceDisplay
	return display === 'icon' || display === 'text' || display === 'both' ? display : 'both'
}

function filteredEnumValues(item: PicoPaletteAnyItem, tool: PicoPaletteEnumTool) {
	const subset = enumConfig(item)?.values
	if (!subset?.length) return tool.values
	const allowed = new Set(subset)
	return tool.values.filter((entry: PicoPaletteEnumTool['values'][number]) =>
		allowed.has(String(entry.value))
	)
}

function enumChoiceText(
	entry: { icon?: string; label?: string; value: string },
	display: PicoPaletteChoiceDisplay
): string {
	if (display === 'icon') return entry.icon ?? entry.label ?? entry.value
	if (display === 'text') return entry.label ?? entry.value
	return [entry.icon, entry.label ?? entry.value].filter(Boolean).join(' ')
}

function editorOptions(
	item: PicoPaletteAnyItem,
	tool: PaletteTool | undefined
): readonly PicoPaletteEditorOption[] {
	if (!item.tool) return [{ value: 'commandBox', label: picoPaletteEditorLabels.commandBox }]
	if (!tool) return []
	const family = paletteToolFamily(tool)
	if (family === 'run')
		return [
			{ value: 'button', label: picoPaletteEditorLabels.button },
			{ value: 'splitButton', label: picoPaletteEditorLabels.splitButton },
		]
	if (family === 'boolean') return [{ value: 'toggle', label: picoPaletteEditorLabels.toggle }]
	if (family === 'enum')
		return [
			{ value: 'flip', label: picoPaletteEditorLabels.flip },
			{ value: 'radio', label: picoPaletteEditorLabels.radio },
			{ value: 'select', label: picoPaletteEditorLabels.select },
			{ value: 'segmented', label: picoPaletteEditorLabels.segmented },
			{ value: 'splitRadio', label: picoPaletteEditorLabels.splitRadio },
		]
	return [
		{ value: 'slider', label: picoPaletteEditorLabels.slider },
		{ value: 'stepper', label: picoPaletteEditorLabels.stepper },
		{ value: 'stars', label: picoPaletteEditorLabels.stars },
	]
}

function setConfigText(item: PicoPaletteAnyItem, key: 'label' | 'hint', value: string) {
	const config = ensureItemConfig(item)
	config[key] = value
}

function setConfigIcon(item: PicoPaletteAnyItem, value: string) {
	const config = ensureItemConfig(item)
	config.icon = value
}

function setConfigTone(item: PicoPaletteAnyItem, value: string) {
	const config = ensureItemConfig(item)
	config.tone = value === 'accent' ? 'accent' : 'neutral'
}

function setConfigChoiceDisplay(item: PicoPaletteAnyItem, value: string) {
	const config = ensureItemConfig(item) as PicoPaletteEnumConfig
	config.choiceDisplay = value === 'icon' || value === 'text' || value === 'both' ? value : 'both'
}

function setConfigList(item: PicoPaletteAnyItem, key: 'values' | 'keywords', value: string) {
	const config = ensureItemConfig(item) as PicoPaletteEnumConfig
	const next = value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
	config[key] = next.length > 0 ? next : undefined
}

function ConfigRow(props: { label: string; description?: string; children?: JSX.Children }) {
	return (
		<div class="sursaut-palette-config-row">
			<div class="sursaut-palette-config-key">
				<strong>{props.label}</strong>
				<span if={props.description}>{props.description}</span>
			</div>
			<div class="sursaut-palette-config-value">{props.children}</div>
		</div>
	)
}

function BaseConfigurator(props: { item: PicoPaletteAnyItem; tool: PaletteTool | undefined }) {
	const meta = itemMeta(props.item)
	return (
		<div class="sursaut-palette-config-table">
			<ConfigRow label="Label">
				<input
					value={meta.label}
					update:value={(value: string) => setConfigText(props.item, 'label', value)}
				/>
			</ConfigRow>
			<ConfigRow label="Icon" description="Emoji or icon name.">
				<input
					value={typeof meta.icon === 'string' ? meta.icon : ''}
					placeholder="bolt or ⚡"
					update:value={(value: string) => setConfigIcon(props.item, value)}
				/>
			</ConfigRow>
			<ConfigRow label="Hint">
				<input
					value={meta.hint ?? ''}
					update:value={(value: string) => setConfigText(props.item, 'hint', value)}
				/>
			</ConfigRow>
			<ConfigRow label="Editor">
				<select
					value={props.item.editor}
					update:value={(value: string) => {
						if (value in picoPaletteEditorLabels)
							props.item.editor = value as PicoPaletteEditorVariant
					}}
				>
					<for each={editorOptions(props.item, props.tool)}>
						{(option: PicoPaletteEditorOption) => (
							<option value={option.value}>{option.label}</option>
						)}
					</for>
				</select>
			</ConfigRow>
			<ConfigRow label="Tone">
				<select
					value={meta.tone}
					update:value={(value: string) => setConfigTone(props.item, value)}
				>
					<option value="neutral">Neutral</option>
					<option value="accent">Accent</option>
				</select>
			</ConfigRow>
		</div>
	)
}

function EnumConfigurator(props: { item: PicoPaletteAnyItem; tool: PicoPaletteEnumTool }) {
	const config = enumConfig(props.item)
	return (
		<div class="sursaut-palette-config-stack">
			<BaseConfigurator item={props.item} tool={props.tool} />
			<ConfigRow label="Choice display">
				<select
					value={choiceDisplay(props.item)}
					update:value={(value: string) => setConfigChoiceDisplay(props.item, value)}
				>
					<option value="both">Icon + text</option>
					<option value="icon">Icon only</option>
					<option value="text">Text only</option>
				</select>
			</ConfigRow>
			<ConfigRow label="Allowed values">
				<input
					value={config?.values?.join(', ') ?? ''}
					placeholder={props.tool.values
						.map((entry: PicoPaletteEnumTool['values'][number]) => String(entry.value))
						.join(', ')}
					update:value={(value: string) => setConfigList(props.item, 'values', value)}
				/>
			</ConfigRow>
			<ConfigRow label="Keywords">
				<input
					value={config?.keywords?.join(', ') ?? ''}
					placeholder="layout, theme"
					update:value={(value: string) => setConfigList(props.item, 'keywords', value)}
				/>
			</ConfigRow>
		</div>
	)
}

function EnumChoiceContent(props: {
	entry: { icon?: string; label?: string; value: string }
	display: PicoPaletteChoiceDisplay
}) {
	return (
		<>
			<span if={props.display !== 'text'}>{renderIcon(props.entry.icon, props.entry.value)}</span>
			<span if={props.display !== 'icon'}>{props.entry.label ?? props.entry.value}</span>
		</>
	)
}

export function PicoPaletteCommandBox(props: PicoPaletteCommandBoxProps) {
	let input: HTMLInputElement | undefined
	const paletteState = palettes as { editing?: PicoPaletteInstance }
	const edition = {
		get checked() {
			const palette = props.palette
			return Boolean(palette && unwrap(paletteState.editing) === unwrap(palette))
		},
		button: {
			type: 'button' as const,
			onClick() {
				const palette = props.palette
				if (!palette) return
				paletteState.editing = edition.checked ? undefined : palette
			},
		},
	}
	return (
		<div
			class={[
				'sursaut-palette-command-box',
				props.expanded ? 'is-expanded' : undefined,
				props.floating ? 'is-floating' : undefined,
			]}
		>
			<div class="sursaut-palette-command-shell" title={props.title}>
				<button
					if={props.editable && props.palette}
					{...edition.button}
					class={edition.checked ? 'primary' : 'secondary'}
				>
					✎
				</button>
				<span else>{renderIcon(props.icon, '⌘')}</span>
				<div class="sursaut-palette-command-tokens">
					<for each={props.commandBox.categories.active}>
						{(category: string) => (
							<button
								type="button"
								class="secondary"
								onClick={() => props.commandBox.categories.toggle(category)}
								onKeydown={(event) =>
									handlePaletteCommandChipKeydown({
										commandBox: props.commandBox,
										event,
										token: category,
										type: 'category',
									})
								}
							>
								#{category}
							</button>
						)}
					</for>
					<for each={props.commandBox.keywords.tokens}>
						{(token: { keyword: string }) => (
							<button
								type="button"
								class="secondary"
								onClick={() => props.commandBox.keywords.removeToken(token.keyword)}
								onKeydown={(event) =>
									handlePaletteCommandChipKeydown({
										commandBox: props.commandBox,
										event,
										token: token.keyword,
									})
								}
							>
								{token.keyword}
							</button>
						)}
					</for>
					<input
						this={input}
						use={() => {
							if (input) props.onInputMount?.(input)
						}}
						value={props.commandBox.input.value}
						placeholder={props.commandBox.input.placeholder}
						onInput={(event) => setPaletteCommandBoxInput(props.commandBox, event)}
						onFocus={() => props.onInputFocus?.()}
						onBlur={(event) => props.onInputBlur?.(event)}
						onKeydown={(event) => {
							const handled = handlePaletteCommandBoxInputKeydown({
								commandBox: props.commandBox,
								event,
								onAfterExecute: () => {
									if (!props.selectOnPick) props.onEscapeOrExecute?.()
								},
							})
							if (handled && event.key === 'Enter' && props.selectOnPick) {
								const entry = props.commandBox.selection.item
								if (entry) props.onEntryPick?.(entry.id)
							}
							if (event.key === 'Escape') props.onEscapeOrExecute?.()
							return handled
						}}
					/>
				</div>
			</div>
			<div if={props.expanded} class="sursaut-palette-command-popover">
				<for each={props.commandBox.results.slice(0, 6)}>
					{(entry: { id: string; icon?: string; label: string; meta?: string; can?: boolean }) => (
						<button
							type="button"
							class={
								props.commandBox.selection.item?.id === entry.id ? 'primary' : 'contrast outline'
							}
							disabled={entry.can === false}
							onClick={() => {
								if (props.selectOnPick) {
									props.commandBox.select(entry.id)
									props.onEntryPick?.(entry.id)
									return
								}
								props.commandBox.execute(entry.id)
								props.onEscapeOrExecute?.()
							}}
						>
							<span>{renderIcon(entry.icon)}</span>
							<span>{entry.label}</span>
							<span if={entry.meta}>{entry.meta}</span>
						</button>
					)}
				</for>
			</div>
		</div>
	)
}

function scopeExtras<TSchema extends PaletteSchema>(
	scope: PaletteScope<TSchema>
): PicoPaletteScopeExtras {
	return scope as PaletteScope<TSchema> & PicoPaletteScopeExtras
}

function CommandBoxEditor(
	context: PaletteEditorContext<undefined, PicoPaletteAnyItem, PicoPaletteSchema>
) {
	const extras = scopeExtras(context.scope)
	const commandBox = extras.commandBox
	const ui = reactive({ focused: false })
	let root: HTMLDivElement | undefined
	if (!commandBox) return <div>Provide `scope.commandBox`.</div>
	return (
		<div this={root}>
			<PicoPaletteCommandBox
				commandBox={commandBox}
				editable={extras.commandBoxEditable}
				palette={context.scope.palette as PicoPaletteInstance | undefined}
				icon={extras.commandBoxIcon ?? '⌘'}
				expanded={extras.commandBoxExpanded ?? ui.focused}
				floating={extras.commandBoxFloating ?? true}
				selectOnPick={extras.commandBoxSelectOnPick}
				onEntryPick={extras.onCommandBoxEntryPick}
				onSuggestionPick={extras.onCommandBoxSuggestionPick}
				onInputMount={extras.onCommandBoxInputMount}
				onEscapeOrExecute={() => {
					ui.focused = false
					extras.onCommandBoxEscapeOrExecute?.()
				}}
				onInputFocus={() => {
					ui.focused = true
					extras.onCommandBoxFocus?.()
				}}
				onInputBlur={(event) => {
					const next = event.relatedTarget instanceof Node ? event.relatedTarget : undefined
					if (next && root?.contains(next)) return
					ui.focused = false
					extras.onCommandBoxBlur?.(event)
				}}
			/>
		</div>
	)
}

function ToggleEditor(
	context: PaletteEditorContext<PicoPaletteBooleanTool, PicoPaletteAnyItem, PicoPaletteSchema>
) {
	const meta = itemMeta(context.item as PicoPaletteAnyItem)
	return (
		<CheckButton
			variant={toneButtonVariant[meta.tone]}
			outline={!context.tool.value}
			checked={context.tool.value}
			onCheckedChange={(checked: boolean) => {
				context.tool.value = checked
			}}
		>
			{renderIcon(meta.icon, context.tool.value ? '🔔' : '🔕')}
			<span>{meta.label}</span>
		</CheckButton>
	)
}

function ButtonEditor(
	context: PaletteEditorContext<PicoPaletteRunTool, PicoPaletteAnyItem, PicoPaletteSchema>
) {
	const meta = itemMeta(context.item as PicoPaletteAnyItem)
	return (
		<Button
			variant={toneButtonVariant[meta.tone]}
			outline={meta.tone !== 'accent'}
			disabled={!context.tool.can}
			onClick={() => context.tool.run()}
		>
			{renderIcon(meta.icon)}
			<span>{meta.label}</span>
		</Button>
	)
}

function SplitButtonEditor(
	context: PaletteEditorContext<PicoPaletteRunTool, PicoPaletteAnyItem, PicoPaletteSchema>
) {
	const meta = itemMeta(context.item as PicoPaletteAnyItem)
	return (
		<SplitButton
			variant={toneButtonVariant[meta.tone]}
			value="run"
			items={[{ value: 'run', label: meta.label, onClick: () => context.tool.run() }]}
			onClick={() => context.tool.run()}
			onValueChange={() => context.tool.run()}
		>
			{renderIcon(meta.icon)}
			<span>{meta.label}</span>
		</SplitButton>
	)
}

function SelectEditor(
	context: PaletteEditorContext<PicoPaletteEnumTool, PicoPaletteAnyItem, PicoPaletteSchema>
) {
	const meta = itemMeta(context.item as PicoPaletteAnyItem)
	const values = filteredEnumValues(
		context.item as PicoPaletteAnyItem,
		context.tool as PicoPaletteEnumTool
	)
	const display = choiceDisplay(context.item as PicoPaletteAnyItem)
	return (
		<label>
			<span if={meta.icon}>{renderIcon(meta.icon)}</span>
			<Select
				value={context.tool.value}
				options={values.map((entry: PicoPaletteEnumTool['values'][number]) => ({
					value: String(entry.value),
					label: enumChoiceText(
						{ icon: entry.icon, label: entry.label, value: String(entry.value) },
						display
					),
				}))}
				onInput={(value: string) => {
					context.tool.value = value
				}}
				fullWidth
			/>
		</label>
	)
}

function SegmentedEditor(
	context: PaletteEditorContext<PicoPaletteEnumTool, PicoPaletteAnyItem, PicoPaletteSchema>
) {
	const values = filteredEnumValues(
		context.item as PicoPaletteAnyItem,
		context.tool as PicoPaletteEnumTool
	)
	const display = choiceDisplay(context.item as PicoPaletteAnyItem)
	return (
		<ButtonGroup>
			<for each={values}>
				{(entry: PicoPaletteEnumTool['values'][number]) => (
					<RadioButton
						value={entry.value}
						group={context.tool.value}
						onClick={() => {
							context.tool.value = entry.value
						}}
					>
						<EnumChoiceContent
							entry={{ icon: entry.icon, label: entry.label, value: String(entry.value) }}
							display={display}
						/>
					</RadioButton>
				)}
			</for>
		</ButtonGroup>
	)
}

function SplitRadioEditor(
	context: PaletteEditorContext<PicoPaletteEnumTool, PicoPaletteAnyItem, PicoPaletteSchema>
) {
	const meta = itemMeta(context.item as PicoPaletteAnyItem)
	const values = filteredEnumValues(
		context.item as PicoPaletteAnyItem,
		context.tool as PicoPaletteEnumTool
	).map((entry: PicoPaletteEnumTool['values'][number]) => ({
		value: String(entry.value),
		label: entry.label ?? String(entry.value),
	}))
	return (
		<SplitRadioButton
			variant={toneButtonVariant[meta.tone]}
			value={String(context.tool.value)}
			group={String(context.tool.value)}
			items={values}
			onValueChange={(value: string) => {
				context.tool.value = value
			}}
		/>
	)
}

function SliderEditor(
	context: PaletteEditorContext<PicoPaletteNumberTool, PicoPaletteAnyItem, PicoPaletteSchema>
) {
	const meta = itemMeta(context.item as PicoPaletteAnyItem)
	return (
		<label
			title={titleForItem(
				context.item as PicoPaletteAnyItem,
				`${meta.label} ${context.tool.value}`
			)}
		>
			<span>{renderIcon(meta.icon, 'A')}</span>
			<input
				type="range"
				min={String(context.tool.min ?? 0)}
				max={String(context.tool.max ?? 100)}
				step={String(context.tool.step ?? 1)}
				value={String(context.tool.value)}
				onInput={(event: Event) => {
					if (!(event.target instanceof HTMLInputElement)) return
					context.tool.value = Number(event.target.value)
				}}
			/>
		</label>
	)
}

function StepperEditor(
	context: PaletteEditorContext<PicoPaletteNumberTool, PicoPaletteAnyItem, PicoPaletteSchema>
) {
	const step = context.tool.step ?? 1
	const min = context.tool.min ?? Number.NEGATIVE_INFINITY
	const max = context.tool.max ?? Number.POSITIVE_INFINITY
	return (
		<ButtonGroup>
			<Button
				outline
				disabled={context.tool.value - step < min}
				onClick={() => {
					context.tool.value = Math.max(min, context.tool.value - step)
				}}
			>
				−
			</Button>
			<Button outline disabled>
				{String(context.tool.value)}
			</Button>
			<Button
				outline
				disabled={context.tool.value + step > max}
				onClick={() => {
					context.tool.value = Math.min(max, context.tool.value + step)
				}}
			>
				+
			</Button>
		</ButtonGroup>
	)
}

function StarsEditor(
	context: PaletteEditorContext<PicoPaletteNumberTool, PicoPaletteAnyItem, PicoPaletteSchema>
) {
	const meta = itemMeta(context.item as PicoPaletteAnyItem)
	return (
		<div>
			<span>{renderIcon(meta.icon, '★')}</span>
			<Stars
				value={context.tool.value}
				maximum={context.tool.max ?? 5}
				before="star-filled"
				after="star-outline"
				onChange={(value) => {
					if (typeof value === 'number') context.tool.value = value
				}}
			/>
		</div>
	)
}

export function createPicoPaletteEditors(): PaletteEditorRegistry<PicoPaletteSchema> {
	return {
		boolean: {
			toggle: {
				editor: ToggleEditor,
				configure: (context) => (
					<BaseConfigurator item={context.item as PicoPaletteAnyItem} tool={context.tool} />
				),
				flags: { footprint: 'square' },
			},
		},
		enum: {
			flip: {
				editor: SelectEditor,
				configure: (context) => (
					<EnumConfigurator
						item={context.item as PicoPaletteAnyItem}
						tool={context.tool as PicoPaletteEnumTool}
					/>
				),
				flags: { footprint: 'square' },
			},
			radio: {
				editor: SegmentedEditor,
				configure: (context) => (
					<EnumConfigurator
						item={context.item as PicoPaletteAnyItem}
						tool={context.tool as PicoPaletteEnumTool}
					/>
				),
				flags: { footprint: 'free' },
			},
			select: {
				editor: SelectEditor,
				configure: (context) => (
					<EnumConfigurator
						item={context.item as PicoPaletteAnyItem}
						tool={context.tool as PicoPaletteEnumTool}
					/>
				),
				flags: { footprint: 'horizontal' },
			},
			segmented: {
				editor: SegmentedEditor,
				configure: (context) => (
					<EnumConfigurator
						item={context.item as PicoPaletteAnyItem}
						tool={context.tool as PicoPaletteEnumTool}
					/>
				),
				flags: { footprint: 'free' },
			},
			splitRadio: {
				editor: SplitRadioEditor,
				configure: (context) => (
					<EnumConfigurator
						item={context.item as PicoPaletteAnyItem}
						tool={context.tool as PicoPaletteEnumTool}
					/>
				),
				flags: { footprint: 'free' },
			},
		},
		number: {
			slider: {
				editor: SliderEditor,
				configure: (context) => (
					<BaseConfigurator item={context.item as PicoPaletteAnyItem} tool={context.tool} />
				),
				flags: { footprint: 'horizontal' },
			},
			stepper: {
				editor: StepperEditor,
				configure: (context) => (
					<BaseConfigurator item={context.item as PicoPaletteAnyItem} tool={context.tool} />
				),
				flags: { footprint: 'free' },
			},
			stars: {
				editor: StarsEditor,
				configure: (context) => (
					<BaseConfigurator item={context.item as PicoPaletteAnyItem} tool={context.tool} />
				),
				flags: { footprint: 'free' },
			},
		},
		run: {
			button: {
				editor: ButtonEditor,
				configure: (context) => (
					<BaseConfigurator item={context.item as PicoPaletteAnyItem} tool={context.tool} />
				),
				flags: { footprint: 'horizontal' },
			},
			splitButton: {
				editor: SplitButtonEditor,
				configure: (context) => (
					<BaseConfigurator item={context.item as PicoPaletteAnyItem} tool={context.tool} />
				),
				flags: { footprint: 'free' },
			},
		},
		item: {
			commandBox: {
				editor: CommandBoxEditor,
				configure: (context) => (
					<BaseConfigurator item={context.item as PicoPaletteAnyItem} tool={undefined} />
				),
				flags: { footprint: 'horizontal' },
			},
		},
	}
}

export function createPicoPalettePreset(): Pick<
	PaletteConfig<PicoPaletteSchema>,
	'editors' | 'editorDefaults'
> {
	return {
		editors: createPicoPaletteEditors(),
		editorDefaults: picoPaletteEditorDefaults,
	}
}

export const picoPaletteEditors = createPicoPaletteEditors()
export const picoPalettePreset = createPicoPalettePreset()
export const picoPaletteEditorSpecs = {
	button: picoPaletteEditors.run?.button,
	commandBox: picoPaletteEditors.item?.commandBox,
	flip: picoPaletteEditors.enum?.flip,
	radio: picoPaletteEditors.enum?.radio,
	select: picoPaletteEditors.enum?.select,
	segmented: picoPaletteEditors.enum?.segmented,
	slider: picoPaletteEditors.number?.slider,
	splitButton: picoPaletteEditors.run?.splitButton,
	splitRadio: picoPaletteEditors.enum?.splitRadio,
	stars: picoPaletteEditors.number?.stars,
	stepper: picoPaletteEditors.number?.stepper,
	toggle: picoPaletteEditors.boolean?.toggle,
} satisfies Record<PicoPaletteEditorVariant, unknown>

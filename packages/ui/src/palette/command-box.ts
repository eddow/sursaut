import { lift, reactive } from 'mutts'
import {
	isEditableTool,
	isRunTool,
	paletteEnumValueKeywords,
	paletteTool,
	paletteToolFamily,
	valueActions,
} from './palette'
import type {
	Palette,
	PaletteSchema,
	PaletteTool,
	PaletteToolEnumValue,
	PaletteToolRun,
} from './types'

function normalizeCommandBoxToken(value: string): string {
	return value.trim().toLowerCase()
}

function uniqueNormalized(values: readonly string[]): string[] {
	const seen = new Set<string>()
	const result: string[] = []
	for (const value of values) {
		const normalized = normalizeCommandBoxToken(value)
		if (!normalized || seen.has(normalized)) continue
		seen.add(normalized)
		result.push(value)
	}
	return result
}

function tokenizeQuery(value: string): string[] {
	return value
		.split(/\s+/)
		.map((token) => token.trim())
		.filter((token) => token.length > 0)
}

function trimLastToken(value: string): string {
	const tokens = tokenizeQuery(value)
	tokens.pop()
	return tokens.join(' ')
}

function matchesAllTerms(haystack: string, terms: readonly string[]): boolean {
	return terms.every((term) => haystack.includes(term))
}

export type PaletteCommandBoxQuery = {
	readonly free?: string
	readonly keywords?: readonly string[]
	readonly categories?: readonly string[]
}

export type PaletteCommandBoxEntry = {
	readonly id: string
	readonly label: string
	readonly meta?: string
	readonly icon?: string
	readonly keywords?: readonly string[]
	readonly categories?: readonly string[]
	readonly can?: boolean
	run(): unknown
}

export type PaletteAddItemSource<TSchema extends PaletteSchema = PaletteSchema> = {
	readonly id: string
	readonly label: string
	readonly meta: string
	readonly icon?: string
	readonly keywords?: readonly string[]
	readonly categories?: readonly string[]
	readonly kind: 'tool' | 'item'
	readonly toolId?: keyof TSchema['tools'] & string
	readonly editor?: keyof TSchema['editorConfigs'] & string
}

export type PaletteAddItemCommandEntry<TSchema extends PaletteSchema = PaletteSchema> =
	PaletteCommandBoxEntry & {
		readonly source: PaletteAddItemSource<TSchema>
	}

export type PaletteDerivedVariant<TSchema extends PaletteSchema = PaletteSchema> = {
	readonly id: string
	readonly label: string
	readonly meta: string
	readonly icon?: string
	readonly keywords?: readonly string[]
	readonly categories?: readonly string[]
	readonly kind: 'tool' | 'item' | 'set' | 'action'
	readonly toolId?: keyof TSchema['tools'] & string
	readonly editor?: keyof TSchema['editorConfigs'] & string
	readonly action?: string
	readonly spec?: string
	readonly valueType?: 'boolean' | 'number' | 'enum'
	readonly values?: readonly PaletteToolEnumValue[]
}

function splitCommandWords(value: string): string[] {
	return value
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[^a-zA-Z0-9]+/g, ' ')
		.split(/\s+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0)
}

function humanizeCommandText(value: string): string {
	const words = splitCommandWords(value)
	if (words.length === 0) return value
	return words.map((word) => word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
}

function collectCommandKeywords(...sources: (string | readonly string[] | undefined)[]): string[] {
	const values: string[] = []
	for (const source of sources) {
		if (!source) continue
		if (typeof source === 'string') {
			values.push(source)
			values.push(...splitCommandWords(source).map((word) => word.toLowerCase()))
			continue
		}
		for (const value of source) {
			values.push(value)
			values.push(...splitCommandWords(value).map((word) => word.toLowerCase()))
		}
	}
	return uniqueNormalized(values)
}

function commandEntryMeta<TSchema extends PaletteSchema>(
	palette: Palette<TSchema>,
	spec: string,
	fallback: string
): string {
	const keys = palette.keys.findByTool(spec)
	return keys.length > 0 ? keys.join(' / ') : fallback
}

function commandEntryCategories<TSchema extends PaletteSchema>(
	tool: PaletteTool<TSchema['tools']>,
	extra?: readonly string[]
): string[] {
	const categories = uniqueNormalized([...(tool.categories ?? []), ...(extra ?? [])])
	return categories.length > 0 ? categories : [paletteToolFamily(tool)]
}

function commandRunner<TSchema extends PaletteSchema>(
	palette: Palette<TSchema>,
	spec: string
): PaletteToolRun {
	const runner = paletteTool(palette, spec)
	if (!('run' in runner)) throw new Error(`Palette command "${spec}" is not runnable`)
	return runner
}

function generatedCommandEntry(options: {
	id: string
	label: string
	meta: string
	icon?: string
	keywords?: readonly string[]
	categories?: readonly string[]
	can?: () => boolean
	run(): unknown
}): PaletteCommandBoxEntry {
	return {
		id: options.id,
		label: options.label,
		meta: options.meta,
		icon: options.icon,
		keywords: options.keywords,
		categories: options.categories,
		get can() {
			return options.can ? options.can() : true
		},
		run() {
			return options.run()
		},
	}
}

function generatedAddItemEntry<TSchema extends PaletteSchema>(options: {
	source: PaletteAddItemSource<TSchema>
	can?: () => boolean
}): PaletteAddItemCommandEntry<TSchema> {
	return {
		id: options.source.id,
		label: options.source.label,
		meta: options.source.meta,
		icon: options.source.icon,
		keywords: options.source.keywords,
		categories: options.source.categories,
		source: options.source,
		get can() {
			return options.can ? options.can() : true
		},
		run() {
			return options.source
		},
	}
}

export function paletteAddItemEntries<TSchema extends PaletteSchema>(options: {
	palette: Palette<TSchema>
	excludeTools?: readonly string[]
}): readonly PaletteAddItemCommandEntry<TSchema>[] {
	const excluded = new Set(options.excludeTools ?? [])
	const entries: PaletteAddItemCommandEntry<TSchema>[] = []
	for (const [toolId, tool] of Object.entries(options.palette.tools)) {
		if (excluded.has(toolId)) continue
		const toolLabel = tool.label ?? humanizeCommandText(toolId)
		entries.push(
			generatedAddItemEntry({
				source: {
					id: `tool:${toolId}`,
					kind: 'tool',
					toolId: toolId as keyof TSchema['tools'] & string,
					label: toolLabel,
					meta: isRunTool(tool) ? 'Add runnable item' : `Add ${tool.type} tool`,
					icon: tool.icon,
					keywords: collectCommandKeywords(toolId, toolLabel, tool.keywords, 'add', 'tool'),
					categories: commandEntryCategories(tool, ['tools']),
				},
			})
		)
	}
	for (const editor of Object.keys(options.palette.editors?.item ?? {})) {
		entries.push(
			generatedAddItemEntry({
				source: {
					id: `item:${editor}`,
					kind: 'item',
					editor: editor as keyof TSchema['editorConfigs'] & string,
					label: humanizeCommandText(editor),
					meta: 'Add editor-only item',
					keywords: collectCommandKeywords(editor, 'add', 'editor', 'toolbox'),
					categories: ['editors', 'items'],
				},
			})
		)
	}
	return entries.toSorted((left, right) => left.label.localeCompare(right.label))
}

export function paletteDerivedVariants<TSchema extends PaletteSchema>(options: {
	palette: Palette<TSchema>
	entry: PaletteAddItemCommandEntry<TSchema> | PaletteAddItemSource<TSchema>
}): readonly PaletteDerivedVariant<TSchema>[] {
	const source = 'source' in options.entry ? options.entry.source : options.entry
	if (source.kind === 'item') {
		return [
			{
				id: `${source.id}:item`,
				kind: 'item',
				editor: source.editor,
				label: source.label,
				meta: 'Editor-only item',
				icon: source.icon,
				keywords: source.keywords,
				categories: source.categories,
			},
		]
	}
	if (!source.toolId) return []
	const tool = options.palette.tools[source.toolId]
	if (!tool) return []
	const toolLabel = tool.label ?? humanizeCommandText(source.toolId)
	const variants: PaletteDerivedVariant<TSchema>[] = [
		{
			id: `${source.id}:tool`,
			kind: 'tool',
			toolId: source.toolId,
			label: `Add ${toolLabel}`,
			meta: isRunTool(tool) ? 'Toolbar action item' : 'Editable tool item',
			icon: tool.icon,
			keywords: collectCommandKeywords(source.toolId, toolLabel, tool.keywords),
			categories: commandEntryCategories(tool, ['tool']),
		},
	]
	if (!isEditableTool(tool)) return variants
	const editableTool = tool
	if (editableTool.type === 'boolean') {
		variants.push({
			id: `${source.id}:set`,
			kind: 'set',
			toolId: source.toolId,
			label: `Set ${toolLabel}`,
			meta: 'Choose on/off value',
			icon: editableTool.icon,
			keywords: collectCommandKeywords(
				source.toolId,
				toolLabel,
				editableTool.keywords,
				'set',
				'toggle'
			),
			categories: commandEntryCategories(editableTool, ['derived']),
			valueType: 'boolean',
		})
		return variants
	}
	if (editableTool.type === 'enum') {
		variants.push({
			id: `${source.id}:set`,
			kind: 'set',
			toolId: source.toolId,
			label: `Set ${toolLabel}`,
			meta: 'Choose enum value',
			icon: editableTool.icon,
			keywords: collectCommandKeywords(
				source.toolId,
				toolLabel,
				editableTool.keywords,
				'set',
				'value'
			),
			categories: commandEntryCategories(editableTool, ['derived']),
			valueType: 'enum',
			values: editableTool.values,
		})
		return variants
	}
	if (editableTool.type === 'number') {
		variants.push({
			id: `${source.id}:set`,
			kind: 'set',
			toolId: source.toolId,
			label: `Set ${toolLabel}`,
			meta: 'Enter numeric value',
			icon: editableTool.icon,
			keywords: collectCommandKeywords(
				source.toolId,
				toolLabel,
				editableTool.keywords,
				'set',
				'value'
			),
			categories: commandEntryCategories(editableTool, ['derived']),
			valueType: 'number',
		})
		for (const action of Object.keys(valueActions.number)) {
			variants.push({
				id: `${source.id}:action:${action}`,
				kind: 'action',
				toolId: source.toolId,
				action,
				spec: `${source.toolId}:${action}`,
				label:
					action === 'inc'
						? `Increase ${toolLabel}`
						: action === 'dec'
							? `Decrease ${toolLabel}`
							: `${humanizeCommandText(action)} ${toolLabel}`,
				meta: 'Derived value action',
				icon: editableTool.icon,
				keywords: collectCommandKeywords(source.toolId, toolLabel, editableTool.keywords, action),
				categories: commandEntryCategories(editableTool, ['derived']),
			})
		}
	}
	return variants
}

export function paletteEnumSubsetValues<TValue extends string>(options: {
	values: readonly PaletteToolEnumValue<TValue>[]
	keywords?: readonly string[]
}): readonly PaletteToolEnumValue<TValue>[] {
	const keywords = options.keywords?.map((entry) => normalizeCommandBoxToken(entry)).filter(Boolean)
	if (!keywords?.length) return options.values
	return options.values.filter((value) => {
		const actual = new Set(
			paletteEnumValueKeywords(value).map((entry) => normalizeCommandBoxToken(entry))
		)
		for (const keyword of keywords) {
			if (actual.has(keyword)) return true
		}
		return false
	})
}

export function paletteCommandEntries<TSchema extends PaletteSchema>(options: {
	palette: Palette<TSchema>
	excludeTools?: readonly string[]
}): readonly PaletteCommandBoxEntry[] {
	const excluded = new Set(options.excludeTools ?? [])
	const entries: PaletteCommandBoxEntry[] = []
	for (const [toolId, tool] of Object.entries(options.palette.tools)) {
		if (excluded.has(toolId)) continue
		const toolLabel = tool.label ?? humanizeCommandText(toolId)
		if (isRunTool(tool)) {
			const spec = toolId
			entries.push(
				generatedCommandEntry({
					id: spec,
					label: toolLabel,
					meta: commandEntryMeta(options.palette, spec, 'Run command'),
					icon: tool.icon,
					keywords: collectCommandKeywords(toolId, toolLabel, tool.keywords),
					categories: commandEntryCategories(tool),
					can: () => tool.can,
					run() {
						return commandRunner(options.palette, spec).run()
					},
				})
			)
			continue
		}
		if (tool.type === 'boolean') {
			for (const [value, verb, keywords] of [
				[true, 'Enable', ['enable', 'on', 'true']],
				[false, 'Disable', ['disable', 'off', 'false']],
			] as const) {
				const spec = `${toolId}|${value}`
				entries.push(
					generatedCommandEntry({
						id: spec,
						label: `${verb} ${toolLabel}`,
						meta: commandEntryMeta(options.palette, spec, `Set ${toolLabel}`),
						icon: tool.icon,
						keywords: collectCommandKeywords(toolId, toolLabel, tool.keywords, keywords),
						categories: commandEntryCategories(tool),
						can: () => tool.value !== value,
						run() {
							return commandRunner(options.palette, spec).run()
						},
					})
				)
			}
			continue
		}
		if (tool.type === 'enum') {
			for (const value of tool.values) {
				const valueLabel = value.label ?? humanizeCommandText(value.value)
				const spec = `${toolId}|${value.value}`
				entries.push(
					generatedCommandEntry({
						id: spec,
						label: `Set ${toolLabel} to ${valueLabel}`,
						meta: commandEntryMeta(options.palette, spec, toolLabel),
						icon: value.icon ?? tool.icon,
						keywords: collectCommandKeywords(
							toolId,
							toolLabel,
							tool.keywords,
							value.value,
							valueLabel,
							value.keywords
						),
						categories: commandEntryCategories(tool, value.categories),
						can: () => value.can !== false && tool.value !== value.value,
						run() {
							return commandRunner(options.palette, spec).run()
						},
					})
				)
			}
			continue
		}
		// TODO: use the generic `paletteConfig.runner` that should provide with a title instead of these hard-coded for inc/dec - as these tools are supposed to be customizable
		if (tool.type === 'number') {
			for (const [action, run] of Object.entries(valueActions.number)) {
				const spec = `${toolId}:${action}`
				const actionLabel =
					action === 'inc'
						? `Increase ${toolLabel}`
						: action === 'dec'
							? `Decrease ${toolLabel}`
							: `${humanizeCommandText(action)} ${toolLabel}`
				const actionKeywords =
					action === 'inc'
						? ['increase', 'increment', 'up', 'more']
						: action === 'dec'
							? ['decrease', 'decrement', 'down', 'less']
							: [action]
				entries.push(
					generatedCommandEntry({
						id: spec,
						label: actionLabel,
						meta: commandEntryMeta(options.palette, spec, `Adjust ${toolLabel}`),
						icon: tool.icon,
						keywords: collectCommandKeywords(toolId, toolLabel, tool.keywords, actionKeywords),
						categories: commandEntryCategories(tool),
						can: () => run(tool).can,
						run() {
							return commandRunner(options.palette, spec).run()
						},
					})
				)
			}
		}
	}
	return entries
}

type PaletteCommandKeywordToken = {
	readonly keyword: string
}

export interface PaletteCommandBoxKeywordSuggestion {
	readonly keyword: string
	readonly isActive: boolean
}

export interface PaletteCommandBoxModel {
	readonly input: {
		value: string
		readonly placeholder?: string
		clear(): void
	}
	readonly query: {
		readonly free: string
		readonly keywords: readonly string[]
		readonly categories: readonly string[]
	}
	readonly results: readonly PaletteCommandBoxEntry[]
	readonly suggestions: readonly PaletteCommandBoxKeywordSuggestion[]
	readonly categories: {
		readonly available: readonly string[]
		readonly active: readonly string[]
		toggle(category: string): void
		removeLast(): string | undefined
		clear(): void
	}
	readonly keywords: {
		readonly available: readonly string[]
		readonly tokens: readonly PaletteCommandKeywordToken[]
		readonly active: readonly string[]
		addToken(keyword: string): void
		removeLast(): PaletteCommandKeywordToken | undefined
		removeToken(keyword: string): boolean
		clear(): void
	}
	readonly selection: {
		readonly index: number
		readonly item: PaletteCommandBoxEntry | undefined
		select(entryId?: string): PaletteCommandBoxEntry | undefined
		set(index: number): void
		next(): void
		previous(): void
		clear(): void
	}
	select(entryId?: string): PaletteCommandBoxEntry | undefined
	execute(entryId?: string): unknown
	search(query: PaletteCommandBoxQuery): void
	handleKeyDown(event: KeyboardEvent): boolean
}

export function setPaletteCommandBoxInput(commandBox: PaletteCommandBoxModel, event: Event) {
	if (event.currentTarget instanceof HTMLInputElement) {
		commandBox.input.value = event.currentTarget.value
	}
}

export function handlePaletteCommandChipKeydown(options: {
	commandBox: PaletteCommandBoxModel
	event: KeyboardEvent
	token: string
	type?: 'category' | 'keyword'
}) {
	const { commandBox, event, token, type = 'keyword' } = options
	if (!['Backspace', 'Delete', 'Enter', ' '].includes(event.key)) return false
	event.preventDefault()
	if (type === 'category') commandBox.categories.toggle(token)
	else commandBox.keywords.removeToken(token)
	return true
}

export function handlePaletteCommandBoxInputKeydown(options: {
	commandBox: PaletteCommandBoxModel
	event: KeyboardEvent
	onAfterExecute?: () => void
}) {
	const { commandBox, event, onAfterExecute } = options
	const handled = commandBox.handleKeyDown(event)
	if (handled && event.key === 'Enter') onAfterExecute?.()
	return handled
}

export function paletteCommandBoxModel(options: {
	entries: readonly PaletteCommandBoxEntry[]
	placeholder?: string
	enterAction?: 'execute' | 'select'
}): PaletteCommandBoxModel {
	const inputState = reactive({ value: '' })
	const categoryState = reactive({ manual: [] as string[] })
	const keywordState = reactive({ tokens: [] as PaletteCommandKeywordToken[] })
	const selectionState = reactive({ index: -1 })
	const manualQueryState = reactive({
		active: false,
		free: '',
		keywords: [] as string[],
		categories: [] as string[],
	})
	const inputPlaceholder = options.placeholder
	const enterAction = options.enterAction ?? 'execute'

	const availableCategories = lift`paletteCommandBoxModel.availableCategories`(() => {
		const values = options.entries.flatMap((entry) => entry.categories ?? [])
		return uniqueNormalized(values).sort((left, right) => left.localeCompare(right))
	})

	const availableKeywords = lift`paletteCommandBoxModel.availableKeywords`(() => {
		const values = options.entries.flatMap((entry) => entry.keywords ?? [])
		return uniqueNormalized(values).sort((left, right) => left.localeCompare(right))
	})

	const keywordAliases = lift`paletteCommandBoxModel.keywordAliases`(() => {
		const aliases: Record<string, string> = {}
		for (const keyword of availableKeywords) aliases[normalizeCommandBoxToken(keyword)] = keyword
		return aliases
	})

	const categoryAliases = lift`paletteCommandBoxModel.categoryAliases`(() => {
		const aliases: Record<string, string> = {}
		for (const category of availableCategories)
			aliases[normalizeCommandBoxToken(category)] = category
		return aliases
	})

	const parsedInput = lift`paletteCommandBoxModel.parsedInput`(() => {
		const categories: string[] = []
		const keywords: string[] = []
		const textTokens: string[] = []
		for (const token of tokenizeQuery(inputState.value)) {
			const categoryToken = token.startsWith('#') ? token.slice(1) : token
			const category = categoryAliases[normalizeCommandBoxToken(categoryToken)]
			if (category && token.startsWith('#')) {
				if (!categories.includes(category)) categories.push(category)
				continue
			}
			const keyword = keywordAliases[normalizeCommandBoxToken(token)]
			if (keyword) {
				if (!keywords.includes(keyword)) keywords.push(keyword)
				continue
			}
			textTokens.push(token)
		}
		return {
			categories,
			keywords,
			text: textTokens.join(' '),
		}
	})

	const activeCategories = lift`paletteCommandBoxModel.activeCategories`(() => {
		return uniqueNormalized([...categoryState.manual, ...parsedInput.categories])
	})

	const activeKeywords = lift`paletteCommandBoxModel.activeKeywords`(() => {
		const manual = keywordState.tokens.map((token) => token.keyword)
		return uniqueNormalized([...manual, ...parsedInput.keywords])
	})

	function useLocalQuery() {
		manualQueryState.active = false
	}

	const query = {
		get free() {
			if (manualQueryState.active) return manualQueryState.free
			return parsedInput.text
		},
		get keywords() {
			if (manualQueryState.active) return manualQueryState.keywords
			return activeKeywords
		},
		get categories() {
			if (manualQueryState.active) return manualQueryState.categories
			return activeCategories
		},
	}

	function entrySearchData(entry: PaletteCommandBoxEntry) {
		const keywords = uniqueNormalized(entry.keywords ?? [])
		const categories = uniqueNormalized(entry.categories ?? [])
		const searchable = normalizeCommandBoxToken(
			[entry.id, entry.label, entry.meta ?? '', ...keywords, ...categories].join(' ')
		)
		return {
			keywords: keywords.map((keyword) => normalizeCommandBoxToken(keyword)),
			categories: categories.map((category) => normalizeCommandBoxToken(category)),
			searchable,
			label: normalizeCommandBoxToken(entry.label),
		}
	}

	function entryScore(entry: PaletteCommandBoxEntry, freeTerms: readonly string[]): number {
		const data = entrySearchData(entry)
		let score = 0
		for (const term of freeTerms) {
			if (data.label === term) score += 8
			else if (data.label.startsWith(term)) score += 5
			else if (data.searchable.includes(term)) score += 2
		}
		return score
	}

	const results = lift`paletteCommandBoxModel.results`(() => {
		const freeTerms = tokenizeQuery(query.free).map((term) => normalizeCommandBoxToken(term))
		const categoryTerms = query.categories.map((term) => normalizeCommandBoxToken(term))
		const keywordTerms = query.keywords.map((term) => normalizeCommandBoxToken(term))
		return options.entries
			.filter((entry) => {
				if (entry.can === false) return false
				const data = entrySearchData(entry)
				if (!matchesAllTerms(data.searchable, freeTerms)) return false
				if (
					!keywordTerms.every(
						(term) => data.keywords.includes(term) || data.searchable.includes(term)
					)
				) {
					return false
				}
				if (!categoryTerms.every((term) => data.categories.includes(term))) return false
				return true
			})
			.toSorted((left, right) => {
				const score = entryScore(right, freeTerms) - entryScore(left, freeTerms)
				if (score !== 0) return score
				return left.label.localeCompare(right.label)
			})
	})

	const suggestions = lift`paletteCommandBoxModel.suggestions`(() => {
		const currentWord = tokenizeQuery(inputState.value).at(-1)
		const prefix = currentWord ? normalizeCommandBoxToken(currentWord.replace(/^#/, '')) : ''
		if (!prefix || currentWord?.startsWith('#')) return [] as PaletteCommandBoxKeywordSuggestion[]
		const active = new Set(activeKeywords.map((keyword) => normalizeCommandBoxToken(keyword)))
		const remainingKeywords = new Set<string>()
		for (const entry of results) {
			for (const keyword of entry.keywords ?? []) {
				const normalized = normalizeCommandBoxToken(keyword)
				if (!active.has(normalized)) remainingKeywords.add(keyword)
			}
		}
		return Array.from(remainingKeywords)
			.filter((keyword) => normalizeCommandBoxToken(keyword).startsWith(prefix))
			.sort((left, right) => left.localeCompare(right))
			.map((keyword) => ({ keyword, isActive: false }))
	})

	function clearFilters() {
		useLocalQuery()
		inputState.value = ''
		categoryState.manual.splice(0, categoryState.manual.length)
		keywordState.tokens.splice(0, keywordState.tokens.length)
	}

	function removeLastCategory(): string | undefined {
		const active = activeCategories
		const category = active[active.length - 1]
		if (!category) return undefined
		const normalized = normalizeCommandBoxToken(category)
		for (let index = categoryState.manual.length - 1; index >= 0; index -= 1) {
			if (normalizeCommandBoxToken(categoryState.manual[index]) !== normalized) continue
			const [removed] = categoryState.manual.splice(index, 1)
			return removed
		}
		return undefined
	}

	const input = {
		get value() {
			return inputState.value
		},
		set value(value: string) {
			useLocalQuery()
			inputState.value = value
			selection.clear()
		},
		get placeholder() {
			return inputPlaceholder
		},
		clear() {
			input.value = ''
		},
	}

	const categories = {
		get available() {
			return availableCategories
		},
		get active() {
			return activeCategories
		},
		toggle(category: string) {
			useLocalQuery()
			const normalized = normalizeCommandBoxToken(category)
			const index = categoryState.manual.findIndex(
				(value) => normalizeCommandBoxToken(value) === normalized
			)
			if (index >= 0) categoryState.manual.splice(index, 1)
			else {
				const resolved = categoryAliases[normalized] ?? category
				categoryState.manual.push(resolved)
			}
			selection.clear()
		},
		removeLast() {
			useLocalQuery()
			const removed = removeLastCategory()
			if (removed) selection.clear()
			return removed
		},
		clear() {
			if (categoryState.manual.length === 0) return
			useLocalQuery()
			categoryState.manual.splice(0, categoryState.manual.length)
			selection.clear()
		},
	}

	const keywords = {
		get available() {
			return availableKeywords
		},
		get tokens() {
			return keywordState.tokens
		},
		get active() {
			return activeKeywords
		},
		addToken(keyword: string) {
			useLocalQuery()
			const resolved = keywordAliases[normalizeCommandBoxToken(keyword)] ?? keyword
			if (
				keywordState.tokens.some(
					(token) => normalizeCommandBoxToken(token.keyword) === normalizeCommandBoxToken(resolved)
				)
			)
				return
			keywordState.tokens.push({ keyword: resolved })
			selection.clear()
		},
		removeLast() {
			useLocalQuery()
			const removed = keywordState.tokens.pop()
			if (removed) selection.clear()
			return removed
		},
		removeToken(keyword: string) {
			useLocalQuery()
			const normalized = normalizeCommandBoxToken(keyword)
			const index = keywordState.tokens.findIndex(
				(token) => normalizeCommandBoxToken(token.keyword) === normalized
			)
			if (index < 0) return false
			keywordState.tokens.splice(index, 1)
			selection.clear()
			return true
		},
		clear() {
			if (keywordState.tokens.length === 0) return
			useLocalQuery()
			keywordState.tokens.splice(0, keywordState.tokens.length)
			selection.clear()
		},
	}

	const selection = {
		get index() {
			return selectionState.index
		},
		get item() {
			return selectionState.index >= 0 && selectionState.index < model.results.length
				? model.results[selectionState.index]
				: undefined
		},
		set(index: number) {
			selectionState.index = Math.max(-1, Math.min(index, model.results.length - 1))
		},
		select(entryId?: string) {
			const index = entryId
				? model.results.findIndex((candidate) => candidate.id === entryId)
				: selectionState.index >= 0
					? selectionState.index
					: model.results.length > 0
						? 0
						: -1
			selection.set(index)
			return index >= 0 ? model.results[index] : undefined
		},
		next() {
			if (model.results.length === 0) {
				selection.clear()
				return
			}
			selection.set(selectionState.index >= model.results.length - 1 ? 0 : selectionState.index + 1)
		},
		previous() {
			if (model.results.length === 0) {
				selection.clear()
				return
			}
			selection.set(selectionState.index <= 0 ? model.results.length - 1 : selectionState.index - 1)
		},
		clear() {
			selectionState.index = -1
		},
	}

	const model: PaletteCommandBoxModel = {
		input,
		query,
		results,
		suggestions,
		categories,
		keywords,
		selection,
		select(entryId?: string) {
			return selection.select(entryId)
		},
		execute(entryId?: string) {
			const entry = entryId
				? options.entries.find((candidate) => candidate.id === entryId)
				: selection.item
			if (!entry || entry.can === false) return undefined
			const result = entry.run()
			clearFilters()
			selection.clear()
			return result
		},
		search(nextQuery: PaletteCommandBoxQuery) {
			manualQueryState.active = true
			manualQueryState.free = nextQuery.free ?? ''
			manualQueryState.keywords.splice(
				0,
				manualQueryState.keywords.length,
				...uniqueNormalized(nextQuery.keywords ?? []).map(
					(keyword) => keywordAliases[normalizeCommandBoxToken(keyword)] ?? keyword
				)
			)
			manualQueryState.categories.splice(
				0,
				manualQueryState.categories.length,
				...uniqueNormalized(nextQuery.categories ?? []).map(
					(category) => categoryAliases[normalizeCommandBoxToken(category)] ?? category
				)
			)
			selection.clear()
		},
		handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'ArrowDown') {
				event.preventDefault()
				selection.next()
				return true
			}
			if (event.key === 'ArrowUp') {
				event.preventDefault()
				selection.previous()
				return true
			}
			if (event.key === 'Enter') {
				const entry = selection.item ?? model.results[0]
				if (!entry || entry.can === false) return false
				event.preventDefault()
				if (enterAction === 'select') model.select(entry.id)
				else model.execute(entry.id)
				return true
			}
			if (event.key === 'Backspace' && inputState.value.length === 0) {
				const removedKeyword = keywords.removeLast()
				if (removedKeyword) {
					event.preventDefault()
					return true
				}
				const removedCategory = categories.removeLast()
				if (removedCategory) {
					event.preventDefault()
					return true
				}
			}
			if (event.key === 'Escape') {
				if (selection.index >= 0) {
					event.preventDefault()
					selection.clear()
					return true
				}
				if (inputState.value || categories.active.length > 0 || keywords.tokens.length > 0) {
					event.preventDefault()
					clearFilters()
					return true
				}
			}
			if (event.key === ' ' || event.key === 'Tab') {
				const currentWord = tokenizeQuery(inputState.value).at(-1)
				const normalizedWord = currentWord ? normalizeCommandBoxToken(currentWord) : ''
				const suggestion = normalizedWord
					? suggestions.find((entry) =>
							normalizeCommandBoxToken(entry.keyword).startsWith(normalizedWord)
						)
					: undefined
				if (suggestion) {
					event.preventDefault()
					keywords.addToken(suggestion.keyword)
					input.value = trimLastToken(inputState.value)
					return true
				}
			}
			return false
		},
	}

	return model
}

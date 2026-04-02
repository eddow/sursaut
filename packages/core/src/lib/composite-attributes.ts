import {
	type EffectAccess,
	type EffectCleanup,
	effect,
	isReactive,
	reactive,
	reactiveOptions,
	unreactive,
} from 'mutts'
import { sursautOptions } from './debug'
import { styles } from './styles'
import { stringKeys } from './utils'

export type PropInteraction = 'none' | 'read' | 'write' | 'bidi'

export class ReactiveProp<T> {
	interaction: PropInteraction = 'none'
	constructor(
		public get: () => T,
		public set?: (v: T) => void
	) {
		if (typeof get !== 'function') {
			throw new TypeError('[sursaut] ReactiveProp get must be a function')
		}
		if (set !== undefined && typeof set !== 'function') {
			throw new TypeError('[sursaut] ReactiveProp set must be a function')
		}
	}
}
export type PerhapsReactive<T> = T | ReactiveProp<T>
/**
 * Collapse a PerhapsReactive<T> into its concrete T.
 * Like Schrödinger's box: the value is in superposition — it might be a
 * deferred computation (ReactiveProp from babel's r()) or already concrete.
 * Calling collapse() opens the box: if reactive, .get() is invoked (which
 * establishes tracking in a reactive context); if plain, returned as-is.
 */
export const collapse = <T>(v: PerhapsReactive<T>): T => (v instanceof ReactiveProp ? v.get() : v)
export const fromAttribute = Symbol('from attributes')
export interface CompositeAttributesGuards {
	condition?: PerhapsReactive<any>
	pick?: Record<string, any>
	else?: true
	when?: Record<string, PerhapsReactive<(arg: unknown) => boolean>>
	if?: Record<string, PerhapsReactive<unknown> | true | string>
}

export type ThisDirective = (mounted: Node | readonly Node[] | undefined) => unknown

export type MountDirective = PerhapsReactive<
	(mounted: Node | readonly Node[], access: EffectAccess) => EffectCleanup
>

export interface CompositeAttributesDirectives {
	this: Set<ThisDirective>
	use: Set<MountDirective>
	named?: Record<string, PerhapsReactive<unknown>>
}

export interface CompositeAttributesMeta {
	guards: CompositeAttributesGuards
	directives(): CompositeAttributesDirectives
}
function report(msg: string) {
	if (sursautOptions.checkReactivity === 'error') throw new Error(msg)
	reactiveOptions.warn(msg)
}

function trackRead(rp: ReactiveProp<any>) {
	if (!sursautOptions.checkReactivity) return
	if (rp.interaction === 'write') {
		report('[sursaut] Prop read after write-only interaction — expected bidi but got write-only')
		rp.interaction = 'bidi'
	} else if (rp.interaction === 'none') {
		rp.interaction = 'read'
	}
}

function trackWrite(rp: ReactiveProp<any>, value: any): boolean {
	if (!rp.set) {
		throw new TypeError(`[sursaut] Cannot set read-only prop`)
	}
	if (!sursautOptions.checkReactivity) {
		rp.set(value)
		return true
	}
	const prevTouched = reactiveOptions.touched
	let wasTouched = false
	reactiveOptions.touched = (...args) => {
		wasTouched = true
		prevTouched(...args)
	}
	// Establish a temporary watcher so reactiveOptions.touched fires even with no pre-existing watchers
	let stopWatcher: (() => void) | undefined
	try {
		stopWatcher = effect(function probeWatcher() {
			rp.get()
		})
		rp.set(value)
	} finally {
		reactiveOptions.touched = prevTouched
		stopWatcher?.()
	}
	rp.interaction = wasTouched ? 'bidi' : rp.interaction === 'read' ? 'read' : 'write'
	if (rp.interaction === 'read') {
		report('[sursaut] Prop written after read-only interaction — expected bidi but got read-only')
		rp.interaction = 'bidi'
	}
	return true
}

const propsProxy: ProxyHandler<{
	composite: CompositeAttributes
	superLayer: Record<string, any> & object
}> &
	Record<symbol, unknown> = {
	[Symbol.toStringTag]: 'Properties',
	get(target, prop) {
		if (prop === fromAttribute) return target.composite
		if (typeof prop === 'string') {
			if (prop in target.superLayer) return target.superLayer[prop]
			const rp = target.composite.get(prop)
			if (rp instanceof ReactiveProp) trackRead(rp)
			return rp instanceof ReactiveProp ? rp.get() : reactive(rp)
		}
	},
	set(target, prop, value) {
		if (typeof prop === 'string') {
			if (!(prop in target.superLayer)) {
				const rp = target.composite.get(prop)
				if (rp instanceof ReactiveProp) return trackWrite(rp, value)
				//reactiveOptions.warn(`[sursaut] Cannot set read-only property "${prop}"`)
			}
			// try setting value in superLayer?? Is it a good idea?
			target.superLayer[prop] = value
			return true
		}
		return false
	},

	has: (target, prop) =>
		typeof prop === 'string' && (target.composite.keys.has(prop) || prop in target.superLayer),
	ownKeys(target) {
		const gather = new Set<string>(target.composite.keys)
		for (const key of Object.keys(target.superLayer)) gather.add(key)
		return Array.from(gather)
	},
	getOwnPropertyDescriptor(target, prop) {
		if (typeof prop === 'string' && prop in target.superLayer)
			return {
				value: target.superLayer[prop],
				writable: false,
				configurable: true,
				enumerable: true,
			}
		if (typeof prop !== 'string' || !target.composite.keys.has(prop)) return
		const value = target.composite.get(prop)
		return {
			enumerable: true,
			configurable: true,
			...(value instanceof ReactiveProp
				? {
						get: () => {
							trackRead(value)
							return value.get()
						},
						set: value.set && ((v) => trackWrite(value, v)),
					}
				: {
						writable: false,
						value,
					}),
		}
	},
}

function collapseLayer(layer: any): any {
	const collapsed = typeof layer === 'function' ? layer() : layer
	return collapsed instanceof CompositeAttributes ? collapsed.asProps() : collapsed
}

@unreactive
export class CompositeAttributes {
	public layers: (object | (() => any))[]
	private masked: Set<string> = new Set()

	constructor(...layers: any[]) {
		this.layers = layers.filter(Boolean)
	}

	mask(key: string) {
		this.masked.add(key)
	}

	// TODO: @memoize
	get keys(): Set<string> {
		const keys = new Set<string>()
		for (const layer of this.layers.map(collapseLayer)) {
			for (const key of stringKeys(layer)) {
				if (typeof key === 'string') {
					const colonIndex = key.indexOf(':')
					const rootKey = colonIndex > 0 ? key.slice(0, colonIndex) : key
					if (!this.masked.has(rootKey)) keys.add(rootKey)
				}
			}
		}
		return keys
	}

	getSingle(key: string, nonReactive = false): any {
		if (this.masked.has(key)) return undefined
		// Reverse iteration for precedence (last one wins)
		for (let i = this.layers.length - 1; i >= 0; i--) {
			const rawLayer = this.layers[i]
			//const isDeferred = typeof rawLayer === 'function'
			if (nonReactive && (typeof rawLayer === 'function' || isReactive(rawLayer))) continue
			const layer = collapseLayer(rawLayer)

			if (layer && key in layer) {
				if (nonReactive) this.mask(key)
				return layer[key]
			}
		}
		return undefined
	}

	getCategory(category: string, nonReactive = false): Record<string, any> | undefined {
		let result: Record<string, any> | undefined
		const prefix = `${category}:`

		// Reverse iteration for precedence (last one wins)
		for (let i = this.layers.length - 1; i >= 0; i--) {
			const rawLayer = this.layers[i]
			if (nonReactive && (typeof rawLayer === 'function' || isReactive(rawLayer))) continue
			const layer = collapseLayer(rawLayer)

			if (layer)
				for (const key of Object.keys(layer)) {
					if (key.startsWith(prefix)) {
						const name = key.slice(prefix.length)
						if (name && !this.masked.has(name) && !(result && Object.hasOwn(result, name))) {
							if (nonReactive) this.mask(category)
							result ??= {}
							result[name] = layer[key]
						}
					}
				}
		}
		return result
	}

	getCumulative(key: string, nonReactive = false, includeMasked = false): Set<any> {
		if (!includeMasked && this.masked.has(key)) return new Set()
		const result = new Set<any>()
		for (const rawLayer of this.layers) {
			if (nonReactive && (typeof rawLayer === 'function' || isReactive(rawLayer))) continue
			const layer = collapseLayer(rawLayer)
			if (layer && key in layer) result.add(layer[key])
		}
		this.mask(key)
		return result
	}

	get(key: string): any {
		if (this.masked.has(key)) return undefined

		const single = this.getSingle(key)
		const category = this.getCategory(key)

		// Merge logic:
		if (single !== undefined && category !== undefined) {
			// When single is a ReactiveProp (from reactive layer), wrap the merge lazily
			if (single instanceof ReactiveProp) {
				return new ReactiveProp(() => {
					const resolved = single.get()
					if (typeof resolved === 'object' && resolved !== null && !Array.isArray(resolved))
						return { ...resolved, ...category }
					throw new Error(
						`Invalid attribute type for attribute "${key}": ${typeof resolved} and {${Object.keys(category).join(', ')}}`
					)
				})
			}
			if (typeof single === 'object' && single !== null && !Array.isArray(single)) {
				return { ...single, ...category }
			}
			throw new Error(
				`Invalid attribute type for attribute "${key}": Both ${typeof single} and {${Object.keys(category).join(', ')}}`
			)
		}

		return category || single
	}

	get isReactive(): boolean {
		return this.layers.some((l) => isReactive(l) || typeof l === 'function')
	}

	requiresEffect(key: string): boolean {
		if (this.isReactive) return true
		for (const layer of this.layers.map(collapseLayer)) {
			if (Object.hasOwn(layer, key) || key in layer) {
				if (layer[key] instanceof ReactiveProp) return true
			}
			const prefix = `${key}:`
			for (const k of stringKeys(layer)) {
				if (k.startsWith(prefix) && layer[k] instanceof ReactiveProp) return true
			}
		}
		return false
	}

	extractGuards(): CompositeAttributesGuards {
		return {
			condition: this.getSingle('if', true),
			pick: this.getCategory('pick', true),
			else: this.getSingle('else', true),
			when: this.getCategory('when', true),
			if: this.getCategory('if', true),
		}
	}

	retrieveMeta(): CompositeAttributesMeta {
		const guards = this.extractGuards()
		this.mask('this')
		this.mask('use')

		return {
			guards,
			directives: () => ({
				this: this.getCumulative('this', false, true),
				use: this.getCumulative('use', false, true),
				named: this.getCategory('use'),
			}),
		}
	}

	/**
	 * Returns a Proxy that acts as a flattened view of the attributes.
	 * This is useful for passing to components that expect a single props object.
	 */
	asProps(superLayer: Record<string, any> = {}): any {
		return new Proxy({ composite: this, superLayer }, propsProxy)
	}

	mergeClasses() {
		const classes: any[] = []
		for (const layer of this.layers.map(collapseLayer)) {
			if (layer && 'class' in layer) {
				const val = collapse(layer.class)
				if (Array.isArray(val)) classes.push(...val.flat(Infinity))
				else if (val) classes.push(val)
			}
		}
		return classes
	}

	mergeStyles() {
		// Collect all styles
		const stylesInput: any[] = []
		for (const layer of this.layers.map(collapseLayer)) {
			if (!layer) continue
			if ('style' in layer) {
				const val = collapse(layer.style)
				if (Array.isArray(val)) stylesInput.push(...val.flat(Infinity))
				else if (val) stylesInput.push(val)
			}
			const styleProps: Record<string, any> = {}
			for (const key of stringKeys(layer)) {
				if (typeof key !== 'string' || !key.startsWith('style:')) continue
				const styleKey = key.slice('style:'.length)
				if (!styleKey) continue
				styleProps[styleKey] = collapse(layer[key])
			}
			if (Object.keys(styleProps).length > 0) stylesInput.push(styleProps)
		}
		// Use the styles utility to merge them correctly into a single object
		return styles(...stylesInput)
	}
}

export const c = (...args: object[]) => new CompositeAttributes(...args)

export function bind<T>(dst: ReactiveProp<T>, src: ReactiveProp<T>, defaultValue?: T) {
	if (!src.set) throw new Error('src is read-only')
	if (!dst.set) throw new Error('dst is read-only')
	if (defaultValue !== undefined && src.get() == null) src.set!(defaultValue)
	let writing = false
	const stopSrcToDst = effect`bind:srcToDst`(() => {
		const v = src.get()
		if (!writing) {
			writing = true
			try {
				dst.set!(v)
			} finally {
				writing = false
			}
		}
	})
	const stopDstToSrc = effect`bind:dstToSrc`(() => {
		const v = dst.get()
		if (!writing) {
			writing = true
			try {
				src.set!(v)
			} finally {
				writing = false
			}
		}
	})
	return () => {
		stopSrcToDst()
		stopDstToSrc()
	}
}

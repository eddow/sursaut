import { reactive } from 'mutts'
import type { Env } from './sursaut-element'

const defaultsProxy: ProxyHandler<any> & Record<symbol, unknown> = {
	[Symbol.toStringTag]: 'Defaulted',
	get(target, key) {
		if (typeof key === 'string') return (key in target.props ? target.props : target.defs)[key]
		// Forward symbol reads (e.g. CompositeAttributes[fromAttribute]) to wrapped props.
		const fromProps = Reflect.get(target.props, key)
		if (fromProps !== undefined) return fromProps
		return Reflect.get(target.defs, key)
	},
	set(target, key, value) {
		if (typeof key !== 'string') return false
		;((key in target.props ? target.props : target.defs) as Record<string, any>)[key] = value
		return true
	},
	has(target, p) {
		return Reflect.has(target.props, p) || Reflect.has(target.defs, p)
	},
	ownKeys(target) {
		// No key caching, prop can change
		const keySet = new Set<PropertyKey>([
			...Reflect.ownKeys(target.props),
			...Reflect.ownKeys(target.defs),
		])
		return Array.from(keySet).filter((k) => typeof k === 'string')
	},
	getOwnPropertyDescriptor(target, p) {
		return (
			Reflect.getOwnPropertyDescriptor(target.props, p) ||
			Reflect.getOwnPropertyDescriptor(target.defs, p)
		)
	},
}
/**
 * Creates a proxy over `props` that applies `??` defaults lazily.
 * Safe to call in the component body — no reactive reads happen until
 * a property is accessed (e.g. from JSX bindings wrapped in `r()`).
 *
 * Simulates an object whose *own* properties are defaulted (no prototyping)
 *
 * ```ts
 * const d = defaults(props, { gap: 'md', variant: 'primary' })
 * // d.gap → props.gap ?? 'md'  (deferred)
 * // d.name → props.name         (passthrough)
 * ```
 */
export function defaults<P extends Record<string, any>, D extends Record<string, any>>(
	props: P,
	defs: D
): P & D {
	//Omit<P, keyof D> & { [K in keyof D & keyof P]-?: NonNullable<P[K]> } {
	defs = reactive(defs)
	return new Proxy({ props, defs } as any, defaultsProxy) as any
}

export function extend<
	A extends Record<PropertyKey, any>,
	B extends Record<PropertyKey, any> | null,
>(base: B, added?: A): (B extends null ? {} : B) & A {
	return Object.create(base, Object.getOwnPropertyDescriptors(added || {}))
}

export function* stringKeys(o: object) {
	for (const key in o) yield key
}

export function* range(start: number, end: number) {
	for (let i = start; i < end; i++) yield `${i}`
}

/**
 * Resolves a deep path in the environment
 * @param {Object} env - The static context object
 * @param {string} path - e.g., 'user-role' or 'settings-theme'
 * @returns {*} The resolved value or undefined
 */
export function getEnvPath<T = unknown>(env: Env, path: string): T {
	return path.split('-').reduce((acc, key) => {
		return acc && typeof acc === 'object' ? acc[key] : undefined
	}, env)
}

const lazyHandler: ProxyHandler<{ fn: () => any }> = {
	get({ fn }: any, prop) {
		const value = fn()
		return (value as any)[prop]
	},
	set({ fn }: any, prop, val) {
		const value = fn()
		;(value as any)[prop] = val
		return true
	},
	ownKeys({ fn }: any) {
		const value = fn()
		return Reflect.ownKeys(value)
	},
	getOwnPropertyDescriptor({ fn }: any, prop) {
		const value = fn()
		return Reflect.getOwnPropertyDescriptor(value, prop)
	},
	has({ fn }: any, prop) {
		const value = fn()
		return prop in value
	},
	getPrototypeOf({ fn }: any) {
		const value = fn()
		return Object.getPrototypeOf(value)
	},
	deleteProperty({ fn }: any, prop) {
		const value = fn()
		return delete (value as any)[prop]
	},
	defineProperty({ fn }: any, prop, descriptor) {
		const value = fn()
		return Reflect.defineProperty(value, prop, descriptor)
	},
	isExtensible({ fn }: any) {
		const value = fn()
		return Object.isExtensible(value)
	},
	preventExtensions({ fn }: any) {
		const value = fn()
		return Object.preventExtensions(value)
	},
	setPrototypeOf({ fn }: any, proto) {
		const value = fn()
		return Object.setPrototypeOf(value, proto)
	},
}

export function lazy<T extends object>(fn: () => T): T {
	return new Proxy({ fn }, lazyHandler) as T
}

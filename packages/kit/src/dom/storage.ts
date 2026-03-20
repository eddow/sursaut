import { listen } from '@sursaut/core'
import { effect, link, reactive, type ScopedCallback } from 'mutts'

/**
 * JSON parser and serializer for localStorage
 * If specific objects are stored and need specific serialiser/deserialiser, they can be set here
 */
export const json = {
	parse: <T>(value: string): T => JSON.parse(value),
	stringify: <T>(value: T): string => JSON.stringify(value),
}
const getStorage = () => {
	try {
		return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
	} catch {
		return null
	}
}

// MUtTs localStorage wrapper
/**
 * Idea: state allows direct access to localStorage values and is reactive (allows inter-tab communication)
 *
 * @example const state = stored({ key: 'value' })
 * @example state.key = 'new value'
 * @example effect(() => { console.log(state.key) })
 *
 * @param initial - initial values for the state
 * @returns
 */
export function stored<T extends Record<string, any>>(initial: T): T {
	const rv: Partial<T> = reactive({})
	const storage = getStorage()

	function eventListener(event: StorageEvent) {
		if (event.storageArea !== storage) return
		if (event.key === null)
			for (const key in initial) {
				rv[key] = initial[key]
			}
		else if (event.key in initial) {
			const evKey = event.key as keyof T
			if (event.newValue == null) rv[evKey] = initial[evKey]
			else {
				try {
					rv[evKey] = json.parse<T[typeof evKey]>(event.newValue)
				} catch {
					rv[evKey] = initial[evKey]
				}
			}
		}
	}

	let stopStorage = () => {}
	if (typeof window !== 'undefined') {
		stopStorage = listen(window, 'storage', eventListener as EventListener)
	}

	const cleanups: ScopedCallback[] = []
	function bind(key: keyof T & string) {
		const storedValue = storage?.getItem(key)
		if (storedValue != null) {
			try {
				rv[key] = json.parse<T[typeof key]>(storedValue)
			} catch {
				rv[key] = initial[key]
			}
		} else {
			rv[key] = initial[key]
		}

		let initialized = false
		cleanups.push(
			effect`stored.${key}`(() => {
				const value = rv[key]
				if (initialized) {
					try {
						if (value === undefined) storage?.removeItem(key)
						else storage?.setItem(key, json.stringify(value))
					} catch {
						/* ignore */
					}
				}
				initialized = true
			})
		)
	}
	for (const key in initial) bind(key)
	return link(rv as T, () => {
		for (const cleanup of cleanups) cleanup()
		stopStorage()
	})
}

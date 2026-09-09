import { describe, expect, it } from 'vitest'
import { cloneParams, deepEqual, isPlainObject, mergeInto } from './dockview-utils'

describe('isPlainObject', () => {
	it('accepts plain objects and null-prototype objects', () => {
		expect(isPlainObject({})).toBe(true)
		expect(isPlainObject({ a: 1 })).toBe(true)
		expect(isPlainObject(Object.create(null))).toBe(true)
	})

	it('rejects arrays, null, primitives, class instances', () => {
		expect(isPlainObject([])).toBe(false)
		expect(isPlainObject(null)).toBe(false)
		expect(isPlainObject('x')).toBe(false)
		expect(isPlainObject(42)).toBe(false)
		expect(isPlainObject(new Date())).toBe(false)
	})
})

describe('deepEqual', () => {
	it('compares primitives', () => {
		expect(deepEqual(1, 1)).toBe(true)
		expect(deepEqual(1, 2)).toBe(false)
		expect(deepEqual('a', 'a')).toBe(true)
		expect(deepEqual(null, null)).toBe(true)
		expect(deepEqual(null, undefined)).toBe(false)
	})

	it('compares arrays structurally', () => {
		expect(deepEqual([1, 2], [1, 2])).toBe(true)
		expect(deepEqual([1, 2], [1, 3])).toBe(false)
		expect(deepEqual([1], [1, 2])).toBe(false)
		expect(deepEqual({ a: 1 }, [1])).toBe(false)
	})

	it('compares nested objects', () => {
		expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true)
		expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false)
		expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
	})

	it('handles undefined values, NaN, and nested arrays', () => {
		expect(deepEqual({ a: undefined }, { a: undefined })).toBe(true)
		expect(deepEqual({ a: undefined }, {})).toBe(false)
		expect(deepEqual({ a: undefined }, { a: 1 })).toBe(false)
		expect(deepEqual(NaN, NaN)).toBe(true)
		expect(deepEqual({ v: NaN }, { v: NaN })).toBe(true)
		expect(deepEqual({ v: NaN }, { v: 1 })).toBe(false)
		expect(deepEqual({ a: [[1, 2], [3]] }, { a: [[1, 2], [3]] })).toBe(true)
		expect(deepEqual({ a: [[1, 2], [3]] }, { a: [[1, 2], [4]] })).toBe(false)
	})
})

describe('mergeInto', () => {
	it('merges top-level keys in place', () => {
		const target = { a: 1 }
		mergeInto(target, { b: 2 })
		expect(target).toEqual({ a: 1, b: 2 })
	})

	it('recurses into nested plain objects preserving identity', () => {
		const nested = { x: 1 }
		const target = { nested }
		mergeInto(target, { nested: { y: 2 } })
		expect(target.nested).toBe(nested)
		expect(target).toEqual({ nested: { x: 1, y: 2 } })
	})

	it('replaces non-plain values', () => {
		const target = { a: [1, 2] }
		mergeInto(target, { a: [3] })
		expect(target).toEqual({ a: [3] })
	})

	it('does not reassign on a no-op merge', () => {
		const nested = { x: 1 }
		const arr = [1, 2]
		const target: Record<string, unknown> = { a: 1, nested, arr }
		mergeInto(target, { a: 1, nested: { x: 1 }, arr: [1, 2] })
		expect(target.nested).toBe(nested)
		expect(target.arr).toBe(arr)
	})
})

describe('cloneParams', () => {
	it('preserves undefined values and NaN (unlike JSON round-trip)', () => {
		const source = { a: undefined, b: NaN, c: { d: undefined, e: NaN } }
		const clone = cloneParams(source)
		expect(clone).toEqual(source)
		expect('a' in clone).toBe(true)
		expect(clone.a).toBeUndefined()
		expect(Number.isNaN(clone.b)).toBe(true)
		expect(Number.isNaN((clone.c as { e: number }).e)).toBe(true)
	})

	it('deep-clones nested structures without sharing references', () => {
		const source = { list: [{ x: 1 }], obj: { y: 2 } }
		const clone = cloneParams(source)
		expect(clone).toEqual(source)
		expect(clone.list).not.toBe(source.list)
		expect(clone.list[0]).not.toBe(source.list[0])
		expect(clone.obj).not.toBe(source.obj)
	})

	it('returns primitives unchanged', () => {
		expect(cloneParams(42)).toBe(42)
		expect(cloneParams('x')).toBe('x')
		expect(cloneParams(null)).toBeNull()
		expect(cloneParams(undefined)).toBeUndefined()
	})

	it('preserves NaN through a deepEqual guard (JSON would coerce to null)', () => {
		const params = { v: NaN }
		// A JSON round-trip loses NaN; cloneParams + deepEqual must not.
		expect(deepEqual(cloneParams(params), params)).toBe(true)
		expect(deepEqual(JSON.parse(JSON.stringify(params)), params)).toBe(false)
	})
})

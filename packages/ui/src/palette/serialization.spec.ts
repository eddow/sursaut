import { reactive } from 'mutts'
import { describe, expect, it } from 'vitest'
import {
	hydratePaletteLayout,
	Palette,
	serializePaletteLayout,
	validatePaletteLayout,
} from './palette'
import type { SerializedPaletteLayout } from './types'

describe('Palette Layout Serialization', () => {
	// Helper to create a minimal palette for testing
	function createTestPalette(): Palette {
		return new Palette({
			tools: {
				testTool: {
					type: 'boolean',
					value: false,
					default: false,
					label: 'Test Tool',
				},
				anotherTool: {
					type: 'number',
					value: 10,
					default: 10,
					label: 'Another Tool',
				},
			},
			keys: { bindings: {}, findByTool: () => [], resolve: () => undefined },
			editors: {
				boolean: {
					editor: () => undefined as any,
				},
				number: {
					editor: () => undefined as any,
				},
				item: {
					editorOnly: {
						editor: () => undefined as any,
					},
				},
			} as any,
		})
	}

	// Helper to create test borders
	function createTestBorders() {
		return reactive({
			top: [
				[
					{
						space: 0.1,
						toolbar: reactive([
							{
								tool: 'testTool',
								editor: 'boolean',
								config: { icon: '🔔', label: 'Test' },
							},
						]),
					},
				],
			],
			right: [],
			bottom: [
				[
					{
						space: 0.5,
						toolbar: reactive([
							{
								tool: 'anotherTool',
								editor: 'number',
							},
							{
								editor: 'editorOnly',
								config: { label: 'Editor Only Item' },
							},
						]),
					},
				],
			],
			left: [],
		})
	}

	describe('serializePaletteLayout', () => {
		it('should serialize a palette border layout to a stable format', () => {
			const borders = createTestBorders()
			const serialized = serializePaletteLayout(borders)

			expect(serialized).toEqual({
				version: 1,
				borders: {
					top: [
						{
							space: 0.1,
							toolbar: [
								{
									tool: 'testTool',
									editor: 'boolean',
									config: { icon: '🔔', label: 'Test' },
								},
							],
						},
					],
					right: [],
					bottom: [
						{
							space: 0.5,
							toolbar: [
								{
									tool: 'anotherTool',
									editor: 'number',
								},
								{
									editor: 'editorOnly',
									config: { label: 'Editor Only Item' },
								},
							],
						},
					],
					left: [],
				},
			})
		})

		it('should handle empty borders', () => {
			const borders = reactive({
				top: [],
				right: [],
				bottom: [],
				left: [],
			})

			const serialized = serializePaletteLayout(borders)

			expect(serialized).toEqual({
				version: 1,
				borders: {
					top: [],
					right: [],
					bottom: [],
					left: [],
				},
			})
		})

		it('should handle complex multi-track layout', () => {
			const borders = reactive({
				top: [
					[
						{
							space: 0.1,
							toolbar: reactive([{ tool: 'testTool' }]),
						},
						{
							space: 0.2,
							toolbar: reactive([{ tool: 'anotherTool' }]),
						},
					],
					[
						{
							space: 0.3,
							toolbar: reactive([{ editor: 'editorOnly' }]),
						},
					],
				],
				right: [],
				bottom: [],
				left: [],
			})

			const serialized = serializePaletteLayout(borders)

			expect(serialized.borders.top).toHaveLength(3)
			expect(serialized.borders.top[0].space).toBe(0.1)
			expect(serialized.borders.top[1].space).toBe(0.2)
			expect(serialized.borders.top[2].space).toBe(0.3)
		})
	})

	describe('validatePaletteLayout', () => {
		it('should validate a correct serialized layout', () => {
			const validLayout: SerializedPaletteLayout = {
				version: 1,
				borders: {
					top: [
						{
							space: 0.1,
							toolbar: [
								{
									tool: 'testTool',
									editor: 'boolean',
									config: { icon: '🔔' },
								},
							],
						},
					],
					right: [],
					bottom: [],
					left: [],
				},
			}

			expect(validatePaletteLayout(validLayout)).toBe(true)
		})

		it('should reject invalid version', () => {
			const invalidLayout = {
				version: 2,
				borders: {
					top: [],
					right: [],
					bottom: [],
					left: [],
				},
			}

			expect(validatePaletteLayout(invalidLayout)).toBe(false)
		})

		it('should reject missing borders', () => {
			const invalidLayout = {
				version: 1,
			}

			expect(validatePaletteLayout(invalidLayout)).toBe(false)
		})

		it('should reject invalid toolbar item structure', () => {
			const invalidLayout = {
				version: 1,
				borders: {
					top: [
						{
							space: 0.1,
							toolbar: [
								{
									tool: 123, // Invalid: should be string
								},
							],
						},
					],
					right: [],
					bottom: [],
					left: [],
				},
			}

			expect(validatePaletteLayout(invalidLayout)).toBe(false)
		})

		it('should reject invalid config (array instead of object)', () => {
			const invalidLayout = {
				version: 1,
				borders: {
					top: [
						{
							space: 0.1,
							toolbar: [
								{
									tool: 'testTool',
									config: [], // Invalid: should be object
								},
							],
						},
					],
					right: [],
					bottom: [],
					left: [],
				},
			}

			expect(validatePaletteLayout(invalidLayout)).toBe(false)
		})

		it('should accept valid parking', () => {
			const validLayout: SerializedPaletteLayout = {
				version: 1,
				borders: {
					top: [],
					right: [],
					bottom: [],
					left: [],
				},
				parking: [
					[
						{
							tool: 'testTool',
							editor: 'boolean',
						},
					],
				],
			}

			expect(validatePaletteLayout(validLayout)).toBe(true)
		})

		it('should reject invalid parking structure', () => {
			const invalidLayout = {
				version: 1,
				borders: {
					top: [],
					right: [],
					bottom: [],
					left: [],
				},
				parking: [
					[
						{
							tool: 123, // Invalid
						},
					],
				],
			}

			expect(validatePaletteLayout(invalidLayout)).toBe(false)
		})
	})

	describe('hydratePaletteLayout', () => {
		it('should hydrate a serialized layout into reactive borders', () => {
			const palette = createTestPalette()
			const serialized: SerializedPaletteLayout = {
				version: 1,
				borders: {
					top: [
						{
							space: 0.1,
							toolbar: [
								{
									tool: 'testTool',
									editor: 'boolean',
									config: { icon: '🔔' },
								},
							],
						},
					],
					right: [],
					bottom: [],
					left: [],
				},
			}

			const hydrated = hydratePaletteLayout(palette, serialized)

			expect(hydrated.top).toHaveLength(1)
			expect(hydrated.top[0]).toHaveLength(1)
			expect(hydrated.top[0][0].space).toBe(0.1)
			expect(hydrated.top[0][0].toolbar).toHaveLength(1)
			expect(hydrated.top[0][0].toolbar[0].tool).toBe('testTool')
			expect(hydrated.top[0][0].toolbar[0].editor).toBe('boolean')
			expect(hydrated.top[0][0].toolbar[0].config).toEqual({ icon: '🔔' })
		})

		it('should handle empty borders', () => {
			const palette = createTestPalette()
			const serialized: SerializedPaletteLayout = {
				version: 1,
				borders: {
					top: [],
					right: [],
					bottom: [],
					left: [],
				},
			}

			const hydrated = hydratePaletteLayout(palette, serialized)

			expect(hydrated.top).toEqual([])
			expect(hydrated.right).toEqual([])
			expect(hydrated.bottom).toEqual([])
			expect(hydrated.left).toEqual([])
		})
	})

	describe('Roundtrip: serialize then hydrate', () => {
		it('should preserve structure through serialization and hydration', () => {
			const palette = createTestPalette()
			const originalBorders = createTestBorders()

			// Serialize
			const serialized = serializePaletteLayout(originalBorders)

			// Validate
			expect(validatePaletteLayout(serialized)).toBe(true)

			// Hydrate
			const hydrated = hydratePaletteLayout(palette, serialized)

			// Verify structure is preserved
			expect(hydrated.top).toHaveLength(originalBorders.top.length)
			expect(hydrated.bottom).toHaveLength(originalBorders.bottom.length)
			expect(hydrated.right).toHaveLength(originalBorders.right.length)
			expect(hydrated.left).toHaveLength(originalBorders.left.length)

			// Verify top border content
			if (hydrated.top.length > 0 && originalBorders.top.length > 0) {
				expect(hydrated.top[0]).toHaveLength(originalBorders.top[0].length)
				if (hydrated.top[0].length > 0 && originalBorders.top[0].length > 0) {
					expect(hydrated.top[0][0].space).toBe(originalBorders.top[0][0].space)
					expect(hydrated.top[0][0].toolbar).toHaveLength(originalBorders.top[0][0].toolbar.length)
				}
			}

			// Verify bottom border content
			if (hydrated.bottom.length > 0 && originalBorders.bottom.length > 0) {
				expect(hydrated.bottom[0]).toHaveLength(originalBorders.bottom[0].length)
				if (hydrated.bottom[0].length > 0 && originalBorders.bottom[0].length > 0) {
					expect(hydrated.bottom[0][0].space).toBe(originalBorders.bottom[0][0].space)
					expect(hydrated.bottom[0][0].toolbar).toHaveLength(
						originalBorders.bottom[0][0].toolbar.length
					)
				}
			}
		})

		it('should handle complex multi-track layout roundtrip', () => {
			const palette = createTestPalette()
			const complexBorders = reactive({
				top: [
					[
						{
							space: 0.1,
							toolbar: reactive([{ tool: 'testTool' }]),
						},
						{
							space: 0.2,
							toolbar: reactive([{ tool: 'anotherTool' }]),
						},
					],
					[
						{
							space: 0.3,
							toolbar: reactive([{ editor: 'editorOnly' }]),
						},
					],
				],
				right: [],
				bottom: [],
				left: [],
			})

			const serialized = serializePaletteLayout(complexBorders)
			const hydrated = hydratePaletteLayout(palette, serialized)

			expect(hydrated.top).toHaveLength(3) // 2 tracks in first border + 1 in second
			expect(hydrated.top[0][0].space).toBe(0.1)
			expect(hydrated.top[1][0].space).toBe(0.2)
			expect(hydrated.top[2][0].space).toBe(0.3)
		})
	})
})

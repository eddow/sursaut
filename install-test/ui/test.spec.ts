import { describe, it, expect } from 'vitest'

// Test all model exports from @sursaut/ui (jsdom environment needed for DOM-dependent models)
import {
	buttonModel,
	checkboxModel,
	checkButtonModel,
	radioButtonModel,
	switchModel,
	radioModel,
	accordionModel,
	selectModel,
	comboboxModel,
	multiselectModel,
	menuModel,
	menuItemModel,
	menuBarModel,
	progressModel,
	starsModel,
	chipModel,
	headingModel,
	textModel,
	themeToggleModel,
	dialogModel,
	drawerModel,
	toastModel,
	stackModel,
	inlineModel,
	gridModel,
	containerModel,
	appShellModel,
	withOverlaysModel,
	splitButtonModel,
	splitRadioButtonModel,
	iconPickerModel,
} from '@sursaut/ui/models'

describe('@sursaut/ui integration', () => {
	describe('buttonModel', () => {
		it('should return an object with button properties', () => {
			const model = buttonModel({})
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
			expect(model.button).toBeDefined()
		})

		it('should handle disabled state', () => {
			const model = buttonModel({ disabled: true })
			expect(model.button?.disabled).toBe(true)
		})

		it('should not be disabled by default', () => {
			const model = buttonModel({})
			expect(model.button?.disabled).toBeUndefined()
		})

		it('should expose icon when icon prop is provided', () => {
			const model = buttonModel({ icon: 'star' })
			expect(model.icon).toBeDefined()
			expect(model.icon!.position).toBe('start')
		})

		it('should not expose icon when no icon prop', () => {
			const model = buttonModel({})
			expect(model.icon).toBeUndefined()
		})

		it('should expose hasLabel getter', () => {
			const model = buttonModel({})
			expect(typeof model.hasLabel).toBe('boolean')
		})
	})

	describe('checkboxModel', () => {
		it('should return an object', () => {
			const model = checkboxModel({})
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})

		it('should expose input group', () => {
			const model = checkboxModel({})
			expect(model.input).toBeDefined()
		})
	})

	describe('switchModel', () => {
		it('should return an object', () => {
			const model = switchModel({})
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})
	})

	describe('radioModel', () => {
		it('should return an object', () => {
			const model = radioModel({})
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})
	})

	describe('checkButtonModel', () => {
		it('should return an object', () => {
			const model = checkButtonModel({})
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})
	})

	describe('radioButtonModel', () => {
		it('should return an object', () => {
			const model = radioButtonModel({})
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})
	})

	describe('accordionModel', () => {
		it('should return an object', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = accordionModel({ summary: 'Test accordion' } as any)
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
			expect(model.details).toBeDefined()
		})
	})

	describe('selectModel', () => {
		it('should return an object', () => {
			const model = selectModel({})
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})
	})

	describe('comboboxModel', () => {
		it('should return an object', () => {
			const model = comboboxModel({})
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})
	})

	describe('multiselectModel', () => {
		it('should return an object', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = multiselectModel({ items: [], value: new Set(), renderItem: (i: any) => i } as any)
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})
	})

	describe('menuModel', () => {
		it('should return an object', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = menuModel({ summary: 'Test menu' } as any)
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})
	})

	describe('menuItemModel', () => {
		it('should return an object', () => {
			const model = menuItemModel({})
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})
	})

	describe('menuBarModel', () => {
		it('should return an object', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = menuBarModel({ items: [] } as any)
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})
	})

	describe('progressModel', () => {
		it('should return correct value and max', () => {
			const model = progressModel({ value: 75, max: 100 })
			expect(model.progress?.value).toBe(75)
			expect(model.progress?.max).toBe(100)
		})

		it('should default max to 100', () => {
			const model = progressModel({ value: 42 })
			expect(model.progress?.max).toBe(100)
		})
	})

	describe('starsModel', () => {
		it('should return an object', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = starsModel({ max: 5 } as any)
			expect(model).toBeDefined()
			expect(typeof model).toBe('object')
		})
	})

	describe('chipModel', () => {
		it('should return an object with dismiss', () => {
			const model = chipModel({})
			expect(model).toBeDefined()
			expect(typeof model.dismiss).toBe('function')
			expect(model.isVisible).toBe(true)
		})
	})

	describe('headingModel', () => {
		it('should return an object', () => {
			const model = headingModel({})
			expect(model).toBeDefined()
		})
	})

	describe('textModel', () => {
		it('should return an object', () => {
			const model = textModel({})
			expect(model).toBeDefined()
		})
	})

	describe('themeToggleModel', () => {
		it('should return an object', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = themeToggleModel({ settings: {}, resolvedTheme: 'light' } as any)
			expect(model).toBeDefined()
		})
	})

	describe('dialogModel', () => {
		it('should return an object', () => {
			const close = () => {}
			const model = dialogModel({}, close)
			expect(model).toBeDefined()
		})
	})

	describe('drawerModel', () => {
		it('should return an object', () => {
			const close = () => {}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = drawerModel({ children: null } as any, close)
			expect(model).toBeDefined()
		})
	})

	describe('toastModel', () => {
		it('should return an object', () => {
			const close = () => {}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = toastModel({ message: 'Test' } as any, close)
			expect(model).toBeDefined()
		})
	})

	describe('stackModel', () => {
		it('should return an object', () => {
			const model = stackModel({})
			expect(model).toBeDefined()
		})
	})

	describe('inlineModel', () => {
		it('should return an object', () => {
			const model = inlineModel({})
			expect(model).toBeDefined()
		})
	})

	describe('gridModel', () => {
		it('should return an object', () => {
			const model = gridModel({})
			expect(model).toBeDefined()
		})
	})

	describe('containerModel', () => {
		it('should return an object', () => {
			const model = containerModel({})
			expect(model).toBeDefined()
		})
	})

	describe('appShellModel', () => {
		it('should return an object', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = appShellModel({ header: null } as any)
			expect(model).toBeDefined()
		})
	})

	describe('withOverlaysModel', () => {
		it('should return an object when given an env scope', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = withOverlaysModel({}, globalThis as any)
			expect(model).toBeDefined()
		})
	})

	describe('splitButtonModel', () => {
		it('should return an object', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = splitButtonModel({ items: [{ label: 'Option A', value: 'a' }] } as any)
			expect(model).toBeDefined()
		})
	})

	describe('splitRadioButtonModel', () => {
		it('should return an object', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = splitRadioButtonModel({ items: [] } as any)
			expect(model).toBeDefined()
		})
	})

	describe('iconPickerModel', () => {
		it('should return an object', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const model = iconPickerModel({ items: [] } as any)
			expect(model).toBeDefined()
		})
	})
})

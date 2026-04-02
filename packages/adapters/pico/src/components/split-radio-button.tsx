import { type ArrangedProps, arranged } from '@sursaut/ui'
import {
	type SplitRadioButtonProps as BaseSplitRadioButtonProps,
	splitRadioButtonModel,
} from '@sursaut/ui/models'
import { type PicoButtonLikeProps, picoButtonClass } from '../factory'

export type SplitRadioButtonProps<Value = unknown> = PicoButtonLikeProps<
	BaseSplitRadioButtonProps<Value>
> &
	ArrangedProps

function splitArrangement(scope: Record<string, unknown>, props: ArrangedProps) {
	return arranged(scope, {
		get orientation() {
			return props.orientation
		},
		get density() {
			return props.density
		},
		get joined() {
			return props.joined ?? true
		},
		get align() {
			return props.align
		},
	})
}

export function SplitRadioButton<Value = unknown>(
	props: SplitRadioButtonProps<Value>,
	scope: Record<string, unknown>
) {
	const o = splitArrangement(scope, props)
	const model = splitRadioButtonModel<Value>(props)
	return (
		<div
			class={o.class}
			style={`position:relative;display:inline-flex;align-items:stretch;max-width:100%;flex-direction:${o.orientation === 'vertical' ? 'column' : 'row'};`}
		>
			<button
				class={picoButtonClass(props.variant ?? 'secondary', props.outline ?? !model.checked)}
				style={
					o.joined
						? o.orientation === 'vertical'
							? 'border-end-start-radius:0;border-end-end-radius:0;margin:0;display:flex;align-items:center;gap:0.5rem;'
							: 'border-start-end-radius:0;border-end-end-radius:0;margin:0;display:flex;align-items:center;gap:0.5rem;'
						: 'margin:0;display:flex;align-items:center;gap:0.5rem;'
				}
				{...props.el}
				{...model.button}
			>
				<span
					style={`display:inline-block;width:0.5rem;height:0.5rem;border-radius:999px;background:${model.checked ? 'currentColor' : 'var(--pico-muted-color)'};opacity:${model.checked ? 1 : 0.5};`}
				/>
				{model.selected?.label ?? props.children}
			</button>
			<button
				type="button"
				class={picoButtonClass(props.variant ?? 'secondary', props.outline ?? !model.checked)}
				style={
					o.joined
						? o.orientation === 'vertical'
							? 'border-start-start-radius:0;border-start-end-radius:0;margin:0;border-block-start:0;min-height:2.5rem;padding-block:0.5rem;'
							: 'border-start-start-radius:0;border-end-start-radius:0;margin:0;border-inline-start:0;min-width:2.5rem;padding-inline:0.75rem;'
						: o.orientation === 'vertical'
							? 'margin:0;min-height:2.5rem;padding-block:0.5rem;'
							: 'margin:0;min-width:2.5rem;padding-inline:0.75rem;'
				}
				{...model.trigger}
			>
				▾
			</button>
			<div
				if={model.open}
				style={
					o.orientation === 'vertical'
						? 'position:absolute;top:0;left:calc(100% + 0.25rem);display:grid;gap:0.25rem;min-width:12rem;padding:0.375rem;border:1px solid var(--pico-muted-border-color);border-radius:var(--pico-border-radius);background:var(--pico-background-color);box-shadow:var(--pico-card-box-shadow);z-index:10;'
						: 'position:absolute;top:calc(100% + 0.25rem);left:0;display:grid;gap:0.25rem;min-width:12rem;padding:0.375rem;border:1px solid var(--pico-muted-border-color);border-radius:var(--pico-border-radius);background:var(--pico-background-color);box-shadow:var(--pico-card-box-shadow);z-index:10;'
				}
				{...model.menu}
			>
				<for each={model.items}>
					{(item) => (
						<button
							class={picoButtonClass(props.variant ?? 'secondary', props.outline ?? !item.checked)}
							style="margin:0;display:flex;align-items:center;gap:0.5rem;text-align:start;"
							{...item.button}
						>
							<span
								style={`display:inline-block;width:0.5rem;height:0.5rem;border-radius:999px;background:${item.checked ? 'currentColor' : 'var(--pico-muted-color)'};opacity:${item.checked ? 1 : 0.5};`}
							/>
							{item.item.label ?? String(item.item.value)}
						</button>
					)}
				</for>
			</div>
		</div>
	)
}

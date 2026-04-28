import type { EffectAccess, EffectCloser, MorphPosition } from 'mutts'
import type { StyleInput } from '../lib/styles'
import type { Env, Children as SourceChildren, SursautElement } from '../lib/sursaut-element'

declare global {
	var h: (type: any, props?: any, ...children: any[]) => JSX.Element
	var Fragment: (props: any, env?: any) => any
	type ComponentFunction<P extends Record<string, any> = any, E extends Env = Env> = (
		props: P,
		env: E
	) => SourceChildren

	interface ComponentInfo {
		id: string
		name: string
		ctor: Function
		props: any
		env: any
		parent?: ComponentInfo
		children: Set<ComponentInfo>
		elements: Set<Node>
	}
	namespace JSX {
		type Child =
			| Node
			| string
			| number
			| JSX.Element
			| undefined
			| false
			| null
			| undefined
			| (() => Children)
		interface ChildrenCollection {
			readonly __sursaut_children_collection: unique symbol
			readonly length?: never
			[n: number]: never
		}
		type Children = Child | readonly Children[] | ChildrenCollection

		// Base interface for common HTML attributes
		type BaseHTMLAttributes<N extends Node = HTMLElement> = JSX.IntrinsicThisAttributes<N> &
			GlobalHTMLAttributes &
			MouseReactiveHTMLAttributes & {
				children?: Children
				autoFocus?: boolean
				// Additional common non-mouse events
				onFocus?: (event: FocusEvent) => void
				onBlur?: (event: FocusEvent) => void
				onKeydown?: (event: KeyboardEvent) => void
				onKeyup?: (event: KeyboardEvent) => void
				onKeypress?: (event: KeyboardEvent) => void
			}
		// Specify the property name used for JSX children
		interface ElementChildrenAttribute {
			children: any
		}
		type Element = SursautElement
		interface ElementClass {
			template: any
		}
		type ElementType = string | ((props: any, ...args: any[]) => any)

		type UnionToIntersection<U> = (U extends any ? (value: U) => void : never) extends (
			value: infer I
		) => void
			? I
			: never

		type Simplify<T> = { [K in keyof T]: T[K] }

		type PlainObject<T> = T extends readonly any[]
			? never
			: T extends Record<string, any>
				? T extends (...args: any[]) => any
					? never
					: T extends (...args: any[]) => any
						? never
						: T
				: never

		type OptionalObjectProps<Props> = {
			[K in Extract<keyof Props, string> as undefined extends Props[K]
				? PlainObject<NonNullable<Props[K]>> extends never
					? never
					: K
				: never]: NonNullable<Props[K]>
		}

		type NamespacedProps<Props> = {
			[K in keyof OptionalObjectProps<Props> & string as `${K}:${string}`]?: any
		}

		type ExtractComponentProps<C, Props> = C extends { props: infer ExplicitProps }
			? ExplicitProps
			: C extends (props: infer InferredProps, ...args: any[]) => any
				? InferredProps
				: Props

		type LibraryManagedAttributes<Component, Props> = ComponentIntrinsicAttributes<Component> &
			Props &
			NamespacedProps<Props>

		type RenderOutput<T> = T extends JSX.Element ? ReturnType<T['render']> : T

		type ElementResult<T> =
			RenderOutput<T> extends infer R
				? R extends readonly Node[]
					? Node | readonly Node[]
					: R extends Node
						? R
						: R extends null | undefined
							? undefined
							: Node | readonly Node[]
				: Node | readonly Node[]

		type ThisBinding<T> = ElementResult<T> | ((mounted: ElementResult<T>) => void) | undefined

		type ComponentIntrinsicAttributes<C> = C extends (props: any, env: any) => infer N
			? N extends Node | readonly Node[]
				? { this?: ThisBinding<N> } & MetaAttributes<any, N>
				: { this?: ThisBinding<N> }
			: {}

		// Override the default JSX children handling
		// Allow any children type so components can accept function-as-children
		type IntrinsicThisAttributes<N extends Node | readonly Node[]> =
			| { children: Children }
			| ({
					children?: any
					// SursautElement class - encapsulates JSX element creation and rendering
					this?: ThisBinding<N>
					if?: any
					else?: true
					use?: (target: N, access: EffectAccess) => EffectCloser | undefined | void
			  } & MetaAttributes<any, N>)
		type MetaAttributes<M, N extends Node | readonly Node[] = Node | readonly Node[]> = {
			[K in string & keyof M as `use:${K}`]?: M[K] extends (
				node: N,
				value: infer V,
				access: EffectAccess
			) => EffectCloser | undefined | void
				? V
				: never
		} & {
			[K in string & keyof M as `if:${K}`]?: M[K]
		} & {
			[K in string & keyof M as `pick:${K}`]?: M[K] // Do this type - if ever we find out how to use meta
		} & {
			[K in string & keyof M as `when:${K}`]?: M[K] extends (value: infer V) => boolean ? V : never
		}

		type ElementIntrinsicAttributes<N extends Node | readonly Node[]> = IntrinsicThisAttributes<N>

		type IntrinsicAttributes = IntrinsicThisAttributes<Node | readonly Node[]>

		// Custom class type for conditional classes
		type ClassValue = string | ClassValue[] | Record<string, boolean> | null | undefined

		// JSX string attributes (attr="value") are always widened to `string` by TypeScript.
		// (string & {}) accepts any string while preserving IDE autocomplete for known values.
		type Booleanish = boolean | 'true' | 'false' | (string & {})

		type AriaAttributesBase = {
			'aria-activeDescendant'?: string
			'aria-atomic'?: Booleanish
			'aria-autoComplete'?: 'none' | 'inline' | 'list' | 'both' | (string & {})
			'aria-brailleLabel'?: string
			'aria-brailleRoleDescription'?: string
			'aria-busy'?: Booleanish
			'aria-checked'?: Booleanish | 'mixed'
			'aria-colCount'?: number
			'aria-colIndex'?: number
			'aria-colIndexText'?: string
			'aria-colSpan'?: number
			'aria-controls'?: string
			'aria-current'?: Booleanish | 'page' | 'step' | 'location' | 'date' | 'time' | (string & {})
			'aria-describedBy'?: string
			'aria-description'?: string
			'aria-details'?: string
			'aria-disabled'?: Booleanish
			'aria-dropEffect'?: 'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup' | (string & {})
			'aria-errorMessage'?: string
			'aria-expanded'?: Booleanish
			'aria-flowTo'?: string
			'aria-grabbed'?: Booleanish
			'aria-hasPopup'?: Booleanish | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog' | (string & {})
			'aria-hidden'?: Booleanish
			'aria-invalid'?: Booleanish | 'grammar' | 'spelling' | (string & {})
			'aria-keyShortcuts'?: string
			'aria-label'?: string
			'aria-labelledBy'?: string
			'aria-level'?: number
			'aria-live'?: 'off' | 'assertive' | 'polite' | (string & {})
			'aria-modal'?: Booleanish
			'aria-multiLine'?: Booleanish
			'aria-multiSelectable'?: Booleanish
			'aria-orientation'?: 'horizontal' | 'vertical' | (string & {})
			'aria-owns'?: string
			'aria-placeholder'?: string
			'aria-posInSet'?: number
			'aria-pressed'?: Booleanish | 'mixed' | (string & {})
			'aria-readOnly'?: Booleanish
			'aria-relevant'?: 'additions' | 'additions text' | 'all' | 'removals' | 'text' | (string & {})
			'aria-required'?: Booleanish
			'aria-roleDescription'?: string
			'aria-rowCount'?: number
			'aria-rowIndex'?: number
			'aria-rowIndexText'?: string
			'aria-rowSpan'?: number
			'aria-selected'?: Booleanish
			'aria-setSize'?: number
			'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other' | (string & {})
			'aria-valueMax'?: number
			'aria-valueMin'?: number
			'aria-valueNow'?: number
			'aria-valueText'?: string
		}

		type AriaAttributes = AriaAttributesBase & {
			[K in Exclude<`aria-${string}`, keyof AriaAttributesBase>]?:
				| string
				| number
				| boolean
				| undefined
		}

		type DataAttributes = {
			[K in `data-${string}`]?: string | number | boolean | null | undefined
		}

		// Common, reusable HTML attributes shared by most elements
		type GlobalHTMLAttributes = AriaAttributes &
			DataAttributes & {
				// Global attributes
				id?: string
				class?: ClassValue
				style?: StyleInput
				title?: string
				lang?: string
				dir?: 'ltr' | 'rtl' | 'auto' | (string & {})
				hidden?: boolean
				tabIndex?: number
				accessKey?: string
				contentEditable?: boolean | 'true' | 'false' | 'inherit' | (string & {})
				spellCheck?: boolean | 'true' | 'false'
				translate?: 'yes' | 'no' | (string & {})
				autoCapitalize?:
					| 'off'
					| 'none'
					| 'on'
					| 'sentences'
					| 'words'
					| 'characters'
					| (string & {})
				autoCorrect?: 'on' | 'off' | (string & {})
				autoComplete?: string
				enterKeyHint?:
					| 'enter'
					| 'done'
					| 'go'
					| 'next'
					| 'previous'
					| 'search'
					| 'send'
					| (string & {})
				inputMode?:
					| 'none'
					| 'text'
					| 'tel'
					| 'url'
					| 'email'
					| 'numeric'
					| 'decimal'
					| 'search'
					| (string & {})
				is?: string
				itemId?: string
				itemProp?: string
				itemRef?: string
				itemScope?: boolean
				itemType?: string
				role?: string
				innerHTML?: string
				draggable?: boolean
				onDragStart?: (event: DragEvent) => void
				onDragEnd?: (event: DragEvent) => void
				onDragOver?: (event: DragEvent) => void
				onDragEnter?: (event: DragEvent) => void
				onDragLeave?: (event: DragEvent) => void
				onDrop?: (event: DragEvent) => void
			}

		// Reusable mouse event handlers for DOM elements
		type MouseReactiveHTMLAttributes = {
			onClick?: (event: MouseEvent) => void
			onMousedown?: (event: MouseEvent) => void
			onMouseup?: (event: MouseEvent) => void
			onMouseover?: (event: MouseEvent) => void
			onMouseout?: (event: MouseEvent) => void
			onMouseenter?: (event: MouseEvent) => void
			onMouseleave?: (event: MouseEvent) => void
			onMousemove?: (event: MouseEvent) => void
			onContextmenu?: (event: MouseEvent) => void
			onDblclick?: (event: MouseEvent) => void
		}

		interface InputBase {
			name?: string
			form?: string
			formAction?: string
			formEncType?: string
			formMethod?: 'get' | 'post' | 'dialog' | (string & {})
			placeholder?: string
			disabled?: boolean
			required?: boolean
			readOnly?: boolean
			min?: number | string
			max?: number | string
			step?: number | string
			size?: number
			multiple?: boolean
			accept?: string
			list?: string
			capture?: boolean | 'user' | 'environment' | (string & {})
			autoComplete?: string
			autoCorrect?: 'on' | 'off' | (string & {})
			autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | (string & {})
			spellCheck?: boolean | 'true' | 'false' | (string & {})
			pattern?: string
			maxLength?: number
			minLength?: number
			dirName?: string
			// Events
			onInput?: (event: Event) => void
			onChange?: (event: Event) => void
			onSelect?: (event: Event) => void
			onInvalid?: (event: Event) => void
			onReset?: (event: Event) => void
			onSearch?: (event: Event) => void
		}

		interface InputNumber extends InputBase {
			type: 'number' | 'range' | (string & {})
			value?: number
			min?: number
			max?: number
			step?: number
			'update:value'?(value: number): void
		}
		interface InputString extends InputBase {
			type?:
				| 'text'
				| 'password'
				| 'email'
				| 'tel'
				| 'url'
				| 'search'
				| 'date'
				| 'time'
				| 'datetime-local'
				| 'month'
				| 'week'
				| 'color'
				| 'radio'
				| 'file'
				| 'hidden'
				| 'submit'
				| 'reset'
				| 'button'
				| (string & {})
			value?: string
			'update:value'?(value: string): void
		}
		interface InputBoolean extends InputBase {
			type: 'checkbox' | 'radio' | (string & {})
			checked?: boolean
			indeterminate?: boolean
			value?: string
			'update:checked'?(checked?: boolean): void
		}
		// Provide default element-specific attributes for all known HTML tags
		type HTMLTagElementsMap = {
			[K in keyof HTMLElementTagNameMap]?: BaseHTMLAttributes<HTMLElementTagNameMap[K]>
		}

		type BaseSVGAttributes = DataAttributes &
			AriaAttributes &
			MouseReactiveHTMLAttributes & {
				children?: Children
				id?: string
				class?: ClassValue
				style?: StyleInput
				[key: string]: any
			}

		type SVGTagElementsMap = {
			[K in keyof SVGElementTagNameMap]?: BaseSVGAttributes
		}

		type MathMLTagElementsMap = {
			[K in keyof MathMLElementTagNameMap]?: BaseSVGAttributes
		}

		interface ForElementProps<T = any> {
			each: readonly T[]
			children: (item: T, position: MorphPosition) => JSX.Element | null | undefined | false
		}

		type IntrinsicElements = HTMLTagElementsMap &
			SVGTagElementsMap &
			MathMLTagElementsMap & {
				dynamic: BaseHTMLAttributes<HTMLElement> & {
					tag: HTMLElementTag | ComponentFunction | (string & {})
					children?: Children
					[key: string]: any
				}
				env: ElementIntrinsicAttributes<Node | Node[]> & {
					children?: Children
					[key: string]: any
				}
				fragment: ElementIntrinsicAttributes<Node | Node[]> & {
					children?: Children
				}
				for: ElementIntrinsicAttributes<Node[]> & ForElementProps
				try: ElementIntrinsicAttributes<Node[]> & {
					catch?: (error: unknown, reset?: () => void) => JSX.Element
					children?: Children
				}

				// Form Elements
				input:
					| (BaseHTMLAttributes<HTMLInputElement> & InputNumber)
					| (BaseHTMLAttributes<HTMLInputElement> & InputString)
					| (BaseHTMLAttributes<HTMLInputElement> & InputBoolean)

				textarea: BaseHTMLAttributes<HTMLTextAreaElement> & {
					value?: string
					'update:value'?(value: string): void
					placeholder?: string
					disabled?: boolean
					required?: boolean
					readOnly?: boolean
					name?: string
					form?: string
					rows?: number
					cols?: number
					maxLength?: number
					minLength?: number
					dirName?: string
					wrap?: 'soft' | 'hard' | 'off' | (string & {})
					autoComplete?: string
					autoCorrect?: 'on' | 'off' | (string & {})
					autoCapitalize?:
						| 'off'
						| 'none'
						| 'on'
						| 'sentences'
						| 'words'
						| 'characters'
						| (string & {})
					spellCheck?: boolean | 'true' | 'false' | (string & {})
					// Events
					onInput?: (event: Event) => void
					onChange?: (event: Event) => void
					onSelect?: (event: Event) => void
					onInvalid?: (event: Event) => void
				}

				select: BaseHTMLAttributes<HTMLSelectElement> & {
					value?: any
					'update:value'?(value: any): void
					disabled?: boolean
					required?: boolean
					name?: string
					form?: string
					multiple?: boolean
					size?: number
					autoComplete?: string
					// Events
					onChange?: (event: Event) => void
					onSelect?: (event: Event) => void
					onInvalid?: (event: Event) => void
				}

				button: BaseHTMLAttributes<HTMLButtonElement> & {
					type?: 'button' | 'submit' | 'reset' | (string & {})
					disabled?: boolean
					autoFocus?: boolean
					form?: string
					formAction?: string
					formEnctype?: string
					formMethod?: string
					formNoValidate?: boolean
					formTarget?: string
					name?: string
					value?: string
				}

				form: BaseHTMLAttributes<HTMLFormElement> & {
					action?: string
					method?: 'get' | 'post' | 'put' | 'delete' | 'patch' | (string & {})
					enctype?: string
					autoComplete?: string
					noValidate?: boolean
					target?: string
					name?: string
					accept?: string
					acceptCharset?: string
					// Events
					onSubmit?: (event: SubmitEvent) => void
					onReset?: (event: Event) => void
					onInvalid?: (event: Event) => void
				}

				label: BaseHTMLAttributes<HTMLLabelElement> & {
					htmlFor?: string
					form?: string
				}

				fieldset: BaseHTMLAttributes<HTMLFieldSetElement> & {
					disabled?: boolean
					form?: string
					name?: string
				}

				legend: BaseHTMLAttributes<HTMLLegendElement> & {}

				// Media Elements
				img: BaseHTMLAttributes<HTMLImageElement> & {
					src?: string
					alt?: string
					width?: number | string
					height?: number | string
					crossOrigin?: 'anonymous' | 'use-credentials' | (string & {})
					useMap?: string
					isMap?: boolean
					loading?: 'lazy' | 'eager' | (string & {})
					decoding?: 'sync' | 'async' | 'auto' | (string & {})
					// Events
					onLoad?: (event: Event) => void
					onError?: (event: Event) => void
					onAbort?: (event: Event) => void
				}

				video: BaseHTMLAttributes<HTMLVideoElement> & {
					src?: string
					poster?: string
					preload?: 'none' | 'metadata' | 'auto' | (string & {})
					autoplay?: boolean
					loop?: boolean
					muted?: boolean
					controls?: boolean
					width?: number | string
					height?: number | string
					crossOrigin?: 'anonymous' | 'use-credentials' | (string & {})
					playsInline?: boolean
					// Events
					onLoadstart?: (event: Event) => void
					onLoadeddata?: (event: Event) => void
					onLoadedmetadata?: (event: Event) => void
					onCanplay?: (event: Event) => void
					onCanplaythrough?: (event: Event) => void
					onPlay?: (event: Event) => void
					onPlaying?: (event: Event) => void
					onPause?: (event: Event) => void
					onEnded?: (event: Event) => void
					onError?: (event: Event) => void
					onAbort?: (event: Event) => void
					onEmptied?: (event: Event) => void
					onStalled?: (event: Event) => void
					onSuspend?: (event: Event) => void
					onWaiting?: (event: Event) => void
					onDurationchange?: (event: Event) => void
					onTimeupdate?: (event: Event) => void
					onProgress?: (event: Event) => void
					onRatechange?: (event: Event) => void
					onVolumechange?: (event: Event) => void
					onSeeked?: (event: Event) => void
					onSeeking?: (event: Event) => void
				}

				audio: BaseHTMLAttributes<HTMLAudioElement> & {
					src?: string
					preload?: 'none' | 'metadata' | 'auto' | (string & {})
					autoplay?: boolean
					loop?: boolean
					muted?: boolean
					controls?: boolean
					crossOrigin?: 'anonymous' | 'use-credentials' | (string & {})
					// Events
					onLoadstart?: (event: Event) => void
					onLoadeddata?: (event: Event) => void
					onLoadedmetadata?: (event: Event) => void
					onCanplay?: (event: Event) => void
					onCanplaythrough?: (event: Event) => void
					onPlay?: (event: Event) => void
					onPlaying?: (event: Event) => void
					onPause?: (event: Event) => void
					onEnded?: (event: Event) => void
					onError?: (event: Event) => void
					onAbort?: (event: Event) => void
					onEmptied?: (event: Event) => void
					onStalled?: (event: Event) => void
					onSuspend?: (event: Event) => void
					onWaiting?: (event: Event) => void
					onDurationchange?: (event: Event) => void
					onTimeupdate?: (event: Event) => void
					onProgress?: (event: Event) => void
					onRatechange?: (event: Event) => void
					onVolumechange?: (event: Event) => void
					onSeeked?: (event: Event) => void
					onSeeking?: (event: Event) => void
				}

				// Interactive Elements
				a: BaseHTMLAttributes<HTMLAnchorElement> & {
					href?: string
					target?: '_blank' | '_self' | '_parent' | '_top' | string
					rel?: string
					download?: string
					hrefLang?: string
					type?: string
					referrerPolicy?: string
				}

				// Additional HTML elements with notable attributes
				dialog: BaseHTMLAttributes<HTMLDialogElement> & {
					open?: boolean
					onCancel?: (event: Event) => void
					onClose?: (event: Event) => void
				}

				details: BaseHTMLAttributes<HTMLDetailsElement> & {
					open?: boolean
					onToggle?: (event: Event) => void
				}

				track: BaseHTMLAttributes<HTMLTrackElement> & {
					default?: boolean
					kind?: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata' | (string & {})
					src?: string
					srclang?: string
					label?: string
				}

				script: BaseHTMLAttributes<HTMLScriptElement> & {
					src?: string
					type?: string
					async?: boolean
					defer?: boolean
					nomodule?: boolean
					crossOrigin?: 'anonymous' | 'use-credentials' | (string & {})
					integrity?: string
					referrerPolicy?: string
					onLoad?: (event: Event) => void
					onError?: (event: Event) => void
				}

				iframe: BaseHTMLAttributes<HTMLIFrameElement> & {
					src?: string
					srcDoc?: string
					name?: string
					width?: number | string
					height?: number | string
					allow?: string
					sandbox?: string
					loading?: 'eager' | 'lazy' | (string & {})
					referrerPolicy?: string
					allowFullScreen?: boolean
					onLoad?: (event: Event) => void
					onError?: (event: Event) => void
				}

				ol: BaseHTMLAttributes<HTMLOListElement> & {
					reversed?: boolean
					start?: number
					type?: '1' | 'a' | 'A' | 'i' | 'I' | (string & {})
				}

				option: BaseHTMLAttributes<HTMLOptionElement> & {
					disabled?: boolean
					selected?: boolean
					label?: string
					value?: string
				}

				optgroup: BaseHTMLAttributes<HTMLOptGroupElement> & {
					disabled?: boolean
					label?: string
				}

				progress: BaseHTMLAttributes<HTMLProgressElement> & {
					value?: number | string
					max?: number | string
				}

				meter: BaseHTMLAttributes<HTMLMeterElement> & {
					value?: number | string
					min?: number | string
					max?: number | string
					low?: number | string
					high?: number | string
					optimum?: number | string
				}

				link: BaseHTMLAttributes<HTMLLinkElement> & {
					rel?: string
					href?: string
					as?: string
					crossOrigin?: 'anonymous' | 'use-credentials' | (string & {})
					disabled?: boolean
					fetchPriority?: 'high' | 'low' | 'auto' | (string & {})
					imageSizes?: string
					imageSrcSet?: string
					media?: string
					referrerPolicy?: string
					integrity?: string
					type?: string
					sizes?: string
					onLoad?: (event: Event) => void
					onError?: (event: Event) => void
				}

				source: BaseHTMLAttributes<HTMLSourceElement> & {
					src?: string
					type?: string
					srcSet?: string
					sizes?: string
					media?: string
				}

				area: BaseHTMLAttributes<HTMLAreaElement> & {
					alt?: string
					coords?: string
					download?: string | boolean
					href?: string
					rel?: string
					shape?: 'rect' | 'circle' | 'poly' | 'default' | (string & {})
					target?: string
					referrerPolicy?: string
				}

				map: BaseHTMLAttributes<HTMLMapElement> & {
					name?: string
				}

				canvas: BaseHTMLAttributes<HTMLCanvasElement> & {
					width?: number | string
					height?: number | string
				}

				col: BaseHTMLAttributes<HTMLTableColElement> & { span?: number }
				colgroup: BaseHTMLAttributes<HTMLTableColElement> & { span?: number }
				/* thead/tbody/tfoot/tr omitted since they add no extra attributes */
				th: BaseHTMLAttributes<HTMLTableCellElement> & {
					abbr?: string
					colSpan?: number
					rowSpan?: number
					headers?: string
					scope?: 'row' | 'col' | 'rowgroup' | 'colgroup' | 'auto' | (string & {})
				}
				td: BaseHTMLAttributes<HTMLTableCellElement> & {
					colSpan?: number
					rowSpan?: number
					headers?: string
				}

				slot: BaseHTMLAttributes<HTMLSlotElement> & { name?: string }
			}
		type HTMLAttributes<tag extends keyof HTMLElementTagNameMap> = Omit<
			IntrinsicElements[tag],
			'children'
		>
		type HTMLElementTag = keyof HTMLElementTagNameMap
	}
}

export type { JSX }

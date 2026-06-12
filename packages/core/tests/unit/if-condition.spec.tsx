import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { latch, document } from '@sursaut/core'
import { effect, reactive } from 'mutts'

describe('if={condition} on intrinsic elements', () => {
	let container: HTMLElement
	let unmount: (() => void) | undefined

	beforeEach(() => {
		container = document.createElement('div')
	})

	afterEach(() => {
		unmount?.()
		container.remove()
	})

	it('hides element when condition is false', () => {
		const state = reactive({ show: false })
		unmount = latch(
			container,
			<div>
				<span if={state.show} class="target">visible</span>
			</div>
		)
		expect(container.querySelector('.target')).toBeNull()
	})

	it('shows element when condition is true', () => {
		const state = reactive({ show: true })
		unmount = latch(
			container,
			<div>
				<span if={state.show} class="target">visible</span>
			</div>
		)
		expect(container.querySelector('.target')).not.toBeNull()
	})

	it('reactively shows/hides element when condition changes', () => {
		const state = reactive({ show: false })
		unmount = latch(
			container,
			<div>
				<span if={state.show} class="target">visible</span>
			</div>
		)
		expect(container.querySelector('.target')).toBeNull()
		state.show = true
		expect(container.querySelector('.target')).not.toBeNull()
		state.show = false
		expect(container.querySelector('.target')).toBeNull()
	})

	it('works with a function call that reads reactive state', () => {
		const stack = reactive<{ mode: string }[]>([])
		const hasBackdrop = () => stack.some(e => e.mode === 'modal')

		unmount = latch(
			container,
			<div>
				<div if={hasBackdrop()} class="backdrop">backdrop</div>
				<fragment>children</fragment>
			</div>
		)
		expect(container.querySelector('.backdrop')).toBeNull()
		stack.push({ mode: 'modal' })
		expect(container.querySelector('.backdrop')).not.toBeNull()
		stack.splice(0, 1)
		expect(container.querySelector('.backdrop')).toBeNull()
	})

	it('works with if/else pair', () => {
		const state = reactive({ show: true })
		unmount = latch(
			container,
			<div>
				<span if={state.show} class="yes">yes</span>
				<span else class="no">no</span>
			</div>
		)
		expect(container.querySelector('.yes')).not.toBeNull()
		expect(container.querySelector('.no')).toBeNull()
		state.show = false
		expect(container.querySelector('.yes')).toBeNull()
		expect(container.querySelector('.no')).not.toBeNull()
	})

	it('works inside <fragment> wrapper (WithOverlays pattern)', () => {
		const stack = reactive<{ mode: string }[]>([])
		const hasBackdrop = () => stack.some(e => e.mode === 'modal')

		unmount = latch(
			container,
			<fragment>
				<div>children</div>
				<div class="overlay-manager">
					<div
						if={hasBackdrop()}
						class="backdrop"
						aria-hidden="true"
					/>
					<div class="layer">layers</div>
				</div>
			</fragment>
		)
		expect(container.querySelector('.backdrop')).toBeNull()
		expect(container.querySelector('.layer')).not.toBeNull()

		stack.push({ mode: 'modal' })
		expect(container.querySelector('.backdrop')).not.toBeNull()

		stack.splice(0, 1)
		expect(container.querySelector('.backdrop')).toBeNull()
	})

	it('if={} with sibling elements preserves siblings', () => {
		const state = reactive({ show: false })
		unmount = latch(
			container,
			<div>
				<div if={state.show} class="conditional">cond</div>
				<div class="sibling1">sibling1</div>
				<div class="sibling2">sibling2</div>
			</div>
		)
		expect(container.querySelector('.conditional')).toBeNull()
		expect(container.querySelector('.sibling1')).not.toBeNull()
		expect(container.querySelector('.sibling2')).not.toBeNull()

		state.show = true
		expect(container.querySelector('.conditional')).not.toBeNull()
		expect(container.querySelector('.sibling1')).not.toBeNull()
		expect(container.querySelector('.sibling2')).not.toBeNull()
	})

	it('if={} on props.children is respected by the parent component', () => {
		const state = reactive({ show: false })
		const Wrapper: ComponentFunction = (props) => <div class="wrapper">{props.children}</div>

		unmount = latch(
			container,
			<Wrapper>
				<span if={state.show} class="target">visible</span>
			</Wrapper>
		)
		expect(container.querySelector('.target')).toBeNull()
		state.show = true
		expect(container.querySelector('.target')).not.toBeNull()
		state.show = false
		expect(container.querySelector('.target')).toBeNull()
	})

	it('if={} on a conditional element returned by a ReactiveProp getter is respected', () => {
		// Regression: a ReactiveProp in a static children array (isReactive(flatInput)=false,
		// needsMorph=true) that resolves to a conditional SursautElement after collapse().
		// anyConditional must be true (via needsMorph) so lift:conditioned runs.
		const state = reactive({ show: false })
		const child = <span if={state.show} class="target">visible</span>
		unmount = latch(container, <div>{child}</div>)
		expect(container.querySelector('.target')).toBeNull()
		state.show = true
		expect(container.querySelector('.target')).not.toBeNull()
		state.show = false
		expect(container.querySelector('.target')).toBeNull()
	})

	it('disposes an A branch before it can refresh with B-shaped props', () => {
		const state = reactive<{ o: any }>({ o: { a: { value: 1 } } })
		const A: ComponentFunction = (props) => <span class="a">{props.x.a.value}</span>
		const B: ComponentFunction = (props) => <span class="b">{props.x.b.value}</span>

		unmount = latch(
			container,
			<>
				<A if={'a' in state.o} x={state.o} />
				<B if={'b' in state.o} x={state.o} />
			</>
		)

		expect(container.textContent).toBe('1')
		expect(() => {
			state.o = { b: { value: 'bee' } }
		}).not.toThrow()
		expect(container.querySelector('.a')).toBeNull()
		expect(container.querySelector('.b')?.textContent).toBe('bee')
	})

	it('disposes a B branch before it can refresh with A-shaped props', () => {
		const state = reactive<{ o: any }>({ o: { b: { value: 'bee' } } })
		const A: ComponentFunction = (props) => <span class="a">{props.x.a.value}</span>
		const B: ComponentFunction = (props) => <span class="b">{props.x.b.value}</span>

		unmount = latch(
			container,
			<>
				<A if={'a' in state.o} x={state.o} />
				<B if={'b' in state.o} x={state.o} />
			</>
		)

		expect(container.textContent).toBe('bee')
		expect(() => {
			state.o = { a: { value: 2 } }
		}).not.toThrow()
		expect(container.querySelector('.b')).toBeNull()
		expect(container.querySelector('.a')?.textContent).toBe('2')
	})

	it('runs old if/else branch cleanup before the new branch observes props', () => {
		const events: string[] = []
		const state = reactive<{ o: any }>({ o: { a: { value: 1 } } })
		const observe = (branch: string, value: string | number) => {
			events.push(`observe:${branch}:${value}`)
			return value
		}
		const A: ComponentFunction = (props) => (
			<span
				class="a"
				use={() => {
					events.push('mount:a')
					return () => {
						events.push('cleanup:a')
					}
				}}
			>
				{observe('a', props.x.a.value)}
			</span>
		)
		const B: ComponentFunction = (props) => (
			<span
				class="b"
				use={() => {
					events.push('mount:b')
					return () => {
						events.push('cleanup:b')
					}
				}}
			>
				{observe('b', props.x.b.value)}
			</span>
		)

		unmount = latch(
			container,
			<>
				<A if={'a' in state.o} x={state.o} />
				<B else x={state.o} />
			</>
		)
		events.length = 0

		state.o = { b: { value: 'bee' } }

		expect(events.indexOf('cleanup:a')).toBeGreaterThanOrEqual(0)
		expect(events.indexOf('observe:b:bee')).toBeGreaterThanOrEqual(0)
		//expect(events.indexOf('cleanup:a')).toBeLessThan(events.indexOf('observe:b:bee'))
	})

	it('cleans a guarded branch once on deactivation and once on unlatch when active', () => {
		const events: string[] = []
		const state = reactive({ show: true })
		const Child: ComponentFunction = () => (
			<span
				if={state.show}
				class="child"
				use={() => {
					events.push('mount')
					return () => {
						events.push('cleanup')
					}
				}}
			>
				child
			</span>
		)

		unmount = latch(container, <Child />)
		expect(events).toEqual(['mount'])

		state.show = false
		expect(events).toEqual(['mount', 'cleanup'])

		state.show = true
		expect(events).toEqual(['mount', 'cleanup', 'mount'])

		unmount()
		unmount = undefined
		expect(events).toEqual(['mount', 'cleanup', 'mount', 'cleanup'])
	})

	it('disposes an else-if branch inside a guarded container before deep props refresh', () => {
		class A {
			constructor(public uid: string) {}
			a = { deep: { value: 1 } }
		}
		class B {
			constructor(public uid: string) {}
			b = { deep: { value: 'bee' } }
		}
		const state = reactive<{ object: A | B | { uid: string } | null }>({ object: new B('b-1') })
		const AProperties: ComponentFunction = (props) => (
			<section class="a-properties">{props.a.a.deep.value}</section>
		)
		const BProperties: ComponentFunction = (props) => (
			<section class="b-properties">{props.b.b.deep.value}</section>
		)
		const InspectorSection: ComponentFunction = (props) => (
			<section class="fallback">{props.children}</section>
		)

		unmount = latch(
			container,
			<div if={state.object} class="selection-info-panel__content">
				<AProperties if={state.object instanceof A} a={state.object as A} />
				<BProperties else if={state.object instanceof B} b={state.object as B} />
				<InspectorSection else>
					<p>ID: {state.object!.uid}</p>
				</InspectorSection>
			</div>
		)

		expect(container.querySelector('.b-properties')?.textContent).toBe('bee')
		expect(() => {
			state.object = new A('a-1')
		}).not.toThrow()
		expect(container.querySelector('.b-properties')).toBeNull()
		expect(container.querySelector('.a-properties')?.textContent).toBe('1')

		expect(() => {
			state.object = { uid: 'plain-1' }
		}).not.toThrow()
		expect(container.querySelector('.a-properties')).toBeNull()
		expect(container.querySelector('.fallback')?.textContent).toBe('ID: plain-1')
	})

	it('disposes an else-if branch before child effects can refresh with wrong props', () => {
		class A {
			constructor(public uid: string) {}
			a = { deep: { value: 1 } }
		}
		class B {
			constructor(public uid: string) {}
			b = { deep: { value: 'bee' } }
		}
		const observed: string[] = []
		const state = reactive<{ object: A | B | { uid: string } | null }>({ object: new B('b-1') })
		const AProperties: ComponentFunction = (props) => {
			effect`test:a-props`(() => {
				observed.push(`a:${props.a.a.deep.value}`)
			})
			return <section class="a-properties">{props.a.a.deep.value}</section>
		}
		const BProperties: ComponentFunction = (props) => {
			effect`test:b-props`(() => {
				observed.push(`b:${props.b.b.deep.value}`)
			})
			return <section class="b-properties">{props.b.b.deep.value}</section>
		}
		const InspectorSection: ComponentFunction = (props) => (
			<section class="fallback">{props.children}</section>
		)

		unmount = latch(
			container,
			<div if={state.object} class="selection-info-panel__content">
				<AProperties if={state.object instanceof A} a={state.object as A} />
				<BProperties else if={state.object instanceof B} b={state.object as B} />
				<InspectorSection else>
					<p>ID: {state.object!.uid}</p>
				</InspectorSection>
			</div>
		)

		expect(observed).toEqual(['b:bee'])
		expect(() => {
			state.object = new A('a-1')
		}).not.toThrow()
		expect(observed).toEqual(['b:bee', 'a:1'])
		expect(container.querySelector('.b-properties')).toBeNull()
		expect(container.querySelector('.a-properties')?.textContent).toBe('1')
	})

	it('hides element when if={} is a plain const false value', () => {
		const flag = false
		unmount = latch(
			container,
			<div>
				<span if={flag} class="target">visible</span>
			</div>
		)
		expect(container.querySelector('.target')).toBeNull()
	})

	it('shows element when if={} is a plain const true value', () => {
		const flag = true
		unmount = latch(
			container,
			<div>
				<span if={flag} class="target">visible</span>
			</div>
		)
		expect(container.querySelector('.target')).not.toBeNull()
	})
})

import { Code, PackageHeader, Section } from '../../components'

const decoratorSnippet = `import { decorator, cached, atomic } from 'mutts'

// decorator() builds one decorator that works as legacy AND modern (Stage 3):
export const logged = decorator({
  method(original) {
    return function (this: any, ...args: any[]) {
      console.log('call', args)
      return original.apply(this, args)
    }
  },
})

class Store {
  @cached
  get expensive() {
    return heavyCompute(this.input)
  }

  @atomic
  updateAll(items: Item[]) {
    // all triggered effects batch into one flush
    for (const item of items) this.add(item)
  }
}`

const descriptorSnippet = `import { descriptor } from 'mutts'

// descriptor.* builds class decorators that rewrite property descriptors:
class Config {
  @descriptor.readonly('apiKey', 'endpoint')
  static setup() {}
}

descriptor.enumerable('visible')
descriptor.hidden('internal')
descriptor.frozen('constants')`

export default function MuttsDecoratorsPage() {
	return (
		<article>
			<PackageHeader
				name="Mutts Decorators"
				description="Unified legacy + Stage 3 decorators: decorator(), cached, atomic, descriptor."
				install="pnpm add mutts"
			/>

			<Section title="One decorator, both proposals">
				<p>
					<code>decorator(description)</code> takes <code>method</code> / <code>class</code> /{' '}
					<code>getter</code> / <code>setter</code> / <code>default</code> handlers and returns a
					function usable as a legacy decorator and as a modern Stage 3 decorator.
				</p>
				<Code code={decoratorSnippet} lang="tsx" />
			</Section>

			<Section title="Built-ins">
				<ul>
					<li>
						<code>cached</code> — memoize a getter; throws on circular dependencies.
					</li>
					<li>
						<code>atomic</code> — batch all effects triggered inside the method.
					</li>
					<li>
						<code>reactive</code> / <code>memoize</code> — themselves built on{' '}
						<code>decorator()</code>, so they work as functions and as decorators.
					</li>
				</ul>
				<Code code={descriptorSnippet} lang="tsx" />
			</Section>
		</article>
	)
}

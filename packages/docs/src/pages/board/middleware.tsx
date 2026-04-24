import { Code, PackageHeader, Section } from '../../components'

const middlewareSnippet = `// routes/api/common.ts
import type { Middleware } from '@sursaut/board/server'

export const middleware: Middleware[] = [
  async (ctx, next) => {
    const start = performance.now()
    const res = await next()
    console.log(\`Execution time: \${performance.now() - start}ms\`)
    return res
  }
]`

const interceptorSnippet = `import { intercept } from '@sursaut/board'

intercept('/api/**', async (req, next) => {
  req.headers.set('X-App-ID', 'demo-app')
  const res = await next(req)
  return res
})`

export default function BoardMiddlewarePage() {
	return (
		<article>
			<PackageHeader
				name="Middleware & Interceptors"
				description="Control the request lifecycle with hierarchical server middleware and universal client interceptors."
				install={false}
			/>

			<Section title="Hierarchical Middleware">
				<p>
					Server-side middleware is defined in <code>common.ts</code> files and inherited by all
					descendant routes. Execution follows the <strong>Ancestor → Descendant</strong> order.
				</p>
				<Code code={middlewareSnippet} lang="tsx" />
			</Section>

			<Section title="Universal Interceptors">
				<p>
					Interceptors are the client-side counterpart to middleware. They wrap the{' '}
					<code>api()</code> client and work identically across SSR dispatch and browser fetch.
				</p>
				<Code code={interceptorSnippet} lang="tsx" />
				<ul>
					<li>
						<strong>Match patterns</strong>: Supports exact paths, globs (<code>**</code>), or
						RegExp.
					</li>
					<li>
						<strong>SSR Aware</strong>: Headers set in interceptors are passed to server-side
						handlers during SSR dispatch.
					</li>
					<li>
						<strong>Modification</strong>: Interceptors use the <code>SursautResponse</code> class,
						which allows modifying bodies multiple times.
					</li>
				</ul>
			</Section>

			<Section title="Request Context">
				<p>
					The <code>RequestContext</code> object is shared across the entire middleware chain and
					the final route handler, enabling easy state propagation (e.g., auth users, trace IDs).
				</p>
			</Section>
		</article>
	)
}

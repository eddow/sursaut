import { ApiTable, Code, PackageHeader, Section } from '../../components'

const factorySnippet = `// Browser — auto-configured with fetch
import { api, defineRoute } from '@sursaut'

// Inline — quick one-off calls
const user = await api('/users/[id]').get({ id: '123' })

// Reusable callable endpoints (recommended)
const users = {
  byId:  defineRoute('/users/[id]'),
  list:  defineRoute('/users', {
    assert: (p: { page?: number }) => ({ page: String(p.page ?? 1) })
  }),
}

const alice = await users.byId({ id: '123' }).get()
const page2 = await users.list({ page: 2 }).get()
await users.byId({ id: '123' }).delete()

// POST with body (path only, no params)
const created = await api('/users').post({ name: 'Alice' })`

const interceptorSnippet = `import { intercept } from '@sursaut'

// Global interceptor for all /api/** requests
intercept('/api/**', async (req, next) => {
  // Add auth header
  const authReq = new Request(req, {
    headers: { ...req.headers, Authorization: 'Bearer ...' }
  })
  
  const res = await next(authReq)
  
  // Log status
  console.log(\`\${req.method} \${req.url} -> \${res.status}\`)
  return res
})`

const ssrSnippet = `// Server-side (Node.js) — uses smart executor
import { api } from '@sursaut/kit'
import { withSSR } from '@sursaut/kit'

// SSR: API calls are tracked for hydration
const { result, context } = await withSSR(async () => {
  return renderApp()
})`

export default function KitApiPage() {
	return (
		<article>
			<PackageHeader
				name="@sursaut/kit"
				description="Lightweight, type-safe API client with SSR hydration and interceptor support."
				install="pnpm add @sursaut/kit"
			/>

			<Section title="API Client">
				<p>
					The API client is built on top of the native <code>Request</code> and{' '}
					<code>Response</code> APIs. It supports path parameter inference, automatic JSON
					serialization, and retries.
				</p>
				<Code code={factorySnippet} lang="tsx" />
			</Section>

			<Section title="Two Patterns">
				<p>You can use the API client in two ways:</p>
				<ul>
					<li>
						<strong>Inline paths</strong> — quick one-off calls with <code>api('/path')</code>
					</li>
					<li>
						<strong>Callable endpoints</strong> — reusable, type-safe routes with{' '}
						<code>defineRoute</code>
					</li>
				</ul>
				<Code
					code={`
// Inline — good for one-off calls
const user = await api('/users/[id]').get({ id: '123' })

// Callable endpoints — reusable and type-safe
const users = {
  byId: defineRoute('/users/[id]'),
  list: defineRoute('/users', {
    assert: (p: { page?: number }) => ({ page: String(p.page ?? 1) })
  }),
}

const alice = await users.byId({ id: '123' }).get()
const page2 = await users.list({ page: 2 }).get()
await users.byId({ id: '123' }).delete()
				`}
					lang="tsx"
				/>
			</Section>

			<Section title="Interceptors">
				<p>
					Interceptors allow you to transform requests and responses globaly or within a specific
					request context. They follow a middleware pattern.
				</p>
				<Code code={interceptorSnippet} lang="tsx" />
			</Section>

			<Section title="SSR Hydration">
				<p>
					When SSR is enabled, the client automatically tracks all <code>GET</code> requests. The
					data is collected and can be injected into the client-side page, allowing the client-side
					API client to "hydrate" the data instantly without a second network request.
				</p>
				<Code code={ssrSnippet} lang="tsx" />
			</Section>

			<Section title="API Reference">
				<ApiTable
					props={[
						{
							name: 'api(path)',
							type: 'function',
							description:
								'Creates a request builder for a path string. Call .get(params?), .post(body), .put(body), .delete(params?), .patch(body) on the result.',
						},
						{
							name: 'defineRoute(path, schema?)',
							type: 'function',
							description:
								'Returns a callable endpoint: call it with params to get a request builder directly. Optionally validates query params via schema.assert().',
						},
						{
							name: 'intercept(pattern, handler)',
							type: 'function',
							description:
								'Registers a global interceptor matching a URL pattern or regex. Returns an unsubscribe function.',
						},
						{
							name: 'SursautResponse',
							type: 'class',
							description: 'Extended Response with .json<T>() typing and .hydrated for SSR data.',
						},
						{
							name: 'ApiError',
							type: 'class',
							description:
								'Error subclass thrown on non-2xx responses. Contains status, statusText, and response data.',
						},
					]}
				/>
			</Section>
		</article>
	)
}

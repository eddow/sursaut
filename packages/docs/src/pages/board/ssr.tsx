import { Code, PackageHeader, Section } from '../../components'

const hydrationSnippet = `import { api } from '@sursaut/board'

// On Server: Fetches and stores in context
// On Client (First Load): Reads from <script> tag (no network)
// On Client (Nav): Performs standard fetch
const data = await api('/api/users').get()`

const smartPromiseSnippet = `const req = api('/user').get()

const state = reactive({ 
  user: req.hydrated // Instant T | undefined if already in cache
})

if (!state.user) {
  req.then(u => state.user = u)
}`

export default function BoardSsrPage() {
	return (
		<article>
			<PackageHeader
				name="SSR & Hydration"
				description="First-class server-side rendering with automatic data collection and zero-config hydration."
				install={false}
			/>

			<Section title="The Reactive Pipeline">
				<p>
					Board uses a unique <strong>Reactive Rendering Pipeline</strong> that handles asynchronous
					data dependencies automatically during server rendering.
				</p>
				<ol>
					<li>The renderer mounts the component into a virtual DOM.</li>
					<li>
						Any <code>api()</code> calls register promises with the SSR context.
					</li>
					<li>
						The renderer waits for all promises to resolve, then executes another reactive pass if
						state has changed.
					</li>
					<li>Once the state stabilizes, the final HTML is generated and sent to the browser.</li>
				</ol>
			</Section>

			<Section title="Hydration">
				<p>
					Data fetched during SSR is serialized into deterministic <code>&lt;script&gt;</code> tags.
					On the client, the <code>api()</code> client automatically detects these tags and hydrates
					the state instantly, preventing an unnecessary "second fetch" on the browser.
				</p>
				<Code code={hydrationSnippet} lang="tsx" />
			</Section>

			<Section title="Smart Promises">
				<p>
					The result of <code>api().get()</code> is a <strong>Smart Promise</strong>. It exposes a{' '}
					<code>.hydrated</code> property which is populated immediately if the data is already
					available from SSR or the local cache.
				</p>
				<Code code={smartPromiseSnippet} lang="tsx" />
			</Section>

			<Section title="CSS Injection">
				<p>
					Styles generated via <code>css</code> templates are automatically collected during the
					server render pass and injected into the <code>&lt;head&gt;</code>.
				</p>
			</Section>
		</article>
	)
}

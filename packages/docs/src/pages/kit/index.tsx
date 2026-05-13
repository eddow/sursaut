import { Code, PackageHeader, Section } from '../../components'

const routerExample = `import { Router, A } from '@sursaut'

const routes = [
  { path: '/', view: HomePage },
  { path: '/about', view: AboutPage },
  { path: '/users/[id]', view: UserPage },
]

function App() {
  return (
    <>
      <nav>
        <A href="/">Home</A>
        <A href="/about">About</A>
      </nav>
      <Router
        routes={routes}
        notFound={({ url }) => <h1>404: {url}</h1>}
      />
    </>
  )
}`

const clientExample = `import { client } from '@sursaut'

// client is a reactive object with browser state:
client.url.pathname    // current URL path
client.url.search      // query string
client.prefersDark     // prefers-color-scheme: dark
client.language        // navigator.language
client.direction       // 'ltr' | 'rtl'

// Navigate programmatically:
client.navigate('/about')`

const storedExample = `import { stored } from '@sursaut'

// stored() creates a reactive value backed by localStorage.
// Changes persist across page reloads.

const theme = stored('theme', 'light')
theme.value = 'dark' // saved to localStorage['theme']`

const intlExample = `import { Number, Date, RelativeTime } from '@sursaut/kit'

// Intl components render formatted text nodes — no wrapper elements.
<Number value={1234.56} style="currency" currency="EUR" />
// → "€1,234.56"

<Date value={new Date()} dateStyle="long" />
// → "February 10, 2026"

<RelativeTime value={-3} unit="day" />
// → "3 days ago"`

export default function KitPage() {
	return (
		<article>
			<PackageHeader
				name="@sursaut/kit"
				description="Router, client state, storage, Intl formatting, and API utilities."
			/>

			<p>
				<code>@sursaut/kit</code> provides the application-level tools that sit between the core
				framework and UI components: routing, browser state, persistent storage,
				internationalization, and API helpers.
			</p>

			<Section title="Router">
				<p>
					Client-side router with reactive URL matching, parameter extraction, and SPA navigation
					via <code>{'<A>'}</code> links.
				</p>
				<Code code={routerExample} lang="tsx" />
			</Section>

			<Section title="Client State">
				<p>
					<code>client</code> is a reactive object exposing browser state. Read any property in JSX
					and it updates automatically.
				</p>
				<Code code={clientExample} lang="tsx" />
			</Section>

			<Section title="Persistent Storage">
				<p>
					<code>stored()</code> creates a reactive value backed by <code>localStorage</code>.
				</p>
				<Code code={storedExample} lang="tsx" />
			</Section>

			<Section title="Intl Components">
				<p>Six Intl formatting components that render text nodes directly — no wrapper elements.</p>
				<Code code={intlExample} lang="tsx" />
			</Section>

			<Section title="Topics">
				<ul>
					<li>
						Router — route definitions, params, guards, <code>{'<A>'}</code>
					</li>
					<li>Client — browser state, navigation, media queries</li>
					<li>Intl — Number, Date, RelativeTime, List, Plural, DisplayNames</li>
					<li>
						Storage — <code>stored()</code> reactive localStorage
					</li>
					<li>API — fetch utilities, validation with arktype</li>
				</ul>
			</Section>
		</article>
	)
}

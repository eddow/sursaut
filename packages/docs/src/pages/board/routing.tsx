import { Code, PackageHeader, Section } from '../../components'

const structureSnippet = `routes/
├── index.tsx          # /
├── about/
│   └── index.tsx      # /about
├── users/
│   ├── [id].tsx       # /users/123
│   └── [...slug].tsx  # /users/any/path/here
└── common.ts          # Root middleware`

const layoutSnippet = `// routes/common.tsx (Root Layout)
export default function Layout({ children }) {
  return (
    <div class="app-container">
      <nav>...</nav>
      <main>{children}</main>
    </div>
  )
}`

const crossPackageRouting = `Cross-package routing split:

@sursaut/kit
  route patterns, matching, links, SPA Router semantics

@sursaut/board
  file-system discovery, inherited layouts, SSR integration, route module loading

Board does not replace Kit's route concepts.
It packages them behind filesystem conventions.`

export default function BoardRoutingPage() {
	return (
		<article>
			<PackageHeader
				name="Board Routing"
				description="File-based routing with support for dynamic segments, catch-all routes, and inherited layouts."
				install={false}
			/>

			<Section title="How Board Fits the Routing Stack">
				<p>
					Board is the full-stack routing layer. It builds on the same route ideas as Kit, then adds
					filesystem conventions, layout inheritance, and SSR integration.
				</p>
				<Code code={crossPackageRouting} lang="text" />
			</Section>

			<Section title="Directory Conventions">
				<p>
					Routes are discovered automatically from the <code>routes/</code> directory. Files ending
					in <code>.tsx</code> are treated as page components.
				</p>
				<Code code={structureSnippet} lang="text" />
			</Section>

			<Section title="Route Segments">
				<ul>
					<li>
						<strong>Static</strong>: Standard filenames (e.g., <code>about.tsx</code>).
					</li>
					<li>
						<strong>Dynamic</strong>: Wrapping a name in brackets (e.g., <code>[id].tsx</code>)
						creates a parameter available in the request context.
					</li>
					<li>
						<strong>Catch-All</strong>: Using three dots (e.g., <code>[...slug].tsx</code>) matches
						all remaining path segments.
					</li>
					<li>
						<strong>Groups</strong>: Folders wrapped in parentheses (e.g.,{' '}
						<code>(auth)/login.tsx</code>) are excluded from the URL path, allowing for organized
						groupings.
					</li>
				</ul>
			</Section>

			<Section title="Layout Inheritance">
				<p>
					A <code>common.tsx</code> file in any directory acts as a <strong>Layout</strong>. It
					wraps all routes in that directory and its subdirectories. Layouts nest automatically from
					root to leaf.
				</p>
				<Code code={layoutSnippet} lang="tsx" />
			</Section>

			<Section title="Matching Priority">
				<ol>
					<li>
						<strong>Static</strong> matches take precedence.
					</li>
					<li>
						<strong>Dynamic</strong> segments match next.
					</li>
					<li>
						<strong>Catch-All</strong> routes are the final fallback.
					</li>
				</ol>
			</Section>
		</article>
	)
}

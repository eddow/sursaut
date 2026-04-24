import { PackageHeader, Section } from '../../components'

export default function BoardIndexPage() {
	return (
		<article>
			<p class="docs-board-banner" role="note">
				<strong>Experimental:</strong> <code>@sursaut/board</code> is not in the current npm release
				wave — the package is under a full rework. These pages describe direction and APIs in flux,
				not a stable install target.
			</p>
			<PackageHeader
				name="@sursaut/board"
				description="A type-safe, scaleable meta-framework for Sursaut applications. Automated routing, SSR, and middleware integration."
				install={false}
			/>

			<Section title="Philosophy">
				<p>
					Board is designed to be the "glue" that brings Sursaut Core, Kit, and UI together into a
					cohesive application framework. It follows an <strong>Automated Integration</strong>{' '}
					philosophy: unlike many libraries that require manual wiring of routes and middleware,
					Board uses file-based conventions to handle the heavy lifting for you.
				</p>
			</Section>

			<Section title="Core Features">
				<ul>
					<li>
						🚀 <strong>File-Based Routing</strong>: Zero-config route registration via directory
						structure.
					</li>
					<li>
						💧 <strong>First-Class SSR</strong>: Automatic data hydration and CSS injection.
					</li>
					<li>
						🔗 <strong>Universal API Client</strong>: Seamless data fetching that works identically
						on server and client.
					</li>
					<li>
						🛡️ <strong>Middleware Inheritance</strong>: Hierarchical middleware system for robust
						request handling.
					</li>
					<li>
						📦 <strong>Type-Safe Proxies</strong>: Easy integration with external APIs via typed
						proxy clients.
					</li>
				</ul>
			</Section>

			<Section title="Package Structure">
				<p>
					Board is split into three main entry points to ensure optimal bundle sizes and environment
					safety:
				</p>
				<ul>
					<li>
						<code>@sursaut/board</code>: Universal types and utilities.
					</li>
					<li>
						<code>@sursaut/board/server</code>: Server-only router and Hono adapters.
					</li>
					<li>
						<code>@sursaut/board/client</code>: Hydration logic and browser-specific helpers.
					</li>
				</ul>
			</Section>
		</article>
	)
}

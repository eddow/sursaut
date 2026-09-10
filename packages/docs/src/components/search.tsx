import { A } from '@sursaut'
import { reactive } from 'mutts'
import { type NavLink, navigation } from '../nav-index'

// Full-text index over nav titles + section titles + page headings/snippets.
// Headings/snippets are extracted from page sources at build time by
// sandbox/docs-index.ts into src/search-index.ts (generated, gitignored).
import { pageIndex } from '../search-index'

interface SearchState {
	query: string
	results: NavLink[]
}

interface SearchProps {
	onNavigate?: () => void
}

export default function Search({ onNavigate }: SearchProps) {
	const state = reactive<SearchState>({
		query: '',
		get results() {
			if (!this.query) return []
			const q = this.query.toLowerCase()
			const scored: { link: NavLink; score: number }[] = []

			for (const section of navigation) {
				for (const link of section.links) {
					const title = link.title.toLowerCase()
					const sectionTitle = section.title.toLowerCase()
					let score = -1
					if (title.includes(q)) score = title.startsWith(q) ? 0 : 1
					else if (sectionTitle.includes(q)) score = 2
					else {
						// Full-text: headings + snippets of the target page.
						const entry = pageIndex[link.href]
						if (entry) {
							const hay = `${entry.headings.join('\n')}\n${entry.snippets.join('\n')}`.toLowerCase()
							if (hay.includes(q)) score = 3
						}
					}
					if (score >= 0) scored.push({ link, score })
				}
			}

			scored.sort((a, b) => a.score - b.score)
			return scored.slice(0, 8).map((s) => s.link)
		},
	})

	return (
		<div class="docs-search">
			<input
				type="search"
				placeholder="Search docs..."
				value={state.query}
				onInput={(e) => (state.query = (e.target as HTMLInputElement).value)}
			/>
			{state.query && (
				<ul class="search-results">
					{state.results.length > 0 ? (
						state.results.map((result) => (
							<li>
								<A
									href={result.href}
									onClick={() => {
										state.query = ''
										onNavigate?.()
									}}
								>
									{result.title}
								</A>
							</li>
						))
					) : (
						<li class="no-results">No results found</li>
					)}
				</ul>
			)}
		</div>
	)
}

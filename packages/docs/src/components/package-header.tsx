import { componentStyle } from '@sursaut'
import { Code } from './code'

componentStyle.sass`
.package-header
	margin-bottom: 2rem
	padding-bottom: 1.5rem
	border-bottom: 1px solid var(--pico-muted-border-color, #e0e0e0)

	.package-name
		font-family: 'Fira Code', 'Consolas', monospace
		font-size: 1.1rem
		color: var(--pico-primary)
		font-weight: 600

	.package-description
		margin: 0.5rem 0 1rem
		font-size: 1.05rem
		opacity: 0.85
`

export interface PackageHeaderProps {
	name: string
	description: string
	/** Bash install line, or `false` to hide install (e.g. unpublished packages). */
	install?: string | false
}

export function PackageHeader(p: PackageHeaderProps) {
	const installCmd = p.install === false ? null : (p.install ?? `pnpm add ${p.name}`)

	return (
		<header class="package-header">
			<span class="package-name">{p.name}</span>
			<p class="package-description">{p.description}</p>
			{installCmd !== null ? <Code code={installCmd} lang="bash" /> : null}
		</header>
	)
}

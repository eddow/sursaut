import { componentStyle } from '@sursaut'
import { Code, PackageHeader, Section } from '../../components'

componentStyle.sass`
.swatches
	display: grid
	grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))
	gap: 1.5rem
	margin-top: 1rem

.swatch-item
	display: flex
	flex-direction: column
	gap: 0.5rem

.swatch-box
	height: 3rem
	border-radius: var(--sursaut-border-radius)
	border: 1px solid var(--sursaut-border)
	display: flex
	align-items: center
	justify-content: center
	font-weight: 600
	font-size: 0.8rem

.swatch-info
	display: flex
	flex-direction: column
	font-size: 0.85rem
	code
		font-size: 0.75rem
		opacity: 0.7
`

function Swatch({ name, label }: { name: string; label?: string }) {
	return (
		<div class="swatch-item">
			<div class="swatch-box" style={{ background: `var(${name})`, color: 'var(--sursaut-fg)' }}>
				{label || ''}
			</div>
			<div class="swatch-info">
				<strong>{label || name.replace('--sursaut-', '')}</strong>
				<code>{name}</code>
			</div>
		</div>
	)
}

export default function CssVariablesPage() {
	return (
		<article>
			<PackageHeader
				name="CSS Variables"
				description="Known --sursaut-* variables. The contract is thin: sizeable handle + demo swatches."
			/>

			<Section title="Real variables (in source)">
				<p>
					Only these are read by <code>@sursaut/ui</code> styles today (
					<code>styles/sizeable.sass</code>):
				</p>
				<ul>
					<li>
						<code>--sursaut-primary</code> (fallback <code>#3b82f6</code>) — sizeable handle
					</li>
					<li>
						<code>--sursaut-resize-handle-width</code> / <code>--sursaut-resize-handle-height</code>{' '}
						(fallback <code>5px</code>)
					</li>
				</ul>
				<p>
					Everything below is the <em>intended</em> design-system contract (adapters map their own
					variables, e.g. <code>--pico-*</code>); swatches render live values where defined and fall
					back otherwise.
				</p>
			</Section>

			<Section title="Brand Colors">
				<div class="swatches">
					<Swatch name="--sursaut-primary" label="Primary" />
					<Swatch name="--sursaut-secondary" label="Secondary" />
					<Swatch name="--sursaut-contrast" label="Contrast" />
				</div>
			</Section>

			<Section title="Semantic Colors">
				<div class="swatches">
					<Swatch name="--sursaut-success" label="Success" />
					<Swatch name="--sursaut-warning" label="Warning" />
					<Swatch name="--sursaut-danger" label="Danger" />
				</div>
			</Section>

			<Section title="Layout & Spacing">
				<div class="swatches">
					<Swatch name="--sursaut-spacing" label="Spacing" />
					<Swatch name="--sursaut-border-radius" label="Border Radius" />
					<Swatch name="--sursaut-form-height" label="Form Height" />
				</div>
			</Section>

			<Section title="Surface & Text">
				<div class="swatches">
					<Swatch name="--sursaut-bg" label="Background" />
					<Swatch name="--sursaut-card-bg" label="Card Background" />
					<Swatch name="--sursaut-fg" label="Foreground" />
					<Swatch name="--sursaut-border" label="Border" />
					<Swatch name="--sursaut-muted" label="Muted Text" />
					<Swatch name="--sursaut-muted-border" label="Muted Border" />
				</div>
			</Section>

			<Section title="Customization Example">
				<p>Override variables globally or env-based to a container:</p>
				<Code
					code={`:root {\n  --sursaut-primary: #ec4899; /* Pink */\n  --sursaut-border-radius: 0;\n}`}
					lang="css"
				/>
			</Section>
		</article>
	)
}

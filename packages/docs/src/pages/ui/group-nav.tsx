import { Code, PackageHeader, Section } from '../../components'

const groupSnippet = `import { hasGroupValue, setGroupValue, toggleGroupCollectionValue } from '@sursaut'

// Single value (radio semantics): group === value means checked.
<Radio value="red" group={state.color}>Red</Radio>

// Collection (checkbox semantics): membership means checked.
<Checkbox value="email" group={state.channels}>Email</Checkbox>

// Helpers:
hasGroupValue(state.color, 'red')          // boolean
setGroupValue(state.color, 'red', true)    // 'red' (single) or mutated set/array
toggleGroupCollectionValue(state.channels, 'email', true)`

const navSnippet = `// nav.ts is DOM utilities, not components — wire from a use= callback:
import { setupButtonGroupNav, setupToolbarNav } from '@sursaut'

<div role="group" use={(el) => setupButtonGroupNav(el, { orientation: 'horizontal' })}>
  <button>Left</button>
  <button>Center</button>
  <button>Right</button>
</div>

// setupButtonGroupNav: arrows cycle, Tab exits (trapTab, default true).
// setupToolbarNav: Tab cycles between toolbar segments (data-toolbar-spacer splits).`

export default function GroupNavPage() {
	return (
		<article>
			<PackageHeader
				name="@sursaut/ui group + nav"
				description="Group bindings (single vs collection) and keyboard-nav DOM utilities."
				install="pnpm add @sursaut/ui"
			/>

			<Section title="Group bindings">
				<p>
					<code>group.ts</code> is the shared selection algebra behind <code>Radio</code>,{' '}
					<code>Checkbox</code>, <code>CheckButton</code>, <code>RadioButton</code> and the split
					variants: a single value compares with <code>===</code>, a <code>Set</code> or array
					compares by membership.
				</p>
				<Code code={groupSnippet} lang="tsx" />
			</Section>

			<Section title="Keyboard nav">
				<p>
					<code>nav.ts</code> exports pure DOM helpers. Adapters call them from a <code>use=</code>{' '}
					mount callback; each returns a cleanup that removes the listener.
				</p>
				<Code code={navSnippet} lang="tsx" />
			</Section>
		</article>
	)
}

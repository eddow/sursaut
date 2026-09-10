import { Code, PackageHeader, Section } from '../../components'

const headSnippet = `import { Head, useHead } from '@sursaut'

// Component form — mounts children into document.head:
function Page() {
  return (
    <>
      <Head>
        <title>My page</title>
        <meta name="description" content="Page description" />
      </Head>
      <main>Content</main>
    </>
  )
}

// Hook form — same mount, imperative:
function Widget(_props: {}, env: Env) {
  useHead(<link rel="test-inject" href="/extra.css" />, env)
  return <div>Widget</div>
}`

const composeSnippet = `// Multiple <Head> instances compose — they add entries,
// never replace existing ones. Each unmounts only its own nodes.

<Head><title>One</title></Head>
<Head><meta name="x" content="y" /></Head>
// document.head keeps both; removing the first leaves the second.`

export default function HeadPage() {
	return (
		<article>
			<PackageHeader
				name="@sursaut/kit Head"
				description="Head manager: mount JSX into document.head with per-instance cleanup."
				install="pnpm add @sursaut/kit"
			/>

			<Section title="Basic Usage">
				<Code code={headSnippet} lang="tsx" />
			</Section>

			<Section title="Composition">
				<p>
					<code>Head</code> renders a comment anchor in place and reconciles its children into{' '}
					<code>document.head</code>. Unmount removes only its own nodes.
				</p>
				<Code code={composeSnippet} lang="tsx" />
			</Section>
		</article>
	)
}

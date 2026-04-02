import { Button, Card, Grid, Inline, Select, Stack, Switch } from '@sursaut'
import { Toolbar } from '@sursaut/adapter-pico'
import { reactive } from 'mutts'
import { ApiTable, Code, Demo, Section } from '../../components'

const stackSource = `<Stack gap={state.gap} align={state.align}>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</Stack>`

const inlineSource = `<Inline gap={state.gap} wrap={state.wrap}>
  <Button>A</Button>
  <Button>B</Button>
  <Button>C</Button>
</Inline>`

const gridSource = `<Grid columns={state.columns} gap={state.gap}>
  <Card><Card.Body>1</Card.Body></Card>
  <Card><Card.Body>2</Card.Body></Card>
  <Card><Card.Body>3</Card.Body></Card>
  <Card><Card.Body>4</Card.Body></Card>
</Grid>`

const appShellCode = `<AppShell
  header={<Toolbar>...</Toolbar>}
  shadowOnScroll
>
  <main>Page content</main>
</AppShell>`

const toolbarCode = `<Toolbar>
  <Button icon="menu" />
  <strong>Title</strong>
  <Toolbar.Spacer />
  <Button icon="settings" />
</Toolbar>`

const arrangedCode = `import { arranged } from '@sursaut/ui'

function VerticalLayout(props, scope) {
  arranged(scope, { orientation: 'vertical', density: 'compact', align: 'stretch' })
  return props.children
}

<VerticalLayout>
  <Toolbar>
    <Button icon="menu" />
    <Button icon="settings" />
  </Toolbar>
</VerticalLayout>`

type Align = 'start' | 'center' | 'end' | 'baseline' | 'stretch'
type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'

function StackDemo() {
	const state = reactive({ gap: 'md', align: '' as '' | Align })
	const box =
		'padding: 0.75rem 1rem; background: var(--sursaut-bg-muted, #eee); border-radius: 0.25rem'
	return (
		<Stack gap="md">
			<Inline gap="md" wrap>
				<label>
					gap
					<Select value={state.gap}>
						<option value="none">none</option>
						<option value="xs">xs</option>
						<option value="sm">sm</option>
						<option value="md">md</option>
						<option value="lg">lg</option>
						<option value="xl">xl</option>
					</Select>
				</label>
				<label>
					align
					<Select value={state.align}>
						<option value="">default</option>
						<option value="start">start</option>
						<option value="center">center</option>
						<option value="end">end</option>
						<option value="stretch">stretch</option>
					</Select>
				</label>
			</Inline>
			<hr />
			<Stack gap={state.gap} align={state.align || undefined}>
				<div style={box}>Item 1</div>
				<div style={box}>Item 2 (wider content)</div>
				<div style={box}>Item 3</div>
			</Stack>
		</Stack>
	)
}

function InlineDemo() {
	const state = reactive({ gap: 'sm', wrap: true, justify: '' as '' | Justify })
	return (
		<Stack gap="md">
			<Inline gap="md" wrap>
				<label>
					gap
					<Select value={state.gap}>
						<option value="none">none</option>
						<option value="xs">xs</option>
						<option value="sm">sm</option>
						<option value="md">md</option>
						<option value="lg">lg</option>
					</Select>
				</label>
				<label>
					justify
					<Select value={state.justify}>
						<option value="">default</option>
						<option value="start">start</option>
						<option value="center">center</option>
						<option value="end">end</option>
						<option value="between">between</option>
						<option value="around">around</option>
					</Select>
				</label>
				<Switch checked={state.wrap}>wrap</Switch>
			</Inline>
			<hr />
			<Inline gap={state.gap} wrap={state.wrap} justify={state.justify || undefined}>
				<Button>Alpha</Button>
				<Button>Beta</Button>
				<Button>Gamma</Button>
				<Button>Delta</Button>
				<Button>Epsilon</Button>
			</Inline>
		</Stack>
	)
}

function GridDemo() {
	const state = reactive({ columns: 3, gap: 'md', minItemWidth: '' })
	const box = 'padding: 1rem; text-align: center'
	return (
		<Stack gap="md">
			<Inline gap="md" wrap>
				<label>
					columns
					<input type="number" value={state.columns} min={1} max={6} style="width: 5rem" />
				</label>
				<label>
					gap
					<Select value={state.gap}>
						<option value="xs">xs</option>
						<option value="sm">sm</option>
						<option value="md">md</option>
						<option value="lg">lg</option>
					</Select>
				</label>
			</Inline>
			<hr />
			<Grid columns={state.columns} gap={state.gap}>
				<Card>
					<Card.Body el={{ style: box }}>1</Card.Body>
				</Card>
				<Card>
					<Card.Body el={{ style: box }}>2</Card.Body>
				</Card>
				<Card>
					<Card.Body el={{ style: box }}>3</Card.Body>
				</Card>
				<Card>
					<Card.Body el={{ style: box }}>4</Card.Body>
				</Card>
				<Card>
					<Card.Body el={{ style: box }}>5</Card.Body>
				</Card>
				<Card>
					<Card.Body el={{ style: box }}>6</Card.Body>
				</Card>
			</Grid>
		</Stack>
	)
}

function ToolbarDemo() {
	return (
		<Toolbar>
			<Button icon="menu" ariaLabel="Menu" />
			<strong>App Title</strong>
			<Toolbar.Spacer />
			<Button variant="secondary">Settings</Button>
			<Button variant="primary">Profile</Button>
		</Toolbar>
	)
}

export default function LayoutPage() {
	return (
		<article>
			<h1>Layout</h1>
			<p>Layout primitives: Stack, Inline, Grid, AppShell, Toolbar, and Container.</p>

			<Section title="Stack">
				<p>Vertical flex layout with configurable gap and alignment.</p>
				<Demo title="Stack" source={stackSource} component={<StackDemo />} />
				<ApiTable
					props={[
						{
							name: 'gap',
							type: "'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string",
							description: "Vertical gap between children. Default: 'md'",
							required: false,
						},
						{
							name: 'align',
							type: "'start' | 'center' | 'end' | 'baseline' | 'stretch'",
							description: 'Cross-axis alignment (align-items)',
							required: false,
						},
						{
							name: 'justify',
							type: "'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'",
							description: 'Main-axis alignment (justify-content)',
							required: false,
						},
						{
							name: '...native',
							type: 'JSX.IntrinsicElements["div"]',
							description: 'All native <div> attributes',
							required: false,
						},
					]}
				/>
			</Section>

			<Section title="Inline">
				<p>Horizontal flex layout with optional wrapping and scrolling.</p>
				<Demo title="Inline" source={inlineSource} component={<InlineDemo />} />
				<ApiTable
					props={[
						{
							name: 'gap',
							type: "'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string",
							description: "Horizontal gap between children. Default: 'sm'",
							required: false,
						},
						{
							name: 'wrap',
							type: 'boolean',
							description: 'Allow items to wrap to next line',
							required: false,
						},
						{
							name: 'scrollable',
							type: 'boolean',
							description: 'Enable horizontal scrolling instead of wrapping',
							required: false,
						},
						{
							name: 'align',
							type: "'start' | 'center' | 'end' | 'baseline' | 'stretch'",
							description: "Cross-axis alignment. Default: 'center'",
							required: false,
						},
						{
							name: 'justify',
							type: "'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'",
							description: 'Main-axis alignment',
							required: false,
						},
						{
							name: '...native',
							type: 'JSX.IntrinsicElements["div"]',
							description: 'All native <div> attributes',
							required: false,
						},
					]}
				/>
			</Section>

			<Section title="Grid">
				<p>CSS Grid layout with column count or auto-fit.</p>
				<Demo title="Grid" source={gridSource} component={<GridDemo />} />
				<ApiTable
					props={[
						{
							name: 'columns',
							type: 'number | string',
							description: 'Column count or grid-template-columns value',
							required: false,
						},
						{
							name: 'minItemWidth',
							type: 'string',
							description: 'Min width for auto-fit columns (e.g. "200px")',
							required: false,
						},
						{
							name: 'gap',
							type: "'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string",
							description: "Grid gap. Default: 'md'",
							required: false,
						},
						{
							name: 'align',
							type: "'start' | 'center' | 'end' | 'stretch'",
							description: 'Align items',
							required: false,
						},
						{
							name: 'justify',
							type: "'start' | 'center' | 'end' | 'stretch'",
							description: 'Justify items',
							required: false,
						},
						{
							name: '...native',
							type: 'JSX.IntrinsicElements["div"]',
							description: 'All native <div> attributes',
							required: false,
						},
					]}
				/>
			</Section>

			<Section title="Toolbar">
				<p>
					Toolbar consumes the ambient arranged scope. By default it is horizontal, but you can set{' '}
					<code>orientation</code>, <code>density</code>, <code>align</code>, or provide them
					ambiently with <code>arranged(scope, ...)</code>. <code>Toolbar.Spacer</code> pushes
					subsequent items to the end of the current axis.
				</p>
				<Demo title="Toolbar" source={toolbarCode} component={<ToolbarDemo />} />
			</Section>

			<Section title="arranged">
				<p>
					<code>arranged</code> is the shared composition primitive for compound controls. It
					propagates <code>orientation</code>, <code>density</code>, <code>joined</code>, and
					<code>align</code> through scope, while adapters derive classes through{' '}
					<code>arranged(...).class</code>.
				</p>
				<p>
					Controls such as <code>Toolbar</code>, <code>ButtonGroup</code>, <code>SplitButton</code>,
					<code>SplitRadioButton</code>, and <code>Stars</code> consume it directly.
				</p>
				<Code code={arrangedCode} lang="tsx" />
			</Section>

			<Section title="AppShell">
				<p>Full-page layout with sticky header and scroll shadow.</p>
				<Code code={appShellCode} lang="tsx" />
				<ApiTable
					props={[
						{
							name: 'header',
							type: 'JSX.Element',
							description: 'Header content (rendered in a sticky <header>)',
							required: true,
						},
						{
							name: 'shadowOnScroll',
							type: 'boolean',
							description: 'Add shadow to header when page is scrolled. Default: true',
							required: false,
						},
						{
							name: 'children',
							type: 'JSX.Children',
							description: 'Main content area',
							required: false,
						},
					]}
				/>
			</Section>
		</article>
	)
}

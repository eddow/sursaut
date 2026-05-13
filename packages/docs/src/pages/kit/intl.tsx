import { Code, Section } from '../../components'

const numberExample = `import { Number } from '@sursaut/kit'

// Renders formatted text nodes — no wrapper elements.
<Number value={1234.56} />
// → "1,234.56"

<Number value={1234.56} style="currency" currency="EUR" />
// → "€1,234.56"

<Number value={0.75} style="percent" />
// → "75%"

<Number value={1000000} notation="compact" />
// → "1M"`

const dateExample = `import { Date } from '@sursaut/kit'

<Date value={new Date()} dateStyle="long" />
// → "February 11, 2026"

<Date value={new Date()} dateStyle="short" timeStyle="short" />
// → "2/11/26, 1:00 AM"

<Date value={new Date()} weekday="long" month="long" day="numeric" />
// → "Wednesday, February 11"`

const relativeTimeExample = `import { RelativeTime } from '@sursaut/kit'

<RelativeTime value={-3} unit="day" />
// → "3 days ago"

<RelativeTime value={2} unit="hour" />
// → "in 2 hours"

<RelativeTime value={-1} unit="month" numeric="auto" />
// → "last month"`

const listExample = `import { List } from '@sursaut/kit'

<List value={['Alice', 'Bob', 'Charlie']} type="conjunction" />
// → "Alice, Bob, and Charlie"

<List value={['Red', 'Blue']} type="disjunction" />
// → "Red or Blue"`

const pluralExample = `import { Plural } from '@sursaut/kit'

<Plural value={1} one="1 item" other="{count} items" />
// → "1 item"

<Plural value={5} one="1 item" other="{count} items" />
// → "5 items"`

const displayNamesExample = `import { DisplayNames } from '@sursaut/kit'

<DisplayNames value="FR" type="region" />
// → "France"

<DisplayNames value="en" type="language" />
// → "English"`

const localeConfig = `import { resolveLocale } from '@sursaut/kit'

// By default, uses navigator.language.
// Override with a custom resolver:
resolveLocale() // → "fr-FR"`

export default function IntlPage() {
	return (
		<article>
			<h1>Intl Components</h1>
			<p>
				Six Intl formatting components that render text nodes directly — no wrapper elements. Import
				from <code>@sursaut/kit</code>.
			</p>

			<Section title="Number">
				<Code code={numberExample} lang="tsx" />
			</Section>

			<Section title="Date">
				<Code code={dateExample} lang="tsx" />
			</Section>

			<Section title="RelativeTime">
				<Code code={relativeTimeExample} lang="tsx" />
			</Section>

			<Section title="List">
				<Code code={listExample} lang="tsx" />
			</Section>

			<Section title="Plural">
				<Code code={pluralExample} lang="tsx" />
			</Section>

			<Section title="DisplayNames">
				<Code code={displayNamesExample} lang="tsx" />
			</Section>

			<Section title="Locale Configuration">
				<p>
					By default, all components use <code>navigator.language</code>. Override with{' '}
					<code>setLocaleResolver()</code>.
				</p>
				<Code code={localeConfig} lang="tsx" />
			</Section>
		</article>
	)
}

// Test that @sursaut/kit can be imported from the .tgz
import { DisplayProvider, useDisplayContext } from '@sursaut/kit'
import { DisplayProvider as DomDisplayProvider } from '@sursaut/kit/dom'
import { createStorage } from '@sursaut/kit/node'
import { routerModel, routeMatcher, parsePathSegment, buildRoute } from '@sursaut/kit'
import { Number as IntlNumber, Date as IntlDate, RelativeTime, List, Plural, DisplayNames, resolveLocale, cachedIntl } from '@sursaut/kit'
import { linkModel } from '@sursaut/kit'

// Verify dom exports exist (main entry)
if (typeof DisplayProvider !== 'function') {
  console.error('FAIL: DisplayProvider is not a function')
  process.exit(1)
}
if (typeof useDisplayContext !== 'function') {
  console.error('FAIL: useDisplayContext is not a function')
  process.exit(1)
}

// Verify dom subpath exports exist
if (typeof DomDisplayProvider !== 'function') {
  console.error('FAIL: DomDisplayProvider from ./dom is not a function')
  process.exit(1)
}

// Verify node exports exist
if (typeof createStorage !== 'function') {
  console.error('FAIL: createStorage is not a function')
  process.exit(1)
}

// Verify router exports exist
if (typeof routerModel !== 'function') {
  console.error('FAIL: routerModel is not a function')
  process.exit(1)
}
if (typeof routeMatcher !== 'function') {
  console.error('FAIL: routeMatcher is not a function')
  process.exit(1)
}
if (typeof parsePathSegment !== 'function') {
  console.error('FAIL: parsePathSegment is not a function')
  process.exit(1)
}
if (typeof buildRoute !== 'function') {
  console.error('FAIL: buildRoute is not a function')
  process.exit(1)
}

// Verify intl exports exist
if (typeof IntlNumber !== 'function') {
  console.error('FAIL: IntlNumber is not a function')
  process.exit(1)
}
if (typeof IntlDate !== 'function') {
  console.error('FAIL: IntlDate is not a function')
  process.exit(1)
}
if (typeof RelativeTime !== 'function') {
  console.error('FAIL: RelativeTime is not a function')
  process.exit(1)
}
if (typeof List !== 'function') {
  console.error('FAIL: List is not a function')
  process.exit(1)
}
if (typeof Plural !== 'function') {
  console.error('FAIL: Plural is not a function')
  process.exit(1)
}
if (typeof DisplayNames !== 'function') {
  console.error('FAIL: DisplayNames is not a function')
  process.exit(1)
}
if (typeof resolveLocale !== 'function') {
  console.error('FAIL: resolveLocale is not a function')
  process.exit(1)
}
if (typeof cachedIntl !== 'function') {
  console.error('FAIL: cachedIntl is not a function')
  process.exit(1)
}

// Verify models exports exist
if (typeof linkModel !== 'function') {
  console.error('FAIL: linkModel is not a function')
  process.exit(1)
}

// Test routeMatcher with a simple route
const matcher = routeMatcher([
  { path: '/hello' },
  { path: '/users/[id]' }
])
const match = matcher('/hello')
if (!match || match.definition.path !== '/hello') {
  console.error('FAIL: routeMatcher not matching correctly')
  process.exit(1)
}

// Test routeMatcher with params
const paramMatch = matcher('/users/42')
if (!paramMatch || paramMatch.params.id !== '42') {
  console.error('FAIL: routeMatcher params not matching correctly')
  process.exit(1)
}

// Test linkModel
const model = linkModel({ href: '/test' })
if (typeof model.onClick !== 'function') {
  console.error('FAIL: linkModel.onClick is not a function')
  process.exit(1)
}
if (!('aria-current' in model)) {
  console.error('FAIL: linkModel missing aria-current')
  process.exit(1)
}

// Test parsePathSegment
const parsed = parsePathSegment('[id]')
if (parsed.kind !== 'param' || parsed.name !== 'id') {
  console.error('FAIL: parsePathSegment not working correctly')
  process.exit(1)
}

console.log('PASS: @sursaut/kit node entry works')
console.log('✓ Package installed from .tgz')
console.log('✓ All dom exports accessible')
console.log('✓ All node exports accessible')
console.log('✓ All router exports accessible')
console.log('✓ All intl exports accessible')
console.log('✓ All models exports accessible')
console.log('✓ routeMatcher works correctly')
console.log('✓ linkModel works correctly')
console.log('✓ parsePathSegment works correctly')

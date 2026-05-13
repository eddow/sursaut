// Test that the package can be imported from the .tgz
import { renderToString, h, withSSR, latch } from '@sursaut/core/node'
import { reactive } from 'mutts'

// Verify core exports exist
if (typeof renderToString !== 'function') {
  console.error('FAIL: renderToString is not a function')
  process.exit(1)
}
if (typeof h !== 'function') {
  console.error('FAIL: h is not a function')
  process.exit(1)
}
if (typeof withSSR !== 'function') {
  console.error('FAIL: withSSR is not a function')
  process.exit(1)
}
if (typeof latch !== 'function') {
  console.error('FAIL: latch is not a function')
  process.exit(1)
}
if (typeof reactive !== 'function') {
  console.error('FAIL: reactive is not a function')
  process.exit(1)
}

// Test that mutts can be imported (verifies transitive dependency resolution from npm)
const state = reactive({ count: 0 })
state.count = 1
if (state.count !== 1) {
  console.error('FAIL: reactive state not working')
  process.exit(1)
}

// Test basic rendering using renderToString
// h() must be called within withSSR context because it references global Node
const result = withSSR(() => {
  const element = h('div', null, 'hello from install-test')
  return renderToString(element)
})

if (!result || !result.includes('hello from install-test')) {
  console.error('FAIL: renderToString did not produce expected output:', result)
  process.exit(1)
}

console.log('PASS: @sursaut/core node entry works')
console.log('Output:', result)
console.log('✓ Package installed from .tgz')
console.log('✓ All exports accessible')
console.log('✓ Transitive dependency (mutts) resolved from npm')
console.log('✓ renderToString works correctly')

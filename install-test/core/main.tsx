import { reactive } from 'mutts'
import { h, Fragment, latch } from '@sursaut/core'
import { renderToString } from '@sursaut/core/node'

// Type-check: basic JSX + reactive state
const state = reactive({ count: 0 })
const App = () => <><h1>Hello {state.count}</h1></>

// Type-check: renderToString resolves from node entry
const html: string = renderToString(<App />)
console.log('Type-check OK')

// Type-check: latch type exists
declare const el: HTMLElement
latch(el, <App />)

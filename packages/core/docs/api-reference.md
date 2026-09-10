# API Reference

Complete reference for Sursaut-TS APIs and utilities.

## Core APIs

### `latch(target, content, env?)`

Latch reactive content onto a DOM element. Polymorph: accepts SursautElement, Child[], Node, Node[], or undefined. Processes content through the appropriate pipeline, then reconciles into the target. Includes DOMContentLoaded guard and conflict detection.

**Parameters:**
- `target` - CSS selector or HTMLElement to latch onto
- `content` - The JSX content or SursautElement to render
- `env` - Optional env object (defaults to rootEnv)

**Returns:** Cleanup function that unmounts the content

**Example:**
```tsx
const app = <MyApp />
const unmount = latch('#my-container', app)
// Later cleanup
unmount()
```

### `bindChildren(parent, newChildren)`

Binds children elements to a parent element with automatic reconciliation.

**Parameters:**
- `parent` - The parent DOM node
- `newChildren` - The new children (Node, Node[], or undefined)

**Example:**
```tsx
bindChildren(document.getElementById('app'), [node1, node2])
```

### `h(tag, props?, ...children)`

The JSX pragma function that creates JSX elements. Automatically transforms JSX into calls to this function.

**Parameters:**
- `tag` - HTML tag name or component function
- `props` - Element properties/attributes
- `...children` - Child elements

**Returns:** JSX element object with `.render()` method

## Utility Functions

### `defaults(props, defs)`

Creates a proxy over `props` that applies `??` defaults lazily. Safe to call in the component body — no reactive reads happen until a property is accessed.

**Example:**
```tsx
const state = defaults(props, { list: [] as string[], addedText: 'new' })
```

### `extend(base, added?)`

Creates a reactive object with `base` as prototype (`Object.create(base, descriptors(added))`). Used for env/scope chains.


## Array Utilities

For derived arrays, prefer creating memoized derivations with `memoize(() => ...)` from the reactive API.

### `array.filter(array, filterFn)`

Filters an array in-place.

**Parameters:**
- `array` - The array to filter
- `filterFn` - Filter function

**Returns:** Boolean (false when done)


## Debug Utilities

Note: advanced debug helpers are internal; prefer `effect()` and `onEffectTrigger()` in userland.

### `onEffectTrigger(callback)`

Tracks all reactive changes in a component.

**Parameters:**
- `callback` - Function called with (obj, evolution)

**Example:**
```tsx
onEffectTrigger((obj, evolution) => {
  console.log('State changed:', obj, evolution)
})
```

## JSX Special Props

### Conditional Rendering

- `if={condition}` — Render the node when `condition` is truthy.
- `if:path={value}` — Strict-compare `value === env[path]` to decide rendering (supports dash-separated paths like `role-name`).
- `when:path={arg}` — Call `env[path](arg)`; render when the returned value is truthy (supports dash-separated paths).
- `else` — Render this node only if no previous sibling in the same fragment has rendered via an `if`/`when` condition. Can be chained as `else if={...}`.

Notes
- Use fragments (`<>...</>`) to group multiple `if`/`else if`/`else` branches for a component without adding wrapper DOM.
- `env` can be provided via the `<env>` component or programmatically within components.

Examples
```tsx
// Simple boolean condition
<div if={state.isLoggedIn}>Welcome back</div>

// Compare against env
<env role="admin">
  <>
    <div if:role={"admin"}>Admin Panel</div>
    <div else>User Panel</div>
  </>
</env>

// when: env predicate — permission guard
function App(_p: {}, env: Env) {
  const auth = reactive({ rights: new Set(['view', 'comment']) })
  env.hasRights = (right: string) => auth.rights.has(right)
  return (
    <nav>
      <a href="/edit"   when:hasRights={'edit'}>Edit</a>
      <a href="/view"   when:hasRights={'view'}>View</a>
    </nav>
  )
}

// else-if chain inside a fragment
<>
  <div if:status={"loading"}>Loading…</div>
  <div else if:status={"error"}>Something went wrong</div>
  <div else>Done</div>
</>
```

### `<try catch={fn}>` — Error Boundary

An intrinsic component that acts as an error boundary. Children that throw during render or in a reactive effect are caught; the element's content is reactively swapped to the fallback.

**Signature:** `<try catch={(error: unknown, reset?: () => void) => JSX.Element}>`

- `error` — the thrown value
- `reset` — restores original content if a successful render preceded the error
- Errors bubble through `env.catch` to the nearest ancestor boundary if no local `catch` is set
- Setting `catch` clears `env.catch` for all descendants (no double-catching)

```tsx
<try catch={(error) => <span class="error">{(error as Error).message}</span>}>
  <UnreliableComponent />
</try>
```

### `pick:path={value}` — Oracle-Based Selection

Multi-sibling selection driven by an env oracle. All siblings with `pick:path` declare a candidate value; `env[path]` (where `path` supports dash-separation like `user-role`) is called as an oracle and returns which value(s) render.


**Requires** `env[name]` to be a function — throws if missing.

```tsx
// Oracle: pick the smallest declared maxSize that fits the container
env.maxSize = (options: Set<number>) => {
  const sorted = [...options].sort((a, b) => a - b)
  return sorted.find((s) => s >= state.containerWidth) ?? sorted.at(-1)
}
<img src="/img-400.webp"  pick:maxSize={400}  alt="small" />
<img src="/img-800.webp"  pick:maxSize={800}  alt="medium" />
<img src="/img-1600.webp" pick:maxSize={1600} alt="large" />
```

### Update Syntax

- `update:prop={fn}` - Two-way binding setter

**Example:**
```tsx
<input value={state.count} update:value={(v) => state.count = v} />
```

### `this` (refs)

Capture a reference to the rendered target.

- For intrinsic DOM elements, the value is an `HTMLElement`.
- For components, the value may be a `Node` or `Node[]` (component render output).

`this` expects a callback. On cleanup / unlatch, it is called again with `undefined`.

```tsx
let inputRef: Node | undefined
let counterRef: Node | readonly Node[] | undefined

<input this={(node) => { inputRef = node }} value={state.sharedCount} />
<CounterComponent this={(node) => { counterRef = node }} count={state.sharedCount} />
```

### `use={callback}` (inline directive)

Attach an inline directive directly on an element or component.

**Signature:** `use={(target: Node | Node[], access) => void | (() => void)}`

**Behavior:**
- Called within an effect.
- May return a cleanup function.
- Re-runs when the directive value changes.
- Layered `use={...}` directives accumulate.

**Example:**
```tsx
<div use={(el) => {
  if (el instanceof HTMLElement) el.focus()
  return () => {
    if (el instanceof HTMLElement) el.blur()
  }
}} />
```

### `use:name` (env mixins)

Attach a env-provided mixin to the rendered target.

- Define on env: `env[path](target: Node | Node[], value: any | undefined, access: EffectAccess)`
- Use in JSX: `use:path={value}` (value optional, `path` supports dash-separation)
- **Effect-bound**: Called WITHIN a reactive effect; re-runs when `value` or other dependencies change.
- May return a cleanup function (`EffectCloser`).
- If the env path is missing or falsy, the directive is skipped.

```tsx
// In component body
env.resize = (target, value, env) => {
  const el = Array.isArray(target) ? target[0] : target
  if (!(el instanceof HTMLElement)) return
  const ro = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect
    if (typeof value === 'function') value(Math.round(width), Math.round(height))
  })
  ro.observe(el)
  return () => ro.disconnect()
}

// In JSX
<div use:resize={(w: number, h: number) => console.log(w, h)} />
```

## Control Flow Components

### `<for each={array}>`

Iterate over a reactive array.

**Example:**
```tsx
<for each={items}>
  {(item) => <div>{item.name}</div>}
</for>
```

### `<env>`

Creates a env for conditional rendering.

**Example:**
```tsx
<env user="Alice" role="admin">
  <Component1 />
  <Component2 />
</env>
```

### `<Fragment>` or `<>`

Group multiple elements without adding a wrapper.

**Example:**
```tsx
<>
  <h1>Title</h1>
  <p>Content</p>
</>
```

## Event Handlers

Use camelCase event handler names:

- `onClick` - Click events
- `onInput` - Input events
- `onKeypress` - Key press events
- `onChange` - Change events
- `onSubmit` - Form submission

**Example:**
```tsx
<button onClick={() => console.log('clicked')}>Click</button>
<input onInput={(e) => state.value = e.target.value} />
```

## Reactive API (from mutts)

### `reactive(obj)`

Creates a reactive proxy object.

**Example:**
```tsx
const state = reactive({ count: 0 })
```

### `memoize(fn)`

Creates a memoized reactive derivation.

**Example:**
```tsx
const doubled = memoize(() => state.count * 2)
```

### `morph(arrayOrGetter, fn)`

Maps over a reactive array.

**Example:**
```tsx
{morph(items, (item) => <div>{item.value.name}</div>)}
```

Use `memoize` to cache expensive derivations.

### `effect(fn)`

Creates a reactive effect.

**Example:**
```tsx
effect(() => {
  console.log('Count:', state.count)
  return () => console.log('Cleaned up')
})
```

### `watch(fn, callback)`

Watches a reactive value for changes.

**Example:**
```tsx
watch(() => state.count, (newVal, oldVal) => {
  console.log(`Changed from ${oldVal} to ${newVal}`)
})
```

### `onEffectTrigger(callback)`

Tracks all reactive changes in the current context.

**Example:**
```tsx
onEffectTrigger((obj, evolution) => {
  console.log('State changed:', obj, evolution)
})
```

### `atomic(fn)`

Creates an atomic wrapper for event handlers.

**Example:**
```tsx
const handler = atomic(() => state.count++)
element.addEventListener('click', handler)
```



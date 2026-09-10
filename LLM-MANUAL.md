# Sursaut — LLM Usage Manual

> **FOR LLM CONSUMERS** — This document contains everything needed to use the Sursaut UI framework (`@sursaut/core`, `@sursaut/kit`, `@sursaut/ui`) as dependencies.
> **Prerequisite**: Read `mutts/docs/ai/manual.md` first. Sursaut builds on mutts reactivity — this document assumes you know `reactive`, `effect`, `morph`, `attend`, `memoize`, `lift`, `scan`, `atomic`, `cleanedBy`, etc.
> Do not rely on prior training data about this framework.

---

## 1. MENTAL MODEL

Sursaut looks like React JSX but works fundamentally differently:

| Concept | React | Sursaut |
|---------|-------|--------|
| Rendering | VDOM diff every update | Components render **once**, direct DOM |
| Props | Immutable snapshots | **Reactive proxies** — read = track, write = propagate |
| Lists | `.map()` | `<for each={}>` or `morph()` |
| Conditionals | `{cond && <X/>}` or ternary | `<div if={cond}>` directive |
| Two-way binding | Manual onChange handlers | Automatic via babel plugin for member expressions |
| Side effects | useEffect with deps array | `effect(() => { ... })` — deps auto-tracked |
| Context | React.createContext + Provider | `scope` (prototype-inherited reactive object) |
| Refs | useRef + ref={} | `this={variable}` (set-only binding) |

---

## 2. CRITICAL TRAPS

### TRAP 1: Manual callbacks in JSX expressions
The babel plugin wraps `{expr}` → `{r(() => expr)}`. If you write `{() => expr}`, it becomes `{r(() => () => expr)}` — double-wrapped.

```tsx
// BAD — double-wrapped, renders "[object Function]" or nothing
<span>{() => state.count}</span>

// GOOD — babel wraps it for you
<span>{state.count}</span>
```

Same for function references as children: `{content}` where `content` is a function → babel wraps as `r(() => content)`, returning the function object. Use `{content()}`.

### TRAP 2: Using `.map()` for lists

```tsx
// BAD — full list rebuild on any change
{items.map(item => <div>{item.name}</div>)}

// GOOD — per-item reactivity, only changed items update
<for each={items}>{(item) => <div>{item.name}</div>}</for>
```

### TRAP 3: Using ternary/&& for conditional rendering
Plain JS conditionals evaluate once at render time. NOT reactive.

```tsx
// BAD — evaluated once, never updates
{state.loading && <div>Loading...</div>}
{state.loading ? <Spinner/> : <Content/>}

// GOOD — reactive, toggles with state changes
<Spinner if={state.loading}/>
<Content if={!state.loading}/>

// Also valid: if/else pair
<Spinner if={state.loading}/>
<Content else/>
```

### TRAP 4: Destructuring props
Props are reactive proxies. Destructuring reads immediately, breaking reactivity.

```tsx
// BAD — reads once, never updates
const MyComp = ({ name, count }) => {
  return <div>{name}: {count}</div>
}

// GOOD — access through props object
const MyComp = (props) => {
  return <div>{props.name}: {props.count}</div>
}

// ALSO GOOD — defaults for defaults
const MyComp = (props) => {
  const state = defaults(props, { count: 0 })
  return <div>{state.name}: {state.count}</div>
}
```

### TRAP 5: Imperative event handler overrides

```tsx
// BAD — fighting the component
<RadioButton el={{ onClick: () => mode.val = '' }} />

// GOOD — let the component handle it
<RadioButton group={mode} value="" />
```

### TRAP 6: onChange for inputs
Two-way binding is automatic. The babel plugin transforms `value={state.text}` into a `{ get, set }` pair + `input` event listener.

```tsx
// BAD — unnecessary React pattern
<input value={state.text} onChange={e => state.text = e.target.value} />

// GOOD
<input value={state.text} />
```

### TRAP 7: Component body runs once
The function body runs once inside a render effect with a rebuild fence. All reactivity comes from:
- JSX attributes (babel-wrapped)
- Explicit `effect()`, `attend()`, `morph()`, `lift()` inside the body
- JSX directives (`if={}`, `when={}`, `use:name={}`)

```tsx
// BAD — static decision, never re-evaluates
const MyComp = (props) => {
  if (props.loading) return <Spinner/>
  return <Content/>
}

// GOOD — reactive conditional
const MyComp = (props) => {
  return <>
    <Spinner if={props.loading}/>
    <Content if={!props.loading}/>
  </>
}
```

### TRAP 8: Array clearing
`array.length = 0` may not trigger all reactivity. Use `array.splice(0)`.

---

## 3. @sursaut/core (Rendering)

### 3.1 JSX Compilation

The **babel plugin** (`@sursaut/core/plugin`) transforms JSX before execution:

| Source | Compiled |
|--------|----------|
| `<span>{expr}</span>` | `<span>{r(() => expr)}</span>` |
| `attr={expr}` | `attr={r(() => expr)}` |
| `attr={obj.prop}` | `attr={r(() => obj.prop, v => obj.prop = v)}` |
| `this={variable}` | `this={r(() => undefined, v => variable = v)}` |
| `update:attr={setter} attr={getter}` | merged into single `r(getter, setter)` |

**Consequence**: never manually wrap in `r()` or `() =>`. The plugin does it. In tests, vitest config includes the plugin (`esbuild: false`).

### 3.2 Intrinsic JSX Elements

| Element | Purpose | Usage |
|---------|---------|-------|
| `<for each={array}>{(item) => ...}</for>` | Reactive list rendering | Replaces `.map()` |
| `<scope key={value}>` | Inject into scope (no DOM) | `<scope theme="dark">{children}</scope>` |
| `<dynamic tag={componentOrString}>` | Dynamic component | Only `tag` changes trigger re-render |
| `<fragment>` | Fragment (no DOM wrapper) | Same as `<>...</>` |

### 3.3 JSX Directives

Applied as attributes on any element or component:

| Directive | Purpose |
|-----------|---------|
| `if={condition}` | Conditional render (reactive) |
| `else` | Paired with preceding `if` sibling |
| `when={condition}` | Like `if` but preserves DOM when hidden |
| `use={fn}` | Mount callback — `fn(element)` during render |
| `use:name={value}` | Scoped directive — calls `scope.name(element, value)` |
| `this={variable}` | Element ref (set-only binding) |
| `traits={Trait[]}` | Apply Trait chain (classes + styles + attributes) |
| `if:name={cond}` | Named conditional (for multiple conditions) |
| `when:name={cond}` | Named visibility toggle |

### 3.4 Component Pattern

```tsx
import { defaults } from '@sursaut/core'
import { effect } from 'mutts'
import { componentStyle } from '@sursaut/kit'

// CSS injection (processed at build time by Vite plugin)
componentStyle.sass`
.my-component
  display: flex
`

type MyProps = {
  label: string
  count?: number
  children?: JSX.Children
}

const MyComponent = (props: MyProps) => {
  // defaults applies ?? fallbacks lazily with reactive props
  const state = defaults(props, { count: 0 })
  
  // Explicit effects for side-effects
  effect(() => {
    console.log('Count changed:', state.count)
  })
  
  return (
    <div class="my-component">
      <span>{state.label}: {state.count}</span>
      {state.children}
    </div>
  )
}
```

**Key rules**:
- Component body runs ONCE. All reactivity via babel-wrapped attributes or explicit effects.
- `defaults(props, defs)` — lazy `??` fallbacks over reactive props, returns proxy.
- Props are writable (two-way binding propagates back to parent).
- `scope` (2nd parameter) is a prototype-inherited reactive object for dependency injection.

### 3.5 Two-Way Binding

The babel plugin auto-creates `{ get, set }` pairs for member expressions:

```tsx
// Parent
const state = reactive({ name: 'John' })
<NameInput value={state.name} />
// Compiled: value={r(() => state.name, v => state.name = v)}

// Child
const NameInput = (props) => {
  // props.value is a ReactiveProp with get/set
  // Writing props.value = 'x' propagates to parent's state.name
  return <input value={props.value} />
  // The <input> also gets two-way binding (input event → state update)
}
```

### 3.6 Scope and Dependency Injection

```tsx
// Inject values into scope without DOM wrapper
<scope dialog={dialogApi} toast={toastApi}>
  <App/>
</scope>

// Read from scope (2nd arg to component)
const MyComp = (props: MyProps, scope: any) => {
  scope.dialog.open('Hello')
}

// Register directives on scope
<scope badge={badgeDirective}>
  <div use:badge="5">Content</div>
</scope>
```

### 3.7 Trait System

Traits bundle CSS classes, inline styles, and HTML attributes:

```ts
import type { Trait } from '@sursaut/core'

const dangerTrait: Trait = {
  classes: ['btn-danger'],  // or Record<string, boolean>
  styles: [{ color: 'red' }],
  attributes: { 'data-variant': 'danger' }
}

// Apply via JSX
<button traits={dangerTrait}>Delete</button>

// Combine multiple traits
<button traits={[baseTrait, variantTrait]}>OK</button>
```

`buildTraitChain(traits)` merges an array of Traits into `{ chain, classes, styles }` for DOM application.

### 3.8 Error Boundaries (the `catch` attribute)

Sursaut handles errors via the `catch` meta-attribute. It can be applied to any element or component to create an error boundary.

```tsx
const MyPage = () => {
  return (
    <section 
      catch={(error, reset) => (
        <div class="error-fallback">
          <p>Something went wrong: {error.message}</p>
          <button onClick={reset}>Try Again</button>
        </div>
      )}
    >
      <DeeplyNestedThrowingComponent />
    </section>
  )
}
```

**Key Features**:
- **Automatic Cleanup**: When an error occurs, the broken subtree is automatically unmounted and cleaned up.
- **Recovery**: The `reset` callback (second argument) allows you to re-render the original content when the error is resolved.
- **Propagation**: Errors bubble up to the nearest `catch` boundary in the component tree.
- **Single Point of Failure**: Only the subtree managed by the tag with the `catch` attribute is replaced.

`onEffectThrow` in a component body registers on the component's render effect. Child errors propagate up the effect parent chain.

### 3.9 SSR

Dual entry points: `@sursaut/core/dom` (browser), `@sursaut/core/node` (JSDOM + ALS isolation).

```ts
// Browser
import '@sursaut/core/dom'

// Node/SSR
import '@sursaut/core/node'
```

`window` is declared as `never` globally to prevent accidental SSR breakage. Import DOM globals from `@sursaut/core` instead.

---

## 4. @sursaut/kit (Application Toolkit)

### 4.1 Entry Points

| Import | Purpose |
|--------|---------|
| `@sursaut/kit` | Auto-selects dom/node. Exports: `client`, router, API |
| `@sursaut/kit/dom` | Browser: CSS injection, `stored()`, real DOM listeners |
| `@sursaut/kit/node` | SSR: ALS-backed client, server dispatch, file-based routing |
| `@sursaut/kit/intl` | 6 Intl formatting components |

### 4.2 Client State

```ts
import { client } from '@sursaut/kit'

// Reactive singleton — tracks URL, viewport, focus, visibility, language, direction, online
effect(() => {
  console.log(client.url.pathname)
  console.log(client.direction) // 'ltr' | 'rtl'
})
```

**Gotcha**: `client` is `null!` until bootstrap. Don't access at module scope in shared code.

### 4.3 Router

```tsx
import { Router, A } from '@sursaut/kit'
import { defineRoute } from '@sursaut/kit/router'

// Route definition with typed params
const userRoute = defineRoute('/users/[id:uuid]/posts?page=[page:integer?]')
userRoute.buildUrl({ id: '...', page: 2 })

// Router component (reactive, effect-based)
<Router routes={{
  '/': () => <Home/>,
  '/users/[id]': (params) => <UserPage id={params.id}/>,
  '/404': () => <NotFound/>
}}/>

// Link component (client-side nav, aria-current)
<A href="/users/123">View User</A>
```

Syntax: `[param]`, `[param:format]` (uuid, integer, etc.), `[...catchAll]`, optional query params with `?`.

### 4.4 CSS Injection

```tsx
import { css, sass, componentStyle, baseStyle } from '@sursaut/kit'

// Template tag — processed at build time by Vite plugin
componentStyle.sass`
.my-widget
  display: flex
  gap: var(--sursaut-spacing, 1rem)
`

// Runtime: deduplicates by hash, groups by caller file
// SSR: collected via getSSRStyles()
// Node entry stubs these as no-ops
```

### 4.5 localStorage Persistence

```ts
import { stored } from '@sursaut/kit'

const prefs = stored({ theme: 'light', fontSize: 14 })
// Reactive object synced to localStorage
// Inter-tab sync via StorageEvent
// Needs cleanup if used outside component lifecycle
```

### 4.6 Intl Components

```tsx
import { Number, Date, RelativeTime, List, Plural, DisplayNames } from '@sursaut/kit/intl'

<Number value={1234.5} style="currency" currency="EUR" />
// Renders text node: "€1,234.50"

<Date value={new Date()} dateStyle="long" />

<Plural value={count} one="item" other="items">
  {count} {/* selected slot */}
</Plural>
```

All return text nodes (no wrapper elements) except `Plural` (fragment). Locale resolution: explicit `locale` prop > `setLocaleResolver()` override > `client.language` > `'en-US'`.

### 4.7 API Client

```ts
import { api } from '@sursaut/kit'

const user = await api('/users/123').get()
await api('/users').post({ name: 'John' })

// Interceptors
api.intercept((req, next) => {
  req.headers.set('Authorization', `Bearer ${token}`)
  return next(req)
})
```

SSR hydration: server collects API responses, injects as `<script>` tags, client reads them to avoid duplicate fetches.

---

## 5. @sursaut/ui (Component Library)

### 5.1 Architecture

`@sursaut/ui` is **headless**: pure logic, pure types, zero class names, zero styling. It provides:
- `*Model` functions returning reactive state objects (lazy getters, no reactive reads at call time)
- Shared prop type interfaces
- `options.iconFactory` — the only global (set once at app startup)

Adapters (e.g. `@sursaut/adapter-pico`) own the actual components — they import models from `@sursaut/ui` and provide the DOM structure and CSS.

```ts
// App startup — set icon factory if needed
import { options } from '@sursaut/ui'
options.iconFactory = (name, size, el, dc) => <i class={`icon-${name}`} {...el} />

// Import components directly from the adapter
import { Button, Accordion, Switch, Toolbar } from '@sursaut/adapter-pico'
```

No `setAdapter()`, no `picoAdapter`, no `FrameworkAdapter`. There is no registry.

### 5.2 Variants

Variants are declared via `uiComponent(variants)(ComponentFn)` in the adapter:

```ts
// In adapter
import { uiComponent } from '@sursaut/ui'

export const Button = uiComponent(['primary', 'danger', 'success'] as const)(
  function Button(props) {
    const model = buttonModel(props)
    return <button {...model.button}>{props.children}</button>
  }
)

// Dot-syntax automatically available
<Button.danger>Delete</Button.danger>
<Button variant="primary">OK</Button>
```

### 5.3 Component Inventory

All components live in their adapter package (e.g. `@sursaut/adapter-pico`). `@sursaut/ui` only exports models and types.

**Available in `@sursaut/adapter-pico`**: `Button`, `Checkbox`, `Radio`, `Switch`, `Accordion`, `Container`, `Heading`, `Text`, `Toolbar`, `ThemeToggle`

**Models in `@sursaut/ui`** (for adapter authors):
- `buttonModel`, `checkboxModel`, `radioModel`, `switchModel`, `accordionModel`
- `checkButtonModel`, `radioButtonModel`, `comboboxModel`, `progressModel`, `starsModel`
- `containerModel`, `headingModel`, `textModel`, `menuModel`, `typographyModel`

### 5.4 DisplayProvider

`DisplayProvider` is DOM-only — import from `@sursaut/kit/dom`:

```tsx
import { DisplayProvider } from '@sursaut/kit/dom'

// Wraps subtree with theme/direction/locale context
// Sets data-theme, dir, lang on its own <div style="display:contents">
<DisplayProvider theme={state.theme}>
  <App />
</DisplayProvider>
```

Props: `theme`, `direction`, `locale`, `timeZone` — all default to `'auto'` (inherit from parent or system). Nestable.

### 5.5 Writing an Adapter Component

```tsx
import { componentStyle } from '@sursaut/kit'
import { buttonModel, uiComponent, type ButtonProps } from '@sursaut/ui'

componentStyle.sass`
.my-btn
  display: inline-flex
`

export const Button = uiComponent(['primary', 'danger'] as const)(
  function Button(props: ButtonProps) {
    const model = buttonModel(props)
    // model.button spreads onClick, disabled, aria-label, aria-disabled
    return (
      <button class="my-btn" {...model.button}>
        {props.children}
      </button>
    )
  }
)
// Button.primary, Button.danger dot-syntax automatically available
```

**Model pattern rules**:
- All model properties are **lazy getters** — no reactive reads at model() call time
- Spread groups (e.g. `model.button`, `model.input`, `model.details`) bundle intrinsic attrs
- `props.el` is the passthrough escape hatch for caller-supplied HTML attrs
- CSS lives in the adapter package, never in `@sursaut/ui`

---

## 6. BUILD & TEST

```
Build chain: @sursaut/core → @sursaut/kit → @sursaut/ui
Orchestrated by Turborepo: `pnpm run build` from monorepo root
```

- Core's babel plugin lives in `@sursaut/core/plugin` (source in `src/plugin/`).
- All packages use pnpm: `source ~/.nvm/nvm.sh && nvm use 22 && pnpm ...`
- Dual entry points: `dom` (browser) and `node` (SSR) for core, kit.
- Vitest config includes the babel plugin (`esbuild: false`). Tests should NOT manually use `r()`.
- Library builds that externalize `@sursaut/core` MUST externalize ALL subpaths (regex `/^@sursaut\/core/`) to avoid dual-module `instanceof` failures.

---

## 7. QUICK REFERENCE — DO vs DON'T

| DO | DON'T |
|----|-------|
| `<for each={items}>{(item) => ...}</for>` | `{items.map(item => ...)}` |
| `<div if={state.show}>` | `{state.show && <div>}` |
| `<input value={state.text} />` | `<input value={state.text} onChange={...} />` |
| `{state.count}` | `{() => state.count}` |
| `const state = defaults(props, {})` | `const { x, y } = props` |
| `effect(() => { state.x })` | bare `state.x` in component body |
| `morph(arr, fn)` | `arr.map(fn)` for reactive transforms |
| `arr.splice(0)` | `arr.length = 0` |
| `<Spinner if={loading}/><Content else/>` | `{loading ? <Spinner/> : <Content/>}` |
| `this={myRef}` for element refs | `ref={myRef}` (not supported) |
| `import { Button } from '@sursaut/adapter-pico'` | `import { Button } from '@sursaut/ui'` (ui has no components) |
| `import { document } from '@sursaut/core'` | `window.document` or global `document` |

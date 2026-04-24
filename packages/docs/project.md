# @sursaut/docs — Interactive Documentation

A **sursaut** application that serves as the living documentation for the entire sursaut ecosystem. Every code example runs live, every component is interactive, and the docs app itself dogfoods the framework.

## Packages Documented

| Package | Description |
|---|---|
| `@sursaut/core` | JSX factory, reactivity (`r()`), SursautElement, env, reconciler, directives (`if`, `when`, `for`, `dynamic`), two-way binding, `compose()`, SSR |
| `@sursaut/kit` | Router, client state, `stored()`, CSS injection, Intl components, API utilities |
| `@sursaut/ui` | 15+ components, 6 directives, overlay system, DisplayProvider, adapter pattern, CSS variable contract |
| `@sursaut/board` | Full-stack meta-framework (experimental — not published with the first npm wave; under rework) |
| `@sursaut/adapter-pico` | PicoCSS adapter: variant traits, bridge CSS, tooltip directive, icon factory |
| `pure-glyf` | Icon system: SVG → CSS classes, Vite plugin, icon factories |
| `mutts` | Reactive primitives: signals, effects, reactive objects/arrays/sets/maps, zones |

## Stack

- **Runtime**: `@sursaut/core` + `@sursaut/kit` + `@sursaut/ui` + `@sursaut/adapter-pico` + `mutts`
- **Styling**: PicoCSS via adapter-pico + docs-specific SASS
- **Icons**: pure-glyf with @tabler/icons
- **Build**: Vite + `@sursaut/core/plugin`
- **Syntax Highlighting**: highlight.js (lightweight, covers TSX/SASS/JSON/bash)

## Architecture

### New UI Components

The docs app needs a few components that live in **`@sursaut/ui`** (not in the docs app) because they're generally useful:

#### `<Code>` — Syntax-highlighted code block

```typescript
interface CodeProps {
  language?: string       // 'tsx' | 'typescript' | 'sass' | 'json' | 'bash' | ...
  filename?: string       // Optional filename tab above the block
  highlight?: number[]    // Line numbers to highlight
  copyable?: boolean      // Copy-to-clipboard button (default: true)
  children: string        // Code content
}
```

- Renders `<pre><code>` with highlight.js classes
- Adapter key: `Code` in `UiComponents` — adapter provides container class, copy button class
- SASS: `@layer sursaut.components` with `--sursaut-code-bg`, `--sursaut-code-border`, `--sursaut-code-font`
- highlight.js is a **peer dependency** (consumer picks the theme)
- Pico adapter: `<pre><code>` already styled natively — zero bridge CSS

#### `<Demo>` — Live component preview with source toggle

```typescript
interface DemoProps {
  title?: string
  children: JSX.Children  // The live rendered components
  source?: string          // TSX source string shown in a <Code> block
  expanded?: boolean       // Source visible by default (default: false)
}
```

- Renders children in a bordered preview area
- "View Source" toggle button reveals the `<Code>` block below
- Adapter key: `Demo` in `UiComponents`

### Docs-Specific Components (live in `packages/docs/src/components/`)

#### `<ApiTable>` — Props reference table

```typescript
interface ApiTableProps {
  props: Array<{
    name: string
    type: string
    default?: string
    description: string
    required?: boolean
  }>
}
```

Hand-written prop arrays per page. No codegen — keeps it simple and accurate.

#### `<PageNav>` — Sidebar navigation

Hierarchical nav tree generated from the route definitions. Highlights current route. Collapsible sections per package.

#### `<PackageHeader>` — Package intro section

Shows package name, version, npm badge, one-liner description, install command in a `<Code>` block.

### Page Structure

Each documentation page follows a consistent pattern:

```tsx
const ButtonPage = () => (
  <article>
    <PackageHeader package="@sursaut/ui" />
    <h1>Button</h1>
    <p>Interactive button with icon support and variant styling.</p>

    <h2>Basic Usage</h2>
    <Demo source={`<Button.primary>Click me</Button.primary>`}>
      <Button.primary>Click me</Button.primary>
    </Demo>

    <h2>Variants</h2>
    <Demo source={...}>
      <Button.primary>Primary</Button.primary>
      <Button.danger>Danger</Button.danger>
      <Button.success>Success</Button.success>
    </Demo>

    <h2>With Icons</h2>
    <Demo source={...}>
      <Button icon="check">Save</Button>
    </Demo>

    <h2>Loading State</h2>
    <Demo source={...}>
      <Button loading>Submitting...</Button>
    </Demo>

    <h2>API Reference</h2>
    <ApiTable props={[
      { name: 'variant', type: 'string', description: 'Visual variant (primary, danger, ...)', default: 'undefined' },
      { name: 'icon', type: 'string', description: 'Icon name (left side)', default: 'undefined' },
      { name: 'loading', type: 'boolean', description: 'Show loading spinner', default: 'false' },
      { name: 'disabled', type: 'boolean', description: 'Disable interaction', default: 'false' },
    ]} />
  </article>
)
```

## Routes

```
/                                   Landing page — what is sursaut, install, quick start
/getting-started                    Installation, first app, concepts overview
/getting-started/concepts           Env, reactivity, components, directives

/core                               @sursaut/core overview
/core/components                    SursautElement, render, mount/use lifecycle
/core/jsx                           JSX factory, r(), two-way binding, this=
/core/directives                    if, when, for, dynamic, fragment
/core/env                         Env chain, <env>, injection
/core/ssr                           Node entry, JSDOM, AsyncLocalStorage

/kit                                @sursaut/kit overview
/kit/router                         Router, <A>, route definitions, params, guards
/kit/client                         Browser state: url, prefersDark, direction, language
/kit/intl                           Intl.Number, Intl.Date, Intl.RelativeTime, ...
/kit/storage                        stored() — reactive localStorage
/kit/api                            API utilities, validation (arktype)

/ui                                 @sursaut/ui overview
/ui/components/button               Button, Button.primary, loading
/ui/components/dialog               Dialog, Dialog.show(), backdrop, focus trap
/ui/components/toast                Toast, bindToast(), variants
/ui/components/drawer               Drawer, positioning, footer
/ui/components/menu                 Menu, Menu.Bar, keyboard navigation
/ui/components/infinite-scroll      Virtualization, variable height, sticky
/ui/components/...                  (one route per component)
/ui/directives                      badge, intersect, loading, pointer, resize, scroll
/ui/display                         DisplayProvider, ThemeToggle, useDisplayContext
/ui/overlays                        Overlay system architecture, WithOverlays
/ui/css-variables                   Full --sursaut-* contract with live swatches
/ui/adapter                         Adapter pattern, creating custom adapters

/board                              @sursaut/board overview
/board/routing                      File-based routing, layouts
/board/ssr                          Server-side rendering, hydration
/board/middleware                    Hono middleware, API routes

/adapters                           Adapter ecosystem overview
/adapters/pico                      PicoCSS adapter — setup, features, bridge CSS
/adapters/creating                  How to write a custom adapter

/mutts                              mutts overview — reactive primitives
/mutts/signals                      reactive(), effect(), attend()
/mutts/collections                  Arrays, Sets, Maps — reactive wrappers
/mutts/zones                        Zone isolation, history, undo/redo

/pure-glyf                          pure-glyf — icon system
/pure-glyf/setup                    Vite plugin, icon sources
/pure-glyf/usage                    CSS classes, icon factories
```

## File Structure

```
packages/docs/
├── project.md              # This file
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx            # Entry: latch, setAdapter, Router, DisplayProvider
│   ├── layout.tsx          # AppShell: sidebar nav + main content + ThemeToggle
│   ├── routes.ts           # Route definitions (flat array, one per page)
│   ├── components/
│   │   ├── api-table.tsx   # Props reference table
│   │   ├── page-nav.tsx    # Sidebar navigation tree
│   │   ├── package-header.tsx
│   │   └── section.tsx     # Reusable page section with anchor
│   ├── pages/
│   │   ├── index.tsx
│   │   ├── getting-started/
│   │   │   ├── index.tsx
│   │   │   └── concepts.tsx
│   │   ├── core/
│   │   │   ├── index.tsx
│   │   │   ├── components.tsx
│   │   │   ├── jsx.tsx
│   │   │   ├── directives.tsx
│   │   │   ├── env.tsx
│   │   │   ├── compose.tsx
│   │   │   └── ssr.tsx
│   │   ├── kit/
│   │   │   ├── index.tsx
│   │   │   ├── router.tsx
│   │   │   ├── client.tsx
│   │   │   ├── intl.tsx
│   │   │   ├── storage.tsx
│   │   │   └── api.tsx
│   │   ├── ui/
│   │   │   ├── index.tsx
│   │   │   ├── components/
│   │   │   │   ├── button.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   └── ...
│   │   │   ├── directives.tsx
│   │   │   ├── display.tsx
│   │   │   ├── overlays.tsx
│   │   │   ├── css-variables.tsx
│   │   │   └── adapter.tsx
│   │   ├── board/
│   │   │   ├── index.tsx
│   │   │   ├── routing.tsx
│   │   │   ├── ssr.tsx
│   │   │   └── middleware.tsx
│   │   ├── adapters/
│   │   │   ├── index.tsx
│   │   │   ├── pico.tsx
│   │   │   └── creating.tsx
│   │   ├── mutts/
│   │   │   ├── index.tsx
│   │   │   ├── signals.tsx
│   │   │   ├── collections.tsx
│   │   │   └── zones.tsx
│   │   └── pure-glyf/
│   │       ├── index.tsx
│   │       ├── setup.tsx
│   │       └── usage.tsx
│   └── styles/
│       └── docs.sass       # Docs layout: sidebar, content area, responsive
└── sandbox/
```

## Dependencies

```json
{
  "name": "@sursaut/docs",
  "private": true,
  "type": "module",
  "dependencies": {
    "@picocss/pico": "^2",
    "@sursaut/adapter-pico": "workspace:*",
    "@sursaut/core": "workspace:*",
    "@sursaut/kit": "workspace:*",
    "@sursaut/ui": "workspace:*",
    "highlight.js": "^11",
    "mutts": "^1.0.13",
    "pure-glyf": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^25",
    "sass": "^1.93",
    "typescript": "^5.9",
    "vite": "^7"
  }
}
```

## Dev Workflow

```bash
# From packages/docs/
pnpm dev         # Vite dev server on :5290
```

## Key Decisions

1. **`<Code>` and `<Demo>` live in `@sursaut/ui`** — They're general-purpose components useful in any sursaut app (READMEs, changelogs, help pages). highlight.js is a peer dep so it's opt-in.
2. **No codegen for API tables** — Hand-written `<ApiTable>` prop arrays are more accurate and readable than auto-generated docs. Types change rarely; descriptions need human touch.
3. **PicoCSS adapter** — The docs app uses the Pico adapter for consistent, beautiful styling out of the box. Demonstrates the adapter pattern in action.
4. **`private: true`** — This package is not published to the npm registry. It is the official deployable documentation site (e.g. Cloudflare Pages, Netlify, any static host with SPA fallback).
5. **No SSR** — Static SPA is fine for docs. Can add prerendering later via `@sursaut/board` if SEO matters.
6. **One route per topic** — Flat, linkable, bookmarkable. No multi-section mega-pages.
7. **highlight.js over shiki** — Lighter bundle (~30KB vs ~2MB). Good enough for docs. TSX/SASS/JSON/bash coverage.

## Priority Order

### Phase 1 — Skeleton + Core Infra Pages
1. Project scaffold (package.json, vite.config, index.html, main.tsx)
2. `<Code>` component in `@sursaut/ui` (with highlight.js peer dep)
3. `<Demo>` component in `@sursaut/ui`
4. Layout shell (sidebar nav + content + ThemeToggle)
5. Landing page + Getting Started
6. Core docs (JSX, components, directives, env) — these are the hardest to understand

### Phase 2 — Kit + UI Component Pages
7. Kit docs (router, client, intl, storage)
8. UI component pages (one per component, with live demos)
9. CSS variable contract page (live swatches)
10. Adapter docs (pattern overview, creating custom, pico details)

### Phase 3 — Advanced + Polish
11. Board docs (routing, SSR, middleware)
12. mutts docs (signals, collections, zones)
13. pure-glyf docs (setup, usage)
14. Search functionality
15. Mobile responsive sidebar
16. Deploy to GitHub Pages / Netlify

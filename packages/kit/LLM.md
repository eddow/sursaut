# @sursaut/kit LLM Cheat Sheet

Read [sursaut core's LLM](../core/LLM.md)

## Overview

Application-level toolkit for Sursaut apps. It owns **reactive client state**, **routing**, **the shared API client**, **CSS injection**, **display context**, **localStorage persistence**, and the **Intl entry point**.

## Entry Points

Kit follows the [dual entry-point policy](../../dual-ep-policy.md):

| Entry | Import | Purpose |
|-------|--------|---------|
| shared | `@sursaut/kit` | Shared surface auto-selected by package exports |
| browser | `@sursaut/kit/dom` | DOM bootstrap (`setPlatform()` side effect) + `stored()` |
| node | `@sursaut/kit/node` | ALS context + file-based routing helpers + node `stored()` stub |
| intl | `@sursaut/kit/intl` | Intl formatters only |

`@sursaut/kit` should not re-export the Intl components. End-consumer Intl imports go through `@sursaut/kit/intl`.

## Platform Adapter

Kit defines a `PlatformAdapter` interface in `src/platform/types.ts` and a singleton slot in `src/platform/shared.ts`.

Adapters:

| Adapter | Where | Notes |
|---------|-------|-------|
| DOM | `src/dom/client.ts` | Real browser APIs, history, listeners |
| Test | `src/platform/test.ts` | Global reactive client for unit tests |
| SSR | provided by board | Request-scoped client via ALS |

- `setPlatform(adapter)` must be called before any `client.*` access.
- `client` is a strict proxy: if no platform is installed, access throws.
- Shared code may depend on `client`; the entry point is responsible for installing the adapter first.

## Shared vs DOM vs Node

- `src/dom/*` is only for browser-only code (window, document, localStorage, listeners).
- `src/node/*` is only for node-only code (ALS, fs/path, route tree building, SSR storage stub).
- Everything else in `src/` must stay environment-agnostic.

Current examples:

- shared: `api/`, `router/logic.ts`, `router/defs.ts`, `css.ts`, `display.ts`, `components/display.tsx`
- DOM-only: `dom/client.ts`, `dom/storage.ts`
- node-only: `node/context.ts`, `node/router.ts`, `node/storage.ts`

## Router

Two layers:

1. `src/router/logic.ts`
   - pure route parsing / matching / building
   - supports `[param]`, `[param:format]`, `[...catchAll]`, optional query params
   - custom formats via `registerFormat()`

2. `src/router/components.tsx`
   - `<Router>` reactive component
   - `renderElements()` currently bridges route JSX into rendered nodes
   - `<A>` behavior lives through `linkModel()` in `src/router/link-model.ts`
   - router-level navigation analytics live on `<Router>` via `onRouteStart`, `onRouteEnd`, and `onRouteError`; the router owns them because it can observe match/not-found/render-error outcomes, not just URL changes
   - perf-mode route instrumentation lives across `src/dom/client.ts`, `src/router/components.tsx`, and `src/router/link-model.ts`; `pnpm run perf:check` validates mark presence plus fast-path budgets, while `route:render` is still the remaining over-budget router metric in the current demo scenario
   - lazy routes use `lazy()` loaders plus a mounted inner `latch()` subtree; plain async state reads in the outer router compute were not sufficient to drive the outlet DOM swap reliably
   - lazy route module caching / prefetching is shared through `src/router/lazy-cache.ts`, and `linkModel({ prefetch })` warms modules without inventing a router data-loader API; `prefetch: 'visible'` depends on passing `use={model.use}` through the rendered anchor
   - lazy routes may also define route-local `loading` / `error` renderers; these override the router-level loading fallback and built-in error panel for that route only

Typed helpers:

- `defineRoute()` + `buildUrl()` live in `src/router/defs.ts`

## API Client

Shared API surface lives in `src/api/`.

- `api/index.ts` owns the single shared `api` singleton
- it starts with standard `fetch` forwarding behavior
- extension and specialization happen through shared hooks, not EP-specific clients

Important files:

- `api/base-client.ts`
  - `createApiClientFactory(executor)`
  - `intercept()` global/context interceptors
  - request lifecycle goes through the shared interceptor chain
  - `prefetch()` provides short-lived shared GET warm-cache reuse for later `get()` calls without introducing router-owned loaders
- `api/context.ts`
  - `RequestScope`
  - `setRequestHook`, `setResponseHook`, `setPromiseHook`, `setStreamGuardHook`
  - framework extension point for board / SSR integration
- `api/core.ts`
  - `ApiError`, middleware runner, HTTP helpers
- `api/response.ts`
  - cached body reads for interceptors

Board should hook API behavior at the shared level, not by depending on a node-specific API implementation.

## Display Context

- shared types and fallback logic are in `src/display.ts`
- `DisplayProvider` lives in `src/components/display.tsx`
- fallback display context reads from `client`, so it also requires `setPlatform()` first

## CSS Injection

`src/css.ts` is shared and works in both DOM and SSR.

- build-time tags: `css`, `sass`, `scss`
- runtime collection/injection: `__injectCSS()`, `getSSRStyles()`
- `componentStyle` and `baseStyle` are shared exports

## Head Management

- `src/head.tsx` exports the public `<Head>` and `useHead()` surface
- DOM/test mounting goes through `src/head-mount.ts` with additive head ranges; do not use `latch(document.head, ...)` for kit head management because `latch()` owns and replaces the whole target
- SSR head collection is adapter-backed through `platform/shared.ts` `mountHead` / `setHeadMount`; board plugs request-scoped serialization into that delegate and injects the collected head HTML through its existing SSR injector pipeline

## Storage

- browser: `src/dom/storage.ts` → reactive `localStorage`
- node: `src/node/storage.ts` → reactive in-memory stub

## Intl Entry Point

Intl is separate on purpose.

- import from `@sursaut/kit/intl`
- do not re-export Intl components from the shared barrel
- formatter cache and locale resolution belong to that entry point

## Gotchas

1. `client` is not optional before init. If no platform has been installed, access throws.
2. CSS tags are build-time transformed by the Vite plugin. Runtime fallback only injects the given text.
3. `stored()` returns a cleanup-bound reactive object. Outside component lifecycle, keep and call cleanup yourself.
4. `components/display.tsx` is shared, not DOM-only. It uses env + `collapse`, not raw DOM APIs.
5. No arrow-function JSX children: `{() => expr}` stays a raw function and is dropped by the reconciler. Use `{expr}`.
6. `models.ts` is useful for other sursaut libraries (for example `linkModel()`), but it is not intended as end-consumer API.
7. For async route-module rendering in kit, prefer a stable mounted subtree (`use` + `latch`) over relying on the parent router `lift` to observe promise completion.
8. Catch-all route branches that must stay mounted also need a stable mounted outlet (`use` + `latch`); returning cached nodes directly from the router `lift` can leave nested routers/effects disposed while the DOM still looks present.
9. Vite 8 uses Rolldown/OXC minification by default. `esbuild: false` and `oxc: false` do not preserve runtime `Function.name` values in library output; set `build.rolldownOptions.output.keepNames: true`. For mutts captioned APIs, prefer template naming such as ``lift`routerCompute`(() => {})`` over `lift(function routerCompute() {})`.

# @sursaut/kit TODO

## High priority

## Medium priority

## Low priority

- Reduce `route:render` p95 during perf-mode router navigation (perf-mode validation harness in place via `pnpm run perf:check`; fast-path marks already meet budget).
- `storedSession()` with SSR in-memory fallback.

## Already implemented

- Typed route helpers via `defineRoute()` + `buildUrl()`.
- Query parameter parsing and route format registry in `router/logic.ts`.
- Lazy route loading via `lazy()` with router loading UI and in-memory module caching.
- Lazy route module prefetch via `linkModel({ prefetch: true | 'hover' | 'intent' | 'visible' })`.
- Shared GET data prefetch via `api(...).prefetch()` with short-lived in-memory reuse for later `get()` calls.
- Perf-mode router validation harness for `route:sync`, `route:match`, `route:render`, `route:navigate`, `route:click`, and `route:not-found` via `pnpm run perf:check`.
- SSR-safe head manager via `<Head>` / `useHead()` with DOM mounting in kit and request-scoped SSR injection in board.
- Navigation analytics hooks via `onRouteStart`, `onRouteEnd`, and `onRouteError` on `<Router>`.
- Route-level lazy pending / error renderers via `loading` and `error` on lazy route definitions.
- Shared API hook/interceptor extension points in `api/context.ts` and `api/base-client.ts`.

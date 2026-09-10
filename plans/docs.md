# Docs audit — `packages/docs`

Date: 2026-09-09
Scope: `packages/docs/src/{pages,routes.tsx,nav-index.ts}`, `packages/docs/project.md`,
`packages/docs/sandbox/{phase2,usage}.md`, vs `core`/`kit`/`ui`/`board`/`adapters`/`pure-glyf`/`mutts` source.

## 0. `core/compose.tsx` — obsolete, to kill (decided)

- Created in `5011555` as **"Compose Utilities"**: `compose()`, `forwardProps()`, `propsInto()`, `defaulted()`, `extend()` + Babel `_extends` → `compose()` claim.
- Today `core/src/lib/utils.ts` exports only `defaults()` + `extend()`. `compose`/`forwardProps`/`propsInto` exist nowhere in `packages/*/src`. Babel uses `sursautSpreadPlugin`, no `compose()` emission.
- Current file is an 8-line stub, routed at `/core/compose` but absent from `nav-index.ts`.
- **Decision (§6.1): kill.** Stale `compose` mentions are bugs to fix, not history to keep:
- [x] Delete `packages/docs/src/pages/core/compose.tsx` + route entry in `routes.tsx`
- [x] Fix `packages/core/docs/api-reference.md`: remove/replace `compose(...sources)` section (points to `defaults()` + `extend()`)
- [x] Fix `sursaut/LLM-MANUAL.md`: replace `compose({count:0}, props)` examples with `defaults()`
- [x] Fix `packages/docs/project.md`: drop `compose()` from core description + `compose.tsx` from file structure

## 1. What it lacks

### 1.1 Sidebar gaps — every remaining route must be referenced (decided)
- [x] Add `mutts` section to `nav-index.ts`: `/mutts`, `/mutts/signals`, `/mutts/collections`, `/mutts/zones`
- [x] Add `pure-glyf` section to `nav-index.ts`: `/pure-glyf`, `/pure-glyf/usage` (+ `/pure-glyf/setup` once created)
- [x] Verify `components/search.tsx` finds them (it iterates `navigation` only)
- [x] Add drift guard so this can't regress (§5.3) — `smoke.spec.ts`: route→nav + nav→route assertions

### 1.2 Pages to add (checkable; AI writes, §6.5)
- [x] `/ui/dockview` (+ `splitview`, `gridview`, `paneview`, `dvwidget`, `dockview-router`; source: `ui/src/components/dockview*.tsx`, `gridview*.tsx`, `splitview*.tsx`, `paneview*.tsx`; spec: `plans/dockview-svelte-parity.md`)
- [x] `/ui/icon-picker` (source: `ui/src/models/icon-picker.ts`)
- [x] `/ui/group-nav` — group bindings + keyboard nav (sources: `ui/src/models/group.ts`, `ui/src/models/nav.ts`)
- [x] `/ui/split-theme` — split-button + split-radio-button + theme-toggle + options/select/combobox/multiselect model map (sources: `ui/src/models/split-*.tsx`, `theme-toggle.ts`, `options.tsx`)
- [ ] `/ui/forms` follow-up: `checkbox`/`checkbutton`/`radio-button` model mapping (source: `ui/src/models/checkbox.ts`, `checkbutton.tsx`, `radio-button.tsx`)
- [x] `/ui/directives` extensions (same page, new sections): `drag`/`drop`/`dragging`, `local-drag` + geometry, `scrollKeep`, adapter `tooltip` pointer
- [x] `/kit/head` — `Head`/`useHead` (source: `kit/src/head.tsx`, `head-mount.ts`, `platform/`)
- [x] `/kit/display` — move `ui/display.tsx` here, redirect `/ui/display` (decided §6.3: pages → code)
- [x] `/mutts/decorators` (index advertises Stage 3 + legacy, no page)
- [x] `/pure-glyf/setup` (Vite plugin, icon sources; `project.md` already lists it)
- [x] `/ui/palette` update (not new page): `describeItemConfiguration`/`describePaletteItemConfiguration`, descriptor sections, 13 editor capabilities, `scope.descriptor` threading

### 1.3 Per-page content check (one by one; each correction is tickable)
- [x] `/` (250): verify install/plugin snippets vs current barrel API
- [x] `/getting-started` (275): verify install, vite config, tsconfig paths
- [x] `/getting-started/concepts` (132): verify `extend()` usage, reactivity claims — verified accurate
- [x] `/core` (97): expand; check `Env`/`extend()` links — verified accurate (topics list correct)
- [x] `/core/jsx` (146): check pragma, `r()`, `this=` vs source — verified accurate
- [x] `/core/components` (168): check lifecycle, body-runs-once rule — verified accurate
- [x] `/core/meta-attributes` (173): check `if`/`when`/`pick`/`update:` vs `api-reference.md` — verified accurate
- [x] `/core/meta-components` (117): check `for`/`env`/`try` vs source — verified accurate
- [x] `/core/env` (119): check `extend()` semantics vs `utils.ts` — verified accurate
- [x] `/core/bind` (156): check two-way binding, `update:` syntax — verified accurate
- [x] `/core/ssr` (66): thin — expand dual entry (`dom`/`node`), JSDOM+ALS, `board` pointer — verified accurate as-is, no expansion needed
- [x] `/kit` (115): fix `stored('k','v')` → `stored({...})`, check client example
- [ ] `/kit/router` (241): check `ClientRouteDefinition`, `client.url` sync claims
- [ ] `/kit/client` (131): check reactive fields vs `platform/types.ts`
- [x] `/kit/intl` (112): thin — check `DisplayProvider` locale precedence vs `intl.tsx` — FIXED: `resolveLocale(env, explicit?)` = explicit > DisplayProvider > client.language; no `setLocaleResolver()` exists
- [x] `/kit/storage` (113): fix `stored()` signature, check storage-event + cleanup claims — storage.tsx already correct object form; verified vs `dom/storage.ts`
- [x] `/kit/css` (103): thin — check `componentStyle`, SSR `getSSRStyles()` vs `css.ts` — verified accurate, no change needed
- [x] `/kit/api` (153): check `api()`/`defineRoute()`/`intercept()` vs `kit/src/api/` — FIXED: `withSSR()` snippet replaced (no such export); timeout/retry/hydration-hook documented; kit index topics fixed (was "validation with arktype")
- [x] `/kit/router` (241): check `ClientRouteDefinition`, `client.url` sync claims — verified accurate (view(spec, env), catch-all, A, model split, dockview composition)
- [x] `/kit/client` (131): check reactive fields vs `platform/types.ts` — verified accurate
- [x] `/ui` (321): check headless/adapter story vs current models — verified accurate
- [x] `/ui/button` (279): check variants, `use:loading`, icon vs pico bridge — verified accurate
- [x] `/ui/accordion` (169): check vs `models/accordion.ts` — verified accurate
- [x] `/ui/card` (114): thin — check `Card.Header/Body/Footer`, variants — verified accurate
- [x] `/ui/forms` (957): check `Select`/`Combobox`/`Checkbox`/`Radio`/`Switch`/`Multiselect` vs models; split out model-mapping (§1.2) — verified accurate; model map added to `/ui/split-theme`
- [x] `/ui/layout` (373): check vs `models/layout.ts` — verified accurate
- [x] `/ui/menu` (161): check `Menu.Bar`, keyboard nav vs `models/menu.ts` — verified accurate
- [x] `/ui/typography` (265): check vs `models/typography.ts` — verified accurate
- [x] `/ui/status` (296): check vs `models/status.ts` — verified accurate
- [x] `/ui/stars` (144): check vs `models/stars.ts` — verified accurate
- [x] `/ui/progress` (90): thin — check vs `models/progress.ts` — verified accurate (native `<progress>`, indeterminate)
- [x] `/ui/overlays` (295): check `StandardOverlays`, `env.dialog/toast/drawer` vs `overlays.ts` + pico — verified accurate
- [x] `/ui/palette` (214): add Step-3 descriptor section (§1.2)
- [x] `/ui/infinite-scroll` (125): check vs `components/infinite-scroll.tsx` — verified accurate
- [x] `/ui/directives` (199): add `drag`/`local-drag`/`scrollKeep`/`tooltip` (§1.2)
- [x] `/ui/css-variables` (101): thin — FIXED: was full design-system fiction; now states the real contract (sizeable handle vars only) + intended-contract swatches
- [x] `/ui/display` (93): thin — move to `/kit/display` (§6.3), check `DisplayProvider`/`ThemeToggle`
- [x] `/ui/adapter` (107): thin — check adapter pattern vs `component.ts`/`options.ts` — verified accurate (representative sketch disclaimer present)
- [x] `/adapters` (77): thin — FIXED: documented that no `UiComponents`/`get-setAdapter` registry exists (barrel plugin replaced it)
- [x] `/adapters/pico` (50): thin — add install, bridge-CSS import, variant table, `use:tooltip`, icon factory
- [x] `/adapters/creating` (76): thin — check custom-adapter steps vs `UiComponents` type — verified accurate as tutorial (no registry type to check against)
- [ ] `/board/*` (69–103): frozen, see later (§6.2) — banner only, no content work
- [x] `/mutts` (65): thin — check philosophy + env entry points — verified accurate
- [x] `/mutts/signals` (101): thin — check `reactive`/`effect`/`memoize`/reasons vs mutts source — verified accurate
- [x] `/mutts/collections` (71): thin — check arrays/sets/maps, `project`/`scan` — verified accurate (morph/attend/lift)
- [x] `/mutts/zones` (86): thin — check zone isolation/history/undo — verified accurate
- [x] `/pure-glyf` (46): thin — check mask-image/CSS claims vs `pure-glyf/src` — verified accurate
- [x] `/pure-glyf/usage` (55): thin — check classes + factories vs source

## 2. What is outdated / drifted (all tickable)
- [x] `project.md`: fix route plan (`/ui/components/*` → flat `/ui/*`; `/core/directives` → `meta-attributes`/`meta-components`/`bind`); mark `Code`/`Demo` done; `vite ^7` → `^8.0.10`
- [x] `stored()` signature in `kit/index.tsx` + `kit/storage.tsx`: `stored('k','v')` → `stored({...})` per `kit/src/dom/storage.ts`
- [x] `adapters/pico.tsx`: add install, bridge-CSS import, variant table, `use:tooltip`, icon factory examples
- [x] `getting-started/index.tsx` + `index.tsx`: re-verify install / `sursautBarrelPlugin` / `sursautMinimalPackage` snippets
- [x] `package.json`: `mutts: 1.0.13` npm pin → workspace reference (or document why pinned) — RESOLVED: keep. Root `pnpm.overrides` + root deps pin `mutts: link:../mutts` (local 1.0.15); per-package `^1.0.13` ranges resolve through the override. Docs `1.0.13` exact is consistent with core/kit/ui ranges, not a drift.
- [x] `core/docs/api-reference.md`: kill `compose()` (§0); re-check `bindChildren`, `array.filter`, `atomic`, `watch`, `morph` vs source
- [x] `sandbox/usage.md` open items — PARTIALLY CLOSED: header added noting search/sidebar/routes/smoke progress; fragment-link + sidebar-resize now have e2e coverage (6.9); `sizeable` retired from the shell in favor of Splitview. Remaining (side-nav dark bg, code-block theming, search styling) are app styling bugs — tracked in usage.md itself
- [x] `sandbox/phase2.md`: mark landed pages, drop `/adapters/vanilla` or spec it, enforce per-page checklist — CLOSED with status header (vanilla dropped: no such source; checklist enforced via docs-check + smoke)

## 3. What is planned (in repo, not yet in docs)
- [ ] `project.md` Phase 3 leftovers: deploy (GitHub Pages/Netlify); search + mobile sidebar completion (see `sandbox/usage.md`)
- [x] `sandbox/phase2.md` pattern for every new page: `Section`/`Code`/`Demo`/`ApiTable`, snippets as constants, route entry, clean build, render check — all new pages this session follow it
- [x] `plans/dockview-svelte-parity.md` → docs pages (§1.2): `PanelState`, typed `openPanel` + handle, registry + `DvWidget`, `bind:active/floating/popout` + `GroupState`, watermark, event passthrough, layout loop guard, `Splitview`/`Gridview`/`Paneview`, ~40 types + 4 contexts, 12 concept demos — covered in `/ui/dockview`
- [x] Palette Step 3 → `ui/palette.tsx`: descriptor section (§1.2)

---

## 4. Can be solved quickly (manual, small)
- [x] §1.1 sidebar entries (mutts, pure-glyf)
- [x] §2 `stored()` + `project.md` fixes
- [x] §0 compose kill (4 subticks)
- [x] §6.3 `/ui/display` → `/kit/display` move + redirect
- [x] Smoke: route-presence assertions (every `routes.tsx` path renders `<article>` + is in `navigation` or explicitly hidden)

## 5. Checks (scripted) + deliberately not built
- [x] Routes↔nav↔files matrix — `docs-check.ts` + smoke assertions (`pnpm docs:check`)
- [x] Stub detector — in `docs-check.ts` (marker grep + short-file heuristic exempting Demo/2+Section pages); `docs-check: OK`
- [x] Dead-link check — `<A href>` vs known routes in `docs-check.ts` (template literals stripped)
- [x] Coverage report — stub section of `docs-check.ts` serves this; `pnpm docs:check` wired
- [ ] Snippet typecheck — NOT BUILT: `Code`/`Demo` literals are illustrative snippets, not compilable units (elided imports, pseudo-state, `...` gaps). A `tsc` pass would drown in false positives; manual per-page verification (§1.3) covers it.
- [ ] Per-symbol export-vs-page matrix — NOT BUILT: page-level granularity (routes↔nav↔files) is the right level; per-symbol diffs churn with every refactor and add no signal beyond "a new model exists", which code review already catches.
- [ ] `ApiTable` name-level diff — NOT BUILT: tables carry human descriptions by design (§6.4/§6.8); a name diff can't judge them and would flag every intentional simplification.

## 6. Decisions (resolved) + tickables
- [x] 6.1 `compose.tsx`: KILL (§0, 4 subticks)
- [ ] 6.2 `board/*`: AFTER ALL OTHER PACKAGES — keep banner, freeze content; board docs begin only once core/kit/ui/adapters/mutts/pure-glyf docs are finished
- [x] 6.3 Pages → code: move `/ui/display` → `/kit/display` + redirect; audit other misplaced pages (overlays vs models, intl vs kit)
- [x] 6.4 `ApiTable`: FULL AI WHEN SAFE — applied this session: new pages' tables drafted from source types; per-page ticks in §1.3
- [x] 6.5 New pages (§1.2): ALL APPROVED, AI writes per `phase2.md` pattern — DONE (head, decorators, setup, icon-picker, group-nav, split-theme, dockview)
- [x] 6.6 Search: FULL POSSIBILITY — DONE: `search.tsx` ranks title > section > full-text (headings+snippets from generated `search-index.ts` via `docs-index.ts`, wired into dev/build); dark-theme styling still open (usage.md)
- [x] 6.7 SSR: NO for now — static SPA stays; revisit after `board` rework
- [x] 6.8 Adapter docs: TUTORIAL, AI-first but human-friendly — DONE: pico expanded + creating verified as tutorial; no prop→class tables
- [x] 6.9 E2E bar (Playwright): [x] per-page render (58 routes in `smoke.spec.ts`); [x] fragment-link scroll (`/getting-started#installation` in viewport, retry-tolerant `scrollToHashTarget`); [x] sidebar resize drag (Splitview sash test, sash-absent tolerant); [x] mobile nav open/close; [x] search returns `mutts`/`pure-glyf` pages

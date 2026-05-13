# Releasing Sursaut packages

## Scope (current npm wave)

Publishable from this monorepo:

- `@sursaut/core`
- `@sursaut/kit`
- `@sursaut/ui`
- `@sursaut/adapter-pico`
- `pure-glyf`

**Not published:** `@sursaut/monorepo` (root), `@sursaut/docs` (private site), `@sursaut/board` (`private: true` until the rework is ready).

## Preconditions

- `pnpm` **10.x** (see root `packageManager`).
- One-time: `pnpm install` from `sursaut/`.
- For E2E: `pnpm exec playwright install chromium` (CI installs with `--with-deps`).

## Verify locally

```bash
pnpm run build
pnpm run test
pnpm run lint
pnpm run release:verify
```

`release:verify` runs `pnpm pack` for each publishable package into `sandbox/packs/` (inspect tarballs before publishing).

### Install-test verification (optional but recommended)

After `release:verify`, verify each packed `.tgz` installs and works correctly:

```bash
# @sursaut/core
cd install-test/core
npm install
node test-node.mjs

# @sursaut/kit
cd ../kit
npm install
npm test
npm run test:node

# @sursaut/ui
cd ../ui
npm install
npm test
npm run test:node

# pure-glyf
cd ../pure-glyf
npm install
npm test
```

## Publish order

Internal dependency graph — publish in this order (or use a single workspace publish so `pnpm` can order by dependencies):

1. `@sursaut/core`
2. `@sursaut/kit`
3. `@sursaut/ui`
4. `@sursaut/adapter-pico`
5. `pure-glyf`

Example (with npm OTP / provenance as you prefer):

```bash
pnpm publish --filter @sursaut/core --access public --no-git-checks
pnpm publish --filter @sursaut/kit --access public --no-git-checks
pnpm publish --filter @sursaut/ui --access public --no-git-checks
pnpm publish --filter @sursaut/adapter-pico --access public --no-git-checks
pnpm publish --filter pure-glyf --access public --no-git-checks
```

`workspace:*` specifiers in manifests are rewritten on publish when using `pnpm publish` from the workspace.

## Official documentation site

- Build: `pnpm run build:docs`
- Deploy (Cloudflare Pages): `pnpm run deploy:docs` (builds then `wrangler pages deploy …`)

Optional env when building the site:

- `DOCS_BASE` — Vite `base` (e.g. `/docs/` for a project subpath). Default `/`.
- `DOCS_SITE_URL` — canonical / Open Graph origin (no trailing slash). Default `https://sursaut-docs.pages.dev`.

Subpath hosting: call `setRouterPathnamePrefix(import.meta.env.BASE_URL)` in the app entry (the docs app already does).

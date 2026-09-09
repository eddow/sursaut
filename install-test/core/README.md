# Install Test for @sursaut/core

This directory tests that `@sursaut/core` can be installed and used from a packed `.tgz` artifact.

## Setup

1. Build and pack the core package:
   ```bash
   cd packages/core
   pnpm build
   pnpm pack --pack-destination ../../sandbox/packs
   ```

2. Install dependencies in this test directory:
   ```bash
   cd install-test/core
   pnpm install
   ```

## Running Tests

Type-check against the installed package:
```bash
pnpm exec tsc --noEmit
```

Run the Node.js test:
```bash
node test-node.mjs
```

## What's Tested

- Package can be installed from the `.tgz` file
- Transitive dependency (`mutts`) resolves from npm, not the workspace link
- TypeScript types resolve (`h`, `Fragment`, `latch`, JSX elements)
- Node entry point (`@sursaut/core/node`) works at runtime (`withSSR`, `renderToString`)

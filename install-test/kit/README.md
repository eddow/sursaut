# Install Test for @sursaut/kit

This directory tests that `@sursaut/kit` can be installed and used from a packed `.tgz` artifact.

## Setup

1. Build and pack the kit package:
   ```bash
   cd packages/kit
   pnpm build
   pnpm pack --pack-destination ../../sandbox/packs
   ```

2. Install dependencies in this test directory:
   ```bash
   cd install-test/kit
   npm install
   ```

## Running Tests

Run the vitest tests:
```bash
npm test
```

Run the Node.js test:
```bash
npm run test:node
```

## What's Tested

- Package can be installed from the `.tgz` file
- All main exports are accessible:
  - Router: `createRouter`, `RouterProvider`, `Link`, `useRoute`, `useRouter`
  - Intl: `IntlProvider`, `useIntl`, `useLocale`
  - DOM: `DisplayProvider`, `useDisplay`
  - Node: `createStorage`
  - Models: `LinkModel`, `linkModel`
- Basic functionality works (router creation, storage, etc.)

# Install Test for @sursaut/ui

This directory tests that `@sursaut/ui` can be installed and used from a packed `.tgz` artifact.

## Setup

1. Build and pack the ui package:
   ```bash
   cd packages/ui
   pnpm build
   pnpm pack --pack-destination ../../sandbox/packs
   ```

2. Install dependencies in this test directory:
   ```bash
   cd install-test/ui
   npm install
   ```

## Running Tests

Run the vitest tests:
```bash
npm test
```

Run the Node.js test (CSS-free subpaths):
```bash
npm run test:node
```

## What's Tested

- Package can be installed from the `.tgz` file
- **Models subpath** (`@sursaut/ui/models`) — all headless model functions are accessible:
  - Input: `buttonModel`, `checkboxModel`, `checkButtonModel`, `radioButtonModel`
  - Container: `accordionModel`, `stackModel`, `inlineModel`, `gridModel`, `containerModel`, `appShellModel`
  - Selection: `selectModel`, `multiselectModel`, `menuModel`
  - Display: `progressModel`, `starsModel`, `badgeModel`, `pillModel`, `chipModel`
  - Content: `linkModel`, `headingModel`, `textModel`
  - Overlays: `dialogModel`, `drawerModel`, `toastModel`, `withOverlaysModel`
  - Utility: `themeToggleModel`
- **Dockview subpath** (`@sursaut/ui/dockview`) — `Dockview`, `DockviewRouter`
- Model contracts verified (button disabled, progress value/max, link onClick/aria-current, etc.)

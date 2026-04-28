import path from 'node:path';
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      'sursaut-ts/server': path.resolve(__dirname, '../core/src/node/index.ts'),
      'sursaut-ts': path.resolve(__dirname, '../core/src'),
      'sursaut-ui': path.resolve(__dirname, '../ui/src'),
      '@sursaut/kit': path.resolve(__dirname, '../kit/src'),
      'mutts': path.resolve(__dirname, '../../../mutts'),
      'npc-script': path.resolve(__dirname, '../../../npcs/src'),
      'omni18n': path.resolve(__dirname, '../../../omni18n/src'),
      'sursaut-board/client': path.resolve(__dirname, 'src/client'),
      'sursaut-board/server': path.resolve(__dirname, 'src/server'),
      '@sursaut/board': path.resolve(__dirname, 'src'), // Local project reference
      'sursaut-board': path.resolve(__dirname, 'src'), // Default to server in Node test env
    },
  },
  test: {
    include: ["src/**/*.spec.ts", "tests/integration/**/*.spec.ts"],
    environment: "node",
    setupFiles: ["tests/setup-mutts.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["**/tests/**", "**/node_modules/**", "**/dist/**"],
    },
  },
});

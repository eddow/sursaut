import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { sursautCorePlugin } from '../core/src/plugin/index'
import dts from 'vite-plugin-dts'

const rootDir = resolve(__dirname, '..')
const boardDir = __dirname
const isWatch = process.argv.includes('--watch')

export default defineConfig({
  plugins: [
    sursautCorePlugin({
      projectRoot: boardDir,
    }),
    dts({
      tsconfigPath: resolve(boardDir, 'tsconfig.build.json'),
      rollupTypes: false,
      insertTypesEntry: true,
      compilerOptions: {
        preserveSymlinks: false,
      },
      exclude: [
        'tests/**/*',
        'demo/**/*',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
    }),
  ],
  esbuild: false,
  oxc: false,
  resolve: {
    alias: {
      'sursaut-ts/server': resolve(boardDir, '../core/src/node/index.ts'),
      'sursaut-ts': resolve(boardDir, '../core/src'),
      'sursaut-ui': resolve(boardDir, '../ui/src'),
      '@sursaut/kit': resolve(boardDir, '../kit/src'),
      'mutts': resolve(rootDir, '../../../mutts/src'),
      'npc-script': resolve(rootDir, '../../../npcs/src'),
      'omni18n': resolve(rootDir, '../../../omni18n/src'),
      'sursaut-board/client': resolve(boardDir, 'src/client'),
      'sursaut-board/server': resolve(boardDir, 'src/server'),
      'sursaut-board': resolve(boardDir, 'src'),
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(boardDir, 'src/index.ts'),
        client: resolve(boardDir, 'src/client/index.ts'),
        server: resolve(boardDir, 'src/server/index.ts'),
        cli: resolve(boardDir, 'src/cli/index.ts'),
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rolldownOptions: {
      external: [
        'mutts',
        /^@sursaut\/core/,
        /^@sursaut\/kit/,
        /^@sursaut\/ui/,
        'hono',
        '@hono/node-server',
        'zod',
        'cac',
        'vite',
        'fsevents',
        'node:async_hooks',
        'node:child_process',
        'node:fs',
        'node:fs/promises',
        'node:http',
        'node:path',
        'node:module',
        'node:os',
        'node:crypto',
        'node:net',
        'node:util',
        'node:perf_hooks',
        'node:url',
        'node:process',
      ],
      output: {
        keepNames: true,
        preserveModules: true,
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    target: 'esnext',
    emptyOutDir: !isWatch,
    sourcemap: 'inline',
  },
})

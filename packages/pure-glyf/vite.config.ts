import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { sursautCorePlugin } from '@sursaut/core/plugin';

const isWatch = process.argv.includes('--watch');
const sursautDts = "export declare function registerGlyfIconFactory(): void;\n";

function ensureStableTypeEntrypoints() {
  const distDir = resolve(import.meta.dirname, 'dist');
  const entrypoints = [
    ['index.d.ts', "export * from '../src/index'\n"],
    ['plugin.d.ts', "export * from '../src/plugin'\n"],
    ['inject.d.ts', "export * from '../src/inject'\n"],
    ['generator.d.ts', "export * from '../src/generator'\n"],
    ['sursaut.d.ts', sursautDts],
  ];
  return {
    name: 'ensure-stable-type-entrypoints',
    buildStart() {
      mkdirSync(distDir, { recursive: true });
      for (const [file, content] of entrypoints) {
        const target = resolve(distDir, file);
        mkdirSync(dirname(target), { recursive: true });
        if (!existsSync(target)) writeFileSync(target, content);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    ensureStableTypeEntrypoints(),
    sursautCorePlugin(),
    dts({
      exclude: ['src/sursaut.tsx'],
      insertTypesEntry: true,
      beforeWriteFile(filePath, content) {
        return {
          filePath,
          content: content
            .replace(/from\s+['"]\.\.[\/\w.-]*\/ui\/dist[\/\w.-]*['"]/g, "from '@sursaut/ui'")
            .replace(/from\s+['"]\.\.[\/\w.-]*\/core\/dist[\/\w.-]*['"]/g, "from '@sursaut/core'")
        }
      },
      afterBuild() {
        const sursautDtsPath = resolve(import.meta.dirname, 'dist/sursaut.d.ts');
        writeFileSync(sursautDtsPath, sursautDts);
      }
    })
  ],
  build: {
    emptyOutDir: !isWatch,
    lib: {
      entry: {
        index: './src/index.ts',
        plugin: './src/plugin.ts',
        inject: './src/inject.ts',
        generator: './src/generator.ts',
        sursaut: './src/sursaut.tsx',
      },
      formats: ['es', 'cjs'],
    },
    rolldownOptions: {
      output: {
        keepNames: true,
      },
      external: ['vite', 'node:fs', 'node:path', /^@sursaut\/core/, /^@sursaut\/ui/]
    },
    sourcemap: true
  }
});

/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'node:url'
import { sursautCorePackage } from '@sursaut/core/plugin'

const projectRootDir = dirname(fileURLToPath(import.meta.url))
const isWatch = process.argv.includes('--watch')

function ensureStableTypeEntrypoints() {
	const distDir = resolve(projectRootDir, 'dist')
	const entrypoints = [
		['dom.d.ts', "export * from '../src/dom/index'\n"],
		['node.d.ts', "export * from '../src/node/index'\n"],
	]
	return {
		name: 'ensure-stable-type-entrypoints',
		buildStart() {
			mkdirSync(distDir, { recursive: true })
			for (const [file, content] of entrypoints) {
				const target = resolve(distDir, file)
				if (!existsSync(target)) writeFileSync(target, content)
			}
		},
	}
}

export default defineConfig({
  plugins: [
    ...(isWatch ? [ensureStableTypeEntrypoints()] : []),
    ...sursautCorePackage({
      core: {
        projectRoot: projectRootDir,
      },
      dts: {
        rollupTypes: false,
        insertTypesEntry: true,
        compilerOptions: {
          preserveSymlinks: false,
        }
      }
    }),
  ],
  esbuild: false,
  oxc: false,
  build: {
    sourcemap: true,
    emptyOutDir: !isWatch,
    lib: {
      entry: {
        index: resolve(projectRootDir, 'src/index.ts'),
        dom: resolve(projectRootDir, 'src/dom/index.ts'),
        node: resolve(projectRootDir, 'src/node/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rolldownOptions: {
      output: {
        keepNames: true,
      },
      external: [
        'mutts',
        /^@sursaut\//,
        'jsdom',
        'arktype',
        'node:async_hooks',
        /^node:/,
      ]
    }
  },
})

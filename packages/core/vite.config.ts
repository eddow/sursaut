import { defineConfig } from 'vitest/config'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sursautCorePackage } from './src/plugin/index'

const projectRootDir = dirname(fileURLToPath(import.meta.url))
const isWatch = process.argv.includes('--watch')

function ensureStableTypeEntrypoints() {
	const distDir = join(projectRootDir, 'dist')
	const entrypoints = [
		['dom.d.ts', "export * from '../src/dom/index'\n"],
		['node.d.ts', "export * from '../src/node/index'\n"],
		['plugin.d.ts', "export * from '../src/plugin/index'\n"],
		['testing.d.ts', "export * from '../src/testing/index'\n"],
		['jsx.d.ts', "export * from '../src/types/jsx'\n"],
	]
	return {
		name: 'ensure-stable-type-entrypoints',
		buildStart() {
			mkdirSync(distDir, { recursive: true })
			for (const [file, content] of entrypoints) {
				const target = join(distDir, file)
				if (!existsSync(target)) writeFileSync(target, content)
			}
		},
	}
}

console.error('--- vite.config.ts LOADED ---')
export default defineConfig({
	root: '.',
	server: {
		fs: {
			allow: [projectRootDir],
		},
		headers: {
			'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
			Pragma: 'no-cache',
			Expires: '0',
		},
	},
	css: {
		preprocessorOptions: {
			scss: {
				// SCSS options can be added here if needed
			}
		}
	},
	resolve: {
		conditions: ['browser', 'default', 'import'],
		alias: {
			// for demo purpose - no '@sursaut/core' in lib
			'@sursaut/core': resolvePath(projectRootDir, 'src/dom/index.ts'),
		},
	},
	plugins: [
		...(isWatch ? [ensureStableTypeEntrypoints()] : []),
		...sursautCorePackage({
			core: {
				projectRoot: projectRootDir,
			},
			dts: {
				rollupTypes: true,
				exclude: ['**/node_modules/**', '**/mutts/**', '**/*.spec.ts', '**/*.spec.tsx', '**/demo/**', '**/src/entry.ts', '**/tests/**'],
				afterBuild() {
					// Copy JSX types to dist, rewriting relative imports to point to rolled-up dom.d.ts
					const jsxSource = readFileSync(join(projectRootDir, 'src/types/jsx.d.ts'), 'utf8')
					const jsxDist = jsxSource
						.replace(
							/import type \{ Children as SourceChildren, SursautElement, Env \} from '\.\.\/lib\/sursaut-element'/g,
							"import type { Children as SourceChildren, SursautElement, Env } from './dom'"
						)
						.replace(/from\s+['"]\.\.\/lib(?:\/\w+)?['"]/g, "from '.'")
						.replace(/from\s+['"]\.['"](?=\n|\r|;)/g, "from './dom'")
						.replace(/from\s+['"]\.\.\/lib['"]/g, "from '.'")
					writeFileSync(join(projectRootDir, 'dist/jsx.d.ts'), jsxDist)
					// Rewrite rolled-up declaration imports so published d.ts files depend on package names,
					// not workspace-relative filesystem paths.
					for (const entry of ['dom.d.ts', 'node.d.ts']) {
						const file = join(projectRootDir, 'dist', entry)
						if (!existsSync(file)) continue
						const content = readFileSync(file, 'utf8')
						const normalized = content.replace(
							/from\s+['"](?:\.\.\/)+(mutts)(?:\/[^'"]*)?['"]/g,
							"from '$1'"
						)
						writeFileSync(file, normalized)
					}
					// Add /// <reference> to dom.d.ts and node.d.ts so consumers get JSX namespace
					for (const entry of ['dom.d.ts', 'node.d.ts']) {
						const file = join(projectRootDir, 'dist', entry)
						if (!existsSync(file)) continue
						const content = readFileSync(file, 'utf8')
						if (!content.includes('jsx.d.ts')) {
							writeFileSync(file, `/// <reference path="./jsx.d.ts" />\n${content}`)
						}
					}
				},
			}
		}),
	],
	esbuild: false,
	oxc: false,
	optimizeDeps: {
		exclude: ['mutts'],
	},
	build: {
		lib: {
			entry: {
				dom: resolvePath(projectRootDir, 'src/dom/index.ts'),
				node: resolvePath(projectRootDir, 'src/node/index.ts'),
				plugin: resolvePath(projectRootDir, 'src/plugin/index.ts'),
				testing: resolvePath(projectRootDir, 'src/testing/index.ts'),
			},
			formats: ['es', 'cjs'],
			fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
		},
		rolldownOptions: {
			output: {
				keepNames: true,
			},
			external: [
				'mutts', 'jsdom',
				'@babel/core', '@babel/types',
				'@babel/plugin-proposal-decorators',
				'@babel/plugin-transform-react-jsx',
				'@babel/plugin-transform-typescript',
				'vite', 'vite-plugin-dts',
				'node:fs', 'node:path', 'node:url', 'node:async_hooks',
			],
		},
		outDir: 'dist',
		emptyOutDir: !isWatch,
		target: 'esnext',
		minify: false,
		sourcemap: 'inline'
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['./tests/setup-mutts.ts'],
		globals: true,
		include: ['**/*.spec.{ts,tsx}'],
		resolveSnapshotPath: (testPath, snapExtension) => testPath + snapExtension,
	}
})

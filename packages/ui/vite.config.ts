import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { sursautCorePlugin } from '@sursaut/core/plugin'

const isWatch = process.argv.includes('--watch')

function ensureStableTypeEntrypoints() {
	const distDir = resolve(__dirname, 'dist')
	const entrypoints = [
		['index.d.ts', "export * from '../src/index'\n"],
		['dockview.d.ts', "export * from '../src/dockview'\n"],
		['palette.d.ts', "export * from './palette/index'\n"],
		['models/index.d.ts', "export * from '../../src/models/index'\n"],
	]
	return {
		name: 'ensure-stable-type-entrypoints',
		buildStart() {
			mkdirSync(distDir, { recursive: true })
			for (const [file, content] of entrypoints) {
				const target = resolve(distDir, file)
				mkdirSync(dirname(target), { recursive: true })
				if (!existsSync(target)) writeFileSync(target, content)
			}
		},
	}
}

export default defineConfig({
	build: {
		lib: {
			entry: {
				dockview: resolve(__dirname, 'src/dockview.ts'),
				index: resolve(__dirname, 'src/index.ts'),
				models: resolve(__dirname, 'src/models/index.ts'),
				palette: resolve(__dirname, 'src/palette/index.ts'),
			},
			formats: ['es'],
		},
		sourcemap: true,
		emptyOutDir: !isWatch,
		rolldownOptions: {
			output: {
				keepNames: true,
			},
			external: [/^@sursaut\//, /^dockview-core/, /^mutts/],
		},
	},
	plugins: [
		ensureStableTypeEntrypoints(),
		sursautCorePlugin(),
		dts({
			include: ['src/**/*.ts', 'src/**/*.tsx'],
			exclude: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
		}),
	],
	// For demo/e2e development: resolve @sursaut/ui to source instead of dist
	resolve: {
		alias: {
			'@sursaut/ui/dockview': resolve(__dirname, 'src/dockview.ts'),
			'@sursaut/ui/palette': resolve(__dirname, 'src/palette/index.ts'),
			'@sursaut/ui': resolve(__dirname, 'src/index.ts'),
		},
	},
})

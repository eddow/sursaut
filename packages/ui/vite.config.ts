import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { mkdirSync, writeFileSync, existsSync, copyFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
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

function copyCSSFiles() {
	return {
		name: 'copy-css-files',
		writeBundle() {
			// Copy palette.css
			const srcPalette = resolve(__dirname, 'src/palette/palette.css')
			const distPalette = resolve(__dirname, 'dist/palette.css')
			if (existsSync(srcPalette)) {
				mkdirSync(dirname(distPalette), { recursive: true })
				copyFileSync(srcPalette, distPalette)
			}
			
			// Copy styles/* directory
			const srcStylesDir = resolve(__dirname, 'src/styles')
			const distStylesDir = resolve(__dirname, 'dist/styles')
			if (existsSync(srcStylesDir)) {
				mkdirSync(distStylesDir, { recursive: true })
				const files = readdirSync(srcStylesDir)
				for (const file of files) {
					const srcFile = join(srcStylesDir, file)
					const destFile = join(distStylesDir, file)
					const stat = statSync(srcFile)
					if (stat.isFile()) {
						copyFileSync(srcFile, destFile)
					}
				}
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
		copyCSSFiles(),
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

import { resolve } from 'node:path'
import { sursautCorePlugin } from '@sursaut/core/plugin'
import { defineConfig } from 'vite'

export default defineConfig({
	root: __dirname,
	plugins: [sursautCorePlugin()],
	build: {
		rolldownOptions: {
			output: {
				keepNames: true,
			},
		},
	},
	resolve: {
		alias: [
			{ find: '@sursaut/adapter-pico/css', replacement: resolve(__dirname, '../src/pico.sass') },
			{ find: '@sursaut/adapter-pico', replacement: resolve(__dirname, '../src/index.ts') },
			{
				find: '@sursaut/ui/palette',
				replacement: resolve(__dirname, '../../../ui/src/palette/index.ts'),
			},
			{
				find: '@sursaut/ui/models',
				replacement: resolve(__dirname, '../../../ui/src/models/index.ts'),
			},
			{ find: '@sursaut/ui', replacement: resolve(__dirname, '../../../ui/src/index.ts') },
		],
	},
})

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'

import { sursautCorePlugin } from '@sursaut/core/plugin'

export default defineConfig({
	plugins: [
		sursautCorePlugin(),
		dts({
			tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
			include: ['src'],
			exclude: ['demo', '**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
			outDir: 'dist',
			rollupTypes: false,
			insertTypesEntry: true,
		}),
	],
	build: {
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			name: 'SursautAdapterPico',
			formats: ['es', 'cjs'],
			fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
		},
		sourcemap: true,
		rolldownOptions: {
			output: {
				keepNames: true,
			},
			external: [/^@sursaut\//, /^mutts/, /^pure-glyf/, '@picocss/pico', 'arktype'],
		},
	},
})

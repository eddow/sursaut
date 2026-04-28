import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sursautCorePlugin } from '../packages/core/src/plugin/index'
import { playwright } from '@vitest/browser-playwright'

// @ts-expect-error Leave vite do his stuffs
const rootDir = fileURLToPath(new URL('.', import.meta.url))
const isBrowser = process.env.TEST_ENV === 'browser'
const workspaceRoot = resolve(rootDir, '..')
export const createBaseConfig = (packageDir: string) => {
	return defineConfig({
		plugins: [
			sursautCorePlugin({
				projectRoot: workspaceRoot,
			}),
		],
		esbuild: false,
		oxc: false,
		resolve: {
			alias: {
				'mutts/debug': resolve(workspaceRoot, '../mutts/debug/index.ts'),
				'mutts': resolve(workspaceRoot, '../mutts'),
				'pure-glyf': resolve(workspaceRoot, 'packages/pure-glyf/src/index.ts'),
				'@sursaut/core/testing': resolve(
					workspaceRoot,
					'packages/core/src/testing/index.ts'
				),
				'@sursaut/core/node': resolve(workspaceRoot, 'packages/core/src/node/index.ts'),
				'@sursaut/core': resolve(workspaceRoot, isBrowser
					? 'packages/core/src/dom/index.ts'
					: 'packages/core/src/node/index.ts'),
				'@sursaut/kit': resolve(workspaceRoot, 'test/ep.ts'),
				'@sursaut/ui': resolve(workspaceRoot, 'packages/ui/src'),
				'@sursaut/board': resolve(workspaceRoot, 'packages/board/src'),
				'@sursaut/core/plugin': resolve(workspaceRoot, 'packages/core/src/plugin/index.ts'),
			},
		},
		root: packageDir,
		test: {
			include: ['**/*.spec.{ts,tsx}'],
			exclude: ['**/node_modules/**', '**/dist/**'],
			resolveSnapshotPath: (testPath, snapExtension) => testPath + snapExtension,
			setupFiles: [resolve(rootDir, 'test-setup.ts')],
			browser: {
				enabled: isBrowser,
				headless: true,
				instances: [{
					browser: 'chromium',
					provider: playwright({
						launchOptions: { channel: 'chrome' },
					}),
				}],
			},
		},
	})
}

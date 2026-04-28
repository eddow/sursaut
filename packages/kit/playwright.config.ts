import { defineConfig, devices } from '@playwright/test'

const projectRootDir = decodeURIComponent(new URL('.', import.meta.url).pathname)
const port = 5280

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.test.ts',

	timeout: 30_000,
	expect: {
		timeout: 5_000,
	},
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: `http://127.0.0.1:${port}`,
		headless: true,
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chrome',
			use: {
				...devices['Desktop Chrome'],
				channel: 'chrome',
			},
		},
	],
	webServer: {
		command: 'pnpm demo',
		cwd: projectRootDir,
		env: {
			CHOKIDAR_INTERVAL: '1000',
			CHOKIDAR_USEPOLLING: 'true',
		},
		port,
		timeout: 120_000,
		reuseExistingServer: true,
	},
})

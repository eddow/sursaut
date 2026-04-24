import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests',
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	use: {
		baseURL: 'http://127.0.0.1:4173',
		trace: 'on-first-retry',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
		cwd: '.',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI,
	},
})

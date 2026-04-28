import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { sursautBarrelPlugin, sursautMinimalPackage } from '@sursaut/core/plugin'

/** Vite `base`: must end with `/` unless `/`. From `DOCS_BASE` env (e.g. `/docs/`). */
function viteBaseFromEnv(value: string | undefined): string {
	if (value == null || value === '' || value === '/') return '/'
	const withLead = value.startsWith('/') ? value : `/${value}`
	return withLead.endsWith('/') ? withLead : `${withLead}/`
}

const base = viteBaseFromEnv(process.env.DOCS_BASE)

export default defineConfig({
	base,
	root: resolve(import.meta.dirname, '.'),
	plugins: [
		{
			name: 'docs-html-meta',
			transformIndexHtml(html) {
				const site =
					process.env.DOCS_SITE_URL?.trim() ?? 'https://sursaut-docs.pages.dev'
				const canonicalRoot = site.endsWith('/') ? site.slice(0, -1) : site
				const basePath = base === '/' ? '' : base.replace(/\/$/, '')
				const ogUrl = `${canonicalRoot}${basePath || ''}/`
				return html
					.replaceAll('%DOCS_OG_URL%', ogUrl)
					.replaceAll('%DOCS_CANONICAL%', ogUrl)
			},
		},
		...sursautMinimalPackage(),
		sursautBarrelPlugin({ skeleton: 'front-end', adapter: '@sursaut/adapter-pico' }),
	],
	build: {
		chunkSizeWarningLimit: 600,
		rolldownOptions: {
			output: {
				keepNames: true,
			},
			onwarn(warning, warn) {
				if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
				if (warning.message?.includes('node:async_hooks')) return
				warn(warning)
			},
		},
	},
	server: {
		port: 5290,
		fs: {
			allow: [resolve(import.meta.dirname, '../../..')],
		},
	},
})

import { latch } from '@sursaut'
import { setRouterPathnamePrefix } from '@sursaut/kit'
import '@picocss/pico/css/pico.min.css'
import '@sursaut/ui/styles/sizeable.sass'
import './styles/docs.sass'
import './styles/theme-serene-confidence.css'
import { ensureHighlightThemes } from './highlight-theme'
import { DocsApp } from './layout'

setRouterPathnamePrefix(import.meta.env.BASE_URL)
ensureHighlightThemes()
latch('#app', <DocsApp />)

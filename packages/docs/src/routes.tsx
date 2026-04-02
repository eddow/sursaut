import type { ClientRouteDefinition, Env } from '@sursaut'
import CreatingAdapterPage from './pages/adapters/creating'
import AdaptersIndexPage from './pages/adapters/index'
import PicoAdapterPage from './pages/adapters/pico'
import BoardIndexPage from './pages/board/index'
import BoardMiddlewarePage from './pages/board/middleware'
import BoardRoutingPage from './pages/board/routing'
import BoardSsrPage from './pages/board/ssr'
import BindPage from './pages/core/bind'
import ComponentsPage from './pages/core/components'
import ComposePage from './pages/core/compose'
import ScopePage from './pages/core/env'
import CorePage from './pages/core/index'
import JsxPage from './pages/core/jsx'
import MetaAttributesPage from './pages/core/meta-attributes'
import MetaComponentsPage from './pages/core/meta-components'
import SSRPage from './pages/core/ssr'
import ConceptsPage from './pages/getting-started/concepts'
import GettingStartedPage from './pages/getting-started/index'
import IndexPage from './pages/index'
import KitApiPage from './pages/kit/api'
import ClientPage from './pages/kit/client'
import CSSPage from './pages/kit/css'
import KitPage from './pages/kit/index'
import IntlPage from './pages/kit/intl'
import RouterPage from './pages/kit/router'
import StoragePage from './pages/kit/storage'
import MuttsCollectionsPage from './pages/mutts/collections'
import MuttsIndexPage from './pages/mutts/index'
import MuttsSignalsPage from './pages/mutts/signals'
import MuttsZonesPage from './pages/mutts/zones'
import PureGlyfIndexPage from './pages/pure-glyf/index'
import PureGlyfUsagePage from './pages/pure-glyf/usage'
import AccordionPage from './pages/ui/accordion'
import AdapterPage from './pages/ui/adapter'
import ButtonPage from './pages/ui/button'
import CardPage from './pages/ui/card'
import CssVariablesPage from './pages/ui/css-variables'
import UiDirectivesPage from './pages/ui/directives'
import DisplayPage from './pages/ui/display'
import FormsPage from './pages/ui/forms'
import UIPage from './pages/ui/index'
import InfiniteScrollPage from './pages/ui/infinite-scroll'
import LayoutPage from './pages/ui/layout'
import MenuPage from './pages/ui/menu'
import OverlaysPage from './pages/ui/overlays'
import PalettePage from './pages/ui/palette'
import ProgressPage from './pages/ui/progress'
import StarsPage from './pages/ui/stars'
import StatusPage from './pages/ui/status'
import TypographyPage from './pages/ui/typography'

// Route type that includes the view function
type AppRoute = ClientRouteDefinition & {
	readonly view: (spec: { params: Record<string, string> }, env: Env) => JSX.Element
}

const routes: AppRoute[] = [
	{ path: '/', view: IndexPage },
	{ path: '/getting-started', view: GettingStartedPage },
	{ path: '/getting-started/concepts', view: ConceptsPage },
	{ path: '/core', view: CorePage },
	{ path: '/core/jsx', view: JsxPage },
	{ path: '/core/components', view: ComponentsPage },
	{ path: '/core/meta-attributes', view: MetaAttributesPage },
	{ path: '/core/meta-components', view: MetaComponentsPage },
	{ path: '/core/env', view: ScopePage },
	{ path: '/core/compose', view: ComposePage },
	{ path: '/core/bind', view: BindPage },
	{ path: '/core/ssr', view: SSRPage },
	{ path: '/kit', view: KitPage },
	{ path: '/kit/router', view: RouterPage },
	{ path: '/kit/client', view: ClientPage },
	{ path: '/kit/intl', view: IntlPage },
	{ path: '/kit/storage', view: StoragePage },
	{ path: '/kit/css', view: CSSPage },
	{ path: '/kit/api', view: KitApiPage },
	{ path: '/ui', view: UIPage },
	{ path: '/ui/button', view: ButtonPage },
	{ path: '/ui/accordion', view: AccordionPage },
	{ path: '/ui/card', view: CardPage },
	{ path: '/ui/overlays', view: OverlaysPage },
	{ path: '/ui/forms', view: FormsPage },
	{ path: '/ui/layout', view: LayoutPage },
	{ path: '/ui/palette', view: PalettePage },
	{ path: '/ui/progress', view: ProgressPage },
	{ path: '/ui/adapter', view: AdapterPage },
	{ path: '/ui/status', view: StatusPage },
	{ path: '/ui/stars', view: StarsPage },
	{ path: '/ui/menu', view: MenuPage },
	{ path: '/ui/typography', view: TypographyPage },
	{ path: '/ui/infinite-scroll', view: InfiniteScrollPage },
	{ path: '/ui/directives', view: UiDirectivesPage },
	{ path: '/ui/css-variables', view: CssVariablesPage },
	{ path: '/ui/display', view: DisplayPage },
	{ path: '/adapters', view: AdaptersIndexPage },
	{ path: '/adapters/pico', view: PicoAdapterPage },
	{ path: '/adapters/creating', view: CreatingAdapterPage },
	{ path: '/board', view: BoardIndexPage },
	{ path: '/board/routing', view: BoardRoutingPage },
	{ path: '/board/ssr', view: BoardSsrPage },
	{ path: '/board/middleware', view: BoardMiddlewarePage },
	{ path: '/mutts', view: MuttsIndexPage },
	{ path: '/mutts/signals', view: MuttsSignalsPage },
	{ path: '/mutts/collections', view: MuttsCollectionsPage },
	{ path: '/mutts/zones', view: MuttsZonesPage },
	{ path: '/pure-glyf', view: PureGlyfIndexPage },
	{ path: '/pure-glyf/usage', view: PureGlyfUsagePage },
]

export default routes

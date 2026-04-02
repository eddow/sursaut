/**
 * PicoCSS adapter for @sursaut/ui v2
 *
 * Usage:
 * ```tsx
 * import { Button, Card, Modal } from '@sursaut/adapter-pico'
 * ```
 */

// Import PicoCSS base styles as a side effect
import '@picocss/pico/css/pico.min.css'

// Export all components
export * from './components'
export * from './directives'
// Export factory for custom components
export { picoComponent } from './factory'
export * from './palette'

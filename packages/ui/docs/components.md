# Components catalogue

`@sursaut/ui` currently exports two concrete components in addition to its headless models.

## `Dockview`

A Dockview-backed layout component built on top of `dockview`.

### Purpose

Use `Dockview` when you need:

- dockable panels
- tabbed groups
- custom tab renderers
- serialized layout persistence
- group header actions

### Main exported types

- `Dockview`
- `DockviewWidget`
- `DockviewWidgetProps`
- `DockviewWidgetScope`
- `DockviewHeaderAction`
- `DockviewHeaderActionProps`

### Main props

- `api?: DockviewApi`
- `widgets: Record<string, DockviewWidget<any>>`
- `tabs?: Record<string, DockviewWidget<any>>`
- `headerLeft?: DockviewHeaderAction`
- `headerRight?: DockviewHeaderAction`
- `headerPrefix?: DockviewHeaderAction`
- `options?: DockviewOptions`
- `layout?: SerializedDockview`
- `el?: JSX.GlobalHTMLAttributes`

### Notes

- `Dockview` is a real component, not a model.
- It bridges `dockview` into Sursaut.
- It supports external layout persistence through the `layout` prop.
- Widgets receive both `params` and a shared reactive `context` object.

## `InfiniteScroll`

A virtualized scrolling component for large item lists.

### Purpose

Use `InfiniteScroll<T>` when you need efficient rendering of many items with fixed or variable row heights.

### Props

```ts
type InfiniteScrollProps<T> = {
	items: T[]
	itemHeight: number | ((item: T, index: number) => number)
	estimatedItemHeight?: number
	stickyLast?: boolean
	children: (item: T, index: number) => JSX.Element
}
```

### Behavior

- fixed-height fast path when `itemHeight` is a number
- variable-height mode with `ResizeObserver` when `itemHeight` is a function
- overscan around the visible range
- optional sticky-to-bottom behavior for append-only lists

### Notes

- `InfiniteScroll` is self-contained and does not use an adapter model.
- It is exported directly from `@sursaut/ui`.
- It is suitable for logs, feeds, chats, and long lists.

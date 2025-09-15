# Router for React Native

[![npm version](https://badge.fury.io/js/%40sigmela%2Frouter.svg)](https://www.npmjs.com/package/@sigmela/router)

Lightweight, predictable navigation for React Native built on top of react-native-screens. It provides:
- Stack navigation with URL-like paths and typed params
- Bottom tab navigation via a simple builder API
- A global overlay stack (e.g., auth modal) rendered above tabs/root
- An imperative API with idempotent navigation and O(1) per-stack updates

Installation

```bash
yarn add @sigmela/router react-native-screens
```

Make sure react-native-screens is properly installed and configured in your app.

Quick start (single stack)

```tsx
import { NavigationStack, Router, Navigation, useRouter, useParams, useQueryParams } from '@sigmela/router';

function HomeScreen() {
  const router = useRouter();
  return (
    <Button
      title="Open details"
      onPress={() => router.navigate('/details/42?from=home')}
    />
  );
}

function DetailsScreen() {
  const { id } = useParams<{ id: string }>();
  const { from } = useQueryParams<{ from?: string }>();
  return <Text>{`Details id=${id} from=${from ?? 'n/a'}`}</Text>;
}

const rootStack = new NavigationStack()
  .addScreen('/', HomeScreen, { header: { title: 'Home' } })
  .addScreen('/details/:id', DetailsScreen, { header: { title: 'Details' } });

const router = new Router({ root: rootStack });

export default function App() {
  return <Navigation router={router} />;
}
```

Quick start (tabs + global stack)

```tsx
import { NavigationStack, Router, Navigation, TabBar } from '@sigmela/router';

const homeStack = new NavigationStack()
  .addScreen('/', HomeScreen, { header: { title: 'Home' } });

const catalogStack = new NavigationStack()
  .addScreen('/catalog', CatalogScreen, { header: { title: 'Catalog' } })
  .addScreen('/catalog/products/:productId', ProductScreen, { 
    header: { title: 'Product' } 
  });

const globalStack = new NavigationStack()
  .addModal('/auth', AuthScreen, {
    header: { title: 'Sign in' },
  });

const tabBar = new TabBar({ labeled: true })
  .addTab({ stack: homeStack, title: 'Home', icon: { sfSymbol: 'house' } })
  .addTab({ stack: catalogStack, title: 'Catalog', icon: { sfSymbol: 'bag' } });

const router = new Router({ root: tabBar, global: globalStack });

export default function App() {
  return <Navigation router={router} />;
}
```

## Navigation Appearance

You can customize the navigation appearance using the `appearance` prop:

```tsx
import { Navigation, NavigationAppearance } from '@sigmela/router';

const appearance: NavigationAppearance = {
  tabBar: {
    // Android-specific
    backgroundColor: '#ffffff',
    tabBarItemStyle: {
      titleFontColor: '#999999',
      titleFontColorActive: '#007AFF',
      titleFontSize: 12,
      titleFontWeight: '600',
      iconColor: '#999999',
      iconColorActive: '#007AFF',
      rippleColor: '#00000020',
      activeIndicatorColor: '#007AFF',
    },
    // iOS-specific
    tintColor: '#007AFF',
    standardAppearance: {
      tabBarBackgroundColor: '#ffffff',
      tabBarShadowColor: 'transparent',
    },
    scrollEdgeAppearance: {
      tabBarBackgroundColor: 'rgba(255,255,255,0.9)',
      tabBarShadowColor: 'transparent',
    },
  },
  screenStyle: {
    backgroundColor: '#ffffff',
  },
};

export default function App() {
  return <Navigation router={router} appearance={appearance} />;
}
```

Core concepts

- Router: central coordinator. Holds slices (histories) per stack, active tab index, and the visible route.
- NavigationStack: define stack routes with path patterns using path-to-regexp.
- TabBar: builder for bottom tabs; each tab may reference a stack or a single screen.
- Global stack: a separate stack rendered above tabs/root, ideal for modals like auth.
- Navigation component: renders current root layer (tabs or root stack) and the global overlay.

API reference

NavigationStack

- constructor(idOrOptions?, maybeOptions?)
  - Overloads:
    - new NavigationStack()
    - new NavigationStack(id: string)
    - new NavigationStack(defaultOptions: ScreenOptions)
    - new NavigationStack(id: string, defaultOptions: ScreenOptions)
- addScreen(path: string, component: React.ComponentType, options?: ScreenOptions): this
- addModal(path: string, component: React.ComponentType, options?: ScreenOptions): this
  - Convenience method that automatically sets `stackPresentation: 'modal'`
- getId(): string
- getDefaultOptions(): ScreenOptions | undefined

Router

- constructor({ root, global?, screenOptions? })
  - root: TabBar | NavigationStack
  - global: optional NavigationStack rendered on top (modal layer)
  - screenOptions: global ScreenOptions overrides merged into each screen
- navigate(path: string): void
  - Matches a route by pathname, switches tab if needed, pushes a new history item
  - Duplicate navigate to the same top screen with the same params is ignored
- replace(path: string): void
  - Replaces the top history item. If the top stack changes, both stack slices are updated incrementally to avoid stale entries [[memory:6631860]].
- goBack(): void
  - Pops from the highest priority layer that can pop: global → current tab → root
  - “Seed” screens (the very first screen of a stack) are protected from popping
- setRoot(nextRoot: TabBar | NavigationStack, options?: { transition?: ScreenOptions['stackAnimation'] }): void
  - Switch between auth flow and main app, etc.; reseeds the new root
  - transition is applied to the root layer when changing
- onTabIndexChange(index: number): void and setActiveTabIndex(index: number): void
- ensureTabSeed(index: number): void
  - Ensures the first screen of a tab stack is seeded when the tab becomes active
- getVisibleRoute(): {
  routeId: string; stackId?: string; tabIndex?: number; scope: 'global' | 'tab' | 'root'; params?; query?; path?; pattern?
} | null
- subscribe(listener): unsubscribe
- subscribeStack(stackId, listener): unsubscribe
- subscribeActiveTab(listener): unsubscribe
- getStackHistory(stackId): HistoryItem[] (useful for debugging/analytics)
- hasTabBar(): boolean, getRootStackId(): string | undefined, getGlobalStackId(): string | undefined, getRootTransition(): ScreenOptions['stackAnimation'] | undefined

Components

- Navigation: top-level view that renders the root layer and the global overlay. Usage: `<Navigation router={router} appearance={appearance} />`.
- StackRenderer: renders a single `NavigationStack` (advanced use, usually not needed directly).

Hooks

- useRouter(): Router
- useCurrentRoute(): VisibleRoute
- useParams<TParams>(): TParams
- useQueryParams<TQuery>(): TQuery
- useRoute(): { params, query, pattern?, path? }

TabBar builder

```ts
new TabBar({
  sidebarAdaptable?: boolean,
  disablePageAnimations?: boolean,
  hapticFeedbackEnabled?: boolean,
  scrollEdgeAppearance?: 'default' | 'opaque' | 'transparent',
  minimizeBehavior?: 'automatic' | 'onScrollDown' | 'onScrollUp' | 'never',
})
  .addTab({
    stack?: NavigationStack,
    screen?: React.ComponentType,
    title?: string,
    badge?: string,
    icon?: ImageSource | AppleIcon | (({ focused }: { focused: boolean }) => ImageSource | AppleIcon),
    activeTintColor?: ColorValue,
    hidden?: boolean,
    testID?: string,
    role?: 'search',
    freezeOnBlur?: boolean,
    lazy?: boolean,
    iconInsets?: { top?: number; bottom?: number; left?: number; right?: number },
  })
```

You can update badges at runtime via:
- setBadge(tabIndex, badge: string | null)
- setTabBarConfig(partial)

For styling, use the `appearance` prop on the Navigation component instead.

Screen options

ScreenOptions map directly to props of react-native-screens `ScreenStackItem` (e.g., header, stackPresentation, stackAnimation, gestureEnabled, etc.).
- **header**: controls the navigation header. If not specified, the header is hidden by default.
- Per-screen options come from `addScreen(path, component, options)`
- Per-stack defaults via `new NavigationStack(defaultOptions)`
- Global overrides via `new Router({ screenOptions })`
The effective options are merged in this order: stack defaults → per-screen → router overrides.

Header configuration:
```tsx
// Header with title (visible)
{ header: { title: 'My Screen' } }

// Hidden header (explicit)
{ header: { hidden: true } }

// No header specified = hidden by default
{ /* header will be hidden automatically */ }

// Custom header with background color
{ header: { title: 'Settings', backgroundColor: '#007AFF' } }
```

Modal screens:
```tsx
// Using addModal - automatically sets stackPresentation: 'modal'
const stack = new NavigationStack()
  .addModal('/auth', AuthScreen, {
    header: { title: 'Sign In' }
  })
  .addModal('/settings', SettingsScreen, {
    header: { title: 'Settings' }
  });

// Equivalent to using addScreen with explicit modal presentation
const stack = new NavigationStack()
  .addScreen('/auth', AuthScreen, {
    stackPresentation: 'modal',
    header: { title: 'Sign In' }
  });
```

Paths, params and query

- Paths use path-to-regexp under the hood. Examples:
  - `/users/:userId`
  - `/orders/:year/:month`
- Params are exposed via `useParams()`; query params via `useQueryParams()` and are parsed with query-string.
- When you call `router.navigate('/users/123?tab=posts')`, your screen receives `{ userId: '123' }` as params and `{ tab: 'posts' }` as query.

### Controllers: delay screen presentation and pass props

You can attach a controller to a route to perform checks or async work before the screen is shown. If a controller is present, the screen is NOT pushed until the controller calls `present(passProps)`.

Definition:

```ts
import { createController } from '@sigmela/router';

type ProductParams = { productId: string };
type ProductQuery = { coupon?: string };

export const ProductController = createController<ProductParams, ProductQuery>((input, present) => {
  // input.params and input.query are typed
  // Do any sync/async work here (auth, data prefetch, A/B logic, etc.)
  setTimeout(() => {
    present({ preloadedTitle: 'From controller' }); // props passed to the screen
  }, 300);
});
```

Attach to a route:

```ts
new NavigationStack()
  .addScreen('/catalog/products/:productId', {
    controller: ProductController,
    component: ProductScreen,
  }, {
    header: { title: 'Product' },
  });
```

In your screen you can receive `passProps` from the controller alongside route params/query:

```tsx
type ProductScreenProps = { preloadedTitle?: string };

function ProductScreen(props: ProductScreenProps) {
  const { productId } = useParams<ProductParams>();
  const { coupon } = useQueryParams<ProductQuery>();
  return <Text>{props.preloadedTitle} #{productId} coupon={coupon ?? '—'}</Text>;
}
```

Notes:
- `navigate()` and `replace()` both respect controllers.
- If the controller never calls `present()`, the screen will not be shown (useful for redirects).
- Props passed to `present()` are injected into the route component as regular props.

Behavior highlights (verified by tests)

- Initial seeding: the first screen of the active tab (or root stack) is pushed automatically.
- Duplicate navigate to the same top screen with the same params is ignored.
- goBack pops from the global stack first (if any), then from the current tab’s stack, then from the root stack; seed screens are protected.
- Navigating to a route inside a tab switches the active tab and seeds it if needed.
- setRoot switches between TabBar and NavigationStack, applies an optional transition, rebuilds the registry, and reseeds the new root; subscribers to `subscribeRoot` are notified.
- replace updates old/new stack slices atomically to avoid stale entries and keeps per-stack updates O(1) [[memory:6631860]].

TypeScript

Helpful exports:
- Types: `TabConfig`, `TabBarConfig`, `NavigationProps`, `NavigationAppearance`, `HistoryItem`
- Components: `Navigation`, `StackRenderer`, `TabBar`
- Hooks: `useRouter`, `useCurrentRoute`, `useParams`, `useQueryParams`
- Core classes: `Router`, `NavigationStack`

Requirements

- React 18+
- React Native (with react-native-screens)

License

MIT
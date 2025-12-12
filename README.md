# Sigmela Router (`@sigmela/router`)

Modern, lightweight navigation for **React Native** and **Web**, built on top of [`react-native-screens`](https://github.com/software-mansion/react-native-screens).

This library is **URL-first**: you navigate by **paths** (`/users/42?tab=posts`), and the router derives `params` and `query` for screens.

## Features

- **Stacks**: predictable stack-based navigation
- **Tabs**: `TabBar` with native + web renderers (or custom tab bar)
- **Split view**: master/details navigation (`SplitView`)
- **Modals & sheets**: via `stackPresentation` (`modal`, `sheet`, …)
- **Controllers**: async/guarded navigation (only present when ready)
- **Web History integration**: keeps Router state in sync with `pushState`, `replaceState`, `popstate`
- **Dynamic root**: swap root navigation tree at runtime (`router.setRoot`)
- **Type-safe hooks**: `useParams`, `useQueryParams`, `useRoute`, `useCurrentRoute`

## Installation

```bash
yarn add @sigmela/router react-native-screens
# optional (required only if you use sheet presentation)
yarn add @sigmela/native-sheet
```

### Peer dependencies

- `react`
- `react-native`
- `react-native-screens` (>= `4.18.0`)
- `@sigmela/native-sheet` (>= `0.0.1`) — only if you use sheets

### Web CSS

On web you must import the bundled stylesheet **once**:

```ts
import '@sigmela/router/styles.css';
```

## Quick start

### Simple stack

```tsx
import {
  Navigation,
  NavigationStack,
  Router,
  useParams,
  useQueryParams,
  useRouter,
} from '@sigmela/router';

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
  return <Text>Details: id={id}, from={from ?? 'n/a'}</Text>;
}

const rootStack = new NavigationStack()
  .addScreen('/', HomeScreen, { header: { title: 'Home' } })
  .addScreen('/details/:id', DetailsScreen, { header: { title: 'Details' } });

const router = new Router({ root: rootStack });

export default function App() {
  return <Navigation router={router} />;
}
```

### Tabs

```tsx
import { Navigation, NavigationStack, Router, TabBar } from '@sigmela/router';

const homeStack = new NavigationStack().addScreen('/', HomeScreen);

const catalogStack = new NavigationStack()
  .addScreen('/catalog', CatalogScreen)
  .addScreen('/catalog/products/:productId', ProductScreen);

const tabBar = new TabBar({ initialIndex: 0 })
  .addTab({ key: 'home', stack: homeStack, title: 'Home' })
  .addTab({ key: 'catalog', stack: catalogStack, title: 'Catalog' });

const router = new Router({ root: tabBar });

export default function App() {
  return <Navigation router={router} />;
}
```

### Tabs wrapped by a root stack (like `example/src/navigation/stacks.ts`)

In the example app, tabs are mounted as a **screen** inside a root `NavigationStack`. This lets you keep tab navigation plus define modals/overlays at the root level.

```tsx
import { NavigationStack, TabBar } from '@sigmela/router';

const homeStack = new NavigationStack().addScreen('/', HomeScreen);
const catalogStack = new NavigationStack().addScreen('/catalog', CatalogScreen);

const tabBar = new TabBar()
  .addTab({
    key: 'home',
    stack: homeStack,
    title: 'Home',
    icon: require('./assets/home.png'),
  })
  .addTab({
    key: 'catalog',
    stack: catalogStack,
    title: 'Catalog',
    icon: require('./assets/catalog.png'),
  });

// Root stack hosts the tab bar AND top-level modals/overlays.
export const rootStack = new NavigationStack()
  .addScreen('/', tabBar)
  .addModal('/auth', AuthScreen, { header: { title: 'Login', hidden: true } })
  .addModal('*?modal=promo', PromoModal);
```

## Core concepts

### `NavigationStack`

A `NavigationStack` defines a set of routes and how to match them.

```tsx
const stack = new NavigationStack({ header: { largeTitle: true } })
  .addScreen('/feed', FeedScreen)
  .addScreen('/feed/:id', FeedItemScreen)
  .addModal('/auth', AuthScreen)
  .addSheet('/settings', SettingsSheet);
```

Key methods:
- `addScreen(pathPattern, componentOrNode, options?)`
- `addModal(pathPattern, component, options?)` (shorthand for `stackPresentation: 'modal'`)
- `addSheet(pathPattern, component, options?)` (shorthand for `stackPresentation: 'sheet'`)
- `addStack(prefixOrStack, maybeStack?)` — compose nested stacks under a prefix

### `Router`

The `Router` holds navigation state and performs path matching.

```ts
const router = new Router({
  root, // NavigationNode (NavigationStack, TabBar, SplitView, ...)
  screenOptions, // optional defaults
  debug, // optional
});
```

Navigation:
- `router.navigate(path)` — push
- `router.replace(path, dedupe?)` — replace top of the active stack
- `router.goBack()` — pop top of the active stack
- `router.reset(path)` — **web-only**: rebuild Router state as if app loaded at `path`
- `router.setRoot(nextRoot, { transition? })` — swap root at runtime

State/subscriptions:
- `router.getState()` → `{ history: HistoryItem[] }`
- `router.getActiveRoute()` → `ActiveRoute | null`
- `router.subscribe(cb)` — notify on any history change
- `router.subscribeStack(stackId, cb)` — notify when a particular stack slice changes
- `router.subscribeRoot(cb)` — notify when root is replaced via `setRoot`
- `router.getStackHistory(stackId)` — slice of history for a stack

> Note: `router.getGlobalStackId()` exists but currently returns `undefined`.

### `TabBar`

`TabBar` is a container node that renders one tab at a time.

```tsx
const tabBar = new TabBar({ component: CustomTabBar, initialIndex: 0 })
  .addTab({ key: 'home', stack: homeStack, title: 'Home' })
  .addTab({ key: 'search', screen: SearchScreen, title: 'Search' });
```

Key methods:
- `addTab({ key, stack?, screen?, title?, icon?, selectedIcon?, ... })`
- `onIndexChange(index)` — switch active tab
- `setBadge(index, badge | null)`
- `setTabBarConfig(partialConfig)`
- `getState()` and `subscribe(cb)`

Web behavior note:
- The built-in **web** tab bar renderer resets Router history on tab switch (to keep URL and Router state consistent) using `router.reset(firstRoutePath)`.

### `SplitView`

`SplitView` renders **two stacks**: `primary` and `secondary`.

- On **native**, `secondary` overlays `primary` when it has at least one screen in its history.
- On **web**, the layout becomes side-by-side at a fixed breakpoint (currently `>= 640px` in CSS).

```tsx
import { NavigationStack, SplitView } from '@sigmela/router';

const master = new NavigationStack().addScreen('/', ThreadsScreen);
const detail = new NavigationStack().addScreen('/:threadId', ThreadScreen);

const splitView = new SplitView({
  minWidth: 640, // currently not used by the web renderer; kept for API compatibility
  primary: master,
  secondary: detail,
  primaryMaxWidth: 390,
});

const root = new NavigationStack().addScreen('/mail', splitView);
```

## Controllers

Controllers let you delay/guard navigation. A route can be registered as:

```tsx
import { createController } from '@sigmela/router';

const UserDetails = {
  component: UserDetailsScreen,
  controller: createController<{ userId: string }, { tab?: string }>(
    async ({ params, query }, present) => {
      const ok = await checkAuth();
      if (!ok) {
        router.replace('/login', true);
        return;
      }

      const user = await fetchUser(params.userId);
      present({ user, tab: query.tab });
    }
  ),
};

stack.addScreen('/users/:userId', UserDetails);
```

If you never call `present()`, the screen is not pushed/replaced.

## Hooks

### `useRouter()`

Access the router instance.

### `useCurrentRoute()`

Subscribes to `router.getActiveRoute()`.

Returns `ActiveRoute | null` (shape from `src/types.ts`):

```ts
type ActiveRoute = {
  routeId: string;
  stackId?: string;
  tabIndex?: number;
  path?: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
} | null;
```

### `useParams<T>()` / `useQueryParams<T>()`

Returns params/query for the **current screen** (from route context).

### `useRoute()`

Returns route-local context for the current screen:

```ts
type RouteLocalContextValue = {
  presentation: StackPresentationTypes;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  pattern?: string;
  path?: string;
};
```

### `useTabBar()`

Returns the nearest `TabBar` from context (only inside tab screens).

```tsx
import { useTabBar } from '@sigmela/router';

function ScreenInsideTabs() {
  const tabBar = useTabBar();

  return (
    <Button
      title="Go to second tab"
      onPress={() => tabBar.onIndexChange(1)}
    />
  );
}
```

## Web integration

### History API syncing

On web, Router integrates with the browser History API using custom events:

- `router.navigate('/x')` writes `history.pushState({ __srPath: ... })`
- `router.replace('/x')` writes `history.replaceState({ __srPath: ... })`
- Browser back/forward triggers `popstate` and Router updates its state accordingly

Important behavioral detail:
- `router.goBack()` **does not call** `history.back()`. It pops Router state and updates the URL via `replaceState` (so it doesn’t grow/rewind the browser stack).

### `syncWithUrl: false`

If a route has `screenOptions.syncWithUrl = false`, Router stores the “real” router path in `history.state.__srPath` while keeping the visible URL unchanged.

## License

MIT

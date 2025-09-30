# React Native Router 

Modern, predictable navigation for React Native and Web built on top of react-native-screens. Simple class-based stacks, optional bottom tabs, global modals, typed URL params, and first-class web History API support.

Features
- Simple, chainable API: `new NavigationStack().addScreen('/users/:id', User)`
- Bottom tab bar with native and web renderers; supports custom tab bars
- Global stack for modals/overlays on top of root/tabs
- URL-first navigation: navigate using path strings; typed `useParams` and `useQueryParams`
- Works on web: integrates with pushState/replaceState/popstate and supports deep links
- Appearance control for headers, screens, and tab bar

Installation
```bash
yarn add @sigmela/router react-native-screens
# or
npm i @sigmela/router react-native-screens
```

Peer requirements
- react-native-screens >= 4.16.0
- react and react-native (versions matching your app)

Web CSS
- Import the bundled stylesheet once in your web entry to enable transitions and default tab styles:
```ts
import '@sigmela/router/styles.css';
```

Quick start (single stack)
```tsx
import {
  NavigationStack,
  Router,
  Navigation,
  useRouter,
  useParams,
  useQueryParams,
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

const homeStack = new NavigationStack().addScreen('/', HomeScreen, {
  header: { title: 'Home' },
});

const catalogStack = new NavigationStack()
  .addScreen('/catalog', CatalogScreen, { header: { title: 'Catalog' } })
  .addScreen('/catalog/products/:productId', ProductScreen, {
    header: { title: 'Product' },
  });

const globalStack = new NavigationStack().addModal('/auth', AuthScreen, {
  header: { title: 'Sign in' },
});

const tabBar = new TabBar()
  .addTab({
    key: 'home',
    stack: homeStack,
    title: 'Home',
    // iOS: SF Symbols, Android/Web: image source
    icon: { sfSymbolName: 'house' },
  })
  .addTab({
    key: 'catalog',
    stack: catalogStack,
    title: 'Catalog',
    icon: { sfSymbolName: 'bag' },
  });

const router = new Router({ root: tabBar, global: globalStack });

export default function App() {
  return <Navigation router={router} />;
}
```

Custom tab bar (optional)
```tsx
import { TabBar, type TabBarProps } from '@sigmela/router';

function MyTabBar({ tabs, activeIndex, onTabPress }: TabBarProps) {
  return (
    <div className="my-tabs">
      {tabs.map((t, i) => (
        <button key={t.tabKey} onClick={() => onTabPress(i)} aria-pressed={i === activeIndex}>
          {t.title}
        </button>
      ))}
    </div>
  );
}

const tabBar = new TabBar({ component: MyTabBar })
  .addTab({ key: 'home', stack: homeStack, title: 'Home' })
  .addTab({ key: 'catalog', stack: catalogStack, title: 'Catalog' });
```

Appearance
Pass `appearance` to `Navigation` to style headers, screens, and the tab bar.
```tsx
import type { NavigationAppearance } from '@sigmela/router';

const appearance: NavigationAppearance = {
  tabBar: {
    backgroundColor: '#fff',
    iconColor: '#8e8e93',
    iconColorActive: '#000',
    title: { fontSize: 11, color: '#555', activeColor: '#000' },
    // Android-only options:
    androidRippleColor: 'rgba(0,0,0,0.1)',
  },
  header: {
    backgroundColor: '#fff',
  },
};

export default function App() {
  return <Navigation router={router} appearance={appearance} />;
}
```

API Reference
- Classes
  - NavigationStack
    - `constructor(idOrOptions?: string | ScreenOptions, defaults?: ScreenOptions)`
    - `addScreen(path: string, component: Component | { component, controller? }, options?: ScreenOptions)`
    - `addModal(path: string, component: Component | { component, controller? }, options?: ScreenOptions)`
  - TabBar
    - `constructor(config?: { component?: ComponentType<TabBarProps> })`
    - `addTab({ key: string, stack?: NavigationStack, screen?: Component, title?: string, icon?: ImageSource | { sfSymbolName | imageSource | templateSource } })`
    - `setBadge(index: number, badge: string | null)`
  - Router
    - `constructor({ root: TabBar | NavigationStack, global?: NavigationStack, screenOptions?: ScreenOptions })`
    - `navigate(path: string)` — push a route (e.g. `/catalog/products/42?ref=home`)
    - `replace(path: string, dedupe?: boolean)` — replace top route; `dedupe` avoids no-op replaces on web
    - `goBack()` — pop a single screen within the active stack (or global)
    - `setRoot(nextRoot: TabBar | NavigationStack, options?: { transition?: ScreenOptions['stackAnimation'] })`
    - `getVisibleRoute()` — returns `{ scope, path, params, query, ... } | null`

- Components
  - `Navigation` — the renderer. Props: `{ router: Router; appearance?: NavigationAppearance }`

- Hooks
  - `useRouter()` — access the router instance
  - `useCurrentRoute()` — subscribe to the currently visible route
  - `useParams<T>()` — typed path params
  - `useQueryParams<T>()` — typed query params
  - `useRoute()` — raw route context `{ presentation, params, query, pattern, path }`
  - `useTabBar()` — access the current `TabBar` (inside a tab screen)

- Utilities
  - `createController<TParams, TQuery>(controller)` — build controllers for guarded navigation

- Types
  - `ScreenOptions` — subset of `react-native-screens` Screen props plus `{ header?, tabBarIcon? }`
  - `NavigationAppearance` — `{ tabBar?, screen?, header? }`
  - `TabBarProps` — props passed to a custom tab bar component

Screen options
- `header`: `ScreenStackHeaderConfigProps` (from react-native-screens). If `title` is falsy, the header is hidden.
- `stackPresentation`: `'push' | 'modal' | ...'` (react-native-screens)
- `stackAnimation`: `'slide_from_right' | 'fade' | ...'` (react-native-screens)
- `tabBarIcon` (web helper): string or `{ sfSymbolName?: string }` for default web icon rendering

Controllers (guarded/async navigation)
Controllers run before a screen is presented. Call `present(passProps?)` when you're ready to show the screen. Useful for auth checks, data prefetch, or conditional redirects.
```tsx
import { createController } from '@sigmela/router';

const Details = {
  component: DetailsScreen,
  controller: createController<{ id: string }, { from?: string }>(async ({ params }, present) => {
    const isSignedIn = await auth.check();
    if (!isSignedIn) {
      router.navigate('/auth');
      return;
    }
    present({ fetched: await api.load(params.id) });
  }),
};

new NavigationStack().addScreen('/details/:id', Details);
```

Web behavior
- On web, the router listens to `pushState`, `replaceState`, and `popstate`. You can navigate by calling `router.navigate('/path')` or by updating `window.history` yourself; the router will stay in sync.
- Initial load deep links are expanded into a stack chain: `/a/b/c` seeds the stack with `/a` → `/a/b` → `/a/b/c` if those routes exist in the same stack.
- `goBack()` pops within the active stack (or global). The router avoids creating duplicate entries when switching tabs by using `replace` under the hood in the web tab bar.

Root switching (auth flows)
Switch between a login stack and the main tab bar at runtime. Optionally pass a transition for the change.
```tsx
router.setRoot(loggedIn ? mainTabs : authStack, { transition: 'fade' });
```

Badges and programmatic tab control
```ts
// Show a badge on the second tab
tabBar.setBadge(1, '3');

// Switch active tab (e.g., from a screen)
useRouter().onTabIndexChange(2);
```

Example app
- This repo contains an `example` app demonstrating tabs, stacks, and appearance.

Tips
- Prefer path-based navigation throughout your app: it keeps web and native in sync.
- Type your params and query with `useParams<T>()` and `useQueryParams<T>()` to get end-to-end type safety.
- On the web, remember to import `@sigmela/router/styles.css` once.

License
MIT



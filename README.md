# React Native Router

Modern, lightweight, and type-safe navigation for React Native and Web built on top of react-native-screens. Predictable stack-based architecture with tabs, global modals, sheets, controllers, and full Web History API integration.

## Features

- 🪶 **Lightweight**: minimal dependencies, small bundle size
- ⚡ **Fast & performant**: optimized for performance with minimal re-renders
- 🔗 **URL-first navigation**: path as source of truth, params in URL
- 🛡️ **Type safety**: typed `useParams` and `useQueryParams`
- ⛓️ **Chainable API**: `new NavigationStack().addScreen('/users/:id', User)`
- 📱 **Sheets & modals**: native presentation styles including iOS/Android sheets
- 🎯 **Bottom tabs**: native and web renderers, custom tab bars
- 🌍 **Global stack**: modals and overlays on top of main navigation
- 🎮 **Controllers**: async navigation with guards and data prefetch
- 🌐 **Web History API**: full synchronization with pushState/replaceState/popstate
- 🔗 **Deep linking**: automatic stack construction from nested URLs
- 🔄 **Dynamic root**: switch between stacks at runtime (auth flows)
- 🎨 **Appearance control**: customize tabs, headers and screens

## 📦 Installation

```bash
yarn add @sigmela/router @sigmela/native-sheet react-native-screens
# or
npm i @sigmela/router @sigmela/native-sheet react-native-screens
```

### 📋 Dependencies

- `react-native-screens` >= 4.16.0
- `@sigmela/native-sheet` >= 0.0.1 (optional, required for sheets)
- `react` and `react-native` (matching your app versions)

### 🌐 Web CSS

For web, import the bundled stylesheet once in your entry point:

```ts
import '@sigmela/router/styles.css';
```

## 🚀 Quick Start

### 📄 Simple Stack

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

### 🎯 Tabs + Global Stack

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

const globalStack = new NavigationStack()
  .addModal('/auth', AuthScreen, { header: { title: 'Sign in' } });

const tabBar = new TabBar()
  .addTab({
    key: 'home',
    stack: homeStack,
    title: 'Home',
    icon: { sfSymbolName: 'house' }, // iOS SF Symbols
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

## 🧩 Core Concepts

### 📚 Navigation Stack

A `NavigationStack` is a container for screens. Stacks can be used as the root, inside tabs, or as a global overlay.

```tsx
const stack = new NavigationStack()
  .addScreen('/path', Component, options)
  .addModal('/modal', ModalComponent, options)
  .addSheet('/sheet', SheetComponent, options);
```

**Constructor overloads:**
```tsx
new NavigationStack()
new NavigationStack(id: string)
new NavigationStack(defaultOptions: ScreenOptions)
new NavigationStack(id: string, defaultOptions: ScreenOptions)
```

**Methods:**
- `addScreen(path, component, options?)` — add a regular screen
- `addModal(path, component, options?)` — add a modal (shorthand for `stackPresentation: 'modal'`)
- `addSheet(path, component, options?)` — add a sheet (shorthand for `stackPresentation: 'sheet'`)
- `getId()` — get the unique stack ID
- `getRoutes()` — get all routes in the stack
- `getFirstRoute()` — get the first route (used for initial seeding)
- `getDefaultOptions()` — get default options for all screens in this stack

### 🧭 Router

The `Router` manages navigation state and history.

```tsx
const router = new Router({
  root: tabBar | stack,        // TabBar or NavigationStack
  global?: stack,               // Optional global overlay stack
  screenOptions?: ScreenOptions // Global screen defaults
});
```

**Navigation methods:**
- `navigate(path: string)` — push a new screen
- `replace(path: string, dedupe?: boolean)` — replace the top screen
- `goBack()` — pop the current screen
- `onTabIndexChange(index: number)` — switch to a specific tab
- `setRoot(nextRoot, options?)` — dynamically switch root (e.g., login → main app)

**State methods:**
- `getVisibleRoute()` — get currently visible route with params and query
- `getState()` — get the full router state
- `subscribe(listener)` — subscribe to all navigation changes
- `subscribeStack(stackId, listener)` — subscribe to specific stack changes
- `subscribeRoot(listener)` — subscribe to root structure changes
- `subscribeActiveTab(listener)` — subscribe to tab changes

**Stack history methods:**
- `getStackHistory(stackId)` — get history for a specific stack
- `getRootStackId()` — get the root stack ID (if root is a stack)
- `getGlobalStackId()` — get the global stack ID
- `hasTabBar()` — check if root is a TabBar

### 📑 TabBar

A `TabBar` manages multiple stacks as tabs.

```tsx
const tabBar = new TabBar({ component?: CustomTabBarComponent })
  .addTab({
    key: string,
    stack?: NavigationStack,
    screen?: Component,
    title?: string,
    icon?: ImageSource | { sfSymbolName | imageSource | templateSource },
    selectedIcon?: ImageSource | { sfSymbolName | imageSource | templateSource },
  });
```

**Methods:**
- `addTab(config)` — add a new tab
- `setBadge(index, badge)` — set badge text on a tab
- `onIndexChange(index)` — change active tab (usually called via router)
- `getState()` — get current tab state
- `subscribe(listener)` — subscribe to tab bar changes

**Tab configuration:**
Each tab can have either a `stack` (NavigationStack) or a single `screen` (Component). If using a stack, the tab will support full navigation within that tab.

### ⚙️ Screen Options

Screen options control the appearance and behavior of individual screens:

```tsx
type ScreenOptions = {
  // Header configuration (react-native-screens)
  header?: {
    title?: string;
    hidden?: boolean;
    backTitle?: string;
    largeTitle?: boolean;
    // ... all ScreenStackHeaderConfigProps
  };

  // Presentation style
  stackPresentation?: 
    | 'push'
    | 'modal'
    | 'transparentModal'
    | 'containedModal'
    | 'containedTransparentModal'
    | 'fullScreenModal'
    | 'formSheet'
    | 'pageSheet'
    | 'sheet';

  // Animation style
  stackAnimation?: 
    | 'default'
    | 'fade'
    | 'flip'
    | 'none'
    | 'simple_push'
    | 'slide_from_right'
    | 'slide_from_left'
    | 'slide_from_bottom'
    | 'fade_from_bottom';

  // Android: convert modals to sheets
  convertModalToSheetForAndroid?: boolean;

  // Web helper for default tab icon rendering
  tabBarIcon?: string | { sfSymbolName?: string };

  // All other react-native-screens Screen props
  // ...
};
```

### 📱 Sheets

Sheets are a special presentation style that shows content in a bottom sheet on both iOS and Android.

```tsx
const stack = new NavigationStack()
  .addSheet('/settings', SettingsSheet, {
    header: { title: 'Settings' },
  });

// Or using addScreen with explicit option:
const stack = new NavigationStack()
  .addScreen('/settings', SettingsSheet, {
    stackPresentation: 'sheet',
    header: { title: 'Settings' },
  });

// Convert modals to sheets on Android:
const stack = new NavigationStack()
  .addModal('/settings', SettingsSheet, {
    convertModalToSheetForAndroid: true,
    header: { title: 'Settings' },
  });
```

**Sheet appearance:**
```tsx
const appearance: NavigationAppearance = {
  sheet: {
    backgroundColor: '#fff',
    cornerRadius: 18,
    androidFullScreenTopInset: 40,
  },
};

<Navigation router={router} appearance={appearance} />
```

### 🎮 Controllers

Controllers run before a screen is presented. They're useful for:
- Authentication guards
- Data prefetching
- Conditional redirects
- Loading states

```tsx
import { createController } from '@sigmela/router';

const UserDetails = {
  component: UserDetailsScreen,
  controller: createController<
    { userId: string },        // Path params type
    { tab?: string }           // Query params type
  >(async ({ params, query }, present) => {
    // Check auth
    const isAuthed = await checkAuth();
    if (!isAuthed) {
      router.navigate('/login');
      return;
    }

    // Prefetch data
    const userData = await fetchUser(params.userId);
    
    // Present screen with prefetched data
    present({ userData });
  }),
};

// Register with stack
stack.addScreen('/users/:userId', UserDetails, {
  header: { title: 'User' }
});

// In the component, receive passProps
function UserDetailsScreen({ userData }) {
  // userData is already loaded
  return <Text>{userData.name}</Text>;
}
```

**Controller signature:**
```tsx
type Controller<TParams, TQuery> = (
  input: { params: TParams; query: TQuery },
  present: (passProps?: any) => void
) => void;
```

Controllers receive `params` and `query` parsed from the URL. Call `present(passProps)` to show the screen, passing any data as props. If you don't call `present()`, the screen won't be shown (useful for redirects).

## 🪝 Hooks

### useRouter

Access the router instance:

```tsx
function MyScreen() {
  const router = useRouter();
  
  return (
    <Button 
      onPress={() => router.navigate('/details')}
      title="Go to details"
    />
  );
}
```

### useParams

Get typed path parameters:

```tsx
function UserScreen() {
  const { userId } = useParams<{ userId: string }>();
  return <Text>User ID: {userId}</Text>;
}

// Route: /users/:userId
// URL: /users/123
// Result: { userId: '123' }
```

### useQueryParams

Get typed query parameters:

```tsx
function SearchScreen() {
  const { q, sort } = useQueryParams<{ 
    q?: string; 
    sort?: 'asc' | 'desc' 
  }>();
  
  return <Text>Query: {q}, Sort: {sort}</Text>;
}

// URL: /search?q=hello&sort=asc
// Result: { q: 'hello', sort: 'asc' }
```

### useCurrentRoute

Subscribe to the currently visible route:

```tsx
function NavigationObserver() {
  const currentRoute = useCurrentRoute();
  
  useEffect(() => {
    console.log('Current route:', currentRoute?.path);
  }, [currentRoute]);
  
  return null;
}

// Returns: { scope, path, params, query, routeId, stackId, tabIndex? } | null
```

### useRoute

Access the full route context for the current screen:

```tsx
function MyScreen() {
  const route = useRoute();
  
  return (
    <View>
      <Text>Path: {route.path}</Text>
      <Text>Pattern: {route.pattern}</Text>
      <Text>Presentation: {route.presentation}</Text>
    </View>
  );
}

// Returns: { presentation, params, query, pattern, path }
```

### useTabBar

Access the TabBar instance (only works inside a tab screen):

```tsx
function HomeScreen() {
  const tabBar = useTabBar();
  const router = useRouter();
  
  const handleSwitchTab = () => {
    router.onTabIndexChange(1); // Switch to second tab
  };
  
  const handleSetBadge = () => {
    tabBar.setBadge(1, '5'); // Show badge on second tab
  };
  
  return (
    <View>
      <Button title="Switch Tab" onPress={handleSwitchTab} />
      <Button title="Set Badge" onPress={handleSetBadge} />
    </View>
  );
}
```

## 🚀 Advanced Features

### 🔄 Dynamic Root (Auth Flows)

Switch between different root structures at runtime:

```tsx
const authStack = new NavigationStack()
  .addScreen('/login', LoginScreen, { header: { title: 'Login' } });

const mainTabBar = new TabBar()
  .addTab({ key: 'home', stack: homeStack, title: 'Home' });

const router = new Router({ root: authStack });

// Later, after login:
function handleLogin() {
  router.setRoot(mainTabBar, { transition: 'fade' });
}

// Or logout:
function handleLogout() {
  router.setRoot(authStack, { transition: 'fade' });
}
```

The `transition` option accepts any `stackAnimation` value (`'fade'`, `'slide_from_bottom'`, etc.).

### 🎨 Custom Tab Bar

Create a custom tab bar component:

```tsx
import { TabBar, type TabBarProps } from '@sigmela/router';

function CustomTabBar({ tabs, activeIndex, onTabPress }: TabBarProps) {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={tab.tabKey}
          onPress={() => onTabPress(index)}
          style={[
            styles.tab,
            index === activeIndex && styles.activeTab
          ]}
        >
          {tab.icon && <Image source={tab.icon} />}
          <Text style={styles.title}>{tab.title}</Text>
          {tab.badgeValue && <Text style={styles.badge}>{tab.badgeValue}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tabBar = new TabBar({ component: CustomTabBar })
  .addTab({ key: 'home', stack: homeStack, title: 'Home' });
```

### 🎨 Appearance Customization

Customize the appearance of tabs, headers, and screens:

```tsx
import type { NavigationAppearance } from '@sigmela/router';

const appearance: NavigationAppearance = {
  // Tab bar styling
  tabBar: {
    backgroundColor: '#ffffff',
    iconColor: '#8e8e93',
    iconColorActive: '#007aff',
    badgeBackgroundColor: '#ff3b30',
    androidRippleColor: 'rgba(0,0,0,0.1)',
    androidActiveIndicatorEnabled: true,
    androidActiveIndicatorColor: '#007aff',
    iOSShadowColor: '#000',
    labelVisibilityMode: 'labeled',
    title: {
      fontSize: 11,
      fontFamily: 'System',
      fontWeight: '500',
      color: '#8e8e93',
      activeColor: '#007aff',
    },
  },
  
  // Header styling (applied to all headers)
  header: {
    backgroundColor: '#ffffff',
    tintColor: '#007aff',
    largeTitleColor: '#000',
  },
  
  // Screen styling
  screen: {
    backgroundColor: '#f2f2f7',
  },
  
  // Sheet styling
  sheet: {
    backgroundColor: '#ffffff',
    cornerRadius: 18,
    androidFullScreenTopInset: 40,
  },
};

export default function App() {
  return <Navigation router={router} appearance={appearance} />;
}
```

### 🔔 Tab Badges

Show badges on tabs:

```tsx
function SomeScreen() {
  const tabBar = useTabBar();
  const router = useRouter();
  
  useEffect(() => {
    // Show badge on second tab
    tabBar.setBadge(1, '3');
    
    // Clear badge
    // tabBar.setBadge(1, null);
  }, []);
}

// Or directly via router instance
router.tabBar?.setBadge(1, '3');
```

### 🎬 Standalone Stack Renderer

Render a specific stack anywhere in your component tree:

```tsx
import { StackRenderer } from '@sigmela/router';

function CustomLayout() {
  const myStack = new NavigationStack()
    .addScreen('/nested', NestedScreen);
  
  return (
    <View>
      <Header />
      <StackRenderer stack={myStack} appearance={appearance} />
      <Footer />
    </View>
  );
}
```

## 🌐 Web Integration

### 🔄 History API Sync

On web, the router automatically synchronizes with the browser's History API:

- `router.navigate('/path')` → `history.pushState()`
- `router.replace('/path')` → `history.replaceState()`
- `router.goBack()` → `history.back()`
- Browser back/forward buttons → `popstate` event → router state update

You can also call `history.pushState()` or `history.replaceState()` directly, and the router will stay in sync.

### 🔗 Deep Linking

On initial load, the router automatically expands deep URLs into a stack chain:

```
URL: /catalog/products/42

Result stack:
  1. /catalog          (CatalogScreen)
  2. /catalog/products/42  (ProductScreen)
```

This only works for routes in the same stack. The router builds the longest possible chain of matching routes.

### ♻️ Replace with Deduplication

Avoid no-op replaces on web with the `dedupe` option:

```tsx
// Won't replace if already on /catalog with same params
router.replace('/catalog', true);
```

This is useful when switching tabs on web to avoid creating duplicate history entries.

## 🛡️ TypeScript

### ✅ Type-Safe Params

```tsx
import { useParams, useQueryParams } from '@sigmela/router';

// Define your param types
type UserParams = {
  userId: string;
  tab?: string;
};

type UserQuery = {
  ref?: string;
  highlight?: string;
};

function UserScreen() {
  const params = useParams<UserParams>();
  const query = useQueryParams<UserQuery>();
  
  // TypeScript knows:
  // params.userId is string
  // params.tab is string | undefined
  // query.ref is string | undefined
}
```

### ✅ Type-Safe Controllers

```tsx
import { createController } from '@sigmela/router';

type ProductParams = { productId: string };
type ProductQuery = { variant?: string };

const ProductDetails = {
  component: ProductScreen,
  controller: createController<ProductParams, ProductQuery>(
    async ({ params, query }, present) => {
      // params.productId is typed as string
      // query.variant is typed as string | undefined
      
      const product = await fetchProduct(params.productId);
      present({ product });
    }
  ),
};
```

## 📖 API Reference

### 🧭 Router

```tsx
class Router {
  constructor(config: {
    root: TabBar | NavigationStack;
    global?: NavigationStack;
    screenOptions?: ScreenOptions;
  });

  // Navigation
  navigate(path: string): void;
  replace(path: string, dedupe?: boolean): void;
  goBack(): void;
  onTabIndexChange(index: number): void;
  setRoot(nextRoot: TabBar | NavigationStack, options?: { transition?: RootTransition }): void;

  // State
  getState(): { history: HistoryItem[]; activeTabIndex?: number };
  getVisibleRoute(): VisibleRoute | null;
  getStackHistory(stackId: string): HistoryItem[];
  getRootStackId(): string | undefined;
  getGlobalStackId(): string | undefined;
  getActiveTabIndex(): number;
  hasTabBar(): boolean;
  getRootTransition(): RootTransition | undefined;

  // Subscriptions
  subscribe(listener: () => void): () => void;
  subscribeStack(stackId: string, listener: () => void): () => void;
  subscribeActiveTab(listener: () => void): () => void;
  subscribeRoot(listener: () => void): () => void;

  // Sheet management (internal)
  registerSheetDismisser(key: string, dismisser: () => void): void;
  unregisterSheetDismisser(key: string): void;
}
```

### 📚 NavigationStack

```tsx
class NavigationStack {
  constructor();
  constructor(id: string);
  constructor(defaultOptions: ScreenOptions);
  constructor(id: string, defaultOptions: ScreenOptions);

  addScreen(
    path: string,
    component: Component | { component: Component; controller?: Controller },
    options?: ScreenOptions
  ): NavigationStack;

  addModal(
    path: string,
    component: Component | { component: Component; controller?: Controller },
    options?: ScreenOptions
  ): NavigationStack;

  addSheet(
    path: string,
    component: Component | { component: Component; controller?: Controller },
    options?: ScreenOptions
  ): NavigationStack;

  getId(): string;
  getRoutes(): BuiltRoute[];
  getFirstRoute(): BuiltRoute | undefined;
  getDefaultOptions(): ScreenOptions | undefined;
}
```

### 📑 TabBar

```tsx
type TabConfig = {
  key: string;
  stack?: NavigationStack;
  screen?: Component;
  title?: string;
  icon?: ImageSource | { 
    sfSymbolName?: string;
    imageSource?: ImageSource;
    templateSource?: ImageSource;
  };
  selectedIcon?: ImageSource | { 
    sfSymbolName?: string;
    imageSource?: ImageSource;
    templateSource?: ImageSource;
  };
};

class TabBar {
  constructor(config?: { component?: ComponentType<TabBarProps> });

  addTab(config: TabConfig): TabBar;
  setBadge(tabIndex: number, badge: string | null): void;
  onIndexChange(index: number): void;
  getState(): { tabs: InternalTabItem[]; index: number; config: TabBarConfig };
  subscribe(listener: () => void): () => void;
}
```

### 📝 Types

```tsx
type ScreenOptions = {
  header?: ScreenStackHeaderConfigProps;
  stackPresentation?: StackPresentationTypes;
  stackAnimation?: 'default' | 'fade' | 'flip' | 'none' | 'simple_push' 
    | 'slide_from_right' | 'slide_from_left' | 'slide_from_bottom' | 'fade_from_bottom';
  convertModalToSheetForAndroid?: boolean;
  tabBarIcon?: string | { sfSymbolName?: string };
  // ... all react-native-screens Screen props
};

type NavigationAppearance = {
  tabBar?: {
    backgroundColor?: ColorValue;
    badgeBackgroundColor?: ColorValue;
    iconColor?: ColorValue;
    iconColorActive?: ColorValue;
    androidActiveIndicatorEnabled?: boolean;
    androidActiveIndicatorColor?: ColorValue;
    androidRippleColor?: ColorValue;
    labelVisibilityMode?: 'labeled' | 'hidden' | 'selected';
    iOSShadowColor?: ColorValue;
    title?: {
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: string;
      fontStyle?: string;
      color?: string;
      activeColor?: string;
    };
  };
  screen?: StyleProp<ViewStyle>;
  header?: ScreenStackHeaderConfigProps;
  sheet?: {
    backgroundColor?: ColorValue;
    cornerRadius?: number;
    androidFullScreenTopInset?: number;
  };
};

type VisibleRoute = {
  routeId: string;
  stackId?: string;
  tabIndex?: number;
  scope: 'global' | 'tab' | 'root';
  path?: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
} | null;

type TabBarProps = {
  tabs: InternalTabItem[];
  activeIndex: number;
  onTabPress: (index: number) => void;
};

type Controller<TParams, TQuery> = (
  input: { params: TParams; query: TQuery },
  present: (passProps?: any) => void
) => void;
```

## 💡 Examples

### 🔐 Full Example with Auth Flow

```tsx
import {
  NavigationStack,
  Router,
  Navigation,
  TabBar,
  createController,
  useRouter,
  useParams,
} from '@sigmela/router';

// Auth check controller
const requireAuth = createController(async (input, present) => {
  const isAuthed = await checkAuth();
  if (!isAuthed) {
    router.navigate('/login');
    return;
  }
  present();
});

// Stacks
const homeStack = new NavigationStack()
  .addScreen('/', { component: HomeScreen, controller: requireAuth }, {
    header: { title: 'Home' },
  });

const profileStack = new NavigationStack()
  .addScreen('/profile', { component: ProfileScreen, controller: requireAuth }, {
    header: { title: 'Profile' },
  })
  .addScreen('/profile/settings', SettingsScreen, {
    header: { title: 'Settings' },
  });

const authStack = new NavigationStack()
  .addScreen('/login', LoginScreen, {
    header: { title: 'Login', hidden: true },
  });

const mainTabs = new TabBar()
  .addTab({ key: 'home', stack: homeStack, title: 'Home', icon: { sfSymbolName: 'house' } })
  .addTab({ key: 'profile', stack: profileStack, title: 'Profile', icon: { sfSymbolName: 'person' } });

const globalStack = new NavigationStack()
  .addSheet('/settings-modal', SettingsModalScreen, {
    convertModalToSheetForAndroid: true,
    header: { title: 'Quick Settings' },
  });

// Router
const router = new Router({
  root: authStack, // Start with auth
  global: globalStack,
});

// Login screen
function LoginScreen() {
  const router = useRouter();
  
  const handleLogin = async () => {
    await login();
    router.setRoot(mainTabs, { transition: 'fade' });
  };
  
  return <Button title="Login" onPress={handleLogin} />;
}

// App
export default function App() {
  return <Navigation router={router} appearance={appearance} />;
}
```

## 💡 Tips & Best Practices

1. 🎯 **Use path-based navigation**: Always navigate with paths (`router.navigate('/path')`) rather than imperative methods. This keeps web and native in sync.

2. 🛡️ **Type your params**: Use TypeScript generics with `useParams` and `useQueryParams` for type safety.

3. 🎮 **Controllers for guards**: Use controllers for auth checks, data prefetching, and conditional navigation instead of doing it in the component.

4. 🌍 **Global stack for overlays**: Use the global stack for modals/sheets that should appear on top of everything (auth, alerts, etc.).

5. 🏷️ **Stack IDs**: Optionally provide custom stack IDs for debugging: `new NavigationStack('my-stack-id')`.

6. ⚙️ **Default options**: Set default options at the stack level to avoid repetition:
   ```tsx
   const stack = new NavigationStack({ header: { largeTitle: true } });
   ```

7. 🌐 **Web CSS**: Don't forget to import `@sigmela/router/styles.css` in your web entry point.

8. 📱 **Sheet vs Modal**: Use `addSheet()` for bottom sheets, `addModal()` for full-screen modals. On Android, use `convertModalToSheetForAndroid: true` to convert modals to sheets automatically.

## 📄 License

MIT

---

Built with ❤️ by [Sigmela](https://github.com/sigmela)

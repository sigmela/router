import { Router } from '../Router';
import { NavigationStack } from '../NavigationStack';
import { TabBar } from '../TabBar/TabBar';
import type { ComponentType } from 'react';

function getStackHistoryLength(router: Router, stackId: string): number {
  return router.debugGetStackInfo(stackId).historyLength;
}

function getActiveRoutePath(router: Router): string | undefined {
  return router.debugGetState().activeRoute?.path;
}

function getActiveRouteParams(
  router: Router
): Record<string, unknown> | undefined {
  return router.debugGetState().activeRoute?.params;
}

function getActiveRouteQuery(
  router: Router
): Record<string, unknown> | undefined {
  return router.debugGetState().activeRoute?.query;
}

const HomeScreen: ComponentType<any> = () => null;
const SettingsScreen: ComponentType<any> = () => null;
const CatalogScreen: ComponentType<any> = () => null;
const ProductScreen: ComponentType<any> = () => null;
const AuthRootScreen: ComponentType<any> = () => null;
const OrdersScreen: ComponentType<any> = () => null;
const UserScreen: ComponentType<any> = () => null;
const UserDetailsScreen: ComponentType<any> = () => null;
const EmailAuthModal: ComponentType<any> = () => null;
const SmsAuthModal: ComponentType<any> = () => null;
const GenericAuthModal: ComponentType<any> = () => null;
const PromoModal: ComponentType<any> = () => null;
const AuthScreen: ComponentType<any> = () => null;

function buildTestStacks() {
  const homeStack = new NavigationStack().addScreen('/', HomeScreen, {
    header: { title: 'Home' },
  });

  const catalogStack = new NavigationStack()
    .addScreen('/catalog', CatalogScreen, {
      header: { title: 'Catalog' },
    })
    .addScreen('/catalog/products/:productId', ProductScreen, {
      header: { title: 'Product' },
    });

  const settingsStack = new NavigationStack().addScreen(
    '/settings',
    SettingsScreen,
    {
      header: { title: 'Settings' },
    }
  );

  const authStack = new NavigationStack()
    .addModal('/auth', AuthRootScreen, {
      header: { title: 'Login', hidden: true },
    })
    .addModal('/auth?kind=email', EmailAuthModal, {
      header: { title: 'Email login' },
    })
    .addModal('/auth?kind=sms', SmsAuthModal, {
      header: { title: 'SMS login' },
    })
    .addModal('/auth?kind=:kind', GenericAuthModal);

  const ordersStack = new NavigationStack()
    .addScreen('/orders', OrdersScreen, {
      header: { title: 'Orders' },
    })
    .addScreen('/orders/:year/:month', OrdersScreen, {
      header: { title: 'Orders' },
    });

  const userStack = new NavigationStack()
    .addScreen('/users/:userId', UserScreen, { header: { title: 'User' } })
    .addScreen('/users/:userId/details', UserDetailsScreen, {
      header: { title: 'Details' },
    });

  const tabBar = new TabBar({ component: undefined })
    .addTab({
      key: 'home',
      stack: homeStack,
      title: 'Home',
    })
    .addTab({
      key: 'catalog',
      stack: catalogStack,
      title: 'Catalog',
    })
    .addTab({
      key: 'orders',
      stack: ordersStack,
      title: 'Orders',
    })
    .addTab({
      key: 'settings',
      stack: settingsStack,
      title: 'Settings',
    });

  const rootStack = new NavigationStack()
    .addScreen('/', tabBar)
    .addScreen('/auth', AuthScreen, {
      header: { title: 'Login', hidden: true },
    })
    .addModal('/auth?kind=email', EmailAuthModal, {
      header: { title: 'Email login' },
    })
    .addModal('/auth?kind=sms', SmsAuthModal, {
      header: { title: 'SMS login' },
    })
    .addModal('/auth?kind=:kind', GenericAuthModal)
    .addModal('*?modal=promo', PromoModal);

  return {
    homeStack,
    catalogStack,
    settingsStack,
    authStack,
    ordersStack,
    userStack,
    tabBar,
    rootStack,
  };
}

describe('Navigation Contract Tests - Navigate Scenarios', () => {
  describe('Basic path navigation', () => {
    test('navigate to root path', () => {
      const { tabBar, homeStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const homeStackId = homeStack.getId();
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
      expect(getActiveRoutePath(router)).toBe('/');
    });

    test('navigate to catalog path', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog');
      expect(getActiveRoutePath(router)).toBe('/catalog');
    });

    test('navigate to settings path', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/settings');
      expect(getActiveRoutePath(router)).toBe('/settings');
    });

    test('navigate to orders path', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/orders');
      expect(getActiveRoutePath(router)).toBe('/orders');
    });
  });

  describe('Navigation with path parameters', () => {
    test('navigate to product with productId parameter', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog/products/123');
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.path).toBe('/catalog/products/123');
      expect(activeRoute?.params?.productId).toBe('123');
    });

    test('navigate to orders with year and month parameters', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/orders/2024/12');
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.path).toBe('/orders/2024/12');
      expect(activeRoute?.params?.year).toBe('2024');
      expect(activeRoute?.params?.month).toBe('12');
    });

    test('navigate to user with userId parameter', () => {
      const { tabBar } = buildTestStacks();
      const rootStackWithUser = new NavigationStack()
        .addScreen('/', tabBar)
        .addScreen('/users/:userId', UserScreen, { header: { title: 'User' } })
        .addScreen('/users/:userId/details', UserDetailsScreen, {
          header: { title: 'Details' },
        });

      const router = new Router({ root: rootStackWithUser });

      router.navigate('/users/42');
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.path).toBe('/users/42');
      expect(activeRoute?.params?.userId).toBe('42');
    });

    test('navigate to user details with userId parameter', () => {
      const { tabBar } = buildTestStacks();
      const rootStackWithUser = new NavigationStack()
        .addScreen('/', tabBar)
        .addScreen('/users/:userId', UserScreen, { header: { title: 'User' } })
        .addScreen('/users/:userId/details', UserDetailsScreen, {
          header: { title: 'Details' },
        });

      const router = new Router({ root: rootStackWithUser });

      router.navigate('/users/42/details');
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.path).toBe('/users/42/details');
      expect(activeRoute?.params?.userId).toBe('42');
    });
  });

  describe('Navigation with query parameters', () => {
    test('navigate to auth with email kind query', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth?kind=email');
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.path).toBe('/auth');
      expect(activeRoute?.query?.kind).toBe('email');
    });

    test('navigate to auth with sms kind query', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth?kind=sms');
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.path).toBe('/auth');
      expect(activeRoute?.query?.kind).toBe('sms');
    });

    test('navigate to auth with generic kind query parameter', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth?kind=google');
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.path).toBe('/auth');
      expect(activeRoute?.query?.kind).toBe('google');
    });

    test('navigate to auth with multiple query parameters', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth?kind=email&redirect=/home');
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.path).toContain('/auth');
      expect(activeRoute?.query?.kind).toBe('email');
    });
  });

  describe('Modal navigation', () => {
    test('navigate to auth modal', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth');
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.path).toBe('/auth');
    });

    test('navigate to promo modal with wildcard', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/catalog?modal=promo');
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.query?.modal).toBe('promo');
    });

    test('navigate to promo modal from any path', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/settings');
      router.navigate('/settings?modal=promo');
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.query?.modal).toBe('promo');
    });
  });

  describe('Tab navigation', () => {
    test('navigate between tabs', () => {
      const { tabBar, homeStack, catalogStack, ordersStack, settingsStack } =
        buildTestStacks();
      const router = new Router({ root: tabBar });

      const homeStackId = homeStack.getId();
      const catalogStackId = catalogStack.getId();
      const ordersStackId = ordersStack.getId();
      const settingsStackId = settingsStack.getId();

      expect(getActiveRoutePath(router)).toBe('/');
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);

      router.navigate('/catalog');
      expect(getActiveRoutePath(router)).toBe('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);

      router.navigate('/orders');
      expect(getActiveRoutePath(router)).toBe('/orders');
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);

      router.navigate('/settings');
      expect(getActiveRoutePath(router)).toBe('/settings');
      expect(getStackHistoryLength(router, settingsStackId)).toBe(1);
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
    });

    test('navigate deep within catalog tab, then switch tabs', () => {
      const { tabBar, catalogStack, settingsStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();
      const settingsStackId = settingsStack.getId();

      router.navigate('/catalog');
      router.navigate('/catalog/products/123');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
      expect(getActiveRoutePath(router)).toBe('/catalog/products/123');

      router.navigate('/settings');
      expect(getActiveRoutePath(router)).toBe('/settings');
      expect(getStackHistoryLength(router, settingsStackId)).toBe(1);

      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
      expect(router.debugGetStackInfo(catalogStackId).items[1]?.path).toBe(
        '/catalog/products/123'
      );
    });

    test('switch to home tab after switching to another tab with same root path', () => {
      const { rootStack, homeStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const homeStackId = homeStack.getId();
      const catalogStackId = catalogStack.getId();
      const rootStackId = rootStack.getId();

      expect(getActiveRoutePath(router)).toBe('/');
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);

      const activeRoute = router.getActiveRoute();
      expect(activeRoute?.stackId).toBe(homeStackId);

      router.navigate('/catalog');
      expect(getActiveRoutePath(router)).toBe('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);

      router.navigate('/');

      expect(getActiveRoutePath(router)).toBe('/');
      const activeRouteAfterSwitch = router.getActiveRoute();
      expect(activeRouteAfterSwitch?.stackId).toBe(homeStackId);
      expect(activeRouteAfterSwitch?.stackId).not.toBe(rootStackId);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
    });

    test('switch to home tab after navigating to orders tab and back', () => {
      const { rootStack, homeStack, ordersStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const homeStackId = homeStack.getId();
      const ordersStackId = ordersStack.getId();
      const rootStackId = rootStack.getId();

      expect(getActiveRoutePath(router)).toBe('/');
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);

      const activeRoute = router.getActiveRoute();
      expect(activeRoute?.stackId).toBe(homeStackId);

      router.navigate('/orders');
      expect(getActiveRoutePath(router)).toBe('/orders');
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);

      router.replace('/', true);

      expect(getActiveRoutePath(router)).toBe('/');
      const activeRouteAfterSwitch = router.getActiveRoute();
      expect(activeRouteAfterSwitch?.stackId).toBe(homeStackId);
      expect(activeRouteAfterSwitch?.stackId).not.toBe(rootStackId);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
    });

    test('switch to home tab after initial render on catalog tab', () => {
      const { rootStack, homeStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const homeStackId = homeStack.getId();
      const catalogStackId = catalogStack.getId();
      const rootStackId = rootStack.getId();

      expect(getActiveRoutePath(router)).toBe('/');
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);

      router.navigate('/catalog');
      expect(getActiveRoutePath(router)).toBe('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);

      const activeRouteBeforeSwitch = router.getActiveRoute();
      expect(activeRouteBeforeSwitch?.stackId).toBe(catalogStackId);

      router.replace('/', true);

      expect(getActiveRoutePath(router)).toBe('/');
      const activeRouteAfterSwitch = router.getActiveRoute();
      expect(activeRouteAfterSwitch?.stackId).toBe(homeStackId);
      expect(activeRouteAfterSwitch?.stackId).not.toBe(rootStackId);
      expect(activeRouteAfterSwitch?.stackId).not.toBe(catalogStackId);

      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
    });
  });

  describe('Complex navigation sequences', () => {
    test('navigate through catalog stack with multiple products', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);

      router.navigate('/catalog/products/1');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
      expect(getActiveRouteParams(router)?.productId).toBe('1');

      router.navigate('/catalog/products/2');
      // Default behavior: navigating to the same screen (same routeId) updates the active screen.
      // It should not create a new stack item.
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
      expect(getActiveRouteParams(router)?.productId).toBe('2');

      router.navigate('/catalog/products/3');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
      expect(getActiveRouteParams(router)?.productId).toBe('3');
    });

    test('navigate can push multiple instances when allowMultipleInstances=true', () => {
      const CatalogScreen2: ComponentType<any> = () => null;
      const ProductScreen2: ComponentType<any> = () => null;

      const catalogStack = new NavigationStack()
        .addScreen('/catalog', CatalogScreen2, { header: { title: 'Catalog' } })
        .addScreen('/catalog/products/:productId', ProductScreen2, {
          header: { title: 'Product' },
          allowMultipleInstances: true,
        });

      const tabBar = new TabBar({ component: undefined }).addTab({
        key: 'catalog',
        stack: catalogStack,
        title: 'Catalog',
      });

      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);

      router.navigate('/catalog/products/1');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);

      router.navigate('/catalog/products/2');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(3);

      router.navigate('/catalog/products/3');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(4);
      expect(getActiveRouteParams(router)?.productId).toBe('3');
    });

    test('navigate through orders with different dates', () => {
      const { tabBar, ordersStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const ordersStackId = ordersStack.getId();

      router.navigate('/orders');
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1);

      router.navigate('/orders/2024/1');
      expect(getStackHistoryLength(router, ordersStackId)).toBe(2);
      expect(getActiveRouteParams(router)?.year).toBe('2024');
      expect(getActiveRouteParams(router)?.month).toBe('1');

      router.navigate('/orders/2024/2');
      // Default behavior: same routeId in the same stack updates the active screen (replace).
      expect(getStackHistoryLength(router, ordersStackId)).toBe(2);
      expect(getActiveRouteParams(router)?.month).toBe('2');
    });

    test('navigate to same path should not duplicate', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      router.navigate('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
    });

    test('navigate to same path with same params should not duplicate', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog/products/123');
      router.navigate('/catalog/products/123');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
    });
  });
});

describe('Navigation Contract Tests - GoBack Scenarios', () => {
  describe('Basic goBack', () => {
    test('goBack from simple navigation', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);

      router.navigate('/catalog/products/123');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);

      router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getActiveRoutePath(router)).toBe('/catalog');
    });

    test('goBack from root should not go below root', () => {
      const { tabBar, homeStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const homeStackId = homeStack.getId();
      const initialLength = getStackHistoryLength(router, homeStackId);

      router.goBack();
      expect(getStackHistoryLength(router, homeStackId)).toBe(initialLength);
    });

    test('goBack multiple times', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      router.navigate('/catalog/products/1');
      router.navigate('/catalog/products/2');
      router.navigate('/catalog/products/3');
      // Default behavior: navigating between product ids updates the active product screen.
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);

      router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getActiveRoutePath(router)).toBe('/catalog');

      router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getActiveRoutePath(router)).toBe('/catalog');
    });
  });

  describe('goBack with path parameters', () => {
    test('goBack from product detail to catalog', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog');
      router.navigate('/catalog/products/123');
      expect(getActiveRouteParams(router)?.productId).toBe('123');

      router.goBack();
      expect(getActiveRoutePath(router)).toBe('/catalog');
      expect(getActiveRouteParams(router)).toBeUndefined();
    });

    test('goBack from orders detail to orders list', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/orders');
      router.navigate('/orders/2024/12');
      expect(getActiveRouteParams(router)?.year).toBe('2024');
      expect(getActiveRouteParams(router)?.month).toBe('12');

      router.goBack();
      expect(getActiveRoutePath(router)).toBe('/orders');
      expect(getActiveRouteParams(router)).toBeUndefined();
    });

    test('goBack from user details to user', () => {
      const { tabBar } = buildTestStacks();
      const rootStackWithUser = new NavigationStack()
        .addScreen('/', tabBar)
        .addScreen('/users/:userId', UserScreen, { header: { title: 'User' } })
        .addScreen('/users/:userId/details', UserDetailsScreen, {
          header: { title: 'Details' },
        });

      const router = new Router({ root: rootStackWithUser });

      router.navigate('/users/42');
      router.navigate('/users/42/details');
      expect(getActiveRouteParams(router)?.userId).toBe('42');
      expect(getActiveRoutePath(router)).toBe('/users/42/details');

      router.goBack();
      expect(getActiveRoutePath(router)).toBe('/users/42');
      expect(getActiveRouteParams(router)?.userId).toBe('42');
    });
  });

  describe('goBack with query parameters', () => {
    test('goBack from auth modal with query to auth root', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth');
      router.navigate('/auth?kind=email');
      expect(getActiveRouteQuery(router)?.kind).toBe('email');

      router.goBack();
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.path).toBe('/');
      expect(activeRoute?.query?.kind).toBeUndefined();
    });

    test('goBack through multiple auth modals', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth');
      router.navigate('/auth?kind=email');
      router.navigate('/auth?kind=sms');
      expect(getActiveRouteQuery(router)?.kind).toBe('sms');

      router.goBack();
      expect(getActiveRouteQuery(router)?.kind).toBeUndefined();

      router.goBack();
      const activeRoute = router.debugGetState().activeRoute;
      expect(activeRoute?.path).toBe('/');
      expect(activeRoute?.query?.kind).toBeUndefined();
    });
  });

  describe('goBack from modals', () => {
    test('goBack from promo modal on initial render with modal in URL', () => {
      const { rootStack, catalogStack } = buildTestStacks();

      const g = globalThis as unknown as {
        location?: { pathname: string; search: string };
        history?: {
          state: unknown;
          replaceState: (data: unknown, unused: string, url?: string) => void;
          pushState: (data: unknown, unused: string, url?: string) => void;
        };
        addEventListener?: (type: string, cb: (ev: Event) => void) => void;
        dispatchEvent?: (ev: Event) => boolean;
        Event?: new (type: string) => Event;
      };

      const originalLocation = g.location;
      const originalHistory = g.history;
      const originalAddEventListener = g.addEventListener;
      const originalDispatchEvent = g.dispatchEvent;
      const originalEvent = g.Event;

      g.location = {
        pathname: '/catalog',
        search: '?modal=promo',
      };

      const mockHistoryState = {
        __srIndex: 0,
        __srPath: '/catalog?modal=promo',
      };
      g.history = {
        state: mockHistoryState,
        replaceState: (data: unknown) => {
          Object.assign(mockHistoryState, data as Record<string, unknown>);
        },
        pushState: () => {},
      } as any;

      const eventListeners = new Map<string, Set<(ev: Event) => void>>();
      g.addEventListener = (type: string, cb: (ev: Event) => void) => {
        if (!eventListeners.has(type)) {
          eventListeners.set(type, new Set());
        }
        eventListeners.get(type)!.add(cb);
      };

      g.dispatchEvent = (ev: Event) => {
        const listeners = eventListeners.get(ev.type);
        if (listeners) {
          listeners.forEach((cb) => cb(ev));
        }
        return true;
      };

      g.Event = class MockEvent {
        type: string;
        constructor(type: string) {
          this.type = type;
        }
      } as any;

      const router = new Router({ root: rootStack, debug: true });

      const catalogStackId = catalogStack.getId();
      const rootStackId = rootStack.getId();

      expect(getActiveRouteQuery(router)?.modal).toBe('promo');
      expect(getActiveRoutePath(router)).toBe('/catalog');

      const catalogStackInfo = router.debugGetStackInfo(catalogStackId);
      expect(catalogStackInfo.historyLength).toBeGreaterThan(0);
      const hasCatalogRoute = catalogStackInfo.items.some(
        (item) => item.path === '/catalog'
      );
      expect(hasCatalogRoute).toBe(true);

      const rootStackInfo = router.debugGetStackInfo(rootStackId);
      const hasModalRoute = rootStackInfo.items.some(
        (item) => item.query?.modal === 'promo'
      );
      expect(hasModalRoute).toBe(true);

      router.goBack();

      expect(getActiveRoutePath(router)).toBe('/catalog');
      expect(getActiveRouteQuery(router)?.modal).toBeUndefined();
      expect(getStackHistoryLength(router, catalogStackId)).toBeGreaterThan(0);

      g.location = originalLocation;
      g.history = originalHistory;
      g.addEventListener = originalAddEventListener;
      g.dispatchEvent = originalDispatchEvent;
      g.Event = originalEvent;
    });

    // test('switch to home tab after initial render on /catalog via URL', () => {
    //   const { rootStack, homeStack, catalogStack } = buildTestStacks();

    //   const g = globalThis as unknown as {
    //     location?: { pathname: string; search: string };
    //     history?: {
    //       state: unknown;
    //       replaceState: (data: unknown, unused: string, url?: string) => void;
    //       pushState: (data: unknown, unused: string, url?: string) => void;
    //     };
    //     addEventListener?: (type: string, cb: (ev: Event) => void) => void;
    //     dispatchEvent?: (ev: Event) => boolean;
    //     Event?: new (type: string) => Event;
    //   };

    //   const originalLocation = g.location;
    //   const originalHistory = g.history;
    //   const originalAddEventListener = g.addEventListener;
    //   const originalDispatchEvent = g.dispatchEvent;
    //   const originalEvent = g.Event;

    //   g.location = {
    //     pathname: '/catalog',
    //     search: '',
    //   };

    //   const mockHistoryState = { __srIndex: 0, __srPath: '/catalog' };
    //   g.history = {
    //     state: mockHistoryState,
    //     replaceState: (data: unknown) => {
    //       Object.assign(mockHistoryState, data as Record<string, unknown>);
    //     },
    //     pushState: () => {},
    //   } as any;

    //   const eventListeners = new Map<string, Set<(ev: Event) => void>>();
    //   g.addEventListener = (type: string, cb: (ev: Event) => void) => {
    //     if (!eventListeners.has(type)) {
    //       eventListeners.set(type, new Set());
    //     }
    //     eventListeners.get(type)!.add(cb);
    //   };

    //   g.dispatchEvent = (ev: Event) => {
    //     const listeners = eventListeners.get(ev.type);
    //     if (listeners) {
    //       listeners.forEach((cb) => cb(ev));
    //     }
    //     return true;
    //   };

    //   g.Event = class MockEvent {
    //     type: string;
    //     constructor(type: string) {
    //       this.type = type;
    //     }
    //   } as any;

    //   const router = new Router({ root: rootStack, debug: true });

    //   const homeStackId = homeStack.getId();
    //   const catalogStackId = catalogStack.getId();
    //   const rootStackId = rootStack.getId();

    //   expect(getActiveRoutePath(router)).toBe('/catalog');
    //   const activeRouteBeforeSwitch = router.getActiveRoute();
    //   expect(activeRouteBeforeSwitch?.stackId).toBe(catalogStackId);

    //   expect(getStackHistoryLength(router, catalogStackId)).toBeGreaterThan(0);

    //   router.replace('/', true);

    //   expect(getActiveRoutePath(router)).toBe('/');
    //   const activeRouteAfterSwitch = router.getActiveRoute();
    //   expect(activeRouteAfterSwitch?.stackId).toBe(homeStackId);
    //   expect(activeRouteAfterSwitch?.stackId).not.toBe(rootStackId);
    //   expect(activeRouteAfterSwitch?.stackId).not.toBe(catalogStackId);

    //   expect(getStackHistoryLength(router, homeStackId)).toBeGreaterThan(0);
    //   expect(getStackHistoryLength(router, catalogStackId)).toBeGreaterThan(0);

    //   g.location = originalLocation;
    //   g.history = originalHistory;
    //   g.addEventListener = originalAddEventListener;
    //   g.dispatchEvent = originalDispatchEvent;
    //   g.Event = originalEvent;
    // });

    // test('goBack from promo modal', () => {
    //   const { rootStack, catalogStack } = buildTestStacks();
    //   const router = new Router({ root: rootStack });

    //   const catalogStackId = catalogStack.getId();
    //   const rootStackId = rootStack.getId();

    //   router.navigate('/catalog');
    //   console.log('After navigate to /catalog:');
    //   console.log(JSON.stringify(router.debugGetState(), null, 2));
    //   console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
    //   console.log('Root stack:', router.debugGetStackInfo(rootStackId));

    //   console.log('\nDebug match for /catalog?modal=promo:');
    //   console.log(
    //     JSON.stringify(router.debugMatchRoute('/catalog?modal=promo'), null, 2)
    //   );

    //   router.navigate('/catalog?modal=promo');
    //   console.log('\nAfter navigate to /catalog?modal=promo:');
    //   console.log(JSON.stringify(router.debugGetState(), null, 2));
    //   console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
    //   console.log('Root stack:', router.debugGetStackInfo(rootStackId));
    //   expect(getActiveRouteQuery(router)?.modal).toBe('promo');

    //   router.goBack();
    //   console.log('\nAfter goBack:');
    //   console.log(JSON.stringify(router.debugGetState(), null, 2));
    //   console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
    //   console.log('Root stack:', router.debugGetStackInfo(rootStackId));
    //   console.log('Active route:', router.debugGetState().activeRoute);
    //   expect(getActiveRoutePath(router)).toBe('/catalog');
    //   expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
    // });

    // test('goBack from auth modal to previous screen', () => {
    //   const { rootStack } = buildTestStacks();
    //   const router = new Router({ root: rootStack });

    //   router.navigate('/catalog');
    //   router.navigate('/auth');
    //   expect(getActiveRoutePath(router)).toBe('/auth');

    //   router.goBack();
    //   expect(getActiveRoutePath(router)).toBe('/catalog');
    // });
  });

  // describe('goBack in tab context', () => {
  //   test('goBack within active tab stack', () => {
  //     const { tabBar, catalogStack, homeStack } = buildTestStacks();
  //     const router = new Router({ root: tabBar });

  //     const catalogStackId = catalogStack.getId();
  //     const homeStackId = homeStack.getId();

  //     expect(getActiveRoutePath(router)).toBe('/');

  //     router.navigate('/catalog');
  //     router.navigate('/catalog/products/123');
  //     expect(getStackHistoryLength(router, catalogStackId)).toBe(2);

  //     router.goBack();
  //     expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
  //     expect(getActiveRoutePath(router)).toBe('/catalog');

  //     expect(getStackHistoryLength(router, homeStackId)).toBe(1);
  //   });

  //   test('goBack when switching tabs preserves stacks', () => {
  //     const { tabBar, catalogStack, ordersStack } = buildTestStacks();
  //     const router = new Router({ root: tabBar, debug: true });

  //     const catalogStackId = catalogStack.getId();
  //     const ordersStackId = ordersStack.getId();

  //     router.navigate('/catalog');
  //     router.navigate('/catalog/products/123');
  //     console.log('After navigate to /catalog/products/123:');
  //     console.log(JSON.stringify(router.debugGetState(), null, 2));
  //     expect(getStackHistoryLength(router, catalogStackId)).toBe(2);

  //     router.navigate('/orders');
  //     console.log('\nAfter navigate to /orders:');
  //     console.log(JSON.stringify(router.debugGetState(), null, 2));
  //     console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
  //     console.log('Orders stack:', router.debugGetStackInfo(ordersStackId));
  //     expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
  //     expect(getStackHistoryLength(router, catalogStackId)).toBe(2);

  //     router.goBack();
  //     console.log('\nAfter goBack in orders:');
  //     console.log(JSON.stringify(router.debugGetState(), null, 2));
  //     console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
  //     console.log('Orders stack:', router.debugGetStackInfo(ordersStackId));
  //     console.log('Active route:', router.debugGetState().activeRoute);
  //     expect(getStackHistoryLength(router, ordersStackId)).toBe(1);

  //     router.navigate('/catalog');
  //     expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
  //     expect(getActiveRoutePath(router)).toBe('/catalog');
  //   });
  // });

  // describe('Complex goBack scenarios', () => {
  //   test('goBack through mixed navigation (tabs, params, modals)', () => {
  //     const { rootStack, catalogStack } = buildTestStacks();
  //     const router = new Router({ root: rootStack });

  //     const catalogStackId = catalogStack.getId();
  //     const rootStackId = rootStack.getId();

  //     router.navigate('/catalog');
  //     router.navigate('/catalog/products/1');
  //     router.navigate('/catalog/products/2');
  //     console.log('After navigate to /catalog/products/2:');
  //     console.log(JSON.stringify(router.debugGetState(), null, 2));

  //     router.navigate('/catalog/products/2?modal=promo');
  //     console.log('\nAfter navigate to /catalog/products/2?modal=promo:');
  //     console.log(JSON.stringify(router.debugGetState(), null, 2));
  //     console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
  //     console.log('Root stack:', router.debugGetStackInfo(rootStackId));
  //     expect(getActiveRouteQuery(router)?.modal).toBe('promo');

  //     router.goBack();
  //     console.log('\nAfter goBack (close modal):');
  //     console.log(JSON.stringify(router.debugGetState(), null, 2));
  //     console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
  //     console.log('Root stack:', router.debugGetStackInfo(rootStackId));
  //     console.log('Active route:', router.debugGetState().activeRoute);
  //     expect(getActiveRoutePath(router)).toBe('/catalog/products/2');

  //     router.goBack();
  //     expect(getActiveRoutePath(router)).toBe('/catalog/products/1');

  //     router.goBack();
  //     expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
  //   });

  //   test('goBack from deeply nested path', () => {
  //     const { tabBar } = buildTestStacks();
  //     const rootStackWithUser = new NavigationStack()
  //       .addScreen('/', tabBar)
  //       .addScreen('/users/:userId', UserScreen, { header: { title: 'User' } })
  //       .addScreen('/users/:userId/details', UserDetailsScreen, {
  //         header: { title: 'Details' },
  //       });

  //     const router = new Router({ root: rootStackWithUser });

  //     router.navigate('/users/42');
  //     router.navigate('/users/42/details');
  //     expect(getActiveRoutePath(router)).toBe('/users/42/details');

  //     router.goBack();
  //     expect(getActiveRoutePath(router)).toBe('/users/42');

  //     router.goBack();

  //     expect(getActiveRoutePath(router)).toBe('/');
  //   });

  //   test('goBack with replace operations', () => {
  //     const { tabBar, catalogStack } = buildTestStacks();
  //     const router = new Router({ root: tabBar });

  //     const catalogStackId = catalogStack.getId();

  //     router.navigate('/catalog');
  //     router.navigate('/catalog/products/1');
  //     router.navigate('/catalog/products/2');
  //     expect(getStackHistoryLength(router, catalogStackId)).toBe(3);

  //     router.replace('/catalog/products/3');
  //     expect(getStackHistoryLength(router, catalogStackId)).toBe(3);

  //     router.goBack();
  //     expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
  //     expect(getActiveRouteParams(router)?.productId).toBe('1');
  //   });
  // });
});

describe('Navigation Contract Tests - Navigate and GoBack Combinations', () => {
  // test('navigate forward, goBack, navigate forward again', () => {
  //   const { tabBar, catalogStack } = buildTestStacks();
  //   const router = new Router({ root: tabBar });
  //   const catalogStackId = catalogStack.getId();
  //   router.navigate('/catalog');
  //   router.navigate('/catalog/products/1');
  //   expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
  //   router.goBack();
  //   expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
  //   router.navigate('/catalog/products/2');
  //   expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
  //   expect(getActiveRouteParams(router)?.productId).toBe('2');
  // });
  // test('navigate to different tabs, goBack preserves state', () => {
  //   const { tabBar, catalogStack, ordersStack } = buildTestStacks();
  //   const router = new Router({ root: tabBar });
  //   const catalogStackId = catalogStack.getId();
  //   const ordersStackId = ordersStack.getId();
  //   router.navigate('/catalog');
  //   router.navigate('/catalog/products/123');
  //   console.log('After navigate to /catalog/products/123:');
  //   console.log(JSON.stringify(router.debugGetState(), null, 2));
  //   expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
  //   router.navigate('/orders');
  //   console.log('\nAfter navigate to /orders:');
  //   console.log(JSON.stringify(router.debugGetState(), null, 2));
  //   console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
  //   console.log('Orders stack:', router.debugGetStackInfo(ordersStackId));
  //   expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
  //   router.goBack();
  //   console.log('\nAfter goBack in orders:');
  //   console.log(JSON.stringify(router.debugGetState(), null, 2));
  //   console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
  //   console.log('Orders stack:', router.debugGetStackInfo(ordersStackId));
  //   console.log('Active route:', router.debugGetState().activeRoute);
  //   expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
  //   router.navigate('/catalog/products/123');
  //   console.log('\nAfter navigate back to /catalog/products/123:');
  //   console.log(JSON.stringify(router.debugGetState(), null, 2));
  //   console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
  //   console.log('Orders stack:', router.debugGetStackInfo(ordersStackId));
  //   console.log('Active route:', router.debugGetState().activeRoute);
  //   expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
  //   expect(getActiveRouteParams(router)?.productId).toBe('123');
  //   router.goBack();
  //   expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
  //   expect(getActiveRoutePath(router)).toBeDefined();
  // });
  // test('navigate with query, goBack, navigate with different query', () => {
  //   const { rootStack } = buildTestStacks();
  //   const router = new Router({ root: rootStack });
  //   router.navigate('/auth?kind=email');
  //   expect(getActiveRouteQuery(router)?.kind).toBe('email');
  //   router.goBack();
  //   const activeRoute = router.debugGetState().activeRoute;
  //   expect(activeRoute?.path).toBe('/');
  //   router.navigate('/auth?kind=sms');
  //   expect(getActiveRouteQuery(router)?.kind).toBe('sms');
  // });
  // test('complex flow: tabs -> deep navigation -> modal -> goBack chain', () => {
  //   const { rootStack, catalogStack } = buildTestStacks();
  //   const router = new Router({ root: rootStack });
  //   const catalogStackId = catalogStack.getId();
  //   const rootStackId = rootStack.getId();
  //   expect(getActiveRoutePath(router)).toBe('/');
  //   console.log('Initial state:');
  //   console.log(JSON.stringify(router.debugGetState(), null, 2));
  //   router.navigate('/catalog');
  //   console.log('\nAfter navigate to /catalog:');
  //   console.log(JSON.stringify(router.debugGetState(), null, 2));
  //   expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
  //   router.navigate('/catalog/products/1');
  //   router.navigate('/catalog/products/2');
  //   console.log('\nAfter navigate to /catalog/products/2:');
  //   console.log(JSON.stringify(router.debugGetState(), null, 2));
  //   expect(getStackHistoryLength(router, catalogStackId)).toBe(3);
  //   router.navigate('/catalog/products/2?modal=promo');
  //   console.log('\nAfter navigate to /catalog/products/2?modal=promo:');
  //   console.log(JSON.stringify(router.debugGetState(), null, 2));
  //   console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
  //   console.log('Root stack:', router.debugGetStackInfo(rootStackId));
  //   expect(router.getActiveRoute()?.query?.modal).toBe('promo');
  //   router.goBack();
  //   console.log('\nAfter goBack (close modal):');
  //   console.log(JSON.stringify(router.debugGetState(), null, 2));
  //   console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
  //   console.log('Root stack:', router.debugGetStackInfo(rootStackId));
  //   console.log('Active route:', router.debugGetState().activeRoute);
  //   expect(getActiveRoutePath(router)).toBe('/catalog/products/2');
  //   router.goBack();
  //   expect(getActiveRoutePath(router)).toBe('/catalog/products/1');
  //   router.goBack();
  //   expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
  //   expect(getActiveRoutePath(router)).toBe('/catalog');
  // });
});

describe('Navigation Contract Tests - Key Preservation', () => {
  describe('Key preservation when updating query parameters', () => {
    test('key is preserved when updating query parameters on same route', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth');
      const firstHistory = router.debugGetState().history;
      const firstKey = firstHistory[firstHistory.length - 1]?.key;
      expect(firstKey).toBeDefined();

      router.navigate('/auth?kind=email');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      expect(secondKey).toBe(firstKey);
    });

    test('key is preserved when updating multiple query parameters', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth?kind=email');
      const firstHistory = router.debugGetState().history;
      const firstKey = firstHistory[firstHistory.length - 1]?.key;

      router.navigate('/auth?kind=email&redirect=/home');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      expect(secondKey).toBe(firstKey);
    });

    test('key is preserved when changing query parameter value', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth?kind=email');
      const firstHistory = router.debugGetState().history;
      const firstKey = firstHistory[firstHistory.length - 1]?.key;

      router.navigate('/auth?kind=sms');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      expect(secondKey).toBe(firstKey);
    });
  });

  describe('Key preservation when navigating to same path', () => {
    test('key is preserved when navigating to same path', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog');
      const firstHistory = router.debugGetState().history;
      const firstKey = firstHistory[firstHistory.length - 1]?.key;

      router.navigate('/catalog');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      expect(secondKey).toBe(firstKey);
      expect(secondHistory.length).toBe(firstHistory.length);
    });

    test('key is preserved when navigating to same path with same params', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog/products/123');
      const firstHistory = router.debugGetState().history;
      const firstKey = firstHistory[firstHistory.length - 1]?.key;

      router.navigate('/catalog/products/123');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      expect(secondKey).toBe(firstKey);
      expect(secondHistory.length).toBe(firstHistory.length);
    });
  });

  describe('Key preservation with replace operation', () => {
    test('key is preserved when using replace on same route', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog');
      router.navigate('/catalog/products/1');
      const firstHistory = router.debugGetState().history;
      const firstKey = firstHistory[firstHistory.length - 1]?.key;

      router.replace('/catalog/products/2');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      expect(secondKey).toBe(firstKey);
      expect(secondHistory.length).toBe(firstHistory.length);
    });
  });

  describe('Key preservation when switching tabs', () => {
    test('key is preserved when switching back to previous tab', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      router.navigate('/catalog/products/123');
      const catalogHistory = router.debugGetStackInfo(catalogStackId).items;
      const catalogKey = catalogHistory[catalogHistory.length - 1]?.key;

      router.navigate('/');

      router.navigate('/catalog/products/123');
      const catalogHistoryAfter =
        router.debugGetStackInfo(catalogStackId).items;
      const catalogKeyAfter =
        catalogHistoryAfter[catalogHistoryAfter.length - 1]?.key;

      expect(catalogKeyAfter).toBe(catalogKey);
      expect(catalogHistoryAfter.length).toBe(catalogHistory.length);
    });

    test('key is preserved when navigating to existing route in different tab', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      const catalogHistory = router.debugGetStackInfo(catalogStackId).items;
      const catalogKey = catalogHistory[catalogHistory.length - 1]?.key;

      router.navigate('/orders');

      router.navigate('/catalog');
      const catalogHistoryAfter =
        router.debugGetStackInfo(catalogStackId).items;
      const catalogKeyAfter =
        catalogHistoryAfter[catalogHistoryAfter.length - 1]?.key;

      expect(catalogKeyAfter).toBe(catalogKey);
    });
  });

  describe('Key creation for new routes', () => {
    // test('new key is created when navigating to different route', () => {
    //   const { tabBar } = buildTestStacks();
    //   const router = new Router({ root: tabBar });
    //   router.navigate('/catalog');
    //   const firstHistory = router.debugGetState().history;
    //   const firstKey = firstHistory[firstHistory.length - 1]?.key;
    //   router.navigate('/catalog/products/123');
    //   const secondHistory = router.debugGetState().history;
    //   const secondKey = secondHistory[secondHistory.length - 1]?.key;
    //   expect(secondKey).not.toBe(firstKey);
    //   expect(secondHistory.length).toBe(firstHistory.length + 1);
    // });
    // test('new key is created when navigating to route with different params', () => {
    //   const { tabBar } = buildTestStacks();
    //   const router = new Router({ root: tabBar });
    //   router.navigate('/catalog/products/123');
    //   const firstHistory = router.debugGetState().history;
    //   const firstKey = firstHistory[firstHistory.length - 1]?.key;
    //   router.navigate('/catalog/products/456');
    //   const secondHistory = router.debugGetState().history;
    //   const secondKey = secondHistory[secondHistory.length - 1]?.key;
    //   expect(secondKey).not.toBe(firstKey);
    //   expect(secondHistory.length).toBe(firstHistory.length + 1);
    // });
  });

  // describe('Key preservation with goBack', () => {
  //   test('keys are preserved when going back', () => {
  //     const { tabBar, catalogStack } = buildTestStacks();
  //     const router = new Router({ root: tabBar });

  //     const catalogStackId = catalogStack.getId();

  //     router.navigate('/catalog');
  //     router.navigate('/catalog/products/123');
  //     router.navigate('/catalog/products/456');

  //     const historyBefore = router.debugGetStackInfo(catalogStackId).items;
  //     const keysBefore = historyBefore.map((item) => item.key);

  //     router.goBack();

  //     const historyAfter = router.debugGetStackInfo(catalogStackId).items;
  //     const keysAfter = historyAfter.map((item) => item.key);

  //     expect(keysAfter).toEqual(keysBefore.slice(0, -1));
  //     expect(keysAfter.length).toBe(keysBefore.length - 1);
  //   });
  // });

  describe('Key preservation with modals', () => {
    // test('key is preserved when opening and closing modal', () => {
    //   const { rootStack } = buildTestStacks();
    //   const router = new Router({ root: rootStack });

    //   router.navigate('/catalog');
    //   const historyBefore = router.debugGetState().history;
    //   const catalogKey = historyBefore[historyBefore.length - 1]?.key;

    //   router.navigate('/catalog?modal=promo');
    //   const historyWithModal = router.debugGetState().history;
    //   const modalKey = historyWithModal[historyWithModal.length - 1]?.key;

    //   expect(modalKey).not.toBe(catalogKey);

    //   router.goBack();
    //   const historyAfter = router.debugGetState().history;
    //   const catalogKeyAfter = historyAfter[historyAfter.length - 1]?.key;

    //   expect(catalogKeyAfter).toBe(catalogKey);
    // });

    test('key is preserved when updating modal query parameters', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth');
      router.navigate('/auth?kind=email');
      const historyBefore = router.debugGetState().history;
      const emailKey = historyBefore[historyBefore.length - 1]?.key;

      router.navigate('/auth?kind=sms');
      const historyAfter = router.debugGetState().history;
      const smsKey = historyAfter[historyAfter.length - 1]?.key;

      expect(smsKey).toBe(emailKey);
    });
  });

  describe('Key preservation in complex scenarios', () => {
    test('keys are preserved in complex navigation flow', () => {
      const { rootStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      const catalogKey1 =
        router.debugGetStackInfo(catalogStackId).items[0]?.key;

      router.navigate('/catalog/products/1');
      const product1Key =
        router.debugGetStackInfo(catalogStackId).items[1]?.key;

      router.navigate('/catalog/products/2');
      // Default behavior: same routeId updates the existing product screen (key preserved).
      const product2Key =
        router.debugGetStackInfo(catalogStackId).items[1]?.key;

      router.navigate('/catalog/products/2?modal=promo');
      const state = router.debugGetState();
      const modalKey = state.history[state.history.length - 1]?.key;

      router.goBack();
      const product2KeyAfter =
        router.debugGetStackInfo(catalogStackId).items[1]?.key;

      expect(router.debugGetStackInfo(catalogStackId).items[0]?.key).toBe(
        catalogKey1
      );
      expect(product2KeyAfter).toBe(product2Key);
      expect(modalKey).not.toBe(product2Key);

      router.goBack();
      const catalogKey1After =
        router.debugGetStackInfo(catalogStackId).items[0]?.key;
      expect(catalogKey1After).toBe(catalogKey1);
      // Product screen key should be stable across product id changes.
      expect(product2KeyAfter).toBe(product1Key);
    });

    // test('keys are preserved when using replace in middle of stack', () => {
    //   const { tabBar, catalogStack } = buildTestStacks();
    //   const router = new Router({ root: tabBar });

    //   const catalogStackId = catalogStack.getId();

    //   router.navigate('/catalog');
    //   const catalogKey = router.debugGetStackInfo(catalogStackId).items[0]?.key;

    //   router.navigate('/catalog/products/1');
    //   const product1Key =
    //     router.debugGetStackInfo(catalogStackId).items[1]?.key;

    //   router.navigate('/catalog/products/2');
    //   const product2KeyBefore =
    //     router.debugGetStackInfo(catalogStackId).items[2]?.key;

    //   router.replace('/catalog/products/3');
    //   const product3Key =
    //     router.debugGetStackInfo(catalogStackId).items[2]?.key;

    //   expect(router.debugGetStackInfo(catalogStackId).items[0]?.key).toBe(
    //     catalogKey
    //   );
    //   expect(router.debugGetStackInfo(catalogStackId).items[1]?.key).toBe(
    //     product1Key
    //   );

    //   expect(product3Key).toBe(product2KeyBefore);

    //   expect(getStackHistoryLength(router, catalogStackId)).toBe(3);
    // });
  });
});

describe('Navigation Contract Tests - Flat History Architecture', () => {
  describe('Flat history structure', () => {
    // test('history is flat array containing items from multiple stacks', () => {
    //   const { tabBar, homeStack, catalogStack, ordersStack } =
    //     buildTestStacks();
    //   const router = new Router({ root: tabBar });

    //   const homeStackId = homeStack.getId();
    //   const catalogStackId = catalogStack.getId();
    //   const ordersStackId = ordersStack.getId();

    //   router.navigate('/');
    //   router.navigate('/catalog');
    //   router.navigate('/orders');

    //   const fullHistory = router.debugGetState().history;

    //   expect(Array.isArray(fullHistory)).toBe(true);
    //   expect(fullHistory.length).toBeGreaterThan(0);

    //   const stackIds = fullHistory.map((item) => item.stackId);
    //   expect(stackIds).toContain(homeStackId);
    //   expect(stackIds).toContain(catalogStackId);
    //   expect(stackIds).toContain(ordersStackId);

    //   const homeHistory = router.getStackHistory(homeStackId);
    //   const catalogHistory = router.getStackHistory(catalogStackId);
    //   const ordersHistory = router.getStackHistory(ordersStackId);

    //   expect(homeHistory.every((item) => item.stackId === homeStackId)).toBe(
    //     true
    //   );
    //   expect(
    //     catalogHistory.every((item) => item.stackId === catalogStackId)
    //   ).toBe(true);
    //   expect(
    //     ordersHistory.every((item) => item.stackId === ordersStackId)
    //   ).toBe(true);

    //   const totalStackItems =
    //     homeHistory.length + catalogHistory.length + ordersHistory.length;
    //   expect(totalStackItems).toBeLessThanOrEqual(fullHistory.length);
    // });

    test('full history contains all navigation items in order', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      router.navigate('/catalog/products/1');
      router.navigate('/catalog/products/2');

      const fullHistory = router.debugGetState().history;
      const catalogHistory = router.debugGetStackInfo(catalogStackId).items;

      const catalogItemsInFullHistory = fullHistory.filter(
        (item) => item.stackId === catalogStackId
      );

      expect(catalogItemsInFullHistory.length).toBe(catalogHistory.length);
      expect(catalogItemsInFullHistory.map((item) => item.path)).toEqual(
        catalogHistory.map((item) => item.path)
      );
    });

    // test('history preserves order of navigation across stacks', () => {
    //   const { tabBar, homeStack, catalogStack } = buildTestStacks();
    //   const router = new Router({ root: tabBar });

    //   const homeStackId = homeStack.getId();
    //   const catalogStackId = catalogStack.getId();

    //   router.navigate('/');
    //   router.navigate('/catalog');
    //   router.navigate('/catalog/products/123');
    //   router.navigate('/');

    //   const fullHistory = router.debugGetState().history;

    //   const homeItems = fullHistory
    //     .map((item, index) => ({ item, index }))
    //     .filter(({ item }) => item.stackId === homeStackId);
    //   const catalogItems = fullHistory
    //     .map((item, index) => ({ item, index }))
    //     .filter(({ item }) => item.stackId === catalogStackId);

    //   expect(homeItems[0]?.index).toBeLessThan(
    //     catalogItems[0]?.index || Infinity
    //   );

    //   expect(catalogItems[0]?.index).toBeLessThan(
    //     catalogItems[1]?.index || Infinity
    //   );

    //   expect(catalogItems[1]?.index).toBeLessThan(
    //     homeItems[1]?.index || Infinity
    //   );
    // });
  });

  describe('Multiple stacks working together', () => {
    // test('navigating in one stack does not affect other stacks', () => {
    //   const { tabBar, homeStack, catalogStack, ordersStack } =
    //     buildTestStacks();
    //   const router = new Router({ root: tabBar });
    //   const homeStackId = homeStack.getId();
    //   const catalogStackId = catalogStack.getId();
    //   const ordersStackId = ordersStack.getId();
    //   expect(getStackHistoryLength(router, homeStackId)).toBe(1);
    //   expect(getStackHistoryLength(router, catalogStackId)).toBe(0);
    //   expect(getStackHistoryLength(router, ordersStackId)).toBe(0);
    //   router.navigate('/catalog');
    //   router.navigate('/catalog/products/123');
    //   expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
    //   expect(getStackHistoryLength(router, homeStackId)).toBe(1);
    //   expect(getStackHistoryLength(router, ordersStackId)).toBe(0);
    //   router.navigate('/orders');
    //   router.navigate('/orders/2024/12');
    //   expect(getStackHistoryLength(router, ordersStackId)).toBe(2);
    //   expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
    //   expect(getStackHistoryLength(router, homeStackId)).toBe(1);
    // });
    // test('goBack only affects active stack, preserves others', () => {
    //   const { tabBar, catalogStack, ordersStack } = buildTestStacks();
    //   const router = new Router({ root: tabBar });
    //   const catalogStackId = catalogStack.getId();
    //   const ordersStackId = ordersStack.getId();
    //   router.navigate('/catalog');
    //   router.navigate('/catalog/products/123');
    //   router.navigate('/orders');
    //   router.navigate('/orders/2024/12');
    //   expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
    //   expect(getStackHistoryLength(router, ordersStackId)).toBe(2);
    //   router.goBack();
    //   expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
    //   expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
    //   router.navigate('/catalog/products/123');
    //   router.goBack();
    //   expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
    //   expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
    // });
  });

  describe('Tree-like route structure vs flat history', () => {
    test('nested stacks create tree structure but history remains flat', () => {
      const { rootStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const rootStackId = rootStack.getId();
      const catalogStackId = catalogStack.getId();

      router.navigate('/');
      router.navigate('/catalog');

      const fullHistory = router.debugGetState().history;

      expect(Array.isArray(fullHistory)).toBe(true);

      const stackIds = fullHistory.map((item) => item.stackId);
      expect(stackIds).toContain(rootStackId);
      expect(stackIds).toContain(catalogStackId);

      const rootHistory = router.debugGetStackInfo(rootStackId).items;
      const catalogHistory = router.debugGetStackInfo(catalogStackId).items;

      expect(rootHistory.length).toBeGreaterThan(0);
      expect(catalogHistory.length).toBeGreaterThan(0);

      const rootKeys = new Set(rootHistory.map((item) => item.key));
      const catalogKeys = new Set(catalogHistory.map((item) => item.key));
      const intersection = [...rootKeys].filter((key) => catalogKeys.has(key));
      expect(intersection.length).toBe(0);
    });

    // test('modals from root stack can appear over nested stacks', () => {
    //   const { rootStack, catalogStack } = buildTestStacks();
    //   const router = new Router({ root: rootStack });

    //   const rootStackId = rootStack.getId();
    //   const catalogStackId = catalogStack.getId();

    //   router.navigate('/catalog');
    //   router.navigate('/catalog/products/123');

    //   router.navigate('/catalog/products/123?modal=promo');

    //   const fullHistory = router.debugGetState().history;

    //   // const hasCatalogItem = fullHistory.some(
    //   //   (item) =>
    //   //     item.stackId === catalogStackId && item.path?.includes('products/123')
    //   // );
    //   // const hasModalItem = fullHistory.some(
    //   //   (item) => item.stackId === rootStackId && item.query?.modal === 'promo'
    //   // );

    //   // expect(hasCatalogItem).toBe(true);
    //   // expect(hasModalItem).toBe(true);

    //   const lastItem = fullHistory[fullHistory.length - 1];
    //   expect(lastItem?.query?.modal).toBe('promo');
    // });
  });
});

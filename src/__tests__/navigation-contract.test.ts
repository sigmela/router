import { Router } from '../Router';
import { NavigationStack } from '../NavigationStack';
import { TabBar } from '../TabBar/TabBar';
import type { ComponentType } from 'react';

// Вспомогательные функции для работы с дебаг данными
function getStackHistoryLength(router: Router, stackId: string): number {
  return router.debugGetStackInfo(stackId).historyLength;
}

function getVisibleRoutePath(router: Router): string | undefined {
  return router.debugGetState().visibleRoute?.path;
}

function getVisibleRouteParams(router: Router): Record<string, unknown> | undefined {
  return router.debugGetState().visibleRoute?.params;
}

function getVisibleRouteQuery(router: Router): Record<string, unknown> | undefined {
  return router.debugGetState().visibleRoute?.query;
}

// Mock screens
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

// Build the same structure as in example/src/navigation/stacks.ts
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
      expect(getVisibleRoutePath(router)).toBe('/');
    });

    test('navigate to catalog path', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog');
      expect(getVisibleRoutePath(router)).toBe('/catalog');
    });

    test('navigate to settings path', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/settings');
      expect(getVisibleRoutePath(router)).toBe('/settings');
    });

    test('navigate to orders path', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/orders');
      expect(getVisibleRoutePath(router)).toBe('/orders');
    });
  });

  describe('Navigation with path parameters', () => {
    test('navigate to product with productId parameter', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog/products/123');
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.path).toBe('/catalog/products/123');
      expect(visibleRoute?.params?.productId).toBe('123');
    });

    test('navigate to orders with year and month parameters', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/orders/2024/12');
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.path).toBe('/orders/2024/12');
      expect(visibleRoute?.params?.year).toBe('2024');
      expect(visibleRoute?.params?.month).toBe('12');
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
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.path).toBe('/users/42');
      expect(visibleRoute?.params?.userId).toBe('42');
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
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.path).toBe('/users/42/details');
      expect(visibleRoute?.params?.userId).toBe('42');
    });
  });

  describe('Navigation with query parameters', () => {
    test('navigate to auth with email kind query', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth?kind=email');
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.path).toBe('/auth');
      expect(visibleRoute?.query?.kind).toBe('email');
    });

    test('navigate to auth with sms kind query', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth?kind=sms');
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.path).toBe('/auth');
      expect(visibleRoute?.query?.kind).toBe('sms');
    });

    test('navigate to auth with generic kind query parameter', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth?kind=google');
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.path).toBe('/auth');
      expect(visibleRoute?.query?.kind).toBe('google');
    });

    test('navigate to auth with multiple query parameters', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth?kind=email&redirect=/home');
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.path).toContain('/auth');
      expect(visibleRoute?.query?.kind).toBe('email');
    });
  });

  describe('Modal navigation', () => {
    test('navigate to auth modal', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth');
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.path).toBe('/auth');
    });

    test('navigate to promo modal with wildcard', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/catalog?modal=promo');
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.query?.modal).toBe('promo');
    });

    test('navigate to promo modal from any path', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/settings');
      router.navigate('/settings?modal=promo');
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.query?.modal).toBe('promo');
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

      // Start at home
      expect(getVisibleRoutePath(router)).toBe('/');
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);

      // Navigate to catalog tab
      router.navigate('/catalog');
      expect(getVisibleRoutePath(router)).toBe('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1); // Preserved

      // Navigate to orders tab
      router.navigate('/orders');
      expect(getVisibleRoutePath(router)).toBe('/orders');
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1); // Preserved

      // Navigate to settings tab
      router.navigate('/settings');
      expect(getVisibleRoutePath(router)).toBe('/settings');
      expect(getStackHistoryLength(router, settingsStackId)).toBe(1);
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1); // Preserved
    });

    test('navigate deep within catalog tab, then switch tabs', () => {
      const { tabBar, catalogStack, settingsStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();
      const settingsStackId = settingsStack.getId();

      // Navigate deep in catalog
      router.navigate('/catalog');
      router.navigate('/catalog/products/123');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
      expect(getVisibleRoutePath(router)).toBe('/catalog/products/123');

      // Switch to settings
      router.navigate('/settings');
      expect(getVisibleRoutePath(router)).toBe('/settings');
      expect(getStackHistoryLength(router, settingsStackId)).toBe(1);

      // Catalog stack should preserve its state
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
      expect(
        router.debugGetStackInfo(catalogStackId).items[1]?.path
      ).toBe('/catalog/products/123');
    });

    test('switch to home tab after switching to another tab with same root path', () => {
      const { rootStack, homeStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const homeStackId = homeStack.getId();
      const catalogStackId = catalogStack.getId();
      const rootStackId = rootStack.getId();

      // Start at home (path is '/')
      expect(getVisibleRoutePath(router)).toBe('/');
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
      
      // Check that visible route is from home stack, not root stack
      const visibleRoute = router.getVisibleRoute();
      expect(visibleRoute?.stackId).toBe(homeStackId);

      // Switch to catalog tab
      router.navigate('/catalog');
      expect(getVisibleRoutePath(router)).toBe('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1); // Preserved

      // Switch back to home tab (path is '/')
      router.navigate('/');
      
      // Should be on home stack, not root stack
      expect(getVisibleRoutePath(router)).toBe('/');
      const visibleRouteAfterSwitch = router.getVisibleRoute();
      expect(visibleRouteAfterSwitch?.stackId).toBe(homeStackId);
      expect(visibleRouteAfterSwitch?.stackId).not.toBe(rootStackId);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1); // Preserved
    });

    test('switch to home tab after navigating to orders tab and back', () => {
      const { rootStack, homeStack, ordersStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const homeStackId = homeStack.getId();
      const ordersStackId = ordersStack.getId();
      const rootStackId = rootStack.getId();

      // Start at home (path is '/')
      expect(getVisibleRoutePath(router)).toBe('/');
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
      
      // Check that visible route is from home stack, not root stack
      const visibleRoute = router.getVisibleRoute();
      expect(visibleRoute?.stackId).toBe(homeStackId);

      // Navigate to orders tab
      router.navigate('/orders');
      expect(getVisibleRoutePath(router)).toBe('/orders');
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1); // Preserved

      // Switch back to home tab (path is '/') using replace (like tab switching does)
      router.replace('/', true);
      
      // Should be on home stack, not root stack
      expect(getVisibleRoutePath(router)).toBe('/');
      const visibleRouteAfterSwitch = router.getVisibleRoute();
      expect(visibleRouteAfterSwitch?.stackId).toBe(homeStackId);
      expect(visibleRouteAfterSwitch?.stackId).not.toBe(rootStackId);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1); // Preserved
    });

    test('switch to home tab after initial render on catalog tab', () => {
      const { rootStack, homeStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const homeStackId = homeStack.getId();
      const catalogStackId = catalogStack.getId();
      const rootStackId = rootStack.getId();

      // Start at home (path is '/') - default initial route
      expect(getVisibleRoutePath(router)).toBe('/');
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
      
      // Navigate to catalog tab (initial state)
      router.navigate('/catalog');
      expect(getVisibleRoutePath(router)).toBe('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1); // Preserved
      
      // Check that visible route is from catalog stack
      const visibleRouteBeforeSwitch = router.getVisibleRoute();
      expect(visibleRouteBeforeSwitch?.stackId).toBe(catalogStackId);

      // Switch to home tab (path is '/') using replace (like tab switching does)
      router.replace('/', true);
      
      // Should be on home stack, not root stack
      expect(getVisibleRoutePath(router)).toBe('/');
      const visibleRouteAfterSwitch = router.getVisibleRoute();
      expect(visibleRouteAfterSwitch?.stackId).toBe(homeStackId);
      expect(visibleRouteAfterSwitch?.stackId).not.toBe(rootStackId);
      expect(visibleRouteAfterSwitch?.stackId).not.toBe(catalogStackId);
      
      // History should be preserved
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1); // Preserved
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
      expect(getVisibleRouteParams(router)?.productId).toBe('1');

      router.navigate('/catalog/products/2');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(3);
      expect(getVisibleRouteParams(router)?.productId).toBe('2');

      router.navigate('/catalog/products/3');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(4);
      expect(getVisibleRouteParams(router)?.productId).toBe('3');
    });

    test('navigate through orders with different dates', () => {
      const { tabBar, ordersStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const ordersStackId = ordersStack.getId();

      router.navigate('/orders');
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1);

      router.navigate('/orders/2024/1');
      expect(getStackHistoryLength(router, ordersStackId)).toBe(2);
      expect(getVisibleRouteParams(router)?.year).toBe('2024');
      expect(getVisibleRouteParams(router)?.month).toBe('1');

      router.navigate('/orders/2024/2');
      expect(getStackHistoryLength(router, ordersStackId)).toBe(3);
      expect(getVisibleRouteParams(router)?.month).toBe('2');
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
      expect(getVisibleRoutePath(router)).toBe('/catalog');
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
      expect(getStackHistoryLength(router, catalogStackId)).toBe(4);

      router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(3);
      expect(getVisibleRouteParams(router)?.productId).toBe('2');

      router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
      expect(getVisibleRouteParams(router)?.productId).toBe('1');

      router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getVisibleRoutePath(router)).toBe('/catalog');
    });
  });

  describe('goBack with path parameters', () => {
    test('goBack from product detail to catalog', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog');
      router.navigate('/catalog/products/123');
      expect(getVisibleRouteParams(router)?.productId).toBe('123');

      router.goBack();
      expect(getVisibleRoutePath(router)).toBe('/catalog');
      expect(getVisibleRouteParams(router)).toBeUndefined();
    });

    test('goBack from orders detail to orders list', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/orders');
      router.navigate('/orders/2024/12');
      expect(getVisibleRouteParams(router)?.year).toBe('2024');
      expect(getVisibleRouteParams(router)?.month).toBe('12');

      router.goBack();
      expect(getVisibleRoutePath(router)).toBe('/orders');
      expect(getVisibleRouteParams(router)).toBeUndefined();
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
      expect(getVisibleRouteParams(router)?.userId).toBe('42');
      expect(getVisibleRoutePath(router)).toBe('/users/42/details');

      router.goBack();
      expect(getVisibleRoutePath(router)).toBe('/users/42');
      expect(getVisibleRouteParams(router)?.userId).toBe('42');
    });
  });

  describe('goBack with query parameters', () => {
    test('goBack from auth modal with query to auth root', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth');
      router.navigate('/auth?kind=email');
      expect(getVisibleRouteQuery(router)?.kind).toBe('email');

      router.goBack();
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.path).toBe('/');
      expect(visibleRoute?.query?.kind).toBeUndefined();
    });

    test('goBack through multiple auth modals', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth');
      router.navigate('/auth?kind=email');
      router.navigate('/auth?kind=sms');
      expect(getVisibleRouteQuery(router)?.kind).toBe('sms');

      router.goBack();
      expect(getVisibleRouteQuery(router)?.kind).toBeUndefined();

      router.goBack();
      const visibleRoute = router.debugGetState().visibleRoute;
      expect(visibleRoute?.path).toBe('/');
      expect(visibleRoute?.query?.kind).toBeUndefined();
    });
  });

  describe('goBack from modals', () => {
    test('goBack from promo modal on initial render with modal in URL', () => {
      const { rootStack, catalogStack } = buildTestStacks();
      
      // Симулируем initial render с модалкой в URL
      // В веб-окружении Router автоматически парсит URL при инициализации
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
      
      // Сохраняем оригинальные значения
      const originalLocation = g.location;
      const originalHistory = g.history;
      const originalAddEventListener = g.addEventListener;
      const originalDispatchEvent = g.dispatchEvent;
      const originalEvent = g.Event;
      
      // Мокаем location для initial render с /catalog?modal=promo
      g.location = {
        pathname: '/catalog',
        search: '?modal=promo',
      };
      
      // Мокаем history для веб-окружения
      const mockHistoryState = { __srIndex: 0, __srPath: '/catalog?modal=promo' };
      g.history = {
        state: mockHistoryState,
        replaceState: (data: unknown) => {
          Object.assign(mockHistoryState, data as Record<string, unknown>);
        },
        pushState: () => {},
      } as any;
      
      // Мокаем addEventListener для веб-окружения
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
          listeners.forEach(cb => cb(ev));
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

      // Проверяем, что модалка видна
      expect(getVisibleRouteQuery(router)?.modal).toBe('promo');
      expect(getVisibleRoutePath(router)).toBe('/catalog');
      
      // Проверяем, что в истории есть базовый маршрут /catalog
      const catalogStackInfo = router.debugGetStackInfo(catalogStackId);
      expect(catalogStackInfo.historyLength).toBeGreaterThan(0);
      const hasCatalogRoute = catalogStackInfo.items.some(item => item.path === '/catalog');
      expect(hasCatalogRoute).toBe(true);
      
      // Проверяем, что в root stack есть модалка
      const rootStackInfo = router.debugGetStackInfo(rootStackId);
      const hasModalRoute = rootStackInfo.items.some(item => item.query?.modal === 'promo');
      expect(hasModalRoute).toBe(true);

      // Вызываем goBack - должен вернуться на /catalog
      router.goBack();
      
      // После goBack модалка должна закрыться, видимым должен быть /catalog
      expect(getVisibleRoutePath(router)).toBe('/catalog');
      expect(getVisibleRouteQuery(router)?.modal).toBeUndefined();
      expect(getStackHistoryLength(router, catalogStackId)).toBeGreaterThan(0);
      
      // Восстанавливаем оригинальные значения
      g.location = originalLocation;
      g.history = originalHistory;
      g.addEventListener = originalAddEventListener;
      g.dispatchEvent = originalDispatchEvent;
      g.Event = originalEvent;
    });

    test('switch to home tab after initial render on /catalog via URL', () => {
      const { rootStack, homeStack, catalogStack } = buildTestStacks();
      
      // Симулируем initial render на /catalog через URL
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
      
      // Сохраняем оригинальные значения
      const originalLocation = g.location;
      const originalHistory = g.history;
      const originalAddEventListener = g.addEventListener;
      const originalDispatchEvent = g.dispatchEvent;
      const originalEvent = g.Event;
      
      // Мокаем location для initial render на /catalog
      g.location = {
        pathname: '/catalog',
        search: '',
      };
      
      // Мокаем history для веб-окружения
      const mockHistoryState = { __srIndex: 0, __srPath: '/catalog' };
      g.history = {
        state: mockHistoryState,
        replaceState: (data: unknown) => {
          Object.assign(mockHistoryState, data as Record<string, unknown>);
        },
        pushState: () => {},
      } as any;
      
      // Мокаем addEventListener для веб-окружения
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
          listeners.forEach(cb => cb(ev));
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

      const homeStackId = homeStack.getId();
      const catalogStackId = catalogStack.getId();
      const rootStackId = rootStack.getId();

      // Проверяем, что initial render был на /catalog
      expect(getVisibleRoutePath(router)).toBe('/catalog');
      const visibleRouteBeforeSwitch = router.getVisibleRoute();
      expect(visibleRouteBeforeSwitch?.stackId).toBe(catalogStackId);
      
      // Проверяем, что в истории есть /catalog
      expect(getStackHistoryLength(router, catalogStackId)).toBeGreaterThan(0);
      
      // Switch to home tab (path is '/') using replace (like tab switching does)
      router.replace('/', true);
      
      // Should be on home stack, not root stack or catalog stack
      expect(getVisibleRoutePath(router)).toBe('/');
      const visibleRouteAfterSwitch = router.getVisibleRoute();
      expect(visibleRouteAfterSwitch?.stackId).toBe(homeStackId);
      expect(visibleRouteAfterSwitch?.stackId).not.toBe(rootStackId);
      expect(visibleRouteAfterSwitch?.stackId).not.toBe(catalogStackId);
      
      // History should be preserved
      expect(getStackHistoryLength(router, homeStackId)).toBeGreaterThan(0);
      expect(getStackHistoryLength(router, catalogStackId)).toBeGreaterThan(0); // Preserved
      
      // Восстанавливаем оригинальные значения
      g.location = originalLocation;
      g.history = originalHistory;
      g.addEventListener = originalAddEventListener;
      g.dispatchEvent = originalDispatchEvent;
      g.Event = originalEvent;
    });

    test('goBack from promo modal', () => {
      const { rootStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const catalogStackId = catalogStack.getId();
      const rootStackId = rootStack.getId();

      router.navigate('/catalog');
      console.log('After navigate to /catalog:');
      console.log(JSON.stringify(router.debugGetState(), null, 2));
      console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
      console.log('Root stack:', router.debugGetStackInfo(rootStackId));

      console.log('\nDebug match for /catalog?modal=promo:');
      console.log(JSON.stringify(router.debugMatchRoute('/catalog?modal=promo'), null, 2));
      
      router.navigate('/catalog?modal=promo');
      console.log('\nAfter navigate to /catalog?modal=promo:');
      console.log(JSON.stringify(router.debugGetState(), null, 2));
      console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
      console.log('Root stack:', router.debugGetStackInfo(rootStackId));
      expect(getVisibleRouteQuery(router)?.modal).toBe('promo');

      router.goBack();
      console.log('\nAfter goBack:');
      console.log(JSON.stringify(router.debugGetState(), null, 2));
      console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
      console.log('Root stack:', router.debugGetStackInfo(rootStackId));
      console.log('Visible route:', router.debugGetState().visibleRoute);
      expect(getVisibleRoutePath(router)).toBe('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
    });

    test('goBack from auth modal to previous screen', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/catalog');
      router.navigate('/auth');
      expect(getVisibleRoutePath(router)).toBe('/auth');

      router.goBack();
      expect(getVisibleRoutePath(router)).toBe('/catalog');
    });
  });

  describe('goBack in tab context', () => {
    test('goBack within active tab stack', () => {
      const { tabBar, catalogStack, homeStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();
      const homeStackId = homeStack.getId();

      // Start at home
      expect(getVisibleRoutePath(router)).toBe('/');

      // Navigate to catalog and deep
      router.navigate('/catalog');
      router.navigate('/catalog/products/123');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);

      // goBack should work within catalog stack
      router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getVisibleRoutePath(router)).toBe('/catalog');

      // Home stack should be preserved
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
    });

    test('goBack when switching tabs preserves stacks', () => {
      const { tabBar, catalogStack, ordersStack } = buildTestStacks();
      const router = new Router({ root: tabBar, debug: true });

      const catalogStackId = catalogStack.getId();
      const ordersStackId = ordersStack.getId();

      // Navigate deep in catalog
      router.navigate('/catalog');
      router.navigate('/catalog/products/123');
      console.log('After navigate to /catalog/products/123:');
      console.log(JSON.stringify(router.debugGetState(), null, 2));
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);

      // Switch to orders
      router.navigate('/orders');
      console.log('\nAfter navigate to /orders:');
      console.log(JSON.stringify(router.debugGetState(), null, 2));
      console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
      console.log('Orders stack:', router.debugGetStackInfo(ordersStackId));
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2); // Preserved

      // goBack in orders
      router.goBack();
      console.log('\nAfter goBack in orders:');
      console.log(JSON.stringify(router.debugGetState(), null, 2));
      console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
      console.log('Orders stack:', router.debugGetStackInfo(ordersStackId));
      console.log('Visible route:', router.debugGetState().visibleRoute);
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1); // Can't go below root

      // Switch back to catalog - restore top
      router.navigate('/catalog');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getVisibleRoutePath(router)).toBe('/catalog');
    });
  });

  describe('Complex goBack scenarios', () => {
    test('goBack through mixed navigation (tabs, params, modals)', () => {
      const { rootStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const catalogStackId = catalogStack.getId();
      const rootStackId = rootStack.getId();

      // Navigate through catalog
      router.navigate('/catalog');
      router.navigate('/catalog/products/1');
      router.navigate('/catalog/products/2');
      console.log('After navigate to /catalog/products/2:');
      console.log(JSON.stringify(router.debugGetState(), null, 2));

      // Open modal
      router.navigate('/catalog/products/2?modal=promo');
      console.log('\nAfter navigate to /catalog/products/2?modal=promo:');
      console.log(JSON.stringify(router.debugGetState(), null, 2));
      console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
      console.log('Root stack:', router.debugGetStackInfo(rootStackId));
      expect(getVisibleRouteQuery(router)?.modal).toBe('promo');

      // Close modal
      router.goBack();
      console.log('\nAfter goBack (close modal):');
      console.log(JSON.stringify(router.debugGetState(), null, 2));
      console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
      console.log('Root stack:', router.debugGetStackInfo(rootStackId));
      console.log('Visible route:', router.debugGetState().visibleRoute);
      expect(getVisibleRoutePath(router)).toBe('/catalog/products/2');

      // Continue going back
      router.goBack();
      expect(getVisibleRoutePath(router)).toBe('/catalog/products/1');

      router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
    });

    test('goBack from deeply nested path', () => {
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
      expect(getVisibleRoutePath(router)).toBe('/users/42/details');

      router.goBack();
      expect(getVisibleRoutePath(router)).toBe('/users/42');

      router.goBack();
      // Should go back to root tab
      expect(getVisibleRoutePath(router)).toBe('/');
    });

    test('goBack with replace operations', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      router.navigate('/catalog/products/1');
      router.navigate('/catalog/products/2');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(3);

      // Replace product 2 with product 3
      router.replace('/catalog/products/3');
      expect(getStackHistoryLength(router, catalogStackId)).toBe(3);

      // goBack should go to product 1, not product 2
      router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
      expect(getVisibleRouteParams(router)?.productId).toBe('1');
    });
  });
});

describe('Navigation Contract Tests - Navigate and GoBack Combinations', () => {
  test('navigate forward, goBack, navigate forward again', () => {
    const { tabBar, catalogStack } = buildTestStacks();
    const router = new Router({ root: tabBar });

    const catalogStackId = catalogStack.getId();

    router.navigate('/catalog');
    router.navigate('/catalog/products/1');
    expect(getStackHistoryLength(router, catalogStackId)).toBe(2);

    router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);

    router.navigate('/catalog/products/2');
    expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
    expect(getVisibleRouteParams(router)?.productId).toBe('2');
  });

  test('navigate to different tabs, goBack preserves state', () => {
    const { tabBar, catalogStack, ordersStack } = buildTestStacks();
    const router = new Router({ root: tabBar });

    const catalogStackId = catalogStack.getId();
    const ordersStackId = ordersStack.getId();

    // Build history in catalog
    router.navigate('/catalog');
    router.navigate('/catalog/products/123');
    console.log('After navigate to /catalog/products/123:');
    console.log(JSON.stringify(router.debugGetState(), null, 2));
    expect(getStackHistoryLength(router, catalogStackId)).toBe(2);

    // Switch to orders
    router.navigate('/orders');
    console.log('\nAfter navigate to /orders:');
    console.log(JSON.stringify(router.debugGetState(), null, 2));
    console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
    console.log('Orders stack:', router.debugGetStackInfo(ordersStackId));
    expect(getStackHistoryLength(router, ordersStackId)).toBe(1);

    // goBack in orders
    router.goBack();
    console.log('\nAfter goBack in orders:');
    console.log(JSON.stringify(router.debugGetState(), null, 2));
    console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
    console.log('Orders stack:', router.debugGetStackInfo(ordersStackId));
    console.log('Visible route:', router.debugGetState().visibleRoute);
    expect(getStackHistoryLength(router, ordersStackId)).toBe(1);

    // Switch back to catalog - should restore state
    router.navigate('/catalog/products/123');
    console.log('\nAfter navigate back to /catalog/products/123:');
    console.log(JSON.stringify(router.debugGetState(), null, 2));
    console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
    console.log('Orders stack:', router.debugGetStackInfo(ordersStackId));
    console.log('Visible route:', router.debugGetState().visibleRoute);
    expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
    expect(getVisibleRouteParams(router)?.productId).toBe('123');

    // goBack in catalog
    router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
    expect(getVisibleRoutePath(router)).toBeDefined();
  });

  test('navigate with query, goBack, navigate with different query', () => {
    const { rootStack } = buildTestStacks();
    const router = new Router({ root: rootStack });

    router.navigate('/auth?kind=email');
    expect(getVisibleRouteQuery(router)?.kind).toBe('email');

    router.goBack();
    const visibleRoute = router.debugGetState().visibleRoute;
    expect(visibleRoute?.path).toBe('/');

    router.navigate('/auth?kind=sms');
    expect(getVisibleRouteQuery(router)?.kind).toBe('sms');
  });

  test('complex flow: tabs -> deep navigation -> modal -> goBack chain', () => {
    const { rootStack, catalogStack } = buildTestStacks();
    const router = new Router({ root: rootStack });

    const catalogStackId = catalogStack.getId();
    const rootStackId = rootStack.getId();

    // Start at home
    expect(getVisibleRoutePath(router)).toBe('/');
    console.log('Initial state:');
    console.log(JSON.stringify(router.debugGetState(), null, 2));

    // Navigate to catalog tab
    router.navigate('/catalog');
    console.log('\nAfter navigate to /catalog:');
    console.log(JSON.stringify(router.debugGetState(), null, 2));
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);

    // Navigate deep
    router.navigate('/catalog/products/1');
    router.navigate('/catalog/products/2');
    console.log('\nAfter navigate to /catalog/products/2:');
    console.log(JSON.stringify(router.debugGetState(), null, 2));
    expect(getStackHistoryLength(router, catalogStackId)).toBe(3);

    // Open modal
    router.navigate('/catalog/products/2?modal=promo');
    console.log('\nAfter navigate to /catalog/products/2?modal=promo:');
    console.log(JSON.stringify(router.debugGetState(), null, 2));
    console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
    console.log('Root stack:', router.debugGetStackInfo(rootStackId));
    expect(router.getVisibleRoute()?.query?.modal).toBe('promo');

    // Close modal
    router.goBack();
      console.log('\nAfter goBack (close modal):');
      console.log(JSON.stringify(router.debugGetState(), null, 2));
      console.log('Catalog stack:', router.debugGetStackInfo(catalogStackId));
      console.log('Root stack:', router.debugGetStackInfo(rootStackId));
      console.log('Visible route:', router.debugGetState().visibleRoute);
      expect(getVisibleRoutePath(router)).toBe('/catalog/products/2');

    // Continue going back
      router.goBack();
      expect(getVisibleRoutePath(router)).toBe('/catalog/products/1');
      router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
    expect(getVisibleRoutePath(router)).toBe('/catalog');
  });
});

describe('Navigation Contract Tests - Key Preservation', () => {
  describe('Key preservation when updating query parameters', () => {
    test('key is preserved when updating query parameters on same route', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      // Navigate to auth
      router.navigate('/auth');
      const firstHistory = router.debugGetState().history;
      const firstKey = firstHistory[firstHistory.length - 1]?.key;
      expect(firstKey).toBeDefined();

      // Update query parameter
      router.navigate('/auth?kind=email');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      // Key should be preserved (same route, different query)
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

      // Navigate to same path again
      router.navigate('/catalog');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      expect(secondKey).toBe(firstKey);
      expect(secondHistory.length).toBe(firstHistory.length); // No duplicate
    });

    test('key is preserved when navigating to same path with same params', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog/products/123');
      const firstHistory = router.debugGetState().history;
      const firstKey = firstHistory[firstHistory.length - 1]?.key;

      // Navigate to same path with same params
      router.navigate('/catalog/products/123');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      expect(secondKey).toBe(firstKey);
      expect(secondHistory.length).toBe(firstHistory.length); // No duplicate
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

      // Replace with same route but different params
      router.replace('/catalog/products/2');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      // Key should be preserved (replace keeps the key)
      expect(secondKey).toBe(firstKey);
      expect(secondHistory.length).toBe(firstHistory.length); // History length unchanged
    });
  });

  describe('Key preservation when switching tabs', () => {
    test('key is preserved when switching back to previous tab', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      // Navigate in catalog tab
      router.navigate('/catalog');
      router.navigate('/catalog/products/123');
      const catalogHistory = router.debugGetStackInfo(catalogStackId).items;
      const catalogKey = catalogHistory[catalogHistory.length - 1]?.key;

      // Switch to home tab
      router.navigate('/');

      // Switch back to catalog tab
      router.navigate('/catalog/products/123');
      const catalogHistoryAfter = router.debugGetStackInfo(catalogStackId).items;
      const catalogKeyAfter = catalogHistoryAfter[catalogHistoryAfter.length - 1]?.key;

      // Key should be preserved
      expect(catalogKeyAfter).toBe(catalogKey);
      expect(catalogHistoryAfter.length).toBe(catalogHistory.length); // No duplicate
    });

    test('key is preserved when navigating to existing route in different tab', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      // Navigate in catalog tab
      router.navigate('/catalog');
      const catalogHistory = router.debugGetStackInfo(catalogStackId).items;
      const catalogKey = catalogHistory[catalogHistory.length - 1]?.key;

      // Switch to orders tab
      router.navigate('/orders');

      // Switch back to catalog (same route)
      router.navigate('/catalog');
      const catalogHistoryAfter = router.debugGetStackInfo(catalogStackId).items;
      const catalogKeyAfter = catalogHistoryAfter[catalogHistoryAfter.length - 1]?.key;

      // Key should be preserved
      expect(catalogKeyAfter).toBe(catalogKey);
    });
  });

  describe('Key creation for new routes', () => {
    test('new key is created when navigating to different route', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog');
      const firstHistory = router.debugGetState().history;
      const firstKey = firstHistory[firstHistory.length - 1]?.key;

      // Navigate to different route
      router.navigate('/catalog/products/123');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      // New key should be created
      expect(secondKey).not.toBe(firstKey);
      expect(secondHistory.length).toBe(firstHistory.length + 1); // New item added
    });

    test('new key is created when navigating to route with different params', () => {
      const { tabBar } = buildTestStacks();
      const router = new Router({ root: tabBar });

      router.navigate('/catalog/products/123');
      const firstHistory = router.debugGetState().history;
      const firstKey = firstHistory[firstHistory.length - 1]?.key;

      // Navigate to same route but different params (different product)
      router.navigate('/catalog/products/456');
      const secondHistory = router.debugGetState().history;
      const secondKey = secondHistory[secondHistory.length - 1]?.key;

      // New key should be created (different params = different route instance)
      expect(secondKey).not.toBe(firstKey);
      expect(secondHistory.length).toBe(firstHistory.length + 1);
    });
  });

  describe('Key preservation with goBack', () => {
    test('keys are preserved when going back', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      router.navigate('/catalog/products/123');
      router.navigate('/catalog/products/456');

      const historyBefore = router.debugGetStackInfo(catalogStackId).items;
      const keysBefore = historyBefore.map(item => item.key);

      router.goBack();

      const historyAfter = router.debugGetStackInfo(catalogStackId).items;
      const keysAfter = historyAfter.map(item => item.key);

      // Keys should be preserved (only last item removed)
      expect(keysAfter).toEqual(keysBefore.slice(0, -1));
      expect(keysAfter.length).toBe(keysBefore.length - 1);
    });
  });

  describe('Key preservation with modals', () => {
    test('key is preserved when opening and closing modal', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/catalog');
      const historyBefore = router.debugGetState().history;
      const catalogKey = historyBefore[historyBefore.length - 1]?.key;

      // Open modal
      router.navigate('/catalog?modal=promo');
      const historyWithModal = router.debugGetState().history;
      const modalKey = historyWithModal[historyWithModal.length - 1]?.key;

      // Modal should have new key
      expect(modalKey).not.toBe(catalogKey);

      // Close modal
      router.goBack();
      const historyAfter = router.debugGetState().history;
      const catalogKeyAfter = historyAfter[historyAfter.length - 1]?.key;

      // Catalog key should be preserved
      expect(catalogKeyAfter).toBe(catalogKey);
    });

    test('key is preserved when updating modal query parameters', () => {
      const { rootStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      router.navigate('/auth');
      router.navigate('/auth?kind=email');
      const historyBefore = router.debugGetState().history;
      const emailKey = historyBefore[historyBefore.length - 1]?.key;

      // Update modal query
      router.navigate('/auth?kind=sms');
      const historyAfter = router.debugGetState().history;
      const smsKey = historyAfter[historyAfter.length - 1]?.key;

      // Key should be preserved (same route, different query value)
      expect(smsKey).toBe(emailKey);
    });
  });

  describe('Key preservation in complex scenarios', () => {
    test('keys are preserved in complex navigation flow', () => {
      const { rootStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const catalogStackId = catalogStack.getId();

      // Navigate through catalog
      router.navigate('/catalog');
      const catalogKey1 = router.debugGetStackInfo(catalogStackId).items[0]?.key;

      router.navigate('/catalog/products/1');
      const product1Key = router.debugGetStackInfo(catalogStackId).items[1]?.key;

      router.navigate('/catalog/products/2');
      const product2Key = router.debugGetStackInfo(catalogStackId).items[2]?.key;

      // Open modal
      router.navigate('/catalog/products/2?modal=promo');
      const state = router.debugGetState();
      const modalKey = state.history[state.history.length - 1]?.key;

      // Close modal
      router.goBack();
      const product2KeyAfter = router.debugGetStackInfo(catalogStackId).items[2]?.key;

      // All keys should be preserved
      expect(router.debugGetStackInfo(catalogStackId).items[0]?.key).toBe(catalogKey1);
      expect(product2KeyAfter).toBe(product2Key);
      expect(modalKey).not.toBe(product2Key); // Modal had different key (correct)

      // Navigate back
      router.goBack();
      const product1KeyAfter = router.debugGetStackInfo(catalogStackId).items[1]?.key;
      expect(product1KeyAfter).toBe(product1Key);

      router.goBack();
      const catalogKey1After = router.debugGetStackInfo(catalogStackId).items[0]?.key;
      expect(catalogKey1After).toBe(catalogKey1);
    });

    test('keys are preserved when using replace in middle of stack', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      const catalogKey = router.debugGetStackInfo(catalogStackId).items[0]?.key;

      router.navigate('/catalog/products/1');
      const product1Key = router.debugGetStackInfo(catalogStackId).items[1]?.key;

      router.navigate('/catalog/products/2');
      const product2KeyBefore = router.debugGetStackInfo(catalogStackId).items[2]?.key;

      // Replace product 2 with product 3
      router.replace('/catalog/products/3');
      const product3Key = router.debugGetStackInfo(catalogStackId).items[2]?.key;

      // Keys should be preserved
      expect(router.debugGetStackInfo(catalogStackId).items[0]?.key).toBe(catalogKey);
      expect(router.debugGetStackInfo(catalogStackId).items[1]?.key).toBe(product1Key);
      // Product 2 key should be replaced with product 3 key (same position)
      expect(product3Key).toBe(product2KeyBefore); // Key preserved on replace

      // History length should be same
      expect(getStackHistoryLength(router, catalogStackId)).toBe(3);
    });
  });
});

describe('Navigation Contract Tests - Flat History Architecture', () => {
  describe('Flat history structure', () => {
    test('history is flat array containing items from multiple stacks', () => {
      const { tabBar, homeStack, catalogStack, ordersStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const homeStackId = homeStack.getId();
      const catalogStackId = catalogStack.getId();
      const ordersStackId = ordersStack.getId();

      // Navigate in different stacks
      router.navigate('/'); // home stack
      router.navigate('/catalog'); // catalog stack
      router.navigate('/orders'); // orders stack

      const fullHistory = router.debugGetState().history;

      // History should be flat array
      expect(Array.isArray(fullHistory)).toBe(true);
      expect(fullHistory.length).toBeGreaterThan(0);

      // Should contain items from different stacks
      const stackIds = fullHistory.map(item => item.stackId);
      expect(stackIds).toContain(homeStackId);
      expect(stackIds).toContain(catalogStackId);
      expect(stackIds).toContain(ordersStackId);

      // getStackHistory should filter by stackId
      const homeHistory = router.getStackHistory(homeStackId);
      const catalogHistory = router.getStackHistory(catalogStackId);
      const ordersHistory = router.getStackHistory(ordersStackId);

      // Each stack history should only contain items from that stack
      expect(homeHistory.every(item => item.stackId === homeStackId)).toBe(true);
      expect(catalogHistory.every(item => item.stackId === catalogStackId)).toBe(true);
      expect(ordersHistory.every(item => item.stackId === ordersStackId)).toBe(true);

      // Sum of stack histories should equal or be less than full history
      // (full history may contain items from root stack or other stacks)
      const totalStackItems = homeHistory.length + catalogHistory.length + ordersHistory.length;
      expect(totalStackItems).toBeLessThanOrEqual(fullHistory.length);
    });

    test('full history contains all navigation items in order', () => {
      const { tabBar, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();

      router.navigate('/catalog');
      router.navigate('/catalog/products/1');
      router.navigate('/catalog/products/2');

      const fullHistory = router.debugGetState().history;
      const catalogHistory = router.debugGetStackInfo(catalogStackId).items;

      // Full history should contain all catalog items
      const catalogItemsInFullHistory = fullHistory.filter(
        item => item.stackId === catalogStackId
      );

      expect(catalogItemsInFullHistory.length).toBe(catalogHistory.length);
      expect(catalogItemsInFullHistory.map(item => item.path)).toEqual(
        catalogHistory.map(item => item.path)
      );
    });

    test('history preserves order of navigation across stacks', () => {
      const { tabBar, homeStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const homeStackId = homeStack.getId();
      const catalogStackId = catalogStack.getId();

      // Navigate in sequence
      router.navigate('/'); // home
      router.navigate('/catalog'); // catalog
      router.navigate('/catalog/products/123'); // catalog
      router.navigate('/'); // home

      const fullHistory = router.debugGetState().history;

      // Find positions of items
      const homeItems = fullHistory
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.stackId === homeStackId);
      const catalogItems = fullHistory
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.stackId === catalogStackId);

      // First home item should be before first catalog item
      expect(homeItems[0]?.index).toBeLessThan(catalogItems[0]?.index || Infinity);
      // Catalog product should be after catalog root
      expect(catalogItems[0]?.index).toBeLessThan(catalogItems[1]?.index || Infinity);
      // Last home item should be after catalog items
      expect(catalogItems[1]?.index).toBeLessThan(homeItems[1]?.index || Infinity);
    });
  });

  describe('Multiple stacks working together', () => {
    test('navigating in one stack does not affect other stacks', () => {
      const { tabBar, homeStack, catalogStack, ordersStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const homeStackId = homeStack.getId();
      const catalogStackId = catalogStack.getId();
      const ordersStackId = ordersStack.getId();

      // Initial state
      expect(getStackHistoryLength(router, homeStackId)).toBe(1);
      expect(getStackHistoryLength(router, catalogStackId)).toBe(0);
      expect(getStackHistoryLength(router, ordersStackId)).toBe(0);

      // Navigate in catalog
      router.navigate('/catalog');
      router.navigate('/catalog/products/123');

      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
      expect(getStackHistoryLength(router, homeStackId)).toBe(1); // Unchanged
      expect(getStackHistoryLength(router, ordersStackId)).toBe(0); // Unchanged

      // Navigate in orders
      router.navigate('/orders');
      router.navigate('/orders/2024/12');

      expect(getStackHistoryLength(router, ordersStackId)).toBe(2);
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2); // Preserved
      expect(getStackHistoryLength(router, homeStackId)).toBe(1); // Preserved
    });

    test('goBack only affects active stack, preserves others', () => {
      const { tabBar, catalogStack, ordersStack } = buildTestStacks();
      const router = new Router({ root: tabBar });

      const catalogStackId = catalogStack.getId();
      const ordersStackId = ordersStack.getId();

      // Build history in both stacks
      router.navigate('/catalog');
      router.navigate('/catalog/products/123');
      router.navigate('/orders');
      router.navigate('/orders/2024/12');

      expect(getStackHistoryLength(router, catalogStackId)).toBe(2);
      expect(getStackHistoryLength(router, ordersStackId)).toBe(2);

      // goBack should only affect orders stack (active)
      router.goBack();
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1);
      expect(getStackHistoryLength(router, catalogStackId)).toBe(2); // Preserved

      // Switch to catalog and goBack
      router.navigate('/catalog/products/123');
      router.goBack();
      expect(getStackHistoryLength(router, catalogStackId)).toBe(1);
      expect(getStackHistoryLength(router, ordersStackId)).toBe(1); // Preserved
    });
  });

  describe('Tree-like route structure vs flat history', () => {
    test('nested stacks create tree structure but history remains flat', () => {
      // Create nested structure: rootStack -> tabBar -> catalogStack
      const { rootStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const rootStackId = rootStack.getId();
      const catalogStackId = catalogStack.getId();

      // Navigate through nested structure
      router.navigate('/'); // root stack (contains tabBar)
      router.navigate('/catalog'); // catalog stack (nested in tabBar)

      const fullHistory = router.debugGetState().history;

      // History should be flat
      expect(Array.isArray(fullHistory)).toBe(true);

      // Should contain items from both stacks
      const stackIds = fullHistory.map(item => item.stackId);
      expect(stackIds).toContain(rootStackId);
      expect(stackIds).toContain(catalogStackId);

      // Each stack history should be independent
      const rootHistory = router.debugGetStackInfo(rootStackId).items;
      const catalogHistory = router.debugGetStackInfo(catalogStackId).items;

      expect(rootHistory.length).toBeGreaterThan(0);
      expect(catalogHistory.length).toBeGreaterThan(0);

      // Stack histories should not overlap
      const rootKeys = new Set(rootHistory.map(item => item.key));
      const catalogKeys = new Set(catalogHistory.map(item => item.key));
      const intersection = [...rootKeys].filter(key => catalogKeys.has(key));
      expect(intersection.length).toBe(0); // No overlapping keys
    });

    test('modals from root stack can appear over nested stacks', () => {
      const { rootStack, catalogStack } = buildTestStacks();
      const router = new Router({ root: rootStack });

      const rootStackId = rootStack.getId();
      const catalogStackId = catalogStack.getId();

      // Navigate to nested catalog
      router.navigate('/catalog');
      router.navigate('/catalog/products/123');

      // Open modal from root stack
      router.navigate('/catalog/products/123?modal=promo');

      const fullHistory = router.debugGetState().history;

      // History should contain items from both stacks
      const hasCatalogItem = fullHistory.some(
        item => item.stackId === catalogStackId && item.path?.includes('products/123')
      );
      const hasModalItem = fullHistory.some(
        item => item.stackId === rootStackId && item.query?.modal === 'promo'
      );

      expect(hasCatalogItem).toBe(true);
      expect(hasModalItem).toBe(true);

      // Modal should be last (visible)
      const lastItem = fullHistory[fullHistory.length - 1];
      expect(lastItem?.query?.modal).toBe('promo');
    });
  });
});

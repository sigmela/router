import { Router } from '../Router';
import { NavigationStack } from '../NavigationStack';
import { TabBar } from '../TabBar/TabBar';
import { createController } from '../createController';
import type { ComponentType } from 'react';

const ScreenA: ComponentType<any> = () => null;
const ScreenB: ComponentType<any> = () => null;
const ScreenAuth: ComponentType<any> = () => null;

describe('Router slices', () => {
  test('tabbed root flow', () => {
    const stackA = new NavigationStack()
      .addScreen('/a', ScreenA)
      .addScreen('/a/one', ScreenA)
      .addScreen('/a/two', ScreenA);

    const stackB = new NavigationStack()
      .addScreen('/b', ScreenB)
      .addScreen('/b/one', ScreenB)
      .addScreen('/b/two', ScreenB);

    const tabBar = new TabBar()
      .addTab({ key: 'a', stack: stackA, title: 'A' })
      .addTab({ key: 'b', stack: stackB, title: 'B' });

    const rootStack = new NavigationStack().addScreen('/', {
      component: tabBar.getRenderer(),
      childNode: tabBar,
    });

    const router = new Router({ root: rootStack });

    const aId = stackA.getId();
    const bId = stackB.getId();

    // Используем debugGetStackInfo для проверки истории
    expect(router.debugGetStackInfo(aId).historyLength).toBe(1);
    expect(router.debugGetStackInfo(bId).historyLength).toBe(0);

    router.navigate('/a/one');
    router.navigate('/a/two');
    expect(router.debugGetStackInfo(aId).historyLength).toBe(3);
    router.navigate('/a/two');
    expect(router.debugGetStackInfo(aId).historyLength).toBe(3);

    router.navigate('/b');
    // Проверяем через debugGetState вместо getTabIndex
    const bStackInfo = router.debugGetStackInfo(bId);
    expect(bStackInfo.historyLength).toBe(1);

    router.navigate('/b/one');
    router.navigate('/b/two');
    expect(router.debugGetStackInfo(bId).historyLength).toBe(3);

    expect(router.debugGetStackInfo(aId).historyLength).toBe(3);
    expect(router.debugGetStackInfo(bId).historyLength).toBe(3);

    router.goBack();
    expect(router.debugGetStackInfo(bId).historyLength).toBe(2);
    router.goBack();
    expect(router.debugGetStackInfo(bId).historyLength).toBe(1);
    router.goBack();
    expect(router.debugGetStackInfo(bId).historyLength).toBe(1);

    tabBar.onIndexChange(1);
    router.navigate('/b/one');
    expect(router.debugGetStackInfo(bId).historyLength).toBe(2);
    router.goBack();
    expect(router.debugGetStackInfo(bId).historyLength).toBe(1);

    const rootOnly = new NavigationStack()
      .addScreen('/r', ScreenA)
      .addScreen('/r/next', ScreenA);
    const router2 = new Router({ root: rootOnly });
    const rId = rootOnly.getId();
    expect(router2.debugGetStackInfo(rId).historyLength).toBe(1);
    router2.navigate('/r/next');
    expect(router2.debugGetStackInfo(rId).historyLength).toBe(2);
    router2.navigate('/r/next');
    expect(router2.debugGetStackInfo(rId).historyLength).toBe(2);
    router2.goBack();
    expect(router2.debugGetStackInfo(rId).historyLength).toBe(1);
    router2.goBack();
    expect(router2.debugGetStackInfo(rId).historyLength).toBe(1);

    const authRoot = new NavigationStack().addScreen('/login', ScreenAuth);
    const router5 = new Router({ root: authRoot });
    let rootChanges = 0;
    const unsub = router5.subscribeRoot(() => {
      rootChanges += 1;
    });
    const r5Id = authRoot.getId();
    expect(router5.debugGetStackInfo(r5Id).historyLength).toBe(1);

    const newTabBar = new TabBar()
      .addTab({ key: 'a', stack: stackA, title: 'A' })
      .addTab({ key: 'b', stack: stackB, title: 'B' });
    router5.setRoot(newTabBar as any, { transition: 'fade' });
    expect(router5.getRootTransition()).toBe('fade');
    // Используем debugGetState для проверки состояния
    const allStacks5 = router5.debugGetAllStacks();
    // Проверяем, что есть хотя бы один стек с историей
    const seededStack5 = allStacks5.find((s) => s.historyLength > 0);
    expect(!!seededStack5).toBe(true);
    if (seededStack5) {
      expect(seededStack5.historyLength).toBe(1);
    }

    router5.setRoot(authRoot, { transition: 'slide_from_right' });
    expect(router5.getRootTransition()).toBe('slide_from_right');
    expect(router5.debugGetStackInfo(r5Id).historyLength).toBe(1);
    expect(rootChanges).toBeGreaterThanOrEqual(2);
    unsub();

    const router4 = new Router({ root: tabBar as any });
    router4.navigate('/a/one');
    router4.navigate('/a/two');
    tabBar.onIndexChange(1);
    router4.navigate('/b/one');
    tabBar.onIndexChange(0);
    const a4Id = stackA.getId();
    const b4Id = stackB.getId();
    expect(router4.debugGetStackInfo(a4Id).historyLength).toBe(2);
    expect(router4.debugGetStackInfo(b4Id).historyLength).toBe(2);
    router4.goBack();
    expect(router4.debugGetStackInfo(a4Id).historyLength).toBe(2);
    expect(router4.debugGetStackInfo(b4Id).historyLength).toBe(1);
    tabBar.onIndexChange(1);
    router4.goBack();
    expect(router4.debugGetStackInfo(b4Id).historyLength).toBe(1);

    const modalStack = new NavigationStack().addModal('/modal', ScreenAuth, {
      header: { title: 'Modal Screen' },
    });
    const modalRoutes = modalStack.getRoutes();
    expect(modalRoutes.length).toBe(1);
    const modalRoute = modalRoutes[0]!;
    expect(modalRoute.options?.stackPresentation).toBe('modal');
    expect(modalRoute.options?.header?.title).toBe('Modal Screen');
  });

  test('tab bar keeps active index in sync with navigation', () => {
    const stackA = new NavigationStack()
      .addScreen('/a', ScreenA)
      .addScreen('/a/one', ScreenA);
    const stackB = new NavigationStack().addScreen('/b', ScreenB);

    const tabBar = new TabBar()
      .addTab({ key: 'a', stack: stackA, title: 'A' })
      .addTab({ key: 'b', stack: stackB, title: 'B' });

    const router = new Router({ root: tabBar as any });

    expect(tabBar.getState().index).toBe(0);

    router.navigate('/b');
    expect(tabBar.getState().index).toBe(1);

    router.navigate('/a/one');
    expect(tabBar.getState().index).toBe(0);

    router.goBack();
    expect(tabBar.getState().index).toBe(0);
  });
});

describe('Router controllers', () => {
  test('controller-driven navigate and replace', () => {
    let controllerCallCount = 0;
    let controllerReceivedParams: any = null;
    let controllerReceivedQuery: any = null;
    let presentCallback: any = null;

    const TestController = createController<any>((input, present) => {
      controllerCallCount++;
      controllerReceivedParams = input.params;
      controllerReceivedQuery = input.query;
      presentCallback = present;
    });

    const TestScreen: ComponentType<any> = () => null;

    const stackWithController = new NavigationStack()
      .addScreen('/test', TestScreen)
      .addScreen('/test/:id', {
        controller: TestController,
        component: TestScreen,
      });

    const router = new Router({ root: stackWithController });
    const stackId = stackWithController.getId();

    expect(router.debugGetStackInfo(stackId).historyLength).toBe(1);

    router.navigate('/test/123?param=value');
    expect(controllerCallCount).toBe(1);
    expect(router.debugGetStackInfo(stackId).historyLength).toBe(1);
    expect(controllerReceivedParams).toEqual({ id: '123' });
    expect(controllerReceivedQuery).toEqual({ param: 'value' });

    const testProps = { data: 'test-data', loading: false };
    presentCallback(testProps);

    expect(router.debugGetStackInfo(stackId).historyLength).toBe(2);
    const stackInfo = router.debugGetStackInfo(stackId);
    const topItem = stackInfo.items[stackInfo.items.length - 1]!;
    // Проверяем через debugGetState для passProps (если доступно)
    const state = router.debugGetState();
    const historyItem = state.history.find(
      (h) => h.routeId === topItem.routeId
    );
    expect(historyItem?.params?.id).toBe('123');
    expect(historyItem?.query?.param).toBe('value');

    controllerCallCount = 0;
    router.replace('/test/456?param=newvalue');
    expect(controllerCallCount).toBe(1);
    expect(router.debugGetStackInfo(stackId).historyLength).toBe(2);
    expect(controllerReceivedParams).toEqual({ id: '456' });

    const replaceProps = { data: 'replace-data', loading: true };
    presentCallback(replaceProps);

    expect(router.debugGetStackInfo(stackId).historyLength).toBe(2);
    const replacedStackInfo = router.debugGetStackInfo(stackId);
    const replacedTopItem =
      replacedStackInfo.items[replacedStackInfo.items.length - 1]!;
    const replacedHistoryItem = router
      .debugGetState()
      .history.find((h) => h.routeId === replacedTopItem.routeId);
    expect(replacedHistoryItem?.params?.id).toBe('456');

    router.navigate('/test');
    expect(router.debugGetStackInfo(stackId).historyLength).toBe(1);
  });
});

describe('Router development mode errors', () => {
  test('should throw error in __DEV__ when route not found', () => {
    // Mock __DEV__ to true
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = true;

    const TestScreen: ComponentType<any> = () => null;
    const stack = new NavigationStack().addScreen('/test', TestScreen);
    const router = new Router({ root: stack });

    // Should throw error when navigating to non-existent route
    expect(() => {
      router.navigate('/non-existent-route');
    }).toThrow('Route not found: "/non-existent-route"');

    // Should throw error when replacing with non-existent route
    expect(() => {
      router.replace('/another-non-existent-route');
    }).toThrow('Route not found: "/another-non-existent-route"');

    // Restore original __DEV__ value
    (globalThis as any).__DEV__ = originalDev;
  });

  test('should not throw error in production when route not found', () => {
    // Mock __DEV__ to false
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = false;

    const TestScreen: ComponentType<any> = () => null;
    const stack = new NavigationStack().addScreen('/test', TestScreen);
    const router = new Router({ root: stack });

    // Should not throw error when navigating to non-existent route in production
    expect(() => {
      router.navigate('/non-existent-route');
    }).not.toThrow();

    // Should not throw error when replacing with non-existent route in production
    expect(() => {
      router.replace('/another-non-existent-route');
    }).not.toThrow();

    // Restore original __DEV__ value
    (globalThis as any).__DEV__ = originalDev;
  });
});

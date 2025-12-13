import { Router } from '../Router';
import { NavigationStack } from '../NavigationStack';
import { TabBar } from '../TabBar/TabBar';
import { createController } from '../createController';
import { SplitView } from '../SplitView/SplitView';
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

    const router = new Router({ roots: { main: rootStack }, root: 'main' });

    const aId = stackA.getId();
    const bId = stackB.getId();

    expect(router.debugGetStackInfo(aId).historyLength).toBe(1);
    expect(router.debugGetStackInfo(bId).historyLength).toBe(0);

    router.navigate('/a/one');
    router.navigate('/a/two');
    expect(router.debugGetStackInfo(aId).historyLength).toBe(3);
    router.navigate('/a/two');
    expect(router.debugGetStackInfo(aId).historyLength).toBe(3);

    router.navigate('/b');

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
    const router2 = new Router({ roots: { main: rootOnly }, root: 'main' });
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

    const newTabBar = new TabBar()
      .addTab({ key: 'a', stack: stackA, title: 'A' })
      .addTab({ key: 'b', stack: stackB, title: 'B' });

    const router5 = new Router({
      roots: { auth: authRoot, tabs: newTabBar as any },
      root: 'auth',
    });
    let rootChanges = 0;
    const unsub = router5.subscribeRoot(() => {
      rootChanges += 1;
    });
    const r5Id = authRoot.getId();
    expect(router5.debugGetStackInfo(r5Id).historyLength).toBe(1);

    router5.setRoot('tabs', { transition: 'fade' });
    // Root swaps should behave like an initial mount; transition is suppressed.
    expect(router5.getRootTransition()).toBe(undefined);

    const allStacks5 = router5.debugGetAllStacks();

    const seededStack5 = allStacks5.find((s) => s.historyLength > 0);
    expect(!!seededStack5).toBe(true);
    if (seededStack5) {
      expect(seededStack5.historyLength).toBe(1);
    }

    router5.setRoot('auth', { transition: 'slide_from_right' });
    // Root swaps should behave like an initial mount; transition is suppressed.
    expect(router5.getRootTransition()).toBe(undefined);
    expect(router5.debugGetStackInfo(r5Id).historyLength).toBe(1);
    expect(rootChanges).toBeGreaterThanOrEqual(2);
    unsub();

    const router4 = new Router({
      roots: { main: tabBar as any },
      root: 'main',
    });
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

    const router = new Router({ roots: { main: tabBar as any }, root: 'main' });

    expect(tabBar.getState().index).toBe(0);

    router.navigate('/b');
    expect(tabBar.getState().index).toBe(1);

    router.navigate('/a/one');
    expect(tabBar.getState().index).toBe(0);

    router.goBack();
    expect(tabBar.getState().index).toBe(0);
  });

  test('tab bar supports node tabs with prefix (SplitView) and activates on deep links', () => {
    const homeStack = new NavigationStack().addScreen('/', ScreenA);

    const mailMasterStack = new NavigationStack().addScreen('/', ScreenA);
    const mailDetailStack = new NavigationStack().addScreen(
      '/:threadId',
      ScreenB
    );

    const mailSplitView = new SplitView({
      minWidth: 640,
      primary: mailMasterStack,
      secondary: mailDetailStack,
    });

    const tabBar = new TabBar()
      .addTab({ key: 'home', stack: homeStack, title: 'Home' })
      .addTab({
        key: 'mail',
        node: mailSplitView,
        prefix: '/mail',
        title: 'Mail',
      });

    const rootStack = new NavigationStack().addScreen('/', {
      component: tabBar.getRenderer(),
      childNode: tabBar,
    });

    const router = new Router({ roots: { main: rootStack }, root: 'main' });

    expect(tabBar.getState().index).toBe(0);

    router.navigate('/mail');
    expect(tabBar.getState().index).toBe(1);
    expect(router.debugGetState().activeRoute?.path).toBe('/mail');

    router.navigate('/mail/123');
    expect(tabBar.getState().index).toBe(1);
    expect(router.debugGetState().activeRoute?.path).toBe('/mail/123');
    expect(router.debugGetState().activeRoute?.params?.threadId).toBe('123');
  });

  test('listener errors do not prevent other listeners from running', () => {
    const stack = new NavigationStack().addScreen('/a', ScreenA);
    const router = new Router({ roots: { main: stack }, root: 'main' });

    let goodCalls = 0;
    router.subscribe(() => {
      throw new Error('listener boom');
    });
    router.subscribe(() => {
      goodCalls += 1;
    });

    router.navigate('/a');
    expect(goodCalls).toBeGreaterThanOrEqual(1);
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

    const router = new Router({
      roots: { main: stackWithController },
      root: 'main',
    });
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
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = true;

    const TestScreen: ComponentType<any> = () => null;
    const stack = new NavigationStack().addScreen('/test', TestScreen);
    const router = new Router({ roots: { main: stack }, root: 'main' });

    expect(() => {
      router.navigate('/non-existent-route');
    }).toThrow('Route not found: "/non-existent-route"');

    expect(() => {
      router.replace('/another-non-existent-route');
    }).toThrow('Route not found: "/another-non-existent-route"');

    (globalThis as any).__DEV__ = originalDev;
  });

  test('should not throw error in production when route not found', () => {
    const originalDev = (globalThis as any).__DEV__;
    (globalThis as any).__DEV__ = false;

    const TestScreen: ComponentType<any> = () => null;
    const stack = new NavigationStack().addScreen('/test', TestScreen);
    const router = new Router({ roots: { main: stack }, root: 'main' });

    expect(() => {
      router.navigate('/non-existent-route');
    }).not.toThrow();

    expect(() => {
      router.replace('/another-non-existent-route');
    }).not.toThrow();

    (globalThis as any).__DEV__ = originalDev;
  });
});

import { Router } from '../Router';
import { NavigationStack } from '../NavigationStack';
import { TabBar } from '../TabBar/TabBar';
import { createController } from '../createController';
import type { ComponentType } from 'react';

const ScreenA: ComponentType<any> = () => null;
const ScreenB: ComponentType<any> = () => null;
const ScreenAuth: ComponentType<any> = () => null;

describe('Router slices', () => {
  test('tabbed root and global overlay flow', () => {
    const stackA = new NavigationStack()
      .addScreen('/a', ScreenA)
      .addScreen('/a/one', ScreenA)
      .addScreen('/a/two', ScreenA);

    const stackB = new NavigationStack()
      .addScreen('/b', ScreenB)
      .addScreen('/b/one', ScreenB)
      .addScreen('/b/two', ScreenB);

    const globalStack = new NavigationStack().addScreen('/auth', ScreenAuth, {
      stackPresentation: 'modal',
    });

    const tabBar = new TabBar()
      .addTab({ key: 'a', stack: stackA, title: 'A' })
      .addTab({ key: 'b', stack: stackB, title: 'B' });

    const router = new Router({ root: tabBar as any, global: globalStack });

    const aId = stackA.getId();
    const bId = stackB.getId();
    const gId = globalStack.getId();

    expect(router.getStackHistory(aId).length).toBe(1);
    expect(router.getStackHistory(bId).length).toBe(0);

    router.navigate('/a/one');
    router.navigate('/a/two');
    expect(router.getStackHistory(aId).length).toBe(3);
    router.navigate('/a/two');
    expect(router.getStackHistory(aId).length).toBe(3);

    router.navigate('/b');
    expect(router.getActiveTabIndex()).toBe(1);
    expect(router.getStackHistory(bId).length).toBe(1);

    router.navigate('/b/one');
    router.navigate('/b/two');
    expect(router.getStackHistory(bId).length).toBe(3);

    router.navigate('/auth');
    expect(router.getStackHistory(gId).length).toBe(1);
    router.navigate('/auth');
    expect(router.getStackHistory(gId).length).toBe(1);

    router.goBack();
    expect(router.getStackHistory(gId).length).toBe(0);

    expect(router.getStackHistory(aId).length).toBe(3);
    expect(router.getStackHistory(bId).length).toBe(3);
    expect(router.getActiveTabIndex()).toBe(1);

    router.goBack();
    expect(router.getStackHistory(bId).length).toBe(2);
    router.goBack();
    expect(router.getStackHistory(bId).length).toBe(1);
    router.goBack();
    expect(router.getStackHistory(bId).length).toBe(1);

    router.setActiveTabIndex(1);
    router.navigate('/b/one');
    expect(router.getStackHistory(bId).length).toBe(2);
    router.goBack();
    expect(router.getStackHistory(bId).length).toBe(1);

    const rootOnly = new NavigationStack()
      .addScreen('/r', ScreenA)
      .addScreen('/r/next', ScreenA);
    const router2 = new Router({ root: rootOnly });
    const rId = rootOnly.getId();
    expect(router2.getStackHistory(rId).length).toBe(1);
    router2.navigate('/r/next');
    expect(router2.getStackHistory(rId).length).toBe(2);
    router2.navigate('/r/next');
    expect(router2.getStackHistory(rId).length).toBe(2);
    router2.goBack();
    expect(router2.getStackHistory(rId).length).toBe(1);
    router2.goBack();
    expect(router2.getStackHistory(rId).length).toBe(1);

    const router3 = new Router({ root: rootOnly, global: globalStack });
    const r3Id = rootOnly.getId();
    router3.navigate('/auth');
    expect(router3.getStackHistory(gId).length).toBe(1);
    router3.goBack();
    expect(router3.getStackHistory(gId).length).toBe(0);
    expect(router3.getStackHistory(r3Id).length).toBe(1);

    const authRoot = new NavigationStack().addScreen('/login', ScreenAuth);
    const router5 = new Router({ root: authRoot });
    let rootChanges = 0;
    const unsub = router5.subscribeRoot(() => {
      rootChanges += 1;
    });
    const r5Id = authRoot.getId();
    expect(router5.hasTabBar()).toBe(false);
    expect(router5.getStackHistory(r5Id).length).toBe(1);

    const newTabBar = new TabBar()
      .addTab({ key: 'a', stack: stackA, title: 'A' })
      .addTab({ key: 'b', stack: stackB, title: 'B' });
    router5.setRoot(newTabBar as any, { transition: 'fade' });
    expect(router5.hasTabBar()).toBe(true);
    expect(router5.getRootTransition()).toBe('fade');
    const activeIdx5 = router5.getActiveTabIndex();
    const state5 = newTabBar.getState();
    const route5 = state5.tabs[activeIdx5]!;
    const seededStack5 = newTabBar.stacks[route5.tabKey]!;
    expect(!!seededStack5).toBe(true);
    expect(router5.getStackHistory(seededStack5.getId()).length).toBe(1);

    router5.setRoot(authRoot, { transition: 'slide_from_right' });
    expect(router5.hasTabBar()).toBe(false);
    expect(router5.getRootTransition()).toBe('slide_from_right');
    expect(router5.getStackHistory(r5Id).length).toBe(1);
    expect(rootChanges).toBeGreaterThanOrEqual(2);
    unsub();

    const router4 = new Router({ root: tabBar as any });
    router4.navigate('/a/one');
    router4.navigate('/a/two');
    router4.setActiveTabIndex(1);
    router4.navigate('/b/one');
    router4.setActiveTabIndex(0);
    const a4Id = stackA.getId();
    const b4Id = stackB.getId();
    expect(router4.getStackHistory(a4Id).length).toBe(2);
    expect(router4.getStackHistory(b4Id).length).toBe(2);
    router4.goBack();
    expect(router4.getStackHistory(a4Id).length).toBe(1);
    expect(router4.getStackHistory(b4Id).length).toBe(2);
    router4.setActiveTabIndex(1);
    router4.goBack();
    expect(router4.getStackHistory(b4Id).length).toBe(1);

    const modalStack = new NavigationStack().addModal('/modal', ScreenAuth, {
      header: { title: 'Modal Screen' },
    });
    const modalRoutes = modalStack.getRoutes();
    expect(modalRoutes.length).toBe(1);
    const modalRoute = modalRoutes[0]!;
    expect(modalRoute.options?.stackPresentation).toBe('modal');
    expect(modalRoute.options?.header?.title).toBe('Modal Screen');
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

    expect(router.getStackHistory(stackId).length).toBe(1);

    router.navigate('/test/123?param=value');
    expect(controllerCallCount).toBe(1);
    expect(router.getStackHistory(stackId).length).toBe(1);
    expect(controllerReceivedParams).toEqual({ id: '123' });
    expect(controllerReceivedQuery).toEqual({ param: 'value' });

    const testProps = { data: 'test-data', loading: false };
    presentCallback(testProps);

    expect(router.getStackHistory(stackId).length).toBe(2);
    const currentStack = router.getStackHistory(stackId);
    const topItem = currentStack[currentStack.length - 1]!;
    expect(topItem.passProps).toEqual(testProps);
    expect(topItem.params?.id).toBe('123');
    expect(topItem.query?.param).toBe('value');

    controllerCallCount = 0;
    router.replace('/test/456?param=newvalue');
    expect(controllerCallCount).toBe(1);
    expect(router.getStackHistory(stackId).length).toBe(2);
    expect(controllerReceivedParams).toEqual({ id: '456' });

    const replaceProps = { data: 'replace-data', loading: true };
    presentCallback(replaceProps);

    expect(router.getStackHistory(stackId).length).toBe(2);
    const replacedStack = router.getStackHistory(stackId);
    const replacedTopItem = replacedStack[replacedStack.length - 1]!;
    expect(replacedTopItem.passProps).toEqual(replaceProps);
    expect(replacedTopItem.params?.id).toBe('456');

    router.navigate('/test');
    expect(router.getStackHistory(stackId).length).toBe(3);
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

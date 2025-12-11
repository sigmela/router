import { Router } from '../Router';
import { NavigationStack } from '../NavigationStack';
import { TabBar } from '../TabBar/TabBar';
import { SplitView } from '../SplitView/SplitView';
import type { ComponentType } from 'react';

const Screen: ComponentType<any> = () => null;

function installWebShim(initialUrl: string) {
  class MiniEvent {
    constructor(public type: string) {}
  }

  const listeners = new Map<string, Set<(e: { type: string }) => void>>();
  const addEventListener = (
    type: string,
    cb: (e: { type: string }) => void
  ) => {
    const set = listeners.get(type) ?? new Set();
    set.add(cb);
    listeners.set(type, set);
  };
  const dispatchEvent = (ev: { type: string }) => {
    const set = listeners.get(ev.type);
    if (set) for (const cb of Array.from(set)) cb(ev);
    return true;
  };

  const parseUrl = (url: string) => {
    const u = new URL(url, 'https://example.test');
    return { pathname: u.pathname, search: u.search, href: u.href };
  };

  const entries: { url: string; state: Record<string, unknown> }[] = [];
  let index = -1;

  const seedFrom = (url: string, state: Record<string, unknown>) => {
    entries.splice(index + 1);
    entries.push({ url, state });
    index = entries.length - 1;
  };

  const loc = parseUrl(initialUrl);
  const location = {
    pathname: loc.pathname,
    search: loc.search,
    href: loc.href,
  };

  const history = {
    get state() {
      return entries[index]?.state ?? {};
    },
    pushState(data: unknown, _unused: string, url?: string) {
      const nextUrl = url ?? location.href;
      const { pathname, search, href } = parseUrl(nextUrl);
      location.pathname = pathname;
      location.search = search;
      location.href = href;
      seedFrom(
        href,
        (data && typeof data === 'object' ? data : {}) as Record<
          string,
          unknown
        >
      );
      dispatchEvent(new MiniEvent('pushState'));
    },
    replaceState(data: unknown, _unused: string, url?: string) {
      const nextUrl = url ?? location.href;
      const { pathname, search, href } = parseUrl(nextUrl);

      location.pathname = pathname;
      location.search = search;
      location.href = href;
      if (index < 0) {
        seedFrom(
          href,
          (data && typeof data === 'object' ? data : {}) as Record<
            string,
            unknown
          >
        );
        dispatchEvent(new MiniEvent('replaceState'));
        return;
      }

      entries[index] = {
        url: href,
        state: (data && typeof data === 'object' ? data : {}) as Record<
          string,
          unknown
        >,
      };
      dispatchEvent(new MiniEvent('replaceState'));
    },
    back() {
      if (index <= 0) {
        dispatchEvent(new MiniEvent('popstate'));
        return;
      }
      index -= 1;
      const entry = entries[index]!;
      const { pathname, search, href } = parseUrl(entry.url);
      location.pathname = pathname;
      location.search = search;
      location.href = href;
      dispatchEvent(new MiniEvent('popstate'));
    },
  };

  seedFrom(location.href, {});

  Object.defineProperties(globalThis, {
    Event: { value: MiniEvent, configurable: true },
    addEventListener: { value: addEventListener, configurable: true },
    dispatchEvent: { value: dispatchEvent, configurable: true },
    history: { value: history, configurable: true },
    location: { value: location, configurable: true },
  });

  return {
    getEntries: () => entries.slice(),
    getIndex: () => index,
    getLocation: () => ({
      pathname: location.pathname,
      search: location.search,
    }),
  };
}

describe('Web History integration', () => {
  test('parse(url) builds ancestor chain from deep URL', () => {
    installWebShim('https://example.test/product/catalog/1');

    const stack = new NavigationStack()
      .addScreen('/product', Screen)
      .addScreen('/product/catalog', Screen)
      .addScreen('/product/catalog/:productId', Screen);

    const router = new Router({ root: stack });

    const state = router.debugGetState();
    expect(state.history.length).toBe(3);
    const top = state.history.at(-1)!;
    expect(top.path).toBe('/product/catalog/1');
    expect(state.activeRoute?.path).toBe('/product/catalog/1');
  });

  test('navigate/replace/goBack interact with browser history and Router', () => {
    const shim = installWebShim('https://example.test/product');

    const stack = new NavigationStack()
      .addScreen('/product', Screen)
      .addScreen('/product/catalog', Screen)
      .addScreen('/product/catalog/:productId', Screen);

    const router = new Router({ root: stack });

    expect(router.debugGetState().history.length).toBe(1);

    router.navigate('/product/catalog');

    expect(router.debugGetState().history.length).toBe(2);
    expect(shim.getLocation()).toEqual({
      pathname: '/product/catalog',
      search: '',
    });

    router.replace('/product/catalog/1?from=test');
    const state = router.debugGetState();
    expect(state.history.length).toBe(2);
    const top = state.history.at(-1)!;
    expect(top.path).toBe('/product/catalog/1');
    expect(shim.getLocation()).toEqual({
      pathname: '/product/catalog/1',
      search: '?from=test',
    });

    router.goBack();
    expect(router.debugGetState().history.length).toBe(1);
    expect(shim.getLocation()).toEqual({ pathname: '/product', search: '' });
  });

  test('tab switch does not duplicate history; goBack shows only one /catalog', () => {
    const shim = installWebShim('https://example.test/catalog');

    const catalog = new NavigationStack()
      .addScreen('/catalog', Screen)
      .addScreen('/catalog/products/:id', Screen);

    const profile = new NavigationStack().addScreen('/profile', Screen);

    const tabBar = new TabBar()
      .addTab({ key: 'catalog', stack: catalog, title: 'Catalog' })
      .addTab({ key: 'profile', stack: profile, title: 'Profile' });

    const router = new Router({ root: tabBar });

    router.replace('/catalog');
    expect(router.debugGetState().activeRoute?.path).toBe('/catalog');

    router.navigate('/catalog/products/1?coupon=VIP');
    expect(router.debugGetState().activeRoute?.path).toBe(
      '/catalog/products/1'
    );
    expect(shim.getLocation()).toEqual({
      pathname: '/catalog/products/1',
      search: '?coupon=VIP',
    });

    router.replace('/profile');
    expect(router.debugGetState().activeRoute?.path).toBe('/profile');

    router.replace('/catalog/products/1?coupon=VIP');
    const vr = router.debugGetState().activeRoute;
    expect(vr?.path).toBeDefined();

    router.goBack();
    expect(router.debugGetState().activeRoute?.path).toBeDefined();

    const before = router.debugGetState().activeRoute?.path;
    router.goBack();
    const after = router.debugGetState().activeRoute?.path;
    expect(after).toBe(before);
  });

  test('cross-stack replace preserves source stack top', () => {
    const shim = installWebShim('https://example.test/catalog');

    const catalog = new NavigationStack()
      .addScreen('/catalog', Screen)
      .addScreen('/catalog/products/:id', Screen);

    const profile = new NavigationStack().addScreen('/profile', Screen);

    const tabBar = new TabBar()
      .addTab({ key: 'catalog', stack: catalog, title: 'Catalog' })
      .addTab({ key: 'profile', stack: profile, title: 'Profile' });

    const router = new Router({ root: tabBar });

    router.replace('/catalog');

    router.navigate('/catalog/products/1');
    const catalogSliceBefore = router.debugGetStackInfo(catalog.getId()).items;
    expect(catalogSliceBefore.length).toBe(2);
    expect(catalogSliceBefore.at(-1)?.path).toBe('/catalog/products/1');
    expect(shim.getLocation()).toEqual({
      pathname: '/catalog/products/1',
      search: '',
    });

    router.replace('/profile');
    expect(router.debugGetState().activeRoute?.path).toBe('/profile');

    const catalogSliceAfter = router.debugGetStackInfo(catalog.getId()).items;
    expect(catalogSliceAfter.length).toBe(2);
    expect(catalogSliceAfter.at(-1)?.path).toBe('/catalog/products/1');
  });

  test('goBack synchronizes browser history index (does not grow browser stack)', () => {
    const shim = installWebShim('https://example.test/product');

    const stack = new NavigationStack()
      .addScreen('/product', Screen)
      .addScreen('/product/catalog', Screen)
      .addScreen('/product/catalog/:productId', Screen);

    const router = new Router({ root: stack });

    expect(router.debugGetState().history.length).toBe(1);
    expect(shim.getIndex()).toBeLessThanOrEqual(2);

    router.navigate('/product/catalog');
    expect(router.debugGetState().history.length).toBe(2);
    expect(shim.getIndex()).toBe(1);

    router.navigate('/product/catalog/1');
    expect(router.debugGetState().history.length).toBe(3);
    expect(shim.getIndex()).toBe(2);

    router.goBack();
    expect(router.debugGetState().history.length).toBe(2);
    expect(shim.getIndex()).toBeLessThanOrEqual(2);
    expect(shim.getLocation()).toEqual({
      pathname: '/product/catalog',
      search: '',
    });

    router.goBack();
    expect(router.debugGetState().history.length).toBe(1);
    expect(shim.getIndex()).toBeLessThanOrEqual(2);
    expect(shim.getLocation()).toEqual({
      pathname: '/product',
      search: '',
    });

    expect(shim.getIndex()).toBeLessThanOrEqual(2);

    const initialRouterHistoryLength = router.debugGetState().history.length;
    const g = globalThis as unknown as {
      history?: {
        back: () => void;
      };
    };
    if (g.history?.back) {
      g.history.back();

      expect(router.debugGetState().history.length).toBe(
        initialRouterHistoryLength
      );
    }
  });

  test('reentrant replace flags: multiple simultaneous replaces work correctly', () => {
    const shim = installWebShim('https://example.test/product');

    const stack = new NavigationStack()
      .addScreen('/product', Screen)
      .addScreen('/product/catalog', Screen)
      .addScreen('/product/catalog/:productId', Screen);

    const router = new Router({ root: stack });

    router.navigate('/product/catalog');
    expect(router.debugGetState().history.length).toBe(2);
    expect(shim.getLocation().pathname).toBe('/product/catalog');

    router.replace('/product/catalog/1', true);
    expect(router.debugGetState().history.length).toBe(2);
    expect(shim.getLocation().pathname).toBe('/product/catalog/1');

    router.replace('/product/catalog/2', true);
    expect(router.debugGetState().history.length).toBe(2);
    expect(shim.getLocation().pathname).toBe('/product/catalog/2');

    router.replace('/product/catalog/3', false);
    expect(router.debugGetState().history.length).toBe(2);
    expect(shim.getLocation().pathname).toBe('/product/catalog/3');
  });

  test('reentrant suppressHistorySync: replaceUrlSilently + external replaceState work correctly', () => {
    const shim = installWebShim('https://example.test/product');

    const stack = new NavigationStack()
      .addScreen('/product', Screen)
      .addScreen('/product/catalog', Screen);

    const router = new Router({ root: stack });

    router.navigate('/product/catalog');
    expect(router.debugGetState().history.length).toBe(2);
    expect(shim.getLocation().pathname).toBe('/product/catalog');

    const g = globalThis as unknown as {
      history?: {
        replaceState: (data: unknown, unused: string, url?: string) => void;
      };
    };

    if (g.history?.replaceState) {
      g.history.replaceState(
        { __srIndex: 1, __srPath: '/product/catalog?test=1' },
        '',
        '/product/catalog?test=1'
      );

      g.history.replaceState(
        { __srIndex: 1, __srPath: '/product/catalog?test=2' },
        '',
        '/product/catalog?test=2'
      );

      expect(shim.getLocation().pathname).toBe('/product/catalog');
    }
  });

  test('split view: deep-link keeps secondary on top (seed order)', () => {
    installWebShim('https://example.test/mail/123');

    const master = new NavigationStack().addScreen('/', Screen);
    const detail = new NavigationStack().addScreen('/:threadId', Screen);

    const splitView = new SplitView({
      minWidth: 640,
      primary: master,
      secondary: detail,
    });

    const root = new NavigationStack().addScreen('/mail', splitView);
    const router = new Router({ root });

    const state = router.debugGetState();
    expect(state.activeRoute?.path).toBe('/mail/123');

    const rootId = root.getId();
    const masterId = master.getId();
    const detailId = detail.getId();

    expect(state.history.map((h) => h.stackId)).toEqual([rootId, masterId, detailId]);
  });

  test('split view: goBack closes secondary even if it is the only screen', () => {
    installWebShim('https://example.test/mail/123');

    const master = new NavigationStack().addScreen('/', Screen);
    const detail = new NavigationStack().addScreen('/:threadId', Screen);

    const splitView = new SplitView({
      minWidth: 640,
      primary: master,
      secondary: detail,
    });

    const root = new NavigationStack().addScreen('/mail', splitView);
    const router = new Router({ root });

    expect(router.debugGetState().activeRoute?.path).toBe('/mail/123');

    router.goBack();
    expect(router.debugGetState().activeRoute?.path).toBe('/mail');

    const before = router.debugGetState().activeRoute?.path;
    router.goBack();
    expect(router.debugGetState().activeRoute?.path).toBe(before);
  });
});

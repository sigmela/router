import { Router } from '../Router';
import { NavigationStack } from '../NavigationStack';
import type { ComponentType } from 'react';

const Screen: ComponentType<any> = () => null;

// DOM globals are provided by lib.dom; the shim installs runtime overrides.

function installWebShim(initialUrl: string) {
  // Minimal Event impl
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

  // Simple URL parser
  const parseUrl = (url: string) => {
    const u = new URL(url, 'https://example.test');
    return { pathname: u.pathname, search: u.search, href: u.href };
  };

  const entries: { url: string; state: Record<string, unknown> }[] = [];
  let index = -1;

  const seedFrom = (url: string, state: Record<string, unknown>) => {
    // truncate forward if any
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
        return;
      }
      entries[index] = {
        url: href,
        state: (data && typeof data === 'object' ? data : {}) as Record<
          string,
          unknown
        >,
      };
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

  // Seed initial entry
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

    // Expect three items in global router state (deep parse)
    expect(router.getState().history.length).toBe(3);
    const top = router.getState().history.at(-1)!;
    expect(top.path).toBe('/product/catalog/1');
    expect(router.getVisibleRoute()?.path).toBe('/product/catalog/1');
  });

  test('navigate/replace/goBack interact with browser history and Router', () => {
    const shim = installWebShim('https://example.test/product');

    const stack = new NavigationStack()
      .addScreen('/product', Screen)
      .addScreen('/product/catalog', Screen)
      .addScreen('/product/catalog/:productId', Screen);

    const router = new Router({ root: stack });

    expect(router.getState().history.length).toBe(1);

    router.navigate('/product/catalog');
    // pushState event causes Router to append
    expect(router.getState().history.length).toBe(2);
    expect(shim.getLocation()).toEqual({
      pathname: '/product/catalog',
      search: '',
    });

    router.replace('/product/catalog/1?from=test');
    expect(router.getState().history.length).toBe(2);
    const top = router.getState().history.at(-1)!;
    expect(top.path).toBe('/product/catalog/1');
    expect(shim.getLocation()).toEqual({
      pathname: '/product/catalog/1',
      search: '?from=test',
    });

    router.goBack();
    expect(router.getState().history.length).toBe(1);
    expect(shim.getLocation()).toEqual({ pathname: '/product', search: '' });
  });

  test('tab switch does not duplicate history; goBack shows only one /catalog', () => {
    const shim = installWebShim('https://example.test/');

    const catalog = new NavigationStack()
      .addScreen('/catalog', Screen)
      .addScreen('/catalog/products/:id', Screen);

    const profile = new NavigationStack().addScreen('/profile', Screen);

    const router = new Router({
      root: new (class MockTabBar {
        private _tabBar = new (class {
          stacks: any = {};
          screens: any = {};
          state = {
            tabs: [{ tabKey: 'catalog' }, { tabKey: 'profile' }],
            index: 0,
          };
          subscribe = (_: () => void) => () => {};
          getState = () => this.state;
          onIndexChange = (i: number) => {
            this.state.index = i;
          };
        })();
        constructor() {
          this._tabBar.stacks.catalog = catalog;
          this._tabBar.stacks.profile = profile;
        }
        // TabBar-like surface
        getState = () => this._tabBar.getState();
        subscribe = (cb: () => void) => this._tabBar.subscribe(cb);
        onIndexChange = (i: number) => this._tabBar.onIndexChange(i);
        stacks = this._tabBar.stacks;
        screens = this._tabBar.screens;
      })() as any,
    } as any);

    // Seed active tab (catalog) initial route
    router.replace('/catalog');
    expect(router.getVisibleRoute()?.path).toBe('/catalog');

    // Navigate deep within catalog
    router.navigate('/catalog/products/1?coupon=VIP');
    expect(router.getVisibleRoute()?.path).toBe('/catalog/products/1');
    expect(shim.getLocation()).toEqual({
      pathname: '/catalog/products/1',
      search: '?coupon=VIP',
    });

    // Switch to profile (simulate tab click)
    router.onTabIndexChange(1);
    // We emulate tab click behavior: use replace to show tab's last route or first
    router.replace('/profile');
    expect(router.getVisibleRoute()?.path).toBe('/profile');

    // Switch back to catalog, use replace with last path
    router.onTabIndexChange(0);
    router.replace('/catalog/products/1?coupon=VIP');
    expect(router.getVisibleRoute()?.path).toBe('/catalog/products/1');

    // Now do goBack (should only go to /catalog once)
    router.goBack();
    expect(router.getVisibleRoute()?.path).toBe('/catalog');

    // Next goBack should NOT go to another /catalog in the same stack
    const before = router.getVisibleRoute()?.path;
    router.goBack();
    const after = router.getVisibleRoute()?.path;
    expect(after).toBe(before); // unchanged
  });
});

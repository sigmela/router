import { NavigationStack } from './NavigationStack';
import { nanoid } from 'nanoid/non-secure';
import { TabBar } from './TabBar/TabBar';
import { Platform } from 'react-native';
import qs from 'query-string';
import type {
  CompiledRoute,
  HistoryItem,
  Scope,
  ScreenOptions,
  VisibleRoute,
  QueryPattern,
} from './types';

type Listener = () => void;

export interface RouterConfig {
  root: TabBar | NavigationStack;
  global?: NavigationStack;
  screenOptions?: ScreenOptions;
  debug?: boolean;
}

export type RootTransition = ScreenOptions['stackAnimation'];

function isTabBarLike(obj: any): obj is TabBar {
  return (
    obj != null &&
    typeof obj === 'object' &&
    'onIndexChange' in obj &&
    'getState' in obj &&
    'subscribe' in obj &&
    'stacks' in obj
  );
}

function isNavigationStackLike(obj: any): obj is NavigationStack {
  return (
    obj != null &&
    typeof obj === 'object' &&
    'getRoutes' in obj &&
    'getId' in obj
  );
}

type RouterState = { history: HistoryItem[]; activeTabIndex?: number };

const EMPTY_ARRAY: HistoryItem[] = [];

export class Router {
  public tabBar: TabBar | null = null;
  public root: NavigationStack | TabBar | null = null;
  public global: NavigationStack | null = null;

  private readonly listeners: Set<Listener> = new Set();
  private readonly registry: CompiledRoute[] = [];
  private state: RouterState = {
    history: [],
    activeTabIndex: undefined,
  };

  private readonly routerScreenOptions: ScreenOptions | undefined;
  private readonly debugEnabled: boolean = false;
  private sheetDismissers = new Map<string, () => void>();

  private stackSlices = new Map<string, HistoryItem[]>();
  private stackListeners = new Map<string, Set<Listener>>();
  private activeTabListeners = new Set<Listener>();
  private stackById = new Map<string, NavigationStack>();
  private routeById = new Map<
    string,
    { path: string; stackId: string; tabIndex?: number; scope: Scope }
  >();
  private visibleRoute: VisibleRoute = null;
  private rootListeners: Set<Listener> = new Set();
  private rootTransition?: RootTransition = undefined;

  private lastBrowserIndex: number = 0;
  private pendingReplaceDedupe: boolean = false;
  private suppressHistorySync: boolean = false;

  constructor(config: RouterConfig) {
    this.debugEnabled = config.debug ?? false;
    this.routerScreenOptions = config.screenOptions;

    this.log('ctor');

    if (isTabBarLike(config.root)) {
      this.tabBar = config.root as TabBar;
    }
    if (config.global) {
      this.global = config.global;
    }

    this.root = config.root;

    if (this.tabBar) {
      this.state = {
        history: [],
        activeTabIndex: this.tabBar.getState().index,
      };
    }

    this.buildRegistry();

    if (this.isWebEnv()) {
      this.setupBrowserHistory();
      const url = this.getCurrentUrl();
      this.parse(url);
    } else {
      this.seedInitialHistory();
    }

    this.recomputeVisibleRoute();
  }

  private log(message: string, data?: any): void {
    if (this.debugEnabled) {
      if (data !== undefined) {
        console.log(`[Router] ${message}`, data);
      } else {
        console.log(`[Router] ${message}`);
      }
    }
  }

  public navigate = (path: string): void => {
    if (this.isWebEnv()) {
      const syncWithUrl = this.getPersistenceForPath(path);
      this.pushUrl(path, { syncWithUrl });
      return;
    }
    this.performNavigation(path, 'push');
  };

  public replace = (path: string, dedupe?: boolean): void => {
    if (this.isWebEnv()) {
      this.pendingReplaceDedupe = !!dedupe;
      const syncWithUrl = this.getPersistenceForPath(path);
      this.replaceUrl(path, { syncWithUrl });
      return;
    }
    this.performNavigation(path, 'replace', { dedupe: !!dedupe });
  };

  public registerSheetDismisser = (
    key: string,
    dismisser: () => void
  ): void => {
    this.sheetDismissers.set(key, dismisser);
  };

  public unregisterSheetDismisser = (key: string): void => {
    this.sheetDismissers.delete(key);
  };

  public goBack = (): void => {
    if (this.isWebEnv()) {
      const popped = this.popOnce();
      if (popped) {
        this.syncUrlWithStateAfterInternalPop(popped);
      }

      return;
    }

    this.popOnce();
  };

  public onTabIndexChange = (index: number): void => {
    if (this.tabBar) {
      this.tabBar.onIndexChange(index);
      this.setState({ activeTabIndex: index });
      this.emit(this.activeTabListeners);
      this.recomputeVisibleRoute();
      this.emit(this.listeners);
    }
  };

  public setActiveTabIndex = (index: number): void => {
    this.onTabIndexChange(index);
  };

  public ensureTabSeed = (index: number): void => {
    if (!this.tabBar) return;
    const state = this.tabBar.getState();
    const route = state.tabs[index];
    if (!route) return;
    const key = route.tabKey;
    const stack = this.tabBar.stacks[key];
    if (!stack) return;
    const hasAny = this.getStackHistory(stack.getId()).length > 0;
    if (hasAny) return;
    const first = stack.getFirstRoute();
    if (!first) return;

    const newItem: HistoryItem = {
      key: this.generateKey(),
      scope: 'tab',
      routeId: first.routeId,
      component: first.component,
      options: this.mergeOptions(first.options, stack.getId()),
      params: {},
      tabIndex: index,
      stackId: stack.getId(),
    };
    this.applyHistoryChange('push', newItem);
  };

  public getState = () => {
    return this.state;
  };

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStackHistory = (stackId: string): HistoryItem[] => {
    return this.stackSlices.get(stackId) ?? EMPTY_ARRAY;
  };

  public subscribeStack = (stackId: string, cb: Listener): (() => void) => {
    if (!stackId) return () => {};
    let set = this.stackListeners.get(stackId);
    if (!set) {
      set = new Set();
      this.stackListeners.set(stackId, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
    };
  };

  public getActiveTabIndex = (): number => {
    return this.state.activeTabIndex ?? 0;
  };

  public subscribeActiveTab = (cb: Listener): (() => void) => {
    this.activeTabListeners.add(cb);
    return () => this.activeTabListeners.delete(cb);
  };

  public getRootStackId(): string | undefined {
    return isNavigationStackLike(this.root) ? this.root.getId() : undefined;
  }

  public getGlobalStackId(): string | undefined {
    return this.global?.getId();
  }

  public hasTabBar(): boolean {
    return !!this.tabBar;
  }

  public subscribeRoot(listener: Listener): () => void {
    this.rootListeners.add(listener);
    return () => this.rootListeners.delete(listener);
  }

  private emitRootChange(): void {
    this.rootListeners.forEach((l) => l());
  }

  public getRootTransition(): RootTransition | undefined {
    return this.rootTransition;
  }

  public setRoot(
    nextRoot: TabBar | NavigationStack,
    options?: { transition?: RootTransition }
  ): void {
    this.tabBar = isTabBarLike(nextRoot) ? (nextRoot as TabBar) : null;
    this.root = nextRoot;

    this.rootTransition = options?.transition ?? undefined;

    if (this.tabBar) {
      this.tabBar.onIndexChange(0);
    }

    this.registry.length = 0;
    this.stackSlices.clear();
    this.stackById.clear();
    this.routeById.clear();

    this.state = {
      history: [],
      activeTabIndex: this.tabBar ? this.tabBar.getState().index : undefined,
    };

    this.buildRegistry();
    this.seedInitialHistory();

    const url = this.getCurrentUrl();
    const { pathname, query } = this.parsePath(url);
    this.syncGlobalStackForUrl(pathname, query);

    this.recomputeVisibleRoute();
    this.emitRootChange();
    this.emit(this.listeners);
  }

  public getVisibleRoute = (): VisibleRoute => {
    return this.visibleRoute;
  };

  private recomputeVisibleRoute(): void {
    if (this.global) {
      const gid = this.global.getId();
      const gslice = this.getStackHistory(gid);
      const gtop = gslice.length ? gslice[gslice.length - 1] : undefined;
      if (gtop) {
        const meta = this.routeById.get(gtop.routeId);
        this.visibleRoute = meta
          ? {
              ...meta,
              routeId: gtop.routeId,
              params: gtop.params,
              query: gtop.query,
              path: gtop.path,
            }
          : {
              routeId: gtop.routeId,
              stackId: gtop.stackId,
              params: gtop.params,
              query: gtop.query,
              scope: 'global',
            };
        return;
      }
    }

    if (this.tabBar) {
      const idx = this.getActiveTabIndex();
      const state = this.tabBar.getState();
      const route = state.tabs[idx];
      if (route) {
        const stack = this.tabBar.stacks[route.tabKey];
        if (stack) {
          const sid = stack.getId();
          const slice = this.getStackHistory(sid);
          const top = slice.length ? slice[slice.length - 1] : undefined;
          if (top) {
            const meta = this.routeById.get(top.routeId);
            this.visibleRoute = meta
              ? {
                  ...meta,
                  routeId: top.routeId,
                  params: top.params,
                  query: top.query,
                  path: top.path,
                }
              : {
                  routeId: top.routeId,
                  stackId: sid,
                  tabIndex: idx,
                  params: top.params,
                  query: top.query,
                  scope: 'tab',
                };
            return;
          }
        } else {
          this.visibleRoute = {
            routeId: `tab-screen-${idx}`,
            tabIndex: idx,
            scope: 'tab',
          };
          return;
        }
      }
    }

    if (this.root && isNavigationStackLike(this.root)) {
      const sid = this.root.getId();
      const slice = this.getStackHistory(sid);
      const top = slice.length ? slice[slice.length - 1] : undefined;
      if (top) {
        const meta = this.routeById.get(top.routeId);
        this.visibleRoute = meta
          ? {
              ...meta,
              routeId: top.routeId,
              params: top.params,
              query: top.query,
              path: top.path,
            }
          : {
              routeId: top.routeId,
              stackId: sid,
              params: top.params,
              query: top.query,
              scope: 'root',
            };
        return;
      }
    }
    this.visibleRoute = null;
  }

  private performNavigation(
    path: string,
    action: 'push' | 'replace',
    opts?: { dedupe?: boolean }
  ): void {
    const { pathname, query } = this.parsePath(path);

    this.log('performNavigation', {
      path,
      pathname,
      query,
      action,
      dedupe: opts?.dedupe,
    });

    const base = this.matchBaseRoute(pathname, query);
    const globalMatch = this.matchGlobalRoute(pathname, query);

    this.log('resolveNavigation', {
      base: base
        ? {
            routeId: base.routeId,
            scope: base.scope,
            path: base.path,
            stackId: base.stackId,
          }
        : null,
      global: globalMatch
        ? {
            routeId: globalMatch.routeId,
            scope: globalMatch.scope,
            path: globalMatch.path,
            stackId: globalMatch.stackId,
          }
        : null,
    });

    if (!base && !globalMatch) {
      if (__DEV__) {
        throw new Error(`Route not found: "${pathname}"`);
      }
      return;
    }

    if (base) {
      if (base.scope === 'tab' && this.tabBar && base.tabIndex !== undefined) {
        this.onTabIndexChange(base.tabIndex);
      }

      const matchResult = base.matchPath(pathname);
      const params = matchResult ? matchResult.params : undefined;

      if (action === 'push') {
        const top = this.getTopForTarget(base.stackId);
        if (top && top.routeId === base.routeId) {
          const samePath = (top.path ?? '') === pathname;
          const sameParams = this.areShallowEqual(
            (top.params ?? {}) as Record<string, any>,
            (params ?? {}) as Record<string, any>
          );

          if (samePath && sameParams) {
            this.log(
              'push: same identity as top, updating query instead of pushing'
            );
            const updatedTop: HistoryItem = {
              ...top,
              params,
              query: query as any,
              path: pathname,
            };
            this.applyHistoryChange('replace', updatedTop);
            this.syncGlobalStackForUrl(pathname, query);
            return;
          }
        }
      }

      if (action === 'replace' && opts?.dedupe) {
        const top = this.getTopForTarget(base.stackId);

        this.log('dedupe: checking top of stack', {
          top: top
            ? { key: top.key, routeId: top.routeId, path: top.path }
            : null,
          matched: { routeId: base.routeId, pathname },
        });

        if (top && top.routeId === base.routeId) {
          const sameParams = this.areShallowEqual(
            (top.params ?? {}) as Record<string, any>,
            (params ?? {}) as Record<string, any>
          );
          const samePath = (top.path ?? '') === pathname;
          const sameIdentity = sameParams && samePath;

          const sameQuery = this.areShallowEqual(
            (top.query ?? {}) as Record<string, any>,
            (query ?? {}) as Record<string, any>
          );

          this.log(
            'dedupe: top matches routeId, checking identity (params+path) and query',
            {
              sameParams,
              samePath,
              sameIdentity,
              sameQuery,
            }
          );

          if (sameIdentity && sameQuery) {
            this.log('dedupe: already at target, no-op');
            this.syncGlobalStackForUrl(pathname, query);
            return;
          }

          if (sameIdentity && !sameQuery) {
            this.log(
              'dedupe: same identity, updating query on top via replace'
            );
            const updatedTop: HistoryItem = {
              ...top,
              params,
              query: query as any,
              path: pathname,
            };
            this.applyHistoryChange('replace', updatedTop);
            this.syncGlobalStackForUrl(pathname, query);
            return;
          }
        }

        const stackHistory = this.getStackHistory(base.stackId!);

        this.log('dedupe: searching in stack history', {
          stackId: base.stackId,
          stackHistory: stackHistory.map((h) => ({
            key: h.key,
            routeId: h.routeId,
            path: h.path,
          })),
          looking: { routeId: base.routeId, pathname, params, query },
        });

        const existing = stackHistory.find((item) => {
          const sameRoute = item.routeId === base.routeId;
          const sameParams = this.areShallowEqual(
            (item.params ?? {}) as Record<string, any>,
            (params ?? {}) as Record<string, any>
          );
          const samePath = (item.path ?? '') === pathname;
          return sameRoute && sameParams && samePath;
        });

        if (existing) {
          const updatedExisting: HistoryItem = {
            ...existing,
            params,
            query: query as any,
            path: pathname,
          };

          this.log('dedupe: found existing item, calling popTo', {
            key: updatedExisting.key,
          });

          this.applyHistoryChange('popTo', updatedExisting);
          this.syncGlobalStackForUrl(pathname, query);
          return;
        } else {
          this.log('dedupe: no existing item found, will create new');
        }
      }

      if (base.controller) {
        const controllerInput = { params, query };
        const present = (passProps?: Record<string, unknown>) => {
          const newItem = this.createHistoryItem(
            base,
            params,
            query,
            pathname,
            passProps
          );
          this.applyHistoryChange(action, newItem);
          this.syncGlobalStackForUrl(pathname, query);
        };

        base.controller(controllerInput, present);
        return;
      }

      const newItem = this.createHistoryItem(base, params, query, pathname);
      this.applyHistoryChange(action, newItem);
    } else {
      this.log(
        'performNavigation: no base route, relying only on global stack sync'
      );
    }

    this.syncGlobalStackForUrl(pathname, query);
  }

  private createHistoryItem(
    matched: CompiledRoute,
    params: Record<string, any> | undefined,
    query: Record<string, unknown>,
    pathname: string,
    passProps?: any
  ): HistoryItem {
    return {
      key: this.generateKey(),
      scope: matched.scope,
      routeId: matched.routeId,
      component: matched.component,
      options: this.mergeOptions(matched.options, matched.stackId),
      params,
      query: query as any,
      passProps,
      tabIndex: matched.tabIndex,
      stackId: matched.stackId,
      pattern: matched.path,
      path: pathname,
    };
  }

  private applyHistoryChange(
    action: 'push' | 'replace' | 'pop' | 'popTo',
    item: HistoryItem
  ): void {
    const stackId = item.stackId;
    if (!stackId) return;

    const prevHist = this.state.history;
    let nextHist = prevHist;

    this.log('applyHistoryChange', {
      action,
      stackId,
      item: {
        key: item.key,
        routeId: item.routeId,
        path: item.path,
        scope: item.scope,
      },
    });

    if (action === 'push') {
      nextHist = [...prevHist, item];
    } else if (action === 'replace') {
      let replaced = false;
      const copy = [...prevHist];

      for (let i = copy.length - 1; i >= 0; i--) {
        const h = copy[i];
        if (h) {
          if (h.stackId === stackId) {
            copy[i] = {
              ...item,
              key: h.key,
            };
            replaced = true;
            break;
          }
        }
      }

      if (!replaced) {
        copy.push(item);
      }

      nextHist = copy;
    } else if (action === 'pop') {
      const copy = [...prevHist];
      for (let i = copy.length - 1; i >= 0; i--) {
        const h = copy[i]!;
        if (h.stackId === stackId) {
          copy.splice(i, 1);
          break;
        }
      }
      nextHist = copy;
    } else if (action === 'popTo') {
      const targetKey = item.key;
      const keysToRemove = new Set<string>();
      let foundIndex = -1;

      for (let i = prevHist.length - 1; i >= 0; i--) {
        const h = prevHist[i]!;
        if (h.stackId !== stackId) {
          continue;
        }
        if (h.key === targetKey) {
          foundIndex = i;
          break;
        }
        keysToRemove.add(h.key);
      }

      if (foundIndex === -1) {
        return;
      }

      const copy = [...prevHist];

      copy[foundIndex] = {
        ...copy[foundIndex],
        ...item,
        key: targetKey,
      };

      nextHist = copy.filter((h) => !keysToRemove.has(h.key));
    }

    this.setState({ history: nextHist });

    const newSlice = nextHist.filter((h) => h.stackId === stackId);
    this.stackSlices.set(stackId, newSlice);
    this.emit(this.stackListeners.get(stackId));

    this.recomputeVisibleRoute();
    this.emit(this.listeners);
  }

  private setState(next: Partial<RouterState>): void {
    const prev = this.state;
    const nextState: RouterState = {
      history: next.history ?? prev.history,
      activeTabIndex: next.activeTabIndex ?? prev.activeTabIndex,
    };
    this.state = nextState;

    this.log('setState', nextState);
  }

  private emit(set?: Set<Listener> | null): void {
    if (!set) return;
    set.forEach((l) => l());
  }

  private getTopForTarget(stackId?: string): HistoryItem | undefined {
    if (!stackId) return undefined;
    const slice = this.stackSlices.get(stackId) ?? EMPTY_ARRAY;
    return slice.length ? slice[slice.length - 1] : undefined;
  }

  private buildRegistry(): void {
    this.registry.length = 0;

    const addFromStack = (
      stack: NavigationStack,
      scope: Scope,
      extras: { tabIndex?: number }
    ) => {
      const stackId = stack.getId();
      this.stackById.set(stackId, stack);
      for (const r of stack.getRoutes() as any[]) {
        const compiled: CompiledRoute = {
          routeId: r.routeId,
          scope,
          path: r.path,
          pathnamePattern: r.pathnamePattern,
          isWildcardPath: r.isWildcardPath,
          queryPattern: r.queryPattern,
          baseSpecificity: r.baseSpecificity,
          matchPath: r.matchPath,
          component: r.component,
          controller: r.controller,
          options: r.options,
          tabIndex: extras.tabIndex,
          stackId,
        };

        this.registry.push(compiled);
        this.routeById.set(r.routeId, {
          path: r.path,
          stackId,
          tabIndex: extras.tabIndex,
          scope,
        });

        this.log('buildRegistry route', {
          routeId: compiled.routeId,
          scope: compiled.scope,
          path: compiled.path,
          pathnamePattern: compiled.pathnamePattern,
          isWildcardPath: compiled.isWildcardPath,
          baseSpecificity: compiled.baseSpecificity,
          stackId,
          tabIndex: extras.tabIndex,
        });
      }
      if (!this.stackSlices.has(stackId)) {
        this.stackSlices.set(stackId, EMPTY_ARRAY);
      }
    };

    if (isNavigationStackLike(this.root)) {
      addFromStack(this.root, 'root', {});
    } else if (this.tabBar) {
      const state = this.tabBar.getState();
      state.tabs.forEach((tab, idx) => {
        const stack = this.tabBar!.stacks[tab.tabKey];
        if (stack) {
          addFromStack(stack, 'tab', { tabIndex: idx });
        }
      });
    }

    if (this.global) {
      addFromStack(this.global, 'global', {});
    }
  }

  private seedInitialHistory(): void {
    if (this.state.history.length > 0) return;

    if (this.tabBar) {
      const state = this.tabBar.getState();
      const activeIdx = state.index ?? 0;
      const route = state.tabs[activeIdx];
      if (!route) return;
      const stack = this.tabBar.stacks[route.tabKey];
      if (stack) {
        const first = stack.getFirstRoute();
        if (first) {
          const newItem: HistoryItem = {
            key: this.generateKey(),
            scope: 'tab',
            routeId: first.routeId,
            component: first.component,
            options: this.mergeOptions(first.options, stack.getId()),
            params: {},
            tabIndex: activeIdx,
            stackId: stack.getId(),
          };
          this.applyHistoryChange('push', newItem);
        }
      }
      return;
    }

    if (isNavigationStackLike(this.root)) {
      const first = this.root.getFirstRoute();
      if (first) {
        const newItem: HistoryItem = {
          key: this.generateKey(),
          scope: 'root',
          routeId: first.routeId,
          component: first.component,
          options: this.mergeOptions(first.options, this.root.getId()),
          params: {},
          stackId: this.root.getId(),
        };
        this.applyHistoryChange('push', newItem);
      }
    }
  }

  private matchBaseRoute(
    pathname: string,
    query: Record<string, unknown>
  ): CompiledRoute | undefined {
    this.log('matchBaseRoute', { pathname, query });

    let best:
      | {
          route: CompiledRoute;
          specificity: number;
        }
      | undefined;

    for (const r of this.registry) {
      if (r.scope === 'global') continue;

      let pathMatch: false | { params: Record<string, any> };
      if (r.isWildcardPath) {
        pathMatch = { params: {} };
      } else {
        pathMatch = r.matchPath(pathname);
      }
      if (!pathMatch) continue;

      if (!this.matchQueryPattern(r.queryPattern, query)) continue;

      const spec = r.baseSpecificity;

      this.log('matchBaseRoute candidate', {
        routeId: r.routeId,
        scope: r.scope,
        path: r.path,
        baseSpecificity: r.baseSpecificity,
      });

      if (!best || spec > best.specificity) {
        best = { route: r, specificity: spec };
      }
    }

    if (best) {
      this.log('matchBaseRoute winner', {
        routeId: best.route.routeId,
        scope: best.route.scope,
        path: best.route.path,
        specificity: best.specificity,
      });
    } else {
      this.log('matchBaseRoute no match');
    }

    return best?.route;
  }

  private matchGlobalRoute(
    pathname: string,
    query: Record<string, unknown>
  ): CompiledRoute | undefined {
    if (!this.global) {
      return undefined;
    }

    this.log('matchGlobalRoute', { pathname, query });

    let best:
      | {
          route: CompiledRoute;
          specificity: number;
        }
      | undefined;

    for (const r of this.registry) {
      if (r.scope !== 'global') continue;

      let pathMatch: false | { params: Record<string, any> };
      if (r.isWildcardPath) {
        pathMatch = { params: {} };
      } else {
        pathMatch = r.matchPath(pathname);
      }
      if (!pathMatch) continue;

      if (!this.matchQueryPattern(r.queryPattern, query)) continue;

      const spec = r.baseSpecificity;

      this.log('matchGlobalRoute candidate', {
        routeId: r.routeId,
        scope: r.scope,
        path: r.path,
        baseSpecificity: r.baseSpecificity,
      });

      if (!best || spec > best.specificity) {
        best = { route: r, specificity: spec };
      }
    }

    if (best) {
      this.log('matchGlobalRoute winner', {
        routeId: best.route.routeId,
        scope: best.route.scope,
        path: best.route.path,
        specificity: best.specificity,
      });
    } else {
      this.log('matchGlobalRoute no match');
    }

    return best?.route;
  }

  private generateKey(): string {
    return `route-${nanoid()}`;
  }

  private parsePath(path: string): {
    pathname: string;
    query: Record<string, unknown>;
  } {
    const parsed = qs.parseUrl(path);
    const result = {
      pathname: parsed.url,
      query: parsed.query as Record<string, unknown>,
    };

    this.log('parsePath', {
      input: path,
      output: result,
    });

    return result;
  }

  private mergeOptions(
    routeOptions?: ScreenOptions,
    stackId?: string
  ): ScreenOptions | undefined {
    const stackDefaults = stackId
      ? (this.findStackById(stackId)?.getDefaultOptions() as any)
      : undefined;
    const routerDefaults = this.routerScreenOptions as any;
    if (!routerDefaults && !stackDefaults && !routeOptions) return undefined;

    const merged: any = {
      ...(stackDefaults ?? {}),
      ...(routeOptions ?? {}),
      ...(routerDefaults ?? {}),
    };

    if (
      merged.stackPresentation === 'modal' &&
      merged.convertModalToSheetForAndroid &&
      Platform.OS === 'android'
    ) {
      merged.stackPresentation = 'sheet';
    }

    return merged;
  }

  private findStackById(stackId: string): NavigationStack | undefined {
    return this.stackById.get(stackId);
  }

  private areShallowEqual(
    a?: Record<string, any>,
    b?: Record<string, any>
  ): boolean {
    if (a === b) return true;
    const prev = a ? JSON.stringify(a) : '';
    const next = b ? JSON.stringify(b) : '';
    return prev === next;
  }

  private matchQueryPattern(
    pattern: QueryPattern | null,
    query: Record<string, unknown>
  ): boolean {
    if (!pattern) {
      return true;
    }

    for (const [key, token] of Object.entries(pattern)) {
      const raw = query[key];
      if (raw == null) {
        this.log('matchQueryPattern: key missing', {
          key,
          token,
          query,
        });
        return false;
      }

      if (typeof raw !== 'string') {
        this.log('matchQueryPattern: non-string value', {
          key,
          token,
          value: raw,
        });
        return false;
      }

      if (token.type === 'const') {
        if (raw !== token.value) {
          this.log('matchQueryPattern: const mismatch', {
            key,
            expected: token.value,
            actual: raw,
          });
          return false;
        }
      } else if (token.type === 'param') {
        this.log('matchQueryPattern: param ok', {
          key,
          value: raw,
          paramName: token.name,
        });
      }
    }

    this.log('matchQueryPattern: success', {
      pattern,
      query,
    });

    return true;
  }

  private isWebEnv(): boolean {
    const g = globalThis as unknown as {
      addEventListener?: (type: string, cb: (ev: Event) => void) => void;
      history?: { state: unknown };
      location?: object;
    };
    return !!(g.addEventListener && g.history && g.location);
  }

  private getCurrentUrl(): string {
    const g = globalThis as unknown as {
      location?: { pathname: string; search: string };
    };
    return g.location ? `${g.location.pathname}${g.location.search}` : '/';
  }

  private readIndex(state: unknown): number {
    if (
      state &&
      typeof state === 'object' &&
      '__srIndex' in (state as Record<string, unknown>)
    ) {
      const idx = (state as { __srIndex?: unknown }).__srIndex;
      if (typeof idx === 'number') return idx;
    }
    return 0;
  }

  private getHistoryIndex(): number {
    const g = globalThis as unknown as { history?: { state: unknown } };
    return this.readIndex(g.history?.state);
  }

  private ensureHistoryIndex(): void {
    const g = globalThis as unknown as {
      history?: {
        state: unknown;
        replaceState: (data: unknown, unused: string, url?: string) => void;
      };
      location?: { href: string };
    };
    const st = (g.history?.state ?? {}) as Record<string, unknown>;
    let next = st;
    let changed = false;

    if (!('__srIndex' in next)) {
      next = { ...next, __srIndex: 0 };
      changed = true;
    }

    if (!('__srPath' in next)) {
      next = { ...next, __srPath: this.getCurrentUrl() };
      changed = true;
    }

    if (changed) {
      try {
        g.history?.replaceState(next, '', g.location?.href);
      } catch {}
    }
  }

  private getRouterPathFromHistory(): string {
    const g = globalThis as unknown as { history?: { state: unknown } };
    const st = g.history?.state;
    if (
      st &&
      typeof st === 'object' &&
      '__srPath' in (st as Record<string, unknown>)
    ) {
      const p = (st as { __srPath?: unknown }).__srPath;
      if (typeof p === 'string' && p.length > 0) {
        return p;
      }
    }
    return this.getCurrentUrl();
  }

  private getPersistenceForPath(path: string): boolean {
    const { pathname, query } = this.parsePath(path);
    const base = this.matchBaseRoute(pathname, query);
    if (!base) return true;

    const mergedOptions = this.mergeOptions(base.options, base.stackId);
    const rawsyncWithUrl = mergedOptions && (mergedOptions as any).syncWithUrl;

    if (typeof rawsyncWithUrl === 'boolean') {
      return rawsyncWithUrl;
    }

    return true;
  }

  private pushUrl(
    to: string,
    opts?: {
      syncWithUrl?: boolean;
    }
  ): void {
    const g = globalThis as unknown as {
      history?: {
        state: unknown;
        pushState: (data: unknown, unused: string, url?: string) => void;
      };
    };
    const st = g.history?.state ?? {};
    const prev = this.readIndex(st);
    const base = st as Record<string, unknown>;
    const syncWithUrl = opts?.syncWithUrl ?? true;

    const routerPath = to;
    const visualUrl = syncWithUrl ? to : this.getCurrentUrl();

    const next = {
      ...base,
      __srIndex: prev + 1,
      __srPath: routerPath,
    };

    g.history?.pushState(next, '', visualUrl);
  }

  private replaceUrl(
    to: string,
    opts?: {
      syncWithUrl?: boolean;
    }
  ): void {
    const g = globalThis as unknown as {
      history?: {
        state: unknown;
        replaceState: (data: unknown, unused: string, url?: string) => void;
      };
    };
    const st = g.history?.state ?? {};
    const base = st as Record<string, unknown>;
    const syncWithUrl = opts?.syncWithUrl ?? true;

    const routerPath = to;
    const visualUrl = syncWithUrl ? to : this.getCurrentUrl();

    const next = {
      ...base,
      __srPath: routerPath,
    };

    g.history?.replaceState(next, '', visualUrl);
  }

  private replaceUrlSilently(to: string): void {
    if (!this.isWebEnv()) return;
    this.suppressHistorySync = true;
    this.replaceUrl(to, { syncWithUrl: true });
  }

  private buildUrlFromVisibleRoute(): string | null {
    const vr = this.visibleRoute;
    if (!vr || !vr.path) {
      return null;
    }

    const path = vr.path;
    const query = (vr as any).query as Record<string, unknown> | undefined;

    if (!query || Object.keys(query).length === 0) {
      return path;
    }

    const search = qs.stringify(query);
    return `${path}${search}`;
  }

  private patchHistoryOnce(): void {
    const g = globalThis as unknown as {
      history?: {
        pushState?: (data: unknown, unused: string, url?: string) => void;
        replaceState?: (data: unknown, unused: string, url?: string) => void;
      };
      Event?: new (type: string) => Event;
      dispatchEvent?: (ev: Event) => boolean;
    } & Record<PropertyKey, unknown>;

    const key = Symbol.for('sigmela_router_history_patch');
    if (g[key]) return;

    const hist = g.history;
    if (hist && hist.pushState && hist.replaceState) {
      const originalPush = hist.pushState.bind(hist);
      const originalReplace = hist.replaceState.bind(hist);
      hist.pushState = (data: unknown, unused: string, url?: string) => {
        const res = originalPush(data, unused, url);
        if (g.Event && g.dispatchEvent) {
          g.dispatchEvent(new g.Event('pushState'));
        }
        return res;
      };
      hist.replaceState = (data: unknown, unused: string, url?: string) => {
        const res = originalReplace(data, unused, url);
        if (g.Event && g.dispatchEvent) {
          g.dispatchEvent(new g.Event('replaceState'));
        }
        return res;
      };
    }
    g[key] = true;
  }

  private tryPopGlobalForWebBack(): boolean {
    if (!this.global) return false;

    const gid = this.global.getId();
    const gslice = this.getStackHistory(gid);
    if (!gslice.length) {
      return false;
    }

    const top = gslice[gslice.length - 1]!;

    this.log('web back: popping global top', {
      key: top.key,
      routeId: top.routeId,
      path: top.path,
    });

    this.applyHistoryChange('pop', top);
    return true;
  }

  private setupBrowserHistory(): void {
    const g = globalThis as unknown as {
      addEventListener?: (type: string, cb: (ev: Event) => void) => void;
    };
    this.patchHistoryOnce();
    this.ensureHistoryIndex();
    this.lastBrowserIndex = this.getHistoryIndex();

    const onHistory = (ev: Event): void => {
      if (ev.type === 'pushState') {
        const path = this.getRouterPathFromHistory();
        this.lastBrowserIndex = this.getHistoryIndex();
        this.performNavigation(path, 'push');
        return;
      }

      if (ev.type === 'replaceState') {
        if (this.suppressHistorySync) {
          this.log('onHistory: replaceState suppressed (internal URL sync)');
          this.suppressHistorySync = false;
          this.lastBrowserIndex = this.getHistoryIndex();
          this.pendingReplaceDedupe = false;
          return;
        }

        const path = this.getRouterPathFromHistory();
        const dedupe = this.pendingReplaceDedupe === true;
        this.performNavigation(path, 'replace', { dedupe });
        this.lastBrowserIndex = this.getHistoryIndex();
        this.pendingReplaceDedupe = false;
        return;
      }

      if (ev.type === 'popstate') {
        const url = this.getCurrentUrl();
        const idx = this.getHistoryIndex();
        const delta = idx - this.lastBrowserIndex;

        this.log('popstate event', {
          url,
          idx,
          prevIndex: this.lastBrowserIndex,
          delta,
        });

        if (delta < 0) {
          const poppedGlobal = this.tryPopGlobalForWebBack();

          if (poppedGlobal) {
            this.log(
              'popstate: global popped, syncing stack with URL via replace+dedupe'
            );
          } else {
            this.log('popstate: no global to pop, using replace+dedupe');
          }

          this.performNavigation(url, 'replace', { dedupe: true });
        } else if (delta > 0) {
          this.log('popstate: forward history step, treat as push', { url });
          this.performNavigation(url, 'push');
        } else {
          this.log('popstate: same index, soft replace+dedupe', { url });
          this.performNavigation(url, 'replace', { dedupe: true });
        }

        this.lastBrowserIndex = idx;
      }
    };

    g.addEventListener?.('pushState', onHistory);
    g.addEventListener?.('replaceState', onHistory);
    g.addEventListener?.('popstate', onHistory);
  }

  private syncGlobalStackForUrl(
    pathname: string,
    query: Record<string, unknown>
  ): void {
    if (!this.global) {
      return;
    }

    const globalStackId = this.global.getId();
    const globalSlice = this.getStackHistory(globalStackId);
    const currentTop = globalSlice.length
      ? globalSlice[globalSlice.length - 1]
      : undefined;

    const desired = this.matchGlobalRoute(pathname, query);

    if (!desired) {
      if (currentTop) {
        this.log(
          'syncGlobalStackForUrl: no desired global route, popping existing top',
          {
            key: currentTop.key,
            routeId: currentTop.routeId,
            path: currentTop.path,
          }
        );
        this.applyHistoryChange('pop', currentTop);
      } else {
        this.log(
          'syncGlobalStackForUrl: no desired global route and no current global top'
        );
      }
      return;
    }

    if (currentTop && currentTop.routeId === desired.routeId) {
      const samePath = (currentTop.path ?? '') === pathname;
      const sameQuery = this.areShallowEqual(
        (currentTop.query ?? {}) as Record<string, any>,
        (query ?? {}) as Record<string, any>
      );

      if (samePath && sameQuery) {
        this.log(
          'syncGlobalStackForUrl: desired global already on top, no-op',
          {
            routeId: desired.routeId,
            path: desired.path,
          }
        );
        return;
      }
    }

    const matchResult = desired.matchPath(pathname);
    const params = matchResult ? matchResult.params : undefined;

    const newItem = this.createHistoryItem(desired, params, query, pathname);

    this.log('syncGlobalStackForUrl: pushing desired global item', {
      routeId: desired.routeId,
      path: desired.path,
      stackId: desired.stackId,
      pathname,
      query,
    });

    this.applyHistoryChange('push', newItem);
  }

  private syncUrlWithStateAfterInternalPop(popped: HistoryItem): void {
    if (!this.isWebEnv()) return;

    const compiled = this.registry.find((r) => r.routeId === popped.routeId);

    const isQueryGlobal =
      compiled &&
      compiled.scope === 'global' &&
      compiled.queryPattern &&
      Object.keys(compiled.queryPattern).length > 0;

    if (isQueryGlobal) {
      const currentUrl = this.getCurrentUrl();
      const { pathname, query } = this.parsePath(currentUrl);

      const pattern = compiled!.queryPattern!;
      const nextQuery: Record<string, unknown> = { ...query };

      for (const key of Object.keys(pattern)) {
        delete nextQuery[key];
      }

      const hasQuery = Object.keys(nextQuery).length > 0;
      const newSearch = hasQuery ? `?${qs.stringify(nextQuery)}` : '';

      const nextUrl = `${pathname}${newSearch}`;

      this.log('syncUrlWithStateAfterInternalPop (query-global)', {
        poppedRouteId: popped.routeId,
        from: currentUrl,
        to: nextUrl,
      });

      this.replaceUrlSilently(nextUrl);
      return;
    }

    const from = this.getCurrentUrl();
    const nextUrl = this.buildUrlFromVisibleRoute();

    if (!nextUrl) {
      this.log(
        'syncUrlWithStateAfterInternalPop: no visibleRoute, skip URL sync',
        { from }
      );
      return;
    }

    this.log('syncUrlWithStateAfterInternalPop (base/global)', {
      poppedRouteId: popped.routeId,
      from,
      to: nextUrl,
    });

    this.replaceUrlSilently(nextUrl);
  }

  private popOnce(): HistoryItem | null {
    return this.tryPopActiveStack();
  }

  private tryPopActiveStack(): HistoryItem | null {
    const handlePop = (item: HistoryItem): HistoryItem => {
      if ((item.options?.stackPresentation as any) === 'sheet') {
        const dismisser = this.sheetDismissers.get(item.key);
        if (dismisser) {
          this.unregisterSheetDismisser(item.key);
          dismisser();
          return item;
        }
      }

      this.applyHistoryChange('pop', item);
      return item;
    };

    if (this.global) {
      const gid = this.global.getId();
      const gslice = this.getStackHistory(gid);
      const gtop = gslice.length ? gslice[gslice.length - 1] : undefined;
      if (gtop) {
        return handlePop(gtop);
      }
    }

    if (this.tabBar) {
      const idx = this.getActiveTabIndex();
      const state = this.tabBar.getState();
      const route = state.tabs[idx];
      if (!route) return null;
      const stack = this.tabBar.stacks[route.tabKey];
      if (!stack) return null;
      const sid = stack.getId();
      const slice = this.getStackHistory(sid);
      if (slice.length > 1) {
        const top = slice[slice.length - 1];
        if (top) {
          return handlePop(top);
        }
      }
      return null;
    }

    if (isNavigationStackLike(this.root)) {
      const sid = this.root.getId();
      const slice = this.getStackHistory(sid);
      if (slice.length > 1) {
        const top = slice[slice.length - 1];
        if (top) {
          return handlePop(top);
        }
      }
    }

    return null;
  }

  private parse(url: string): void {
    const { pathname, query } = this.parsePath(url);

    this.log('parse', { url, pathname, query });

    const deepest = this.matchBaseRoute(pathname, query);

    if (!deepest) {
      if (__DEV__) {
        console.warn(
          `[Router] parse: no base route found for "${pathname}", seeding initial history and syncing global stack if any`
        );
      }

      this.seedInitialHistory();
      this.syncGlobalStackForUrl(pathname, query);

      this.recomputeVisibleRoute();
      this.emit(this.listeners);
      return;
    }

    if (
      deepest.scope === 'tab' &&
      this.tabBar &&
      deepest.tabIndex !== undefined
    ) {
      this.onTabIndexChange(deepest.tabIndex);
    }

    const segments = pathname.split('/').filter(Boolean);
    const stackId = deepest.stackId;
    const scope = deepest.scope;

    if (!stackId) {
      if (__DEV__) {
        console.warn(
          '[Router] parse: deepest route has no stackId, seeding initial history and syncing global stack'
        );
      }

      this.seedInitialHistory();
      this.syncGlobalStackForUrl(pathname, query);
      this.recomputeVisibleRoute();
      this.emit(this.listeners);
      return;
    }

    const items: HistoryItem[] = [];

    for (let i = 0; i < segments.length; i++) {
      const prefixPath = '/' + segments.slice(0, i + 1).join('/');

      this.log('parse prefix', {
        index: i,
        prefixPath,
      });

      let routeForPrefix: CompiledRoute | undefined;

      if (i === segments.length - 1) {
        routeForPrefix = deepest;
      } else {
        let best:
          | {
              route: CompiledRoute;
              spec: number;
            }
          | undefined;

        for (const route of this.registry) {
          if (route.stackId !== stackId || route.scope !== scope) continue;

          if (route.queryPattern) continue;

          const matchResult = route.matchPath(prefixPath);
          if (!matchResult) continue;

          const spec = route.baseSpecificity;

          this.log('parse candidate for prefix', {
            prefixPath,
            routeId: route.routeId,
            path: route.path,
            baseSpecificity: spec,
          });

          if (!best || spec > best.spec) {
            best = { route, spec };
          }
        }

        routeForPrefix = best?.route;
      }

      if (!routeForPrefix) {
        this.log('parse: no route for prefix', {
          index: i,
          prefixPath,
        });
        continue;
      }

      const matchResult = routeForPrefix.matchPath(prefixPath);
      const params = matchResult ? matchResult.params : undefined;
      const itemQuery = i === segments.length - 1 ? query : {};

      const item = this.createHistoryItem(
        routeForPrefix,
        params,
        itemQuery,
        prefixPath
      );

      this.log('parse: push item', {
        index: i,
        routeId: routeForPrefix.routeId,
        path: routeForPrefix.path,
        prefixPath,
        params,
        itemQuery,
      });

      items.push(item);
    }

    if (!items.length) {
      if (__DEV__) {
        console.warn(
          '[Router] parse: no items built for URL, seeding initial history and syncing global stack'
        );
      }

      this.seedInitialHistory();
      this.syncGlobalStackForUrl(pathname, query);
      this.recomputeVisibleRoute();
      this.emit(this.listeners);
      return;
    }

    this.setState({ history: items });

    const slice = items.filter((h) => h.stackId === stackId);
    this.stackSlices.set(stackId, slice);
    this.emit(this.stackListeners.get(stackId));

    this.syncGlobalStackForUrl(pathname, query);

    this.recomputeVisibleRoute();
    this.emit(this.listeners);
  }
}

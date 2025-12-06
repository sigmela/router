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
} from './types';

type Listener = () => void;

export interface RouterConfig {
  root: TabBar | NavigationStack;
  global?: NavigationStack;
  screenOptions?: ScreenOptions; // global overrides
}

// Root transition option: allow string shorthand like 'fade'
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
  private sheetDismissers = new Map<string, () => void>();

  // per-stack slices and listeners
  private stackSlices = new Map<string, HistoryItem[]>();
  private stackListeners = new Map<string, Set<Listener>>();
  private activeTabListeners = new Set<Listener>();
  private stackById = new Map<string, NavigationStack>();
  private routeById = new Map<
    string,
    { path: string; stackId: string; tabIndex?: number; scope: Scope }
  >();
  private visibleRoute: VisibleRoute = null;
  // Root structure listeners (TabBar ↔ NavigationStack changes)
  private rootListeners: Set<Listener> = new Set();
  private rootTransition?: RootTransition = undefined;

  // Web history bridging
  private lastBrowserIndex: number = 0;
  private pendingReplaceDedupe: boolean = false;

  constructor(config: RouterConfig) {
    console.log('test');
    this.routerScreenOptions = config.screenOptions;

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
      this.parse(this.getCurrentUrl());
    } else {
      this.seedInitialHistory();
    }

    this.recomputeVisibleRoute();
  }

  // =====================
  // Public API
  // =====================

  /**
   * navigate(path):
   * - mobile: локальный push в стек
   * - web: pushState + sync через History API
   */
  public navigate = (path: string): void => {
    if (this.isWebEnv()) {
      this.pushUrl(path);
      return;
    }
    this.performNavigation(path, 'push');
  };

  /**
   * replace(path):
   * - всегда: замена верхнего элемента активного стека
   *   Примеры:
   *   ['a'] → replace(b) → ['b']
   *   ['a', 'b', 'c'] → replace(d) → ['a', 'b', 'd']
   */
  public replace = (path: string, dedupe?: boolean): void => {
    if (this.isWebEnv()) {
      this.pendingReplaceDedupe = !!dedupe;
      this.replaceUrl(path);
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

  /**
   * goBack():
   * - mobile: чистый pop верхнего экрана активного стека
   * - web: history.back() → popstate → sync
   */
  public goBack = (): void => {
    if (this.isWebEnv()) {
      const g = globalThis as unknown as {
        history?: { back: () => void };
      };
      g.history?.back();
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

  // Per-stack subscriptions
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

  /**
   * setRoot:
   * - полностью сбрасывает историю и реестры
   * - пересобирает registry из нового root
   */
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
    this.recomputeVisibleRoute();
    this.emitRootChange();
    this.emit(this.listeners);
  }

  // Visible route (global top if present, else active tab/root top)
  public getVisibleRoute = (): VisibleRoute => {
    return this.visibleRoute;
  };

  private recomputeVisibleRoute(): void {
    // Global top
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

    // TabBar
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

    // Root stack
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

  // =====================
  // Internal navigation logic
  // =====================

  private performNavigation(
    path: string,
    action: 'push' | 'replace',
    opts?: { dedupe?: boolean }
  ): void {
    console.log('[Router] performNavigation called', {
      path,
      action,
      dedupe: opts?.dedupe,
    });
    const { pathname, query } = this.parsePath(path);
    const matched = this.matchRoute(pathname);
    if (!matched) {
      if (__DEV__) {
        throw new Error(`Route not found: "${pathname}"`);
      }
      return;
    }

    if (
      matched.scope === 'tab' &&
      this.tabBar &&
      matched.tabIndex !== undefined
    ) {
      this.onTabIndexChange(matched.tabIndex);
    }

    const matchResult = matched.match(pathname);
    const params = matchResult ? matchResult.params : undefined;

    // Prevent duplicate push to same screen with same params
    if (action === 'push') {
      const top = this.getTopForTarget(matched.stackId);
      if (top && top.routeId === matched.routeId) {
        const prev = top.params ? JSON.stringify(top.params) : '';
        const next = params ? JSON.stringify(params) : '';
        if (prev === next) {
          return;
        }
      }
    }

    // Optional dedupe for replace: reuse existing item from stack history
    if (action === 'replace' && opts?.dedupe) {
      const top = this.getTopForTarget(matched.stackId);
      console.log('[Router] dedupe: checking top of stack', {
        top: top
          ? { key: top.key, routeId: top.routeId, path: top.path }
          : null,
        matched: { routeId: matched.routeId, pathname },
      });

      if (top && top.routeId === matched.routeId) {
        const sameParams =
          JSON.stringify(top.params ?? {}) === JSON.stringify(params ?? {});
        const sameQuery =
          JSON.stringify(top.query ?? {}) === JSON.stringify(query ?? {});
        const samePath = (top.path ?? '') === pathname;
        console.log(
          '[Router] dedupe: top matches routeId, checking params/query/path',
          {
            sameParams,
            sameQuery,
            samePath,
          }
        );
        if (sameParams && sameQuery && samePath) {
          // Already at target, no-op
          console.log('[Router] dedupe: already at target, no-op');
          return;
        }
      }

      // Look for existing item in stack history to reuse its key
      const stackHistory = this.getStackHistory(matched.stackId!);
      console.log('[Router] dedupe: searching in stack history', {
        stackId: matched.stackId,
        stackHistory: stackHistory.map((h) => ({
          key: h.key,
          routeId: h.routeId,
          path: h.path,
        })),
        looking: { routeId: matched.routeId, pathname, params, query },
      });

      const existing = stackHistory.find((item) => {
        const sameRoute = item.routeId === matched.routeId;
        const sameParams =
          JSON.stringify(item.params ?? {}) === JSON.stringify(params ?? {});
        const sameQuery =
          JSON.stringify(item.query ?? {}) === JSON.stringify(query ?? {});
        const samePath = (item.path ?? '') === pathname;
        return sameRoute && sameParams && sameQuery && samePath;
      });

      if (existing) {
        // Reuse existing item by popping to it (within same stack)
        console.log('[Router] dedupe: found existing item, calling popTo', {
          key: existing.key,
        });
        this.applyHistoryChange('popTo', existing);
        return;
      } else {
        console.log('[Router] dedupe: no existing item found, will create new');
      }
    }

    // If there's a controller, execute it first
    if (matched.controller) {
      const controllerInput = { params, query };
      const present = (passProps?: Record<string, unknown>) => {
        const newItem = this.createHistoryItem(
          matched,
          params,
          query,
          pathname,
          passProps
        );
        this.applyHistoryChange(action, newItem);
      };

      matched.controller(controllerInput, present);
      return;
    }

    const newItem = this.createHistoryItem(matched, params, query, pathname);
    this.applyHistoryChange(action, newItem);
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

  // =====================
  // Core stack manipulation
  // =====================

  /**
   * applyHistoryChange:
   *
   * Семантика по стеку для stackId:
   * - push:    [...prev, item]
   * - replace: [..., lastOfStack] → заменить lastOfStack на item (если стека не было — push)
   * - pop:     удалить lastOfStack
   * - popTo:   оставить элементы до item.key включительно, всё после — удалить (внутри стека)
   *
   * История хранится линейно (по времени навигации), но операции всегда
   * работают по stackId на «верхушке» конкретного стека.
   */
  private applyHistoryChange(
    action: 'push' | 'replace' | 'pop' | 'popTo',
    item: HistoryItem
  ): void {
    const stackId = item.stackId;
    if (!stackId) return;

    const prevHist = this.state.history;
    let nextHist = prevHist;

    if (action === 'push') {
      nextHist = [...prevHist, item];
    } else if (action === 'replace') {
      let replaced = false;
      const copy = [...prevHist];

      // Ищем последний элемент этого стека и заменяем его
      for (let i = copy.length - 1; i >= 0; i--) {
        const h = copy[i];
        if (h) {
          if (h.stackId === stackId) {
            // Сохраняем ключ старого элемента, чтобы не ломать анимации по key
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
        // Если в стеке ещё не было элементов — ведём себя как push
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
      let found = false;

      // Идём с конца: все элементы этого стека после targetKey удаляем
      for (let i = prevHist.length - 1; i >= 0; i--) {
        const h = prevHist[i]!;
        if (h.stackId !== stackId) {
          continue;
        }
        if (h.key === targetKey) {
          found = true;
          break;
        }
        keysToRemove.add(h.key);
      }

      if (!found) {
        // Нет такого элемента в стеке — ничего не делаем
        return;
      }

      nextHist = prevHist.filter((h) => !keysToRemove.has(h.key));
    }

    // Обновляем состояние
    this.setState({ history: nextHist });

    // Обновляем срез стека
    const newSlice = nextHist.filter((h) => h.stackId === stackId);
    this.stackSlices.set(stackId, newSlice);
    this.emit(this.stackListeners.get(stackId));

    // Обновляем visibleRoute + глобальные слушатели
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

  // =====================
  // Registry & routes
  // =====================

  private buildRegistry(): void {
    this.registry.length = 0;

    const addFromStack = (
      stack: NavigationStack,
      scope: Scope,
      extras: { tabIndex?: number }
    ) => {
      const stackId = stack.getId();
      this.stackById.set(stackId, stack);
      for (const r of stack.getRoutes()) {
        this.registry.push({
          routeId: r.routeId,
          scope,
          path: r.path,
          match: r.match,
          component: r.component,
          controller: r.controller,
          options: r.options,
          tabIndex: extras.tabIndex,
          stackId,
        });
        this.routeById.set(r.routeId, {
          path: r.path,
          stackId,
          tabIndex: extras.tabIndex,
          scope,
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

  private matchRoute(path: string): CompiledRoute | undefined {
    for (const r of this.registry) {
      if (r.match(path)) return r;
    }
    return undefined;
  }

  private generateKey(): string {
    return `route-${nanoid()}`;
  }

  private parsePath(path: string): {
    pathname: string;
    query: Record<string, unknown>;
  } {
    const parsed = qs.parseUrl(path);
    return { pathname: parsed.url, query: parsed.query };
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

  // =====================
  // Web integration (History API)
  // =====================

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
    const st = g.history?.state ?? {};
    if (
      this.readIndex(st) === 0 &&
      !(
        st &&
        typeof st === 'object' &&
        '__srIndex' in (st as Record<string, unknown>)
      )
    ) {
      const next = { ...(st as Record<string, unknown>), __srIndex: 0 };
      try {
        g.history?.replaceState(next, '', g.location?.href);
      } catch {
        // ignore
      }
    }
  }

  private pushUrl(to: string): void {
    const g = globalThis as unknown as {
      history?: {
        state: unknown;
        pushState: (data: unknown, unused: string, url?: string) => void;
      };
    };
    const st = g.history?.state ?? {};
    const prev = this.readIndex(st);
    const next = { ...(st as Record<string, unknown>), __srIndex: prev + 1 };
    g.history?.pushState(next, '', to);
  }

  private replaceUrl(to: string): void {
    const g = globalThis as unknown as {
      history?: {
        state: unknown;
        replaceState: (data: unknown, unused: string, url?: string) => void;
      };
    };
    const st = g.history?.state ?? {};
    g.history?.replaceState(st, '', to);
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

  /**
   * Web-only helper: при шаге назад по browser history
   * сначала пытаемся убрать верхний экран из global-стека (модалка).
   *
   * Возвращает true, если что-то реально попнули.
   */
  private tryPopGlobalForWebBack(): boolean {
    if (!this.global) return false;

    const gid = this.global.getId();
    const gslice = this.getStackHistory(gid);
    if (!gslice.length) {
      return false;
    }

    const top = gslice[gslice.length - 1]!;
    console.log('[Router] web back: popping global top', {
      key: top.key,
      routeId: top.routeId,
      path: top.path,
    });

    // Для глобального стека нас устраивает обычный pop:
    // модалка закрывается, стейк табов/рута не трогаем.
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
      const url = this.getCurrentUrl();

      if (ev.type === 'pushState') {
        this.lastBrowserIndex = this.getHistoryIndex();
        this.performNavigation(url, 'push');
        return;
      }

      if (ev.type === 'replaceState') {
        const dedupe = this.pendingReplaceDedupe === true;
        this.performNavigation(url, 'replace', { dedupe });
        this.lastBrowserIndex = this.getHistoryIndex();
        this.pendingReplaceDedupe = false;
        return;
      }

      if (ev.type === 'popstate') {
        const url = this.getCurrentUrl();
        const idx = this.getHistoryIndex();
        const delta = idx - this.lastBrowserIndex;

        console.log('[Router] popstate event', {
          url,
          idx,
          prevIndex: this.lastBrowserIndex,
          delta,
        });

        if (delta < 0) {
          // Шаг НАЗАД по browser history
          // 1) Сначала пробуем убрать верхний экран из global-стека (модалка)
          const poppedGlobal = this.tryPopGlobalForWebBack();
          if (poppedGlobal) {
            console.log(
              '[Router] popstate: handled by global pop, skip URL-based navigation'
            );
            this.lastBrowserIndex = idx;
            return;
          }

          // 2) Если глобального экрана нет — ведём себя как раньше:
          // replace + dedupe по текущему URL
          console.log(
            '[Router] popstate: no global to pop, using replace+dedupe'
          );
          this.performNavigation(url, 'replace', { dedupe: true });
        } else if (delta > 0) {
          // Шаг ВПЕРЁД по истории браузера — это push
          console.log('[Router] popstate: forward history step, treat as push');
          this.performNavigation(url, 'push');
        } else {
          // Тот же индекс: мягкий replace с dedupe
          console.log('[Router] popstate: same index, soft replace+dedupe');
          this.performNavigation(url, 'replace', { dedupe: true });
        }

        this.lastBrowserIndex = idx;
      }
    };

    g.addEventListener?.('pushState', onHistory);
    g.addEventListener?.('replaceState', onHistory);
    g.addEventListener?.('popstate', onHistory);
  }

  // =====================
  // Pop helpers
  // =====================

  private popOnce(): void {
    if (this.tryPopActiveStack()) return;
  }

  private tryPopActiveStack(): boolean {
    const handlePop = (item: HistoryItem): boolean => {
      if ((item.options?.stackPresentation as any) === 'sheet') {
        const dismisser = this.sheetDismissers.get(item.key);
        if (dismisser) {
          this.unregisterSheetDismisser(item.key);
          dismisser();
          return true;
        }
      }

      this.applyHistoryChange('pop', item);
      return true;
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
      if (!route) return false;
      const stack = this.tabBar.stacks[route.tabKey];
      if (!stack) return false;
      const sid = stack.getId();
      const slice = this.getStackHistory(sid);
      if (slice.length > 1) {
        const top = slice[slice.length - 1];
        if (top) {
          return handlePop(top);
        }
      }
      return false;
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

    return false;
  }

  // =====================
  // Initial deep-link parsing
  // =====================

  // Expand deep URL into a stack chain on initial load
  private parse(url: string): void {
    const { pathname, query } = this.parsePath(url);
    const deepest = this.matchRoute(pathname);
    if (!deepest) {
      if (__DEV__) {
        throw new Error(`Route not found: "${pathname}"`);
      }
      this.seedInitialHistory();
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

    const parts = pathname.split('/').filter(Boolean);
    const prefixes: string[] = new Array(parts.length + 1);
    let acc = '';
    prefixes[0] = '/';
    for (let i = 0; i < parts.length; i++) {
      acc += `/${parts[i]}`;
      prefixes[i + 1] = acc;
    }

    const candidates: {
      segmentCount: number;
      route: CompiledRoute;
      candidateUrl: string;
      params?: Record<string, unknown>;
    }[] = [];

    for (const route of this.registry) {
      if (route.stackId !== deepest.stackId || route.scope !== deepest.scope) {
        continue;
      }
      const segmentsCount = route.path.split('/').filter(Boolean).length;
      const candidateUrl = prefixes[segmentsCount];
      if (!candidateUrl) {
        continue;
      }
      const matchResult = route.match(candidateUrl);
      if (!matchResult) {
        continue;
      }

      candidates.push({
        params: matchResult.params,
        segmentCount: segmentsCount,
        candidateUrl,
        route,
      });
    }

    if (!candidates.length) {
      this.seedInitialHistory();
      this.recomputeVisibleRoute();
      this.emit(this.listeners);
      return;
    }

    candidates.sort((a, b) => a.segmentCount - b.segmentCount);

    const items = candidates.map((c, i) =>
      this.createHistoryItem(
        c.route,
        c.params,
        i === candidates.length - 1 ? query : {},
        c.candidateUrl
      )
    );

    this.setState({ history: items });

    // Обновляем срез только для соответствующего стека
    const sid = (items[0]?.stackId ?? deepest.stackId) as string | undefined;
    if (sid) {
      const slice = items.filter((h) => h.stackId === sid);
      this.stackSlices.set(sid, slice);
      this.emit(this.stackListeners.get(sid));
    }

    this.recomputeVisibleRoute();
    this.emit(this.listeners);
  }
}

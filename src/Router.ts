import { NavigationStack } from './NavigationStack';
import { nanoid } from 'nanoid/non-secure';
import { TabBar } from './TabBar/TabBar';
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

  constructor(config: RouterConfig) {
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

  // Public API
  public navigate = (path: string): void => {
    if (this.isWebEnv()) {
      this.pushUrl(path);
      return;
    }
    this.performNavigation(path, 'push');
  };

  public replace = (path: string): void => {
    if (this.isWebEnv()) {
      this.replaceUrl(path);
      return;
    }
    this.performNavigation(path, 'replace');
  };

  public goBack = (): void => {
    if (this.isWebEnv()) {
      // Web: only go back within the current active stack.
      const didPop = this.tryPopActiveStack();
      if (didPop) {
        // Keep URL in sync with the new visible route without adding history entries
        const path = this.getVisibleRoute()?.path;
        if (path) this.replaceUrl(path);
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

  public setRoot(
    nextRoot: TabBar | NavigationStack,
    options?: { transition?: RootTransition }
  ): void {
    // Update root/tabBar references
    this.tabBar = isTabBarLike(nextRoot) ? (nextRoot as TabBar) : null;
    this.root = nextRoot;

    // Save requested transition (stackAnimation string)
    this.rootTransition = options?.transition ?? undefined;

    // If switching to TabBar, reset selected tab to the first one to avoid
    // leaking previously selected tab across auth flow changes.
    if (this.tabBar) {
      this.tabBar.onIndexChange(0);
    }

    // Reset core structures (keep global reference as-is)
    this.registry.length = 0;
    this.stackSlices.clear();
    this.stackById.clear();
    this.routeById.clear();

    // Reset state (activeTabIndex from tabBar if present)
    this.state = {
      history: [],
      activeTabIndex: this.tabBar ? this.tabBar.getState().index : undefined,
    };

    // Rebuild registry and seed new root
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

  // Internal navigation logic
  private performNavigation(path: string, action: 'push' | 'replace'): void {
    const { pathname, query } = this.parsePath(path);
    const matched = this.matchRoute(pathname);
    if (!matched) {
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

    // Prevent duplicate push when navigating to the same screen already on top of its stack
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

  // Internal helpers
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
      // init empty slice
      if (!this.stackSlices.has(stackId))
        this.stackSlices.set(stackId, EMPTY_ARRAY);
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

  private applyHistoryChange(
    action: 'push' | 'replace' | 'pop',
    item: HistoryItem
  ): void {
    const sid = item.stackId!;
    if (action === 'push') {
      this.setState({ history: [...this.state.history, item] });
      const prevSlice = this.stackSlices.get(sid) ?? EMPTY_ARRAY;
      const nextSlice = [...prevSlice, item];
      this.stackSlices.set(sid, nextSlice);
      this.emit(this.stackListeners.get(sid));
      this.recomputeVisibleRoute();
      this.emit(this.listeners);
    } else if (action === 'replace') {
      const prevTop = this.state.history[this.state.history.length - 1];
      const prevSid = prevTop?.stackId;
      this.setState({ history: [...this.state.history.slice(0, -1), item] });
      if (prevSid && prevSid !== sid) {
        const prevSlice = this.stackSlices.get(prevSid) ?? EMPTY_ARRAY;
        const trimmed = prevSlice.slice(0, -1);
        this.stackSlices.set(prevSid, trimmed);
        this.emit(this.stackListeners.get(prevSid));
        const newSlice = this.stackSlices.get(sid) ?? EMPTY_ARRAY;
        const appended = [...newSlice, item];
        this.stackSlices.set(sid, appended);
        this.emit(this.stackListeners.get(sid));
      } else {
        const prevSlice = this.stackSlices.get(sid) ?? EMPTY_ARRAY;
        const nextSlice = prevSlice.length
          ? [...prevSlice.slice(0, -1), item]
          : [item];
        this.stackSlices.set(sid, nextSlice);
        this.emit(this.stackListeners.get(sid));
      }
      this.recomputeVisibleRoute();
      this.emit(this.listeners);
    } else if (action === 'pop') {
      // Remove specific item by key from global history
      const nextHist = this.state.history.filter((h) => h.key !== item.key);
      this.setState({ history: nextHist });

      // Update slice only if the last item matches the popped one
      const prevSlice = this.stackSlices.get(sid) ?? EMPTY_ARRAY;
      const last = prevSlice.length
        ? prevSlice[prevSlice.length - 1]
        : undefined;
      if (last && last.key === item.key) {
        const nextSlice = prevSlice.slice(0, -1);
        this.stackSlices.set(sid, nextSlice);
        this.emit(this.stackListeners.get(sid));
      }

      this.recomputeVisibleRoute();
      this.emit(this.listeners);
    }
  }

  private setState(next: Partial<RouterState>): void {
    const prev = this.state;
    const nextState: RouterState = {
      history: next.history ?? prev.history,
      activeTabIndex: next.activeTabIndex ?? prev.activeTabIndex,
    };
    this.state = nextState;
    // Callers will emit updates explicitly.
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

    return merged;
  }

  private findStackById(stackId: string): NavigationStack | undefined {
    return this.stackById.get(stackId);
  }

  // ==== Web integration (History API) ====
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
      Event?: new (type: string) => Event;
      dispatchEvent?: (ev: Event) => boolean;
    };
    const st = g.history?.state ?? {};
    const prev = this.readIndex(st);
    const next = { ...(st as Record<string, unknown>), __srIndex: prev + 1 };
    g.history?.pushState(next, '', to);
    if (g.Event && g.dispatchEvent) {
      g.dispatchEvent(new g.Event('pushState'));
    }
  }

  private replaceUrl(to: string): void {
    const g = globalThis as unknown as {
      history?: {
        state: unknown;
        replaceState: (data: unknown, unused: string, url?: string) => void;
      };
      Event?: new (type: string) => Event;
      dispatchEvent?: (ev: Event) => boolean;
    };
    const st = g.history?.state ?? {};
    g.history?.replaceState(st, '', to);
    if (g.Event && g.dispatchEvent) {
      g.dispatchEvent(new g.Event('replaceState'));
    }
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

  private lastBrowserIndex: number = 0;

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
        this.performNavigation(url, 'replace');
        this.lastBrowserIndex = this.getHistoryIndex();
        return;
      }
      if (ev.type === 'popstate') {
        const idx = this.getHistoryIndex();
        const delta = idx - this.lastBrowserIndex;
        if (delta < 0) {
          let steps = -delta;
          while (steps-- > 0) this.popOnce();
          const target = this.parsePath(url).pathname;
          const current = this.getVisibleRoute()?.path;
          if (current !== target) this.performNavigation(url, 'replace');
        } else if (delta > 0) {
          this.performNavigation(url, 'push');
        } else {
          this.performNavigation(url, 'replace');
        }
        this.lastBrowserIndex = idx;
      }
    };

    g.addEventListener?.('pushState', onHistory);
    g.addEventListener?.('replaceState', onHistory);
    g.addEventListener?.('popstate', onHistory);
  }

  private popOnce(): void {
    if (this.tryPopActiveStack()) return;
  }

  // Attempts to pop exactly one screen within the active stack only.
  // Returns true if a pop occurred; false otherwise.
  private tryPopActiveStack(): boolean {
    if (this.global) {
      const gid = this.global.getId();
      const gslice = this.getStackHistory(gid);
      const gtop = gslice.length ? gslice[gslice.length - 1] : undefined;
      if (gtop) {
        this.applyHistoryChange('pop', gtop);
        return true;
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
          this.applyHistoryChange('pop', top);
          return true;
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
          this.applyHistoryChange('pop', top);
          return true;
        }
      }
    }

    return false;
  }

  // Expand deep URL into a stack chain on initial load
  private parse(url: string): void {
    const { pathname, query } = this.parsePath(url);
    const deepest = this.matchRoute(pathname);
    if (!deepest) {
      this.seedInitialHistory();
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

    const first = items[0];
    const sid = (first?.stackId ?? deepest.stackId) as string | undefined;
    this.setState({ history: items });
    if (sid) {
      this.stackSlices.set(sid, items);
      this.emit(this.stackListeners.get(sid));
    }
  }
}

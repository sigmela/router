import { nanoid } from 'nanoid/non-secure';
import { Platform } from 'react-native';
import qs from 'query-string';
import type { NavigationNode, NodeRoute, NodeChild } from './navigationNode';
import type {
  CompiledRoute,
  HistoryItem,
  ScreenOptions,
  ActiveRoute,
  QueryPattern,
} from './types';

type Listener = () => void;

function canSwitchToRoute(
  node: NavigationNode | undefined
): node is NavigationNode & { switchToRoute: (routeId: string) => void } {
  return node !== undefined && typeof node.switchToRoute === 'function';
}

function canLookupRoutes(
  node: NavigationNode | undefined
): node is NavigationNode & { hasRoute: (routeId: string) => boolean } {
  return node !== undefined && typeof node.hasRoute === 'function';
}

export interface RouterConfig {
  root: NavigationNode;
  screenOptions?: ScreenOptions;
  debug?: boolean;
}

export type RootTransition = ScreenOptions['stackAnimation'];

type RouterState = { history: HistoryItem[] };

const EMPTY_ARRAY: HistoryItem[] = [];

export class Router {
  public root: NavigationNode | null = null;

  private readonly listeners: Set<Listener> = new Set();
  private readonly registry: CompiledRoute[] = [];
  private state: RouterState = {
    history: [],
  };

  private readonly routerScreenOptions: ScreenOptions | undefined;
  private readonly debugEnabled: boolean = false;
  private sheetDismissers = new Map<string, () => void>();

  private stackListeners = new Map<string, Set<Listener>>();
  private stackById = new Map<string, NavigationNode>();
  private routeById = new Map<string, { path: string; stackId: string }>();
  private stackActivators = new Map<string, () => void>();
  private stackHistories = new Map<string, HistoryItem[]>();
  private activeRoute: ActiveRoute = null;
  private rootListeners: Set<Listener> = new Set();
  private rootTransition?: RootTransition = undefined;

  private lastBrowserIndex: number = 0;
  private pendingReplaceDedupe: boolean = false;
  private suppressHistorySync: boolean = false;

  constructor(config: RouterConfig) {
    this.debugEnabled = config.debug ?? false;
    this.routerScreenOptions = config.screenOptions;

    this.log('ctor');

    this.root = config.root;

    this.buildRegistry();

    if (this.isWebEnv()) {
      this.setupBrowserHistory();
      const url = this.getCurrentUrl();
      this.buildHistoryFromUrl(url);
    } else {
      this.seedInitialHistory();
    }

    this.recomputeActiveRoute();
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
      const syncWithUrl = this.shouldSyncPathWithUrl(path);
      this.pushUrl(path, { syncWithUrl });
      return;
    }
    this.performNavigation(path, 'push');
  };

  public replace = (path: string, dedupe?: boolean): void => {
    if (this.isWebEnv()) {
      this.pendingReplaceDedupe = !!dedupe;
      const syncWithUrl = this.shouldSyncPathWithUrl(path);
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
      const popped = this.popFromActiveStack();
      if (popped) {
        this.syncUrlAfterInternalPop(popped);
      }

      return;
    }

    this.popFromActiveStack();
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

  public getStackHistory = (stackId?: string): HistoryItem[] => {
    if (!stackId) return EMPTY_ARRAY;
    if (!this.stackHistories.has(stackId)) {
      const current = this.state.history.filter(
        (item) => item.stackId === stackId
      );
      this.stackHistories.set(stackId, current);
      return current;
    }
    return this.stackHistories.get(stackId) ?? EMPTY_ARRAY;
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

  public getRootStackId(): string | undefined {
    return this.root?.getId();
  }

  public getGlobalStackId(): string | undefined {
    return undefined;
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
    nextRoot: NavigationNode,
    options?: { transition?: RootTransition }
  ): void {
    this.root = nextRoot;

    this.rootTransition = options?.transition ?? undefined;

    this.registry.length = 0;
    this.stackById.clear();
    this.routeById.clear();
    this.stackActivators.clear();

    this.state = {
      history: [],
    };

    this.buildRegistry();
    this.seedInitialHistory();

    this.recomputeActiveRoute();
    this.emitRootChange();
    this.emit(this.listeners);
  }

  public getActiveRoute = (): ActiveRoute => {
    return this.activeRoute;
  };

  public debugGetState() {
    return {
      history: this.state.history.map((h) => ({
        key: h.key,
        routeId: h.routeId,
        stackId: h.stackId,
        path: h.path,
        params: h.params,
        query: h.query,
        stackPresentation: h.options?.stackPresentation,
      })),
      stackSlices: Array.from(
        new Set(
          this.state.history.map((h) => h.stackId).filter(Boolean) as string[]
        )
      ).map((stackId) => ({
        stackId,
        items: this.getStackHistory(stackId).map((i) => ({
          key: i.key,
          routeId: i.routeId,
          path: i.path,
          params: i.params,
          query: i.query,
          stackPresentation: i.options?.stackPresentation,
        })),
      })),
      activeRoute: this.activeRoute,
      registry: this.registry.map((r) => ({
        routeId: r.routeId,
        path: r.path,
        pathnamePattern: r.pathnamePattern,
        stackId: r.stackId,
        isWildcardPath: r.isWildcardPath,
        baseSpecificity: r.baseSpecificity,
        queryPattern: r.queryPattern,
        options: r.options,
      })),
    };
  }

  public debugMatchRoute(path: string) {
    const { pathname, query } = this.parsePath(path);
    const matches: Array<{
      routeId: string;
      path: string;
      pathnamePattern: string;
      stackId?: string;
      isWildcardPath: boolean;
      baseSpecificity: number;
      pathMatch: boolean;
      queryMatch: boolean;
      options?: ScreenOptions;
    }> = [];

    for (const r of this.registry) {
      if (!r.stackId) continue;
      let pathMatch: false | { params: Record<string, any> };
      if (r.isWildcardPath) {
        pathMatch = { params: {} };
      } else {
        pathMatch = r.matchPath(pathname);
      }
      const queryMatch = this.matchQueryPattern(r.queryPattern, query);

      matches.push({
        routeId: r.routeId,
        path: r.path,
        pathnamePattern: r.pathnamePattern,
        stackId: r.stackId,
        isWildcardPath: r.isWildcardPath,
        baseSpecificity: r.baseSpecificity,
        pathMatch: !!pathMatch,
        queryMatch,
        options: r.options,
      });
    }

    const best = this.matchBaseRoute(pathname, query);
    return {
      input: { path, pathname, query },
      matches,
      best: best
        ? {
            routeId: best.routeId,
            path: best.path,
            stackId: best.stackId,
            options: best.options,
          }
        : null,
    };
  }

  public debugGetStackInfo(stackId: string) {
    const slice = this.getStackHistory(stackId);
    return {
      stackId,
      historyLength: slice.length,
      items: slice.map((i) => ({
        key: i.key,
        routeId: i.routeId,
        path: i.path,
        params: i.params,
        query: i.query,
        stackPresentation: i.options?.stackPresentation,
      })),
    };
  }

  public debugGetAllStacks() {
    const stackIds = Array.from(
      new Set(
        this.state.history.map((h) => h.stackId).filter(Boolean) as string[]
      )
    );
    return stackIds.map((stackId) => this.debugGetStackInfo(stackId));
  }

  private recomputeActiveRoute(): void {
    const history = this.state.history;
    if (history.length > 0) {
      const top = history[history.length - 1];
      if (top) {
        const meta = this.routeById.get(top.routeId);
        this.activeRoute = meta
          ? {
              ...meta,
              routeId: top.routeId,
              params: top.params,
              query: top.query,
              path: top.path,
            }
          : {
              routeId: top.routeId,
              stackId: top.stackId,
              params: top.params,
              query: top.query,
              path: top.path,
            };
        return;
      }
    }
    this.activeRoute = null;
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

    this.log('resolveNavigation', {
      base: base
        ? {
            routeId: base.routeId,
            path: base.path,
            stackId: base.stackId,
          }
        : null,
    });

    if (!base) {
      if (__DEV__) {
        throw new Error(`Route not found: "${pathname}"`);
      }
      return;
    }

    const activator = base.stackId
      ? this.stackActivators.get(base.stackId)
      : undefined;
    if (activator) {
      activator();
    }

    const matchResult = base.matchPath(pathname);
    const params = matchResult ? matchResult.params : undefined;

    if (action === 'push') {
      if (base.stackId) {
        let existing = this.findExistingRoute(
          base.stackId,
          base.routeId,
          pathname,
          params ?? {}
        );

        if (!existing) {
          existing = this.findExistingRouteByPathname(
            base.stackId,
            pathname,
            params ?? {}
          );
        }

        if (existing) {
          this.log('push: found existing item in stack history, using popTo', {
            key: existing.key,
            routeId: existing.routeId,
            path: existing.path,
          });
          const normalizedParams =
            params && Object.keys(params).length > 0 ? params : undefined;
          const updatedExisting: HistoryItem = {
            ...existing,
            routeId: base.routeId,
            params: normalizedParams,
            query: query as any,
            path: pathname,
            component: base.component,
            options: this.mergeOptions(base.options, base.stackId),
            pattern: base.path,
          };
          this.applyHistoryChange('popTo', updatedExisting);
          return;
        }
      }
    }

    if (action === 'replace' && opts?.dedupe) {
      const top = this.getTopOfStack(base.stackId);

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
          this.log('dedupe: already at target, syncing state');
          this.syncStateForSameRoute(base, pathname, params, query);
          return;
        }

        if (sameIdentity && !sameQuery) {
          this.log('dedupe: same identity, updating query on top via replace');
          const normalizedParams =
            params && Object.keys(params).length > 0 ? params : undefined;
          const updatedTop: HistoryItem = {
            ...top,
            params: normalizedParams,
            query: query as any,
            path: pathname,
          };
          this.applyHistoryChange('replace', updatedTop);
          return;
        }
      }

      if (base.stackId) {
        const existing = this.findExistingRoute(
          base.stackId,
          base.routeId,
          pathname,
          params ?? {}
        );

        if (existing) {
          const normalizedParams =
            params && Object.keys(params).length > 0 ? params : undefined;
          const updatedExisting: HistoryItem = {
            ...existing,
            params: normalizedParams,
            query: query as any,
            path: pathname,
          };

          this.log('dedupe: found existing item, calling popTo', {
            key: updatedExisting.key,
          });

          this.applyHistoryChange('popTo', updatedExisting);
          return;
        }
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
      };

      base.controller(controllerInput, present);
      return;
    }

    const newItem = this.createHistoryItem(base, params, query, pathname);
    this.applyHistoryChange(action, newItem);
  }

  private createHistoryItem(
    matched: CompiledRoute,
    params: Record<string, any> | undefined,
    query: Record<string, unknown>,
    pathname: string,
    passProps?: any
  ): HistoryItem {
    const normalizedParams =
      params && Object.keys(params).length > 0 ? params : undefined;

    return {
      key: this.generateKey(),
      routeId: matched.routeId,
      component: matched.component,
      options: this.mergeOptions(matched.options, matched.stackId),
      params: normalizedParams,
      query: query as any,
      passProps,
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
      let foundItem: HistoryItem | null = null;

      for (let i = prevHist.length - 1; i >= 0; i--) {
        const h = prevHist[i]!;
        if (h.stackId !== stackId) {
          continue;
        }
        if (h.key === targetKey) {
          foundIndex = i;
          foundItem = h;
          break;
        }
        keysToRemove.add(h.key);
      }

      if (foundIndex === -1 || !foundItem) {
        return;
      }

      const copy = prevHist.filter((h) => !keysToRemove.has(h.key));

      const updatedItem: HistoryItem = {
        ...foundItem,
        ...item,
        key: targetKey,
      };

      const itemIndex = copy.findIndex((h) => h.key === targetKey);
      if (itemIndex >= 0) {
        copy.splice(itemIndex, 1);
      }
      copy.push(updatedItem);

      nextHist = copy;
    }

    this.setState({ history: nextHist });

    this.recomputeActiveRoute();
    this.emit(this.listeners);
  }

  private setState(next: Partial<RouterState>): void {
    const prev = this.state;
    const nextState: RouterState = {
      history: next.history ?? prev.history,
    };
    this.state = nextState;
    if (nextState.history !== prev.history) {
      this.updateStackHistories();
    }

    this.log('setState', nextState);
  }

  private updateStackHistories(): void {
    const stackIds = new Set<string>();
    this.state.history.forEach((item) => {
      if (item.stackId) stackIds.add(item.stackId);
    });

    const changedStackIds = new Set<string>();

    stackIds.forEach((stackId) => {
      const current = this.state.history.filter(
        (item) => item.stackId === stackId
      );
      const previous = this.stackHistories.get(stackId);

      if (previous && this.areArraysEqual(previous, current)) {
        return;
      }

      this.stackHistories.set(stackId, current);
      changedStackIds.add(stackId);
    });

    const currentStackIds = new Set(stackIds);
    this.stackHistories.forEach((history, stackId) => {
      if (!currentStackIds.has(stackId) && history.length > 0) {
        this.stackHistories.delete(stackId);
        changedStackIds.add(stackId);
      } else if (!currentStackIds.has(stackId) && history.length === 0) {
      }
    });

    changedStackIds.forEach((stackId) => {
      this.emit(this.stackListeners.get(stackId));
    });
  }

  private areArraysEqual(a: HistoryItem[], b: HistoryItem[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private syncStateForSameRoute(
    base: CompiledRoute,
    pathname: string,
    _params: Record<string, any> | undefined,
    _query: Record<string, unknown>
  ): void {
    if (!base.stackId) {
      this.recomputeActiveRoute();
      this.emit(this.listeners);
      return;
    }

    const { targetStackId, targetRouteId } = this.resolveTargetStackAndRoute(
      base,
      pathname
    );

    const rootStackId = this.root?.getId();

    if (rootStackId) {
      this.activateContainerForRoute(targetRouteId, rootStackId);
    }

    this.activateStack(targetStackId);

    this.ensureStackHasSeed(targetStackId, rootStackId ?? base.stackId);

    this.updateActiveRouteFromStack(targetStackId, pathname);

    this.emit(this.listeners);
  }

  private resolveTargetStackAndRoute(
    base: CompiledRoute,
    pathname: string
  ): { targetStackId: string; targetRouteId: string } {
    const rootStackId = this.root?.getId();
    let targetStackId = base.stackId!;
    let targetRouteId = base.routeId;

    const currentActivePath = this.activeRoute?.path;
    const currentActivePathname = currentActivePath
      ? this.parsePath(currentActivePath).pathname
      : '';

    if (
      base.stackId === rootStackId &&
      pathname === '/' &&
      currentActivePathname !== '/'
    ) {
      const childStackRoute = this.findChildStackRouteForPathname(
        rootStackId!,
        pathname
      );
      if (childStackRoute) {
        targetStackId = childStackRoute.stackId!;
        targetRouteId = childStackRoute.routeId;
      }
    }

    return { targetStackId, targetRouteId };
  }

  private findChildStackRouteForPathname(
    rootStackId: string,
    pathname: string
  ): CompiledRoute | undefined {
    for (const route of this.registry) {
      if (
        route.stackId !== rootStackId &&
        route.pathnamePattern === pathname &&
        !route.queryPattern
      ) {
        const rootRoute = this.findRootRouteWithContainer(rootStackId);
        if (
          rootRoute?.childNode &&
          this.isRouteInContainer(route.routeId, rootRoute.childNode)
        ) {
          return route;
        }
      }
    }
    return undefined;
  }

  private findRootRouteWithContainer(
    rootStackId: string
  ): CompiledRoute | undefined {
    return this.registry.find(
      (r) =>
        r.stackId === rootStackId &&
        r.childNode &&
        canSwitchToRoute(r.childNode)
    );
  }

  private isRouteInContainer(
    routeId: string,
    container: NavigationNode
  ): boolean {
    if (canLookupRoutes(container)) {
      return container.hasRoute(routeId);
    }

    const children = container.getNodeChildren();
    return children.some((child) => {
      const routes = child.node.getNodeRoutes();
      return routes.some((r) => r.routeId === routeId);
    });
  }

  private activateContainerForRoute(
    targetRouteId: string,
    rootStackId: string
  ): void {
    const container = this.findContainerInStack(rootStackId);
    if (container && canSwitchToRoute(container)) {
      container.switchToRoute(targetRouteId);
    }
  }

  private findContainerInStack(stackId: string): NavigationNode | undefined {
    const stackHistory = this.getStackHistory(stackId);
    for (let i = stackHistory.length - 1; i >= 0; i--) {
      const item = stackHistory[i];
      if (item) {
        const compiled = this.registry.find((r) => r.routeId === item.routeId);
        if (compiled?.childNode && canSwitchToRoute(compiled.childNode)) {
          return compiled.childNode;
        }
      }
    }

    const rootRoute = this.findRootRouteWithContainer(stackId);
    return rootRoute?.childNode;
  }

  private activateStack(stackId: string): void {
    const activator = this.stackActivators.get(stackId);
    if (activator) {
      activator();
    }
  }

  private ensureStackHasSeed(stackId: string, rootStackId: string): void {
    const stackHistory = this.getStackHistory(stackId);
    if (stackHistory.length > 0) return;

    const stackNode = this.stackById.get(stackId);
    if (!stackNode) return;

    const seed = this.getAutoSeed(stackNode);
    if (!seed) return;

    const compiled = this.registry.find((r) => r.routeId === seed.routeId);
    const meta = this.routeById.get(seed.routeId);
    const path = compiled?.path ?? meta?.path ?? seed.path;
    const seedStackId = seed.stackId ?? stackNode.getId();

    const item: HistoryItem = {
      key: this.generateKey(),
      routeId: seed.routeId,
      component: compiled?.component ?? (() => null),
      options: this.mergeOptions(compiled?.options, seedStackId),
      params: seed.params ?? {},
      stackId: seedStackId,
      path,
      pattern: compiled?.path ?? seed.path,
    };

    const prevHist = this.state.history;
    const nextHist = [...prevHist, item];
    this.setState({ history: nextHist });

    this.emit(this.stackListeners.get(seedStackId));

    if (seedStackId !== stackId && rootStackId) {
      this.activateContainerForRoute(seed.routeId, rootStackId);
    }
  }

  private updateActiveRouteFromStack(stackId: string, pathname: string): void {
    const stackHistory = this.getStackHistory(stackId);

    if (stackHistory.length > 0) {
      const topOfStack = stackHistory[stackHistory.length - 1];
      if (topOfStack) {
        const meta = this.routeById.get(topOfStack.routeId);
        this.activeRoute = meta
          ? {
              ...meta,
              routeId: topOfStack.routeId,
              params: topOfStack.params,
              query: topOfStack.query,
              path: topOfStack.path,
            }
          : {
              routeId: topOfStack.routeId,
              stackId: topOfStack.stackId,
              params: topOfStack.params,
              query: topOfStack.query,
              path: topOfStack.path,
            };
        return;
      }
    }

    const targetRoute = this.registry.find(
      (r) => r.stackId === stackId && r.pathnamePattern === pathname
    );
    if (targetRoute) {
      const meta = this.routeById.get(targetRoute.routeId);
      this.activeRoute = meta
        ? {
            ...meta,
            routeId: targetRoute.routeId,
            params: {},
            query: {},
            path: targetRoute.path,
          }
        : {
            routeId: targetRoute.routeId,
            stackId: stackId,
            params: {},
            query: {},
            path: targetRoute.path,
          };
    }
  }

  private emit(set?: Set<Listener> | null): void {
    if (!set) return;
    set.forEach((l) => l());
  }

  private getTopOfStack(stackId?: string): HistoryItem | undefined {
    if (!stackId) return undefined;
    const slice = this.getStackHistory(stackId);
    return slice.length > 0 ? slice[slice.length - 1] : undefined;
  }

  private findExistingRoute(
    stackId: string,
    routeId: string,
    pathname: string,
    params: Record<string, any>
  ): HistoryItem | undefined {
    const stackHistory = this.getStackHistory(stackId);

    return stackHistory.find((item) => {
      if (item.routeId !== routeId) return false;

      const itemPathname = item.path ? this.parsePath(item.path).pathname : '';
      if (itemPathname !== pathname) return false;

      return this.areShallowEqual(
        (item.params ?? {}) as Record<string, any>,
        params
      );
    });
  }

  private findExistingRouteByPathname(
    stackId: string,
    pathname: string,
    params: Record<string, any>
  ): HistoryItem | undefined {
    const stackHistory = this.getStackHistory(stackId);

    return stackHistory.find((item) => {
      const itemPathname = item.path ? this.parsePath(item.path).pathname : '';
      if (itemPathname !== pathname) return false;

      return this.areShallowEqual(
        (item.params ?? {}) as Record<string, any>,
        params
      );
    });
  }

  private buildRegistry(): void {
    this.registry.length = 0;

    const addFromNode = (node: NavigationNode, basePath: string) => {
      const normalizedBasePath = this.normalizeBasePath(basePath);
      const baseSpecificity =
        this.computeBasePathSpecificity(normalizedBasePath);

      const routes: NodeRoute[] = node.getNodeRoutes();

      const stackId = routes.length > 0 ? node.getId() : undefined;
      if (stackId) {
        this.stackById.set(stackId, node);
      }

      for (const r of routes) {
        const compiled: CompiledRoute = {
          routeId: r.routeId,
          path: this.combinePathWithBase(r.path, normalizedBasePath),
          pathnamePattern:
            r.pathnamePattern === '*'
              ? '*'
              : this.joinPaths(normalizedBasePath, r.pathnamePattern),
          isWildcardPath: r.isWildcardPath,
          queryPattern: r.queryPattern,
          baseSpecificity: r.baseSpecificity + baseSpecificity,
          matchPath: (pathname: string) => {
            const stripped = this.stripBasePath(normalizedBasePath, pathname);
            if (stripped === null) return false;
            if (r.isWildcardPath) {
              return { params: {} };
            }
            const target = stripped === '' ? '/' : stripped;
            return r.matchPath(target);
          },
          component: r.component,
          controller: r.controller,
          options: r.options,
          stackId,
          childNode: r.childNode,
        };

        this.registry.push(compiled);
        if (stackId) {
          this.routeById.set(r.routeId, {
            path: compiled.path,
            stackId,
          });
        }

        this.log('buildRegistry route', {
          routeId: compiled.routeId,
          path: compiled.path,
          pathnamePattern: compiled.pathnamePattern,
          isWildcardPath: compiled.isWildcardPath,
          baseSpecificity: compiled.baseSpecificity,
          stackId,
        });

        if (r.childNode) {
          const nextBaseForChild = r.isWildcardPath
            ? normalizedBasePath
            : this.joinPaths(normalizedBasePath, r.pathnamePattern);
          addFromNode(r.childNode, nextBaseForChild);
        }
      }

      const children: NodeChild[] = node.getNodeChildren();

      for (const child of children) {
        const nextBase =
          child.prefix === ''
            ? normalizedBasePath
            : this.joinPaths(normalizedBasePath, child.prefix);
        const childId = child.node.getId();
        if (child.onMatch) {
          this.stackActivators.set(childId, child.onMatch);
        }
        addFromNode(child.node, nextBase);
      }
    };

    if (this.root) {
      addFromNode(this.root, '');
    }
  }

  private normalizeBasePath(input: string): string {
    if (!input || input === '/') {
      return '';
    }
    let normalized = input.startsWith('/') ? input : `/${input}`;
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  private joinPaths(basePath: string, childPath: string): string {
    if (childPath === '*') return '*';

    const base = this.normalizeBasePath(basePath);
    const child = this.normalizeBasePath(childPath || '/');

    if (!base && !child) return '/';
    if (!base) return child || '/';
    if (!child) return base || '/';

    const joined = `${base}${child.startsWith('/') ? child : `/${child}`}`;
    return joined || '/';
  }

  private stripBasePath(basePath: string, pathname: string): string | null {
    const normalizedBase = this.normalizeBasePath(basePath);
    if (!normalizedBase) {
      return pathname || '/';
    }

    if (normalizedBase === '/') {
      return pathname || '/';
    }

    if (pathname === normalizedBase) {
      return '/';
    }

    if (pathname.startsWith(`${normalizedBase}/`)) {
      const rest = pathname.slice(normalizedBase.length);
      return rest.length ? rest : '/';
    }

    return null;
  }

  private combinePathWithBase(path: string, basePath: string): string {
    const parsed = qs.parseUrl(path);
    const urlPart = parsed.url || '/';
    const query = parsed.query;

    const isWildcard = urlPart === '*';
    const combinedPathname = isWildcard
      ? `${this.normalizeBasePath(basePath)}*`
      : this.joinPaths(basePath, urlPart);

    const hasQuery = query && Object.keys(query).length > 0;
    if (!hasQuery) {
      return combinedPathname || '/';
    }

    return `${combinedPathname}?${qs.stringify(query)}`;
  }

  private computeBasePathSpecificity(basePath: string): number {
    if (!basePath) return 0;
    const segments = basePath.split('/').filter(Boolean);
    return segments.length * 2;
  }

  private getAutoSeed(node: NavigationNode): {
    routeId: string;
    params?: Record<string, unknown>;
    path: string;
    stackId?: string;
  } | null {
    const explicitSeed = node.seed?.();
    if (explicitSeed) {
      return explicitSeed;
    }

    const activeChildId = node.getActiveChildId?.();
    if (activeChildId) {
      const activeChild = node
        .getNodeChildren()
        .find((child) => child.node.getId() === activeChildId);
      if (activeChild) {
        const childSeed = this.getAutoSeed(activeChild.node);
        if (childSeed) {
          return childSeed;
        }
      }
    }

    const routes = node.getNodeRoutes();
    if (routes.length > 0 && routes[0]) {
      const firstRoute = routes[0];
      return {
        routeId: firstRoute.routeId,
        params: {},
        path: firstRoute.path,
        stackId: node.getId(),
      };
    }

    return null;
  }

  private seedInitialHistory(): void {
    if (this.state.history.length > 0) return;

    if (this.root) {
      const seed = this.getAutoSeed(this.root);
      if (seed) {
        const compiled = this.registry.find((r) => r.routeId === seed.routeId);
        const meta = this.routeById.get(seed.routeId);
        const path = compiled?.path ?? meta?.path ?? seed.path;
        const stackId = seed.stackId ?? this.root.getId();
        const item: HistoryItem = {
          key: this.generateKey(),
          routeId: seed.routeId,
          component: compiled?.component ?? (() => null),
          options: this.mergeOptions(compiled?.options, stackId),
          params: seed.params ?? {},
          stackId,
          path,
          pattern: compiled?.path ?? seed.path,
        };
        this.applyHistoryChange('push', item);

        this.addChildNodeSeedsToHistory(seed.routeId);
      }
      return;
    }
  }

  private addChildNodeSeedsToItems(
    routeId: string,
    items: HistoryItem[],
    finalRouteId?: string
  ): void {
    this.log('addChildNodeSeeds: called', {
      routeId,
      finalRouteId,
      itemsLength: items.length,
      items: items.map((i) => ({
        routeId: i.routeId,
        stackId: i.stackId,
        path: i.path,
      })),
    });

    const compiled = this.registry.find((r) => r.routeId === routeId);
    if (!compiled || !compiled.childNode) {
      this.log('addChildNodeSeeds: no childNode', { routeId });
      return;
    }

    const childNode = compiled.childNode;

    if (finalRouteId && canSwitchToRoute(childNode)) {
      this.log('addChildNodeSeeds: setting active child', { finalRouteId });
      childNode.switchToRoute(finalRouteId);
    }

    const childSeed = this.getAutoSeed(childNode);
    if (!childSeed) {
      this.log('addChildNodeSeeds: no seed returned', { routeId });
      return;
    }

    this.log('addChildNodeSeeds: got seed', {
      routeId: childSeed.routeId,
      stackId: childSeed.stackId,
      path: childSeed.path,
    });

    const childCompiled = this.registry.find(
      (r) => r.routeId === childSeed.routeId
    );
    const childMeta = this.routeById.get(childSeed.routeId);
    const childPath = childCompiled?.path ?? childMeta?.path ?? childSeed.path;
    const childStackId = childSeed.stackId ?? childNode.getId();

    const existingItem = items.find(
      (item) =>
        item.routeId === childSeed.routeId && item.stackId === childStackId
    );

    if (existingItem) {
      this.log('addChildNodeSeeds: skipping duplicate', {
        routeId: childSeed.routeId,
        stackId: childStackId,
        path: childPath,
        existingItem: {
          key: existingItem.key,
          routeId: existingItem.routeId,
          stackId: existingItem.stackId,
          path: existingItem.path,
        },
      });
      return;
    }

    this.log('addChildNodeSeeds: adding child item', {
      routeId: childSeed.routeId,
      stackId: childStackId,
      path: childPath,
      itemsLength: items.length,
    });

    const childItem: HistoryItem = {
      key: this.generateKey(),
      routeId: childSeed.routeId,
      component: childCompiled?.component ?? (() => null),
      options: this.mergeOptions(childCompiled?.options, childStackId),
      params: childSeed.params ?? {},
      stackId: childStackId,
      path: childPath,
      pattern: childCompiled?.path ?? childSeed.path,
    };
    items.push(childItem);

    if (childSeed.routeId) {
      this.addChildNodeSeedsToItems(childSeed.routeId, items, finalRouteId);
    }
  }

  private addChildNodeSeedsToHistory(routeId: string): void {
    const compiled = this.registry.find((r) => r.routeId === routeId);
    if (!compiled || !compiled.childNode) return;

    const childNode = compiled.childNode;
    const childSeed = this.getAutoSeed(childNode);
    if (!childSeed) return;

    const childCompiled = this.registry.find(
      (r) => r.routeId === childSeed.routeId
    );
    const childMeta = this.routeById.get(childSeed.routeId);
    const childPath = childCompiled?.path ?? childMeta?.path ?? childSeed.path;
    const childStackId = childSeed.stackId ?? childNode.getId();
    const childItem: HistoryItem = {
      key: this.generateKey(),
      routeId: childSeed.routeId,
      component: childCompiled?.component ?? (() => null),
      options: this.mergeOptions(childCompiled?.options, childStackId),
      params: childSeed.params ?? {},
      stackId: childStackId,
      path: childPath,
      pattern: childCompiled?.path ?? childSeed.path,
    };
    this.applyHistoryChange('push', childItem);

    if (childSeed.routeId) {
      this.addChildNodeSeedsToHistory(childSeed.routeId);
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

    const candidates: Array<{
      route: CompiledRoute;
      specificity: number;
    }> = [];

    for (const r of this.registry) {
      if (!r.stackId) continue;
      let pathMatch: false | { params: Record<string, any> };
      if (r.isWildcardPath) {
        pathMatch = { params: {} };
      } else {
        pathMatch = r.matchPath(pathname);
      }
      if (!pathMatch) continue;

      if (!this.matchQueryPattern(r.queryPattern, query)) continue;

      let spec = r.baseSpecificity;
      const hasQueryPattern =
        r.queryPattern && Object.keys(r.queryPattern).length > 0;

      if (hasQueryPattern) {
        spec += 1000;
      }

      this.log('matchBaseRoute candidate', {
        routeId: r.routeId,
        path: r.path,
        baseSpecificity: r.baseSpecificity,
        adjustedSpecificity: spec,
        hasQueryPattern,
        stackId: r.stackId,
      });

      if (!best || spec > best.specificity) {
        best = { route: r, specificity: spec };
        candidates.length = 0;
        candidates.push(best);
      } else if (spec === best.specificity) {
        candidates.push({ route: r, specificity: spec });
      }
    }

    if (candidates.length > 1) {
      this.log('matchBaseRoute: multiple candidates with same specificity', {
        candidatesCount: candidates.length,
        candidates: candidates.map((c) => ({
          routeId: c.route.routeId,
          stackId: c.route.stackId,
          path: c.route.path,
        })),
      });

      const rootStackId = this.root?.getId();
      let bestFromHistory: CompiledRoute | undefined;
      let bestChildStack: CompiledRoute | undefined;
      let bestChildStackWithHistory: CompiledRoute | undefined;

      for (const candidate of candidates) {
        const candidateStackId = candidate.route.stackId;
        const stackHistory = this.getStackHistory(candidateStackId!);
        const hasMatchingItem = stackHistory.some((item) => {
          const itemPathname = item.path
            ? this.parsePath(item.path).pathname
            : '';
          return itemPathname === pathname;
        });

        this.log('matchBaseRoute: checking candidate', {
          routeId: candidate.route.routeId,
          stackId: candidateStackId,
          isRootStack: candidateStackId === rootStackId,
          stackHistoryLength: stackHistory.length,
          hasMatchingItem,
        });

        if (hasMatchingItem) {
          if (candidateStackId !== rootStackId) {
            bestChildStack = candidate.route;
            this.log(
              'matchBaseRoute: found child stack candidate with matching item',
              {
                routeId: candidate.route.routeId,
                stackId: candidateStackId,
              }
            );

            break;
          } else if (!bestFromHistory) {
            bestFromHistory = candidate.route;
          }
        } else if (
          candidateStackId !== rootStackId &&
          stackHistory.length > 0
        ) {
          if (!bestChildStackWithHistory) {
            bestChildStackWithHistory = candidate.route;
            this.log(
              'matchBaseRoute: found child stack candidate with history',
              {
                routeId: candidate.route.routeId,
                stackId: candidateStackId,
                stackHistoryLength: stackHistory.length,
              }
            );
          }
        }
      }

      if (bestChildStack && best) {
        best = { route: bestChildStack, specificity: best.specificity };
        this.log('matchBaseRoute: selected child stack with matching item', {
          routeId: bestChildStack.routeId,
          stackId: bestChildStack.stackId,
        });
      } else if (bestChildStackWithHistory && best) {
        best = {
          route: bestChildStackWithHistory,
          specificity: best.specificity,
        };
        this.log('matchBaseRoute: selected child stack', {
          routeId: bestChildStackWithHistory.routeId,
          stackId: bestChildStackWithHistory.stackId,
        });
      } else if (bestFromHistory && best) {
        best = { route: bestFromHistory, specificity: best.specificity };
        this.log('matchBaseRoute: selected root stack with history', {
          routeId: bestFromHistory.routeId,
          stackId: bestFromHistory.stackId,
        });
      }
    }

    if (best) {
      this.log('matchBaseRoute winner', {
        routeId: best.route.routeId,
        path: best.route.path,
        stackId: best.route.stackId,
        specificity: best.specificity,
        candidatesCount: candidates.length,
      });
    } else {
      this.log('matchBaseRoute no match');
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
    const stackNode = stackId ? this.findStackById(stackId) : undefined;
    const stackDefaults = stackNode?.getDefaultOptions?.();
    const routerDefaults = this.routerScreenOptions;
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

  private findStackById(stackId: string): NavigationNode | undefined {
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

  private readHistoryIndex(state: unknown): number {
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
    return this.readHistoryIndex(g.history?.state);
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

  private shouldSyncPathWithUrl(path: string): boolean {
    const { pathname, query } = this.parsePath(path);
    const base = this.matchBaseRoute(pathname, query);
    if (!base) return true;

    const mergedOptions = this.mergeOptions(base.options, base.stackId);
    const rawsyncWithUrl = mergedOptions?.syncWithUrl;

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
    const prev = this.readHistoryIndex(st);
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

  private buildUrlFromActiveRoute(): string | null {
    const ar = this.activeRoute;
    if (!ar || !ar.path) {
      return null;
    }

    const path = ar.path;
    const query = ar.query;

    if (!query || Object.keys(query).length === 0) {
      return path;
    }

    const search = qs.stringify(query);
    return `${path}${search && search !== '' ? `?${search}` : ''}`;
  }

  private patchBrowserHistoryOnce(): void {
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

  private setupBrowserHistory(): void {
    const g = globalThis as unknown as {
      addEventListener?: (type: string, cb: (ev: Event) => void) => void;
    };
    this.patchBrowserHistoryOnce();
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

  private syncUrlAfterInternalPop(popped: HistoryItem): void {
    if (!this.isWebEnv()) return;

    const compiled = this.registry.find((r) => r.routeId === popped.routeId);

    const isQueryRoute =
      compiled &&
      compiled.queryPattern &&
      Object.keys(compiled.queryPattern).length > 0;

    if (isQueryRoute) {
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

      this.log('syncUrlWithStateAfterInternalPop (query)', {
        poppedRouteId: popped.routeId,
        from: currentUrl,
        to: nextUrl,
      });

      this.replaceUrlSilently(nextUrl);
      return;
    }

    const from = this.getCurrentUrl();
    const nextUrl = this.buildUrlFromActiveRoute();

    if (!nextUrl) {
      this.log(
        'syncUrlWithStateAfterInternalPop: no activeRoute, skip URL sync',
        { from }
      );
      return;
    }

    this.log('syncUrlAfterInternalPop (base)', {
      poppedRouteId: popped.routeId,
      from,
      to: nextUrl,
    });

    this.replaceUrlSilently(nextUrl);
  }

  private popFromActiveStack(): HistoryItem | null {
    const active = this.activeRoute;
    if (!active || !active.stackId) {
      if (this.root) {
        const sid = this.root.getId();
        if (sid) {
          const stackHistory = this.getStackHistory(sid);
          if (stackHistory.length > 0) {
            const top = stackHistory[stackHistory.length - 1]!;
            const isModalOrSheet =
              top.options?.stackPresentation === 'modal' ||
              top.options?.stackPresentation === 'sheet';
            if (stackHistory.length > 1 || isModalOrSheet) {
              if (top.options?.stackPresentation === 'sheet') {
                const dismisser = this.sheetDismissers.get(top.key);
                if (dismisser) {
                  this.unregisterSheetDismisser(top.key);
                  dismisser();
                  return top;
                }
              }
              this.applyHistoryChange('pop', top);
              return top;
            }
          }
        }
      }
      return null;
    }

    let activeItem: HistoryItem | undefined;
    for (let i = this.state.history.length - 1; i >= 0; i--) {
      const h = this.state.history[i];
      if (h && active && h.stackId === active.stackId) {
        activeItem = h;
        break;
      }
    }

    if (!active || !activeItem || !activeItem.stackId) return null;

    const stackHistory = this.getStackHistory(activeItem.stackId);

    const isModalOrSheet =
      activeItem.options?.stackPresentation === 'modal' ||
      activeItem.options?.stackPresentation === 'sheet';

    if (stackHistory.length <= 1 && !isModalOrSheet) return null;

    if (activeItem.options?.stackPresentation === 'sheet') {
      const dismisser = this.sheetDismissers.get(activeItem.key);
      if (dismisser) {
        this.unregisterSheetDismisser(activeItem.key);
        dismisser();
        return activeItem;
      }
    }

    const top = stackHistory[stackHistory.length - 1]!;
    this.applyHistoryChange('pop', top);
    return top;
  }

  private buildHistoryFromUrl(url: string): void {
    const { pathname, query } = this.parsePath(url);

    this.log('parse', { url, pathname, query });

    const baseRoute = this.matchBaseRoute(pathname, {});

    const deepest = this.matchBaseRoute(pathname, query);

    const hasDeepestQueryPattern =
      deepest &&
      deepest.queryPattern &&
      Object.keys(deepest.queryPattern).length > 0;

    const isDeepestOverlay =
      hasDeepestQueryPattern &&
      deepest &&
      baseRoute &&
      deepest.routeId !== baseRoute.routeId;

    if (!deepest || (isDeepestOverlay && !baseRoute)) {
      if (__DEV__) {
        console.warn(
          `[Router] parse: no base route found for "${pathname}", seeding initial history`
        );
      }

      this.seedInitialHistory();

      this.recomputeActiveRoute();
      this.emit(this.listeners);
      return;
    }

    const segments = pathname.split('/').filter(Boolean);
    const prefixes: string[] =
      segments.length > 0
        ? segments.map((_, i) => '/' + segments.slice(0, i + 1).join('/'))
        : ['/'];
    if (!prefixes.includes('/')) {
      prefixes.unshift('/');
    }

    const items: HistoryItem[] = [];

    prefixes.forEach((prefixPath, index) => {
      this.log('parse prefix', {
        index,
        prefixPath,
      });

      let routeForPrefix: CompiledRoute | undefined;

      if (index === prefixes.length - 1) {
        routeForPrefix = baseRoute || deepest;
      } else {
        let best:
          | {
              route: CompiledRoute;
              spec: number;
            }
          | undefined;

        for (const route of this.registry) {
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
          index,
          prefixPath,
        });
        return;
      }

      const matchResult = routeForPrefix.matchPath(prefixPath);
      const params = matchResult ? matchResult.params : undefined;

      const itemQuery =
        index === prefixes.length - 1 && !isDeepestOverlay ? query : {};

      const item = this.createHistoryItem(
        routeForPrefix,
        params,
        itemQuery,
        prefixPath
      );

      this.log('parse: push item', {
        index,
        routeId: routeForPrefix.routeId,
        path: routeForPrefix.path,
        prefixPath,
        params,
        itemQuery,
      });

      items.push(item);
    });

    let overlayItem: HistoryItem | undefined;
    if (isDeepestOverlay && deepest && baseRoute) {
      overlayItem = this.createHistoryItem(deepest, undefined, query, pathname);

      this.log('parse: push overlay item', {
        routeId: deepest.routeId,
        path: deepest.path,
        pathname,
        query,
      });

      items.push(overlayItem);
    }

    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      const lastItemCompiled = lastItem
        ? this.registry.find((r) => r.routeId === lastItem.routeId)
        : undefined;
      const isLastItemOverlay =
        lastItem &&
        lastItemCompiled &&
        lastItemCompiled.queryPattern &&
        Object.keys(lastItemCompiled.queryPattern).length > 0;
      const finalRouteId =
        isLastItemOverlay && items.length > 1
          ? items[items.length - 2]?.routeId
          : lastItem?.routeId;

      const searchStartIndex = isLastItemOverlay
        ? items.length - 2
        : items.length - 1;
      for (let i = searchStartIndex; i >= 0; i--) {
        const item = items[i];
        if (item && item.routeId) {
          const compiled = this.registry.find(
            (r) => r.routeId === item.routeId
          );
          if (compiled && compiled.childNode) {
            this.addChildNodeSeedsToItems(item.routeId, items, finalRouteId);
            break;
          }
        }
      }

      if (overlayItem) {
        const overlayIndex = items.findIndex(
          (item) => item.key === overlayItem!.key
        );
        if (overlayIndex >= 0 && overlayIndex < items.length - 1) {
          items.splice(overlayIndex, 1);
          items.push(overlayItem);
        }
      }
    }

    if (!items.length) {
      if (__DEV__) {
        console.warn(
          '[Router] parse: no items built for URL, seeding initial history'
        );
      }

      this.seedInitialHistory();
      this.recomputeActiveRoute();
      this.emit(this.listeners);
      return;
    }

    this.setState({ history: items });

    this.stackListeners.forEach((set) => this.emit(set));

    this.recomputeActiveRoute();
    this.emit(this.listeners);
  }
}

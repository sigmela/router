import React, { createContext, useContext } from 'react';
import type { Router } from './Router';

export const RouterContext = createContext<Router | null>(null);
type RouteLocalContextValue = {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  pattern?: string;
  path?: string;
} | null;
export const RouteLocalContext = createContext<RouteLocalContextValue>(null);

export const useRouter = (): Router => {
  const ctx = useContext(RouterContext);
  if (ctx == null) {
    throw new Error('useRouter must be used within RouterContext.Provider');
  }
  return ctx;
};

export const useCurrentRoute = () => {
  const router = useRouter();
  const subscribe = React.useCallback((cb: () => void) => router.subscribe(cb), [router]);
  const get = React.useCallback(() => router.getVisibleRoute(), [router]);
  return React.useSyncExternalStore(subscribe, get, get);
};

export function useParams<
  TParams extends Record<string, unknown> = Record<string, unknown>,
>(): TParams {
  const local = React.useContext(RouteLocalContext);
  return (local?.params ?? {}) as TParams;
}

export function useQueryParams<
  TQuery extends Record<string, unknown> = Record<string, unknown>,
>(): TQuery {
  const local = React.useContext(RouteLocalContext);
  return (local?.query ?? {}) as TQuery;
}

export function useRoute() {
  const local = React.useContext(RouteLocalContext);
  return {
    params: local?.params ?? {},
    query: local?.query ?? {},
    pattern: local?.pattern,
    path: local?.path,
  } as {
    params: Record<string, any>;
    query: Record<string, any>;
    pattern?: string;
    path?: string;
  };
}

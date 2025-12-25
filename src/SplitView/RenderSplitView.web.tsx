import type { NavigationAppearance } from '../types';
import { StackRenderer } from '../StackRenderer';
import { SplitViewContext } from './SplitViewContext';
import { useRouter } from '../RouterContext';
import type { NavigationStack } from '../NavigationStack';
import type { HistoryItem } from '../types';
import type { SplitView } from './SplitView';
import { ScreenStackConfigContext } from '../ScreenStack/ScreenStackContext';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';

export interface RenderSplitViewProps {
  splitView: SplitView;
  appearance?: NavigationAppearance;
}

const StackSliceRenderer = memo<{
  stack: NavigationStack;
  appearance?: NavigationAppearance;
  fallbackToFirstRoute?: boolean;
}>(({ stack, appearance, fallbackToFirstRoute }) => {
  const router = useRouter();
  const stackId = stack.getId();

  const subscribe = useCallback(
    (cb: () => void) => router.subscribeStack(stackId, cb),
    [router, stackId]
  );
  const get = useCallback(
    () => router.getStackHistory(stackId),
    [router, stackId]
  );

  const history: HistoryItem[] = useSyncExternalStore(subscribe, get, get);

  let historyToRender = history;

  // When a container route (like /mail -> SplitView) is active, the child stack can be empty,
  // yet we still want to render its root screen. We keep Router history intact and provide a
  // renderer-only fallback item.
  if (fallbackToFirstRoute && historyToRender.length === 0) {
    const first = stack.getFirstRoute();
    if (first) {
      const activePath = router.getActiveRoute()?.path;
      historyToRender = [
        {
          key: `splitview-seed-${stackId}`,
          routeId: first.routeId,
          component: first.component,
          options: first.options,
          stackId,
          pattern: first.path,
          path: activePath ?? first.path,
        },
      ];
    }
  }

  return (
    <StackRenderer
      appearance={appearance}
      stackId={stackId}
      history={historyToRender}
    />
  );
});

StackSliceRenderer.displayName = 'SplitViewStackSliceRenderer';

export const RenderSplitView = memo<RenderSplitViewProps>(
  ({ splitView, appearance }) => {
    const [isWide, setIsWide] = useState(() => {
      if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
      ) {
        return false;
      }
      return window.matchMedia(`(min-width: ${splitView.minWidth}px)`).matches;
    });

    useEffect(() => {
      if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
      ) {
        return;
      }

      const mq = window.matchMedia(`(min-width: ${splitView.minWidth}px)`);
      const onChange = (ev: MediaQueryListEvent) => setIsWide(ev.matches);

      // Sync immediately.
      setIsWide(mq.matches);

      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
      }

      // Safari < 14 fallback (deprecated, but still needed).
      const mqAny = mq as unknown as {
        addListener?: (cb: (ev: MediaQueryListEvent) => void) => void;
        removeListener?: (cb: (ev: MediaQueryListEvent) => void) => void;
      };
      mqAny.addListener?.(onChange);
      return () => mqAny.removeListener?.(onChange);
    }, [splitView.minWidth]);

    const containerStyle: CSSProperties | undefined = useMemo(() => {
      return {
        '--split-view-primary-max-width': `${splitView.primaryMaxWidth}px`,
      } as CSSProperties;
    }, [splitView.primaryMaxWidth]);

    return (
      <SplitViewContext.Provider value={splitView}>
        <div className="split-view-container" style={containerStyle}>
          <div className="split-view-primary">
            <StackSliceRenderer
              appearance={appearance}
              stack={splitView.primary}
              fallbackToFirstRoute
            />
          </div>

          <div className="split-view-secondary">
            {isWide ? (
              <ScreenStackConfigContext.Provider
                value={{ animateFirstScreenAfterEmpty: false }}
              >
                <StackSliceRenderer
                  appearance={appearance}
                  stack={splitView.secondary}
                />
              </ScreenStackConfigContext.Provider>
            ) : (
              <StackSliceRenderer
                appearance={appearance}
                stack={splitView.secondary}
              />
            )}
          </div>
        </div>
      </SplitViewContext.Provider>
    );
  }
);

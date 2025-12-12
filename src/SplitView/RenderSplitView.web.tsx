import type { NavigationAppearance } from '../types';
import { StackRenderer } from '../StackRenderer';
import { SplitViewContext } from './SplitViewContext';
import { useRouter } from '../RouterContext';
import type { NavigationStack } from '../NavigationStack';
import type { HistoryItem } from '../types';
import type { SplitView } from './SplitView';
import {
  memo,
  useCallback,
  useMemo,
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
      stack={stack}
      history={historyToRender}
    />
  );
});

StackSliceRenderer.displayName = 'SplitViewStackSliceRenderer';

export const RenderSplitView = memo<RenderSplitViewProps>(
  ({ splitView, appearance }) => {
    const instanceClass = useMemo(
      () => `split-view-instance-${splitView.getId()}`,
      [splitView]
    );

    const containerStyle: CSSProperties | undefined = useMemo(() => {
      return {
        '--split-view-primary-max-width': `${splitView.primaryMaxWidth}px`,
      } as CSSProperties;
    }, [splitView.primaryMaxWidth]);

    return (
      <SplitViewContext.Provider value={splitView}>
        <div className={instanceClass}>
          <div className="split-view-container" style={containerStyle}>
            <div className="split-view-primary">
              <StackSliceRenderer
                appearance={appearance}
                stack={splitView.primary}
                fallbackToFirstRoute
              />
            </div>

            <div className="split-view-secondary">
              <StackSliceRenderer
                appearance={appearance}
                stack={splitView.secondary}
              />
            </div>
          </div>
        </div>
      </SplitViewContext.Provider>
    );
  }
);

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
  const get = useCallback(() => router.getStackHistory(stackId), [router, stackId]);

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
    <StackRenderer appearance={appearance} stack={stack} history={historyToRender} />
  );
});

StackSliceRenderer.displayName = 'SplitViewStackSliceRenderer';

export const RenderSplitView = memo<RenderSplitViewProps>(
  ({ splitView, appearance }) => {
    const instanceClass = useMemo(
      () => `split-view-instance-${splitView.getId()}`,
      [splitView]
    );

    const minWidth = splitView.minWidth;

    const styleTag = useMemo(() => {
      const css = `\
@media (min-width: ${minWidth}px) {\
  .${instanceClass} .split-view-container {\
    display: flex;\
    flex-direction: row;\
  }\
\
  .${instanceClass} .split-view-primary {\
    position: relative;\
    flex: 0 0 auto;\
    width: 360px;\
    min-width: 320px;\
    max-width: 480px;\
    border-right: 1px solid rgba(0, 0, 0, 0.08);\
  }\
\
  .${instanceClass} .split-view-secondary {\
    display: flex;\
    position: relative;\
    inset: auto;\
    z-index: auto;\
    flex: 1 1 auto;\
  }\
}\
`;
      return <style>{css}</style>;
    }, [minWidth, instanceClass]);

    const containerStyle: CSSProperties | undefined = useMemo(() => {
      // place for future style hooks
      return undefined;
    }, []);

    return (
      <SplitViewContext.Provider value={splitView}>
        <div className={instanceClass}>
          {styleTag}
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

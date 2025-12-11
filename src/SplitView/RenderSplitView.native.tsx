import type { NavigationAppearance, HistoryItem } from '../types';
import type { NavigationStack } from '../NavigationStack';
import type { SplitView } from './SplitView';
import { StackRenderer } from '../StackRenderer';
import { SplitViewContext } from './SplitViewContext';
import { useRouter } from '../RouterContext';
import { memo, useCallback, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

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

StackSliceRenderer.displayName = 'SplitViewStackSliceRendererNative';

export const RenderSplitView = memo<RenderSplitViewProps>(
  ({ splitView, appearance }) => {
    const router = useRouter();
    const secondaryId = splitView.secondary.getId();
    const subscribe = useCallback(
      (cb: () => void) => router.subscribeStack(secondaryId, cb),
      [router, secondaryId]
    );
    const get = useCallback(
      () => router.getStackHistory(secondaryId),
      [router, secondaryId]
    );
    const secondaryHistory = useSyncExternalStore(subscribe, get, get);
    const hasSecondary = secondaryHistory.length > 0;

    return (
      <SplitViewContext.Provider value={splitView}>
        <View style={styles.container}>
          <View style={styles.primary} pointerEvents={hasSecondary ? 'none' : 'auto'}>
            <StackSliceRenderer
              appearance={appearance}
              stack={splitView.primary}
              fallbackToFirstRoute
            />
          </View>

          {hasSecondary ? (
            <View style={styles.secondary}>
              <StackSliceRenderer appearance={appearance} stack={splitView.secondary} />
            </View>
          ) : null}
        </View>
      </SplitViewContext.Provider>
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  primary: { flex: 1 },
  secondary: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
});

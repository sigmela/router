import type { NavigationAppearance, HistoryItem } from '../types';
import type { SplitView } from './SplitView';
import { ScreenStackItem } from '../ScreenStackItem';
import { ScreenStack } from '../ScreenStack';
import { SplitViewContext } from './SplitViewContext';
import { useRouter } from '../RouterContext';
import { memo, useCallback, useSyncExternalStore, useMemo } from 'react';
import { StyleSheet } from 'react-native';

export interface RenderSplitViewProps {
  splitView: SplitView;
  appearance?: NavigationAppearance;
}

/**
 * On native (iPhone), SplitView renders primary and secondary screens
 * in a SINGLE ScreenStack to get native push/pop animations.
 *
 * The combined history is: [...primaryHistory, ...secondaryHistory]
 * This way, navigating from primary to secondary is a native push.
 */
export const RenderSplitView = memo<RenderSplitViewProps>(
  ({ splitView, appearance }) => {
    const router = useRouter();

    // Subscribe to primary stack
    const primaryId = splitView.primary.getId();
    const subscribePrimary = useCallback(
      (cb: () => void) => router.subscribeStack(primaryId, cb),
      [router, primaryId]
    );
    const getPrimary = useCallback(
      () => router.getStackHistory(primaryId),
      [router, primaryId]
    );
    const primaryHistory = useSyncExternalStore(
      subscribePrimary,
      getPrimary,
      getPrimary
    );

    // Subscribe to secondary stack
    const secondaryId = splitView.secondary.getId();
    const subscribeSecondary = useCallback(
      (cb: () => void) => router.subscribeStack(secondaryId, cb),
      [router, secondaryId]
    );
    const getSecondary = useCallback(
      () => router.getStackHistory(secondaryId),
      [router, secondaryId]
    );
    const secondaryHistory = useSyncExternalStore(
      subscribeSecondary,
      getSecondary,
      getSecondary
    );

    // Fallback: if primary is empty, seed with first route
    const primaryHistoryToRender = useMemo(() => {
      if (primaryHistory.length > 0) {
        return primaryHistory;
      }
      const first = splitView.primary.getFirstRoute();
      if (!first) return [];
      const activePath = router.getActiveRoute()?.path;
      return [
        {
          key: `splitview-seed-${primaryId}`,
          routeId: first.routeId,
          component: first.component,
          options: first.options,
          stackId: primaryId,
          pattern: first.path,
          path: activePath ?? first.path,
        },
      ] as HistoryItem[];
    }, [primaryHistory, splitView.primary, primaryId, router]);

    // Combine histories: primary screens first, then secondary screens on top
    // This gives native push animation when navigating from primary to secondary
    const combinedHistory = useMemo(() => {
      return [...primaryHistoryToRender, ...secondaryHistory];
    }, [primaryHistoryToRender, secondaryHistory]);

    // Use primary stack ID for the combined ScreenStack
    // (secondary items will animate as if pushed onto this stack)
    return (
      <SplitViewContext.Provider value={splitView}>
        <ScreenStack style={styles.container}>
          {combinedHistory.map((item) => (
            <ScreenStackItem
              key={`splitview-${item.key}`}
              appearance={appearance}
              stackId={item.stackId}
              item={item}
            />
          ))}
        </ScreenStack>
      </SplitViewContext.Provider>
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});

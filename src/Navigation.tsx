import type { NavigationAppearance, HistoryItem } from './types';
import { ScreenStackItem } from './ScreenStackItem';
import { RouterContext } from './RouterContext';
import { ScreenStack } from './ScreenStack';
import { StyleSheet } from 'react-native';
import { Router } from './Router';
import {
  useSyncExternalStore,
  memo,
  useCallback,
  useEffect,
  useState,
} from 'react';

interface NavigationProps {
  router: Router;
  appearance?: NavigationAppearance;
}

const EMPTY_HISTORY: HistoryItem[] = [];

function useStackHistory(router: Router, stackId?: string) {
  const subscribe = useCallback(
    (cb: () => void) =>
      stackId ? router.subscribeStack(stackId, cb) : () => {},
    [router, stackId]
  );
  const get = useCallback(
    () => (stackId ? router.getStackHistory(stackId) : EMPTY_HISTORY),
    [router, stackId]
  );

  return useSyncExternalStore(subscribe, get, get);
}

/**
 * Navigation component renders the root and global stacks.
 *
 * Modal stacks (NavigationStack added via addModal) are rendered as regular ScreenStackItems
 * with their component being the StackRenderer that subscribes to its own stack history.
 * This creates a clean recursive structure: stacks render their items, nested stacks
 * (via childNode) render their own items through StackRenderer.
 */
export const Navigation = memo<NavigationProps>(({ router, appearance }) => {
  const [root, setRoot] = useState(() => ({
    rootId: router.getRootStackId(),
  }));

  useEffect(() => {
    return router.subscribeRoot(() => {
      setRoot({
        rootId: router.getRootStackId(),
      });
    });
  }, [router]);

  const { rootId } = root;
  const rootTransition = router.getRootTransition();
  const rootItems = useStackHistory(router, rootId);

  return (
    <RouterContext.Provider value={router}>
      {/* Remount on root changes so the incoming root behaves like initial (no enter animation). */}
      <ScreenStack key={rootId ?? 'root'} style={styles.flex}>
        {rootItems.map((item) => (
          <ScreenStackItem
            key={`root-${item.key}`}
            stackId={rootId}
            item={item}
            stackAnimation={rootTransition}
            appearance={appearance}
          />
        ))}
      </ScreenStack>
    </RouterContext.Provider>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

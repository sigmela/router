// import { ScreenStackItem as RNNScreenStackItem } from 'react-native-screens';
import type { NavigationAppearance } from './types';
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

const EMPTY_HISTORY: any[] = [];

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
  const globalId = router.getGlobalStackId();
  const rootItems = useStackHistory(router, rootId);
  const globalItems = useStackHistory(router, globalId);

  return (
    <RouterContext.Provider value={router}>
      <ScreenStack style={styles.flex}>
        {rootItems.map((item) => (
          <ScreenStackItem
            key={`root-${item.key}`}
            stackId={rootId}
            item={item}
            stackAnimation={rootTransition}
            appearance={appearance}
          />
        ))}
        {globalItems.map((item) => (
          <ScreenStackItem
            key={`global-${item.key}`}
            appearance={appearance}
            stackId={globalId}
            item={item}
          />
        ))}
      </ScreenStack>
    </RouterContext.Provider>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

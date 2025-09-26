import type { NavigationAppearance } from '../types';
import { RenderTabBar } from '../TabBar/RenderTabBar';
import { ScreenStackItem } from '../ScreenStackItem';
import { RouterContext } from '../RouterContext';
import { StyleSheet } from 'react-native';
import { Router } from '../Router';
import {
  ScreenStackItem as RNNScreenStackItem,
  ScreenStack,
} from 'react-native-screens';
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
    hasTabBar: router.hasTabBar(),
    rootId: router.getRootStackId(),
  }));

  useEffect(() => {
    return router.subscribeRoot(() => {
      setRoot({
        hasTabBar: router.hasTabBar(),
        rootId: router.getRootStackId(),
      });
    });
  }, [router]);

  const { hasTabBar, rootId } = root;
  const rootTransition = router.getRootTransition();
  const globalId = router.getGlobalStackId();
  const rootItems = useStackHistory(router, rootId);
  const globalItems = useStackHistory(router, globalId);

  return (
    <RouterContext.Provider value={router}>
      <RenderTabBar tabBar={router.tabBar!} appearance={appearance} />
      {/* <ScreenStack style={styles.flex}>
        {hasTabBar && (
          <RNNScreenStackItem
            screenId="root-tabbar"
            headerConfig={{ hidden: true }}
            style={styles.flex}
            stackAnimation={rootTransition}
          >
            
          </RNNScreenStackItem>
        )}
        {rootItems.map((item) => (
          <ScreenStackItem
            key={item.key}
            stackId={rootId}
            item={item}
            stackAnimation={rootTransition}
            appearance={appearance}
          />
        ))}
        {globalItems.map((item) => (
          <ScreenStackItem
            appearance={appearance}
            key={item.key}
            stackId={globalId}
            item={item}
          />
        ))}
      </ScreenStack> */}
    </RouterContext.Provider>
  );
});
const styles = StyleSheet.create({
  flex: { flex: 1 },
});

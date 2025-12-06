// import { ScreenStackItem as RNNScreenStackItem } from 'react-native-screens';
import type { NavigationAppearance } from './types';
import { RenderTabBar } from './TabBar/RenderTabBar';
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
  useMemo,
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

  // Create a component wrapper for the tab bar
  const TabBarComponent = useMemo(() => {
    if (!hasTabBar || !router.tabBar) return null;
    const tabBarInstance = router.tabBar;
    const tabBarAppearance = appearance;

    return () => (
      <RenderTabBar tabBar={tabBarInstance} appearance={tabBarAppearance} />
    );
  }, [hasTabBar, router.tabBar, appearance]);

  // Create a HistoryItem for the tab bar
  const tabBarItem = useMemo(() => {
    if (!hasTabBar || !TabBarComponent) return null;
    return {
      key: 'root-tabbar',
      scope: 'tab' as const,
      routeId: 'root-tabbar',
      component: TabBarComponent,
      options: {
        stackPresentation: 'push' as const,
        header: { hidden: true },
        stackAnimation: 'slide_from_right' as const,
      },
    };
  }, [hasTabBar, TabBarComponent]);

  return (
    <RouterContext.Provider value={router}>
      <ScreenStack style={styles.flex}>
        {hasTabBar && tabBarItem && (
          <ScreenStackItem
            key="root-tabbar-screen-item"
            item={tabBarItem}
            stackId="root"
            stackAnimation="slide_from_right"
            appearance={appearance}
          />
        )}
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

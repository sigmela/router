import { useMemo, useCallback, useSyncExternalStore, memo, useEffect } from 'react';
import type { BaseRoute, NavigationState, NavigationAppearance } from '../types';
import { StackRenderer } from '../StackRenderer';
import { TabBarContext } from './TabBarContext';
import TabView from 'react-native-bottom-tabs';
import { useRouter } from '../RouterContext';
import type { TabBar } from './TabBar';

export interface RenderTabBarProps {
  tabBar: TabBar;
  appearance?: NavigationAppearance['tabBar'];
}

export const RenderTabBar = memo<RenderTabBarProps>(({ tabBar, appearance }) => {
  const router = useRouter();
  const subscribe = useCallback((cb: () => void) => tabBar.subscribe(cb), [tabBar]);
  const snapshot = useSyncExternalStore(subscribe, tabBar.getState, tabBar.getState);
  const { routes, config, index } = snapshot;

  useEffect(() => {
    router.ensureTabSeed(index);
  }, [index, router]);

  const navigationState: NavigationState<BaseRoute> = useMemo(
    () => ({ index, routes }),
    [index, routes],
  );

  const handleChangeIndex = useCallback(
    (index: number) => {
      // Keep Router in sync with TabBar index to ensure correct visible layer handling
      router.onTabIndexChange(index);
    },
    [router],
  );

  const renderScene = useCallback(
    ({ route }: { route: BaseRoute; jumpTo: (key: string) => void }) => {
      const stack = tabBar.stacks[route.key];
      if (stack) {
        return <StackRenderer stack={stack} />;
      }
      const Screen = tabBar.screens[route.key];
      return Screen ? <Screen /> : null;
    },
    [tabBar.screens, tabBar.stacks],
  );

  const getSceneStyle = useCallback(
    () => appearance?.sceneStyle,
    [appearance?.sceneStyle],
  );

  return (
    <TabBarContext.Provider value={tabBar}>
      <TabView
        navigationState={navigationState}
        renderScene={renderScene}
        onIndexChange={handleChangeIndex}
        getSceneStyle={getSceneStyle}
        labeled={appearance?.labeled}
        sidebarAdaptable={config.sidebarAdaptable}
        disablePageAnimations={config.disablePageAnimations}
        hapticFeedbackEnabled={config.hapticFeedbackEnabled}
        scrollEdgeAppearance={config.scrollEdgeAppearance}
        minimizeBehavior={config.minimizeBehavior}
        tabBarActiveTintColor={appearance?.tabBarActiveTintColor}
        tabBarInactiveTintColor={appearance?.tabBarInactiveTintColor}
        tabBarStyle={appearance?.tabBarStyle}
        tabLabelStyle={appearance?.tabBarItemStyle}
        translucent={appearance?.translucent}
        rippleColor={appearance?.rippleColor}
        activeIndicatorColor={appearance?.activeIndicatorColor}
      />
    </TabBarContext.Provider>
  );
});

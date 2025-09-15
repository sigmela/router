import { useCallback, useSyncExternalStore, memo, useEffect } from 'react';
import { type NativeSyntheticEvent } from 'react-native';
import type { NavigationAppearance } from '../types';
import { StackRenderer } from '../StackRenderer';
import { TabBarContext } from './TabBarContext';
import { useRouter } from '../RouterContext';
import type { TabBar } from './TabBar';
import {
  type NativeFocusChangeEvent,
  BottomTabsScreen,
  BottomTabs,
} from 'react-native-screens';

export interface RenderTabBarProps {
  tabBar: TabBar;
  appearance?: NavigationAppearance['tabBar'];
}

export const RenderTabBar = memo<RenderTabBarProps>(({ tabBar, appearance }) => {
  const router = useRouter();
  const subscribe = useCallback((cb: () => void) => tabBar.subscribe(cb), [tabBar]);
  const snapshot = useSyncExternalStore(subscribe, tabBar.getState, tabBar.getState);
  const { tabs, index } = snapshot;

  const {
    standardAppearance,
    scrollEdgeAppearance,
    tabBarItemStyle,
    tintColor,
    backgroundColor,
  } = appearance ?? {};

  useEffect(() => {
    router.ensureTabSeed(index);
  }, [index, router]);

  const onNativeFocusChange = useCallback(
    (event: NativeSyntheticEvent<NativeFocusChangeEvent>) => {
      const tabKey = event.nativeEvent.tabKey;
      const index = tabs.findIndex((route) => route.tabKey === tabKey);
      router.onTabIndexChange(index);
    },
    [tabs],
  );

  return (
    <TabBarContext.Provider value={tabBar}>
      <BottomTabs
        onNativeFocusChange={onNativeFocusChange}
        tabBarBackgroundColor={backgroundColor}
        tabBarTintColor={tintColor}
        tabBarItemTitleFontFamily={tabBarItemStyle?.titleFontFamily}
        tabBarItemTitleFontSize={tabBarItemStyle?.titleFontSize}
        tabBarItemTitleFontSizeActive={tabBarItemStyle?.titleFontSizeActive}
        tabBarItemTitleFontWeight={tabBarItemStyle?.titleFontWeight}
        tabBarItemTitleFontStyle={tabBarItemStyle?.titleFontStyle}
        tabBarItemTitleFontColor={tabBarItemStyle?.titleFontColor}
        tabBarItemTitleFontColorActive={tabBarItemStyle?.titleFontColorActive}
        tabBarItemIconColor={tabBarItemStyle?.iconColor}
        tabBarItemIconColorActive={tabBarItemStyle?.iconColorActive}
        tabBarItemActiveIndicatorColor={tabBarItemStyle?.activeIndicatorColor}
        tabBarItemActiveIndicatorEnabled={tabBarItemStyle?.activeIndicatorEnabled}
        tabBarItemRippleColor={tabBarItemStyle?.rippleColor}
        tabBarItemLabelVisibilityMode={tabBarItemStyle?.labelVisibilityMode}
        // tabBarMinimizeBehavior={}
      >
        {tabs.map((tab) => {
          const isFocused = tab.tabKey === tabs[index]?.tabKey;
          const stack = tabBar.stacks[tab.tabKey];
          const Screen = tabBar.screens[tab.tabKey];

          return (
            <BottomTabsScreen
              scrollEdgeAppearance={scrollEdgeAppearance}
              standardAppearance={standardAppearance}
              isFocused={isFocused}
              key={tab.tabKey}
              {...tab}
            >
              {stack ? <StackRenderer stack={stack} /> : Screen ? <Screen /> : null}
            </BottomTabsScreen>
          );
        })}
      </BottomTabs>
    </TabBarContext.Provider>
  );
});

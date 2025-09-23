import { useCallback, useSyncExternalStore, memo, useEffect } from 'react';
import { type NativeSyntheticEvent, Platform } from 'react-native';
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
  appearance?: NavigationAppearance;
}

// Helpers outside render to avoid re-creation
const isImageSource = (value: any) => {
  if (value == null) return false;
  const valueType = typeof value;
  if (valueType === 'number') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (valueType === 'object') {
    if ('uri' in value || 'width' in value || 'height' in value) return true;
    if (
      'sfSymbolName' in value ||
      'imageSource' in value ||
      'templateSource' in value
    )
      return false;
  }
  return false;
};

const buildIOSIcon = (value: any) => {
  if (!value) return undefined;
  if (
    typeof value === 'object' &&
    (('sfSymbolName' in value ||
      'imageSource' in value ||
      'templateSource' in value) as any)
  ) {
    return value;
  }
  return { templateSource: value } as any;
};

export const RenderTabBar = memo<RenderTabBarProps>(
  ({ tabBar, appearance }) => {
    const router = useRouter();
    const subscribe = useCallback(
      (cb: () => void) => tabBar.subscribe(cb),
      [tabBar]
    );
    const snapshot = useSyncExternalStore(
      subscribe,
      tabBar.getState,
      tabBar.getState
    );
    const { tabs, index } = snapshot;

    const {
      standardAppearance,
      scrollEdgeAppearance,
      tabBarItemStyle,
      tintColor,
      backgroundColor,
    } = appearance?.tabBar ?? {};

    useEffect(() => {
      router.ensureTabSeed(index);
    }, [index, router]);

    const onNativeFocusChange = useCallback(
      (event: NativeSyntheticEvent<NativeFocusChangeEvent>) => {
        const tabKey = event.nativeEvent.tabKey;
        const tabIndex = tabs.findIndex((route) => route.tabKey === tabKey);
        router.onTabIndexChange(tabIndex);
      },
      [tabs, router]
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
          tabBarItemActiveIndicatorEnabled={
            tabBarItemStyle?.activeIndicatorEnabled
          }
          tabBarItemRippleColor={tabBarItemStyle?.rippleColor}
          tabBarItemLabelVisibilityMode={tabBarItemStyle?.labelVisibilityMode}
          // tabBarMinimizeBehavior={}
        >
          {tabs.map((tab) => {
            const isFocused = tab.tabKey === tabs[index]?.tabKey;
            const stack = tabBar.stacks[tab.tabKey];
            const Screen = tabBar.screens[tab.tabKey];

            // Map unified icon to platform-specific props expected by RNS BottomTabsScreen
            const { icon, selectedIcon, ...restTab } = tab as any;

            let mappedTabProps: any = restTab;
            if (icon || selectedIcon) {
              if (Platform.OS === 'android') {
                mappedTabProps = {
                  ...restTab,
                  ...(isImageSource(icon) ? { iconResource: icon } : null),
                };
              } else {
                mappedTabProps = {
                  ...restTab,
                  ...(icon ? { icon: buildIOSIcon(icon) } : null),
                  ...(selectedIcon
                    ? { selectedIcon: buildIOSIcon(selectedIcon) }
                    : null),
                };
              }
            }

            return (
              <BottomTabsScreen
                scrollEdgeAppearance={scrollEdgeAppearance}
                standardAppearance={standardAppearance}
                isFocused={isFocused}
                key={tab.tabKey}
                {...mappedTabProps}
              >
                {stack ? (
                  <StackRenderer
                    stack={stack}
                    screenStyle={appearance?.screenStyle}
                  />
                ) : Screen ? (
                  <Screen />
                ) : null}
              </BottomTabsScreen>
            );
          })}
        </BottomTabs>
      </TabBarContext.Provider>
    );
  }
);

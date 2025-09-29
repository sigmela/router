import { useCallback, useSyncExternalStore, memo, useEffect } from 'react';
import type { NavigationAppearance } from '../types';
import { StackRenderer } from '../StackRenderer';
import { TabBarContext } from './TabBarContext';
import { useRouter } from '../RouterContext';
import type { InternalTabItem, TabBar } from './TabBar';
import {
  type NativeFocusChangeEvent,
  type Icon as RNSIcon,
  BottomTabsScreen,
  BottomTabs,
  ScreenStackItem,
} from 'react-native-screens';
import {
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  type ImageSourcePropType,
} from 'react-native';

export interface RenderTabBarProps {
  tabBar: TabBar;
  appearance?: NavigationAppearance;
}

// Helpers outside render to avoid re-creation
const isImageSource = (value: unknown): value is ImageSourcePropType => {
  if (value == null) return false;
  const valueType = typeof value;
  if (valueType === 'number') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (valueType === 'object') {
    const v = value as Record<string, unknown>;
    if ('uri' in v || 'width' in v || 'height' in v) return true;
    if ('sfSymbolName' in v || 'imageSource' in v || 'templateSource' in v)
      return false;
  }
  return false;
};

const isRNSIcon = (value: unknown): value is RNSIcon => {
  if (value == null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return 'sfSymbolName' in v || 'imageSource' in v || 'templateSource' in v;
};

const buildIOSIcon = (value: unknown): RNSIcon | undefined => {
  if (!value) return undefined;
  if (isRNSIcon(value)) return value;
  return { templateSource: value as ImageSourcePropType } as RNSIcon;
};

// Map unified tab icon props to RNS BottomTabsScreen platform-specific props
const getTabIcon = (tab: InternalTabItem) => {
  const { icon, selectedIcon } = tab;
  if (icon || selectedIcon) {
    if (Platform.OS === 'android' && isImageSource(icon)) {
      return { iconResource: icon };
    }

    return {
      selectedIcon: buildIOSIcon(selectedIcon),
      icon: buildIOSIcon(icon),
    };
  }

  return undefined;
};

export const RenderTabBar = memo<RenderTabBarProps>(
  ({ tabBar, appearance = {} }) => {
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
      iconColor,
      iconColorActive,
      androidActiveIndicatorEnabled,
      androidActiveIndicatorColor,
      androidRippleColor,
      labelVisibilityMode,
      title,
      backgroundColor,
      badgeBackgroundColor,
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

    const containerProps = {
      tabBarBackgroundColor: backgroundColor,
      tabBarItemTitleFontFamily: title?.fontFamily,
      tabBarItemTitleFontSize: title?.fontSize,
      tabBarItemTitleFontWeight: title?.fontWeight,
      tabBarItemTitleFontStyle: title?.fontStyle,
      tabBarItemTitleFontColor: title?.color,
      tabBarItemTitleFontColorActive: title?.activeColor,
      tabBarItemIconColor: iconColor,
      tabBarItemIconColorActive: iconColorActive,
      tabBarItemActiveIndicatorColor: androidActiveIndicatorColor,
      tabBarItemActiveIndicatorEnabled: androidActiveIndicatorEnabled,
      tabBarItemRippleColor: androidRippleColor,
      tabBarItemLabelVisibilityMode: labelVisibilityMode,
    };

    const iosState = {
      tabBarItemTitleFontFamily: title?.fontFamily,
      tabBarItemTitleFontSize: title?.fontSize,
      tabBarItemTitleFontWeight: title?.fontWeight,
      tabBarItemTitleFontStyle: title?.fontStyle,
      tabBarItemTitleFontColor: title?.color,
      tabBarItemBadgeBackgroundColor: badgeBackgroundColor,
      tabBarItemTitleFontColorActive: title?.color,
      tabBarItemIconColorActive: iconColorActive,
      tabBarItemIconColor: iconColor,
    };

    const iosAppearance = Platform.select({
      default: undefined,
      ios: {
        tabBarBackgroundColor: backgroundColor,
        compactInline: { normal: iosState },
        stacked: { normal: iosState },
        inline: { normal: iosState },
      },
    });

    return (
      <ScreenStackItem
        screenId="root-tabbar"
        headerConfig={{ hidden: true }}
        style={StyleSheet.absoluteFill}
        stackAnimation="slide_from_right"
      >
        <TabBarContext.Provider value={tabBar}>
          <BottomTabs
            onNativeFocusChange={onNativeFocusChange}
            {...containerProps}
          >
            {tabs.map((tab) => {
              const isFocused = tab.tabKey === tabs[index]?.tabKey;
              const stack = tabBar.stacks[tab.tabKey];
              const Screen = tabBar.screens[tab.tabKey];
              const icon = getTabIcon(tab);

              return (
                <BottomTabsScreen
                  scrollEdgeAppearance={iosAppearance}
                  standardAppearance={iosAppearance}
                  isFocused={isFocused}
                  tabKey={tab.tabKey}
                  key={tab.tabKey}
                  title={tab.title}
                  badgeValue={tab.badgeValue}
                  specialEffects={tab.specialEffects}
                  selectedIcon={icon?.selectedIcon}
                  iconResource={icon?.iconResource}
                  icon={icon?.icon}
                >
                  {stack ? (
                    <StackRenderer appearance={appearance} stack={stack} />
                  ) : Screen ? (
                    <Screen />
                  ) : null}
                </BottomTabsScreen>
              );
            })}
          </BottomTabs>
        </TabBarContext.Provider>
      </ScreenStackItem>
    );
  }
);

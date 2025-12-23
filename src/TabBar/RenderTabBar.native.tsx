import type { InternalTabItem, TabBar } from './TabBar';
import type { NavigationAppearance } from '../types';
import { StackRenderer } from '../StackRenderer';
import { TabBarContext } from './TabBarContext';
import { NavigationStack } from '../NavigationStack';
import { useRouter } from '../RouterContext';
import type { TabBarProps } from './TabBar';
import type { NavigationNode } from '../navigationNode';
import {
  type NativeFocusChangeEvent,
  type PlatformIcon,
  type PlatformIconIOS,
  BottomTabsScreen,
  BottomTabs,
  ScreenStackItem,
} from 'react-native-screens';
import {
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {
  useCallback,
  useSyncExternalStore,
  memo,
  useEffect,
  useState,
  useMemo,
  type ComponentType,
} from 'react';
import type { HistoryItem } from '../types';

export interface RenderTabBarProps {
  tabBar: TabBar;
  appearance?: NavigationAppearance;
}

const isImageSource = (value: unknown): value is ImageSourcePropType => {
  if (value == null) return false;
  const valueType = typeof value;
  if (valueType === 'number') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (valueType === 'object') {
    const v = value as Record<string, unknown>;
    if ('uri' in v || 'width' in v || 'height' in v) return true;
    // Check for new PlatformIcon format
    if ('ios' in v || 'android' in v || 'shared' in v) return false;
    // Check for legacy format
    if ('sfSymbolName' in v || 'imageSource' in v || 'templateSource' in v)
      return false;
    // Check for new type-based format
    if ('type' in v) return false;
  }
  return false;
};

const isPlatformIcon = (value: unknown): value is PlatformIcon => {
  if (value == null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return 'ios' in v || 'android' in v || 'shared' in v;
};

const isLegacyIOSIcon = (value: unknown): boolean => {
  if (value == null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return 'sfSymbolName' in v || 'imageSource' in v || 'templateSource' in v;
};

const convertLegacyIOSIconToPlatformIconIOS = (
  value: unknown
): PlatformIconIOS | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;

  if ('sfSymbolName' in v) {
    return {
      type: 'sfSymbol',
      name: v.sfSymbolName as string,
    };
  }

  if ('templateSource' in v) {
    return {
      type: 'templateSource',
      templateSource: v.templateSource as ImageSourcePropType,
    };
  }

  if ('imageSource' in v) {
    return {
      type: 'imageSource',
      imageSource: v.imageSource as ImageSourcePropType,
    };
  }

  return undefined;
};

const buildIOSIcon = (value: unknown): PlatformIconIOS | undefined => {
  if (!value) return undefined;

  // If it's already a PlatformIcon, extract ios
  if (isPlatformIcon(value)) {
    return value.ios;
  }

  // If it's a legacy format, convert it
  if (isLegacyIOSIcon(value)) {
    return convertLegacyIOSIconToPlatformIconIOS(value);
  }

  // If it's an ImageSourcePropType, convert to templateSource
  if (isImageSource(value)) {
    return {
      type: 'templateSource',
      templateSource: value as ImageSourcePropType,
    };
  }

  return undefined;
};

const buildPlatformIcon = (
  icon: unknown,
  selectedIcon?: unknown
): PlatformIcon | undefined => {
  if (!icon && !selectedIcon) return undefined;

  const iosIcon = buildIOSIcon(icon);
  const iosSelectedIcon = buildIOSIcon(selectedIcon);

  // If it's already a PlatformIcon, use it directly
  if (isPlatformIcon(icon)) {
    return {
      ...icon,
      ios: iosSelectedIcon || icon.ios,
    };
  }

  // Build new PlatformIcon
  const result: PlatformIcon = {};

  if (iosIcon || iosSelectedIcon) {
    result.ios = iosSelectedIcon || iosIcon;
  }

  // For shared imageSource (works on both platforms)
  if (isImageSource(icon) && !iosIcon) {
    result.shared = {
      type: 'imageSource',
      imageSource: icon as ImageSourcePropType,
    };
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

const getTabIcon = (tab: InternalTabItem) => {
  const { icon, selectedIcon } = tab;
  if (!icon && !selectedIcon) return undefined;

  // Build PlatformIcon for new API
  const platformIcon = buildPlatformIcon(icon, selectedIcon);
  if (!platformIcon) return undefined;

  // For Android, if icon is a direct ImageSourcePropType, use shared
  if (
    Platform.OS === 'android' &&
    isImageSource(icon) &&
    !platformIcon.shared
  ) {
    platformIcon.shared = {
      type: 'imageSource',
      imageSource: icon as ImageSourcePropType,
    };
  }

  return {
    icon: platformIcon,
    selectedIcon: platformIcon.ios,
  };
};

const TabStackRenderer = memo<{
  stack: NavigationStack;
  appearance?: NavigationAppearance;
}>(({ stack, appearance }) => {
  const router = useRouter();
  const stackId = stack.getId();
  const subscribe = useCallback(
    (cb: () => void) => router.subscribeStack(stackId, cb),
    [router, stackId]
  );
  const get = useCallback(
    () => router.getStackHistory(stackId),
    [router, stackId]
  );
  const history: HistoryItem[] = useSyncExternalStore(subscribe, get, get);

  return (
    <StackRenderer appearance={appearance} stack={stack} history={history} />
  );
});

TabStackRenderer.displayName = 'TabStackRenderer';

const TabNodeRenderer = memo<{
  node: NavigationNode;
  appearance?: NavigationAppearance;
}>(({ node, appearance }) => {
  const Renderer = useMemo(() => node.getRenderer(), [node]);
  return <Renderer appearance={appearance} />;
});

TabNodeRenderer.displayName = 'TabNodeRenderer';

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
    const { tabs, index, config } = snapshot;

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
      iOSShadowColor,
    } = appearance?.tabBar ?? {};

    const onNativeFocusChange = useCallback(
      (event: NativeSyntheticEvent<NativeFocusChangeEvent>) => {
        const tabKey = event.nativeEvent.tabKey;
        const tabIndex = tabs.findIndex((route) => route.tabKey === tabKey);
        if (tabIndex === -1) return;

        const targetTab = tabs[tabIndex];
        if (!targetTab) return;

        const targetStack = tabBar.stacks[targetTab.tabKey];
        const targetNode = tabBar.nodes[targetTab.tabKey];

        // Update TabBar UI state
        if (tabIndex !== index) {
          tabBar.onIndexChange(tabIndex);
        }

        // Navigate to the target stack's first route if needed
        if (targetStack) {
          const stackId = targetStack.getId();
          const stackHistory = router.getStackHistory(stackId);
          // Only navigate if stack is empty (first visit)
          if (stackHistory.length === 0) {
            const firstRoute = targetStack.getFirstRoute();
            if (firstRoute?.path) {
              router.navigate(firstRoute.path);
            }
          }
        } else if (targetNode) {
          // For nodes like SplitView, check if we need to seed it
          const nodeId = targetNode.getId?.();
          if (nodeId) {
            const nodeHistory = router.getStackHistory(nodeId);
            if (nodeHistory.length === 0) {
              const seed = targetNode.seed?.();
              if (seed?.path) {
                const prefix = targetTab.tabPrefix ?? '';
                const fullPath =
                  prefix && !seed.path.startsWith(prefix)
                    ? `${prefix}${seed.path.startsWith('/') ? '' : '/'}${seed.path}`
                    : seed.path;
                router.navigate(fullPath);
              }
            }
          }
        }
      },
      [tabs, tabBar, index, router]
    );

    const onTabPress = useCallback(
      (nextIndex: number) => {
        const targetTab = tabs[nextIndex];
        if (!targetTab) return;

        const targetStack = tabBar.stacks[targetTab.tabKey];
        const targetNode = tabBar.nodes[targetTab.tabKey];

        // Update TabBar UI state
        if (nextIndex !== index) {
          tabBar.onIndexChange(nextIndex);
        }

        // Navigate to the target stack's first route if needed
        if (targetStack) {
          const stackId = targetStack.getId();
          const stackHistory = router.getStackHistory(stackId);
          // Only navigate if stack is empty (first visit)
          if (stackHistory.length === 0) {
            const firstRoute = targetStack.getFirstRoute();
            if (firstRoute?.path) {
              router.navigate(firstRoute.path);
            }
          }
        } else if (targetNode) {
          // For nodes like SplitView, check if we need to seed it
          const nodeId = targetNode.getId?.();
          if (nodeId) {
            const nodeHistory = router.getStackHistory(nodeId);
            if (nodeHistory.length === 0) {
              const seed = targetNode.seed?.();
              if (seed?.path) {
                const prefix = targetTab.tabPrefix ?? '';
                const fullPath =
                  prefix && !seed.path.startsWith(prefix)
                    ? `${prefix}${seed.path.startsWith('/') ? '' : '/'}${seed.path}`
                    : seed.path;
                router.navigate(fullPath);
              }
            }
          }
        }
      },
      [tabs, tabBar, index, router]
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
        tabBarShadowColor: iOSShadowColor,
        compactInline: { normal: iosState },
        stacked: { normal: iosState },
        inline: { normal: iosState },
      },
    });

    const CustomTabBar = config.component as
      | ComponentType<TabBarProps>
      | undefined;

    const [visited, setVisited] = useState<Record<string, true>>({});

    useEffect(() => {
      const key = tabs[index]?.tabKey;
      if (key) {
        setVisited((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
      }
    }, [tabs, index]);

    if (CustomTabBar) {
      return (
        <ScreenStackItem
          screenId="root-tabbar"
          headerConfig={{ hidden: true }}
          style={StyleSheet.absoluteFill}
          stackAnimation="slide_from_right"
        >
          <TabBarContext.Provider value={tabBar}>
            <View style={styles.flex}>
              {tabs
                .filter((t) => visited[t.tabKey])
                .map((tab) => {
                  const isActive = tab.tabKey === tabs[index]?.tabKey;
                  const stackForTab = tabBar.stacks[tab.tabKey];
                  const nodeForTab = tabBar.nodes[tab.tabKey];
                  const ScreenForTab = tabBar.screens[tab.tabKey];
                  return (
                    <View
                      key={`tab-content-${tab.tabKey}`}
                      style={[styles.flex, !isActive && styles.hidden]}
                    >
                      {stackForTab ? (
                        <TabStackRenderer
                          appearance={appearance}
                          stack={stackForTab}
                        />
                      ) : nodeForTab ? (
                        <TabNodeRenderer
                          appearance={appearance}
                          node={nodeForTab}
                        />
                      ) : ScreenForTab ? (
                        <ScreenForTab />
                      ) : null}
                    </View>
                  );
                })}
            </View>

            <CustomTabBar
              onTabPress={onTabPress}
              activeIndex={index}
              tabs={tabs}
            />
          </TabBarContext.Provider>
        </ScreenStackItem>
      );
    }

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
              const node = tabBar.nodes[tab.tabKey];
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
                  icon={icon?.icon}
                  selectedIcon={icon?.selectedIcon}
                >
                  {stack ? (
                    <TabStackRenderer appearance={appearance} stack={stack} />
                  ) : node ? (
                    <TabNodeRenderer appearance={appearance} node={node} />
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
});

import { type ImageSourcePropType, type ColorValue } from 'react-native';
import type { NavigationAppearance } from '../types';
import { StackRenderer } from '../StackRenderer';
import { TabBarContext } from './TabBarContext';
import { useRouter } from '../RouterContext';
import type { TabBarProps } from './TabBar';
import type { TabBar } from './TabBar';
import { TabIcon } from './TabIcon';
import {
  useCallback,
  useSyncExternalStore,
  memo,
  useMemo,
  type CSSProperties,
  type ComponentType,
} from 'react';

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
  }
  return false;
};

const toColorString = (c?: ColorValue): string | undefined =>
  typeof c === 'string' ? c : undefined;

//

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
    const { tabs, index, config } = snapshot;

    const focusedTab = tabs[index];
    const stack = focusedTab ? tabBar.stacks[focusedTab.tabKey] : undefined;
    const Screen = focusedTab ? tabBar.screens[focusedTab.tabKey] : undefined;

    const onTabClick = useCallback(
      (nextIndex: number) => {
        const targetTab = tabs[nextIndex];
        if (!targetTab) return;
        const targetStack = tabBar.stacks[targetTab.tabKey];

        if (targetStack) {
          // Prefer last visited route in the target stack; otherwise first route
          const stackId = targetStack.getId();
          const history = router.getStackHistory(stackId);
          const last = history.length ? history[history.length - 1] : undefined;
          const toPath = last?.path ?? targetStack.getFirstRoute()?.path;
          if (toPath) {
            const currentPath = router.getVisibleRoute()?.path;
            if (nextIndex === index && toPath === currentPath) return;
            // Use replace to avoid duplicating history entries when switching tabs
            router.replace(toPath, true);
            return;
          }
        }

        // Fallback: just switch tab index (no history push if there is no path)
        tabBar.onIndexChange(nextIndex);
      },
      [router, tabBar, tabs, index]
    );

    const tabBarStyle: CSSProperties | undefined = useMemo(() => {
      const tabBarBg = toColorString(appearance?.tabBar?.backgroundColor);
      return tabBarBg ? { backgroundColor: tabBarBg } : undefined;
    }, [appearance?.tabBar?.backgroundColor]);

    const titleBaseStyle: CSSProperties = useMemo(
      () => ({
        fontFamily: appearance?.tabBar?.title?.fontFamily,
        fontSize: appearance?.tabBar?.title?.fontSize,
        fontWeight: appearance?.tabBar?.title?.fontWeight,
        fontStyle: appearance?.tabBar?.title?.fontStyle,
      }),
      [
        appearance?.tabBar?.title?.fontFamily,
        appearance?.tabBar?.title?.fontSize,
        appearance?.tabBar?.title?.fontWeight,
        appearance?.tabBar?.title?.fontStyle,
      ]
    );

    // If a custom component is provided, render it instead of the default web tab bar
    const CustomTabBar = config.component as
      | ComponentType<TabBarProps>
      | undefined;

    return (
      <TabBarContext.Provider value={tabBar}>
        <div className="tab-stacks-container">
          {stack ? (
            <StackRenderer appearance={appearance} stack={stack} />
          ) : Screen ? (
            <Screen />
          ) : null}

          {CustomTabBar ? (
            <CustomTabBar
              onTabPress={onTabClick}
              activeIndex={index}
              tabs={tabs}
            />
          ) : (
            <div className="tab-bar" style={tabBarStyle}>
              {tabs.map((tab, i) => {
                const isActive = i === index;
                const iconTint = toColorString(
                  isActive
                    ? appearance?.tabBar?.iconColorActive
                    : appearance?.tabBar?.iconColor
                );
                const title = appearance?.tabBar?.title;
                const labelColor = isActive
                  ? (toColorString(title?.activeColor) ??
                    toColorString(title?.color))
                  : toColorString(title?.color);
                const labelStyle: CSSProperties = {
                  ...titleBaseStyle,
                  color: labelColor,
                };
                return (
                  <button
                    key={tab.tabKey}
                    data-index={i}
                    className={`tab-item${isActive ? ' active' : ''}`}
                    onClick={() => onTabClick(i)}
                  >
                    <div className="tab-item-icon">
                      {isImageSource(tab.icon) ? (
                        <TabIcon source={tab.icon} tintColor={iconTint} />
                      ) : null}
                    </div>
                    {tab.badgeValue ? (
                      <span className="tab-item-label-badge">
                        {tab.badgeValue}
                      </span>
                    ) : null}

                    <div className="tab-item-label" style={labelStyle}>
                      {tab.title}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </TabBarContext.Provider>
    );
  }
);

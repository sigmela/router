import React, {
  useCallback,
  useSyncExternalStore,
  memo,
  useEffect,
} from 'react';
import type { NavigationAppearance } from '../types';
import { StackRenderer } from '../StackRenderer/StackRenderer';
import { TabBarContext } from './TabBarContext';
import { useRouter } from '../RouterContext';
import type { TabBar } from './TabBar';

export interface RenderTabBarProps {
  tabBar: TabBar;
  appearance?: NavigationAppearance;
}

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

    useEffect(() => {
      router.ensureTabSeed(index);
    }, [index, router]);

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
            // Use replace to avoid duplicating history entries when switching tabs
            router.replace(toPath);
            return;
          }
        }

        // Fallback: just switch tab index (no history push if there is no path)
        router.onTabIndexChange(nextIndex);
      },
      [router, tabBar, tabs]
    );

    const tintColor = appearance?.tabBar?.tintColor as string | undefined;
    const backgroundColor =
      (appearance?.tabBar?.backgroundColor as string | undefined) ?? undefined;
    const itemStyle = appearance?.tabBar?.tabBarItemStyle;

    const iconColor = (active: boolean): React.CSSProperties['color'] => {
      const activeColor =
        (itemStyle?.iconColorActive as string | undefined) ?? tintColor;
      const idleColor =
        (itemStyle?.iconColor as string | undefined) ?? '#6c757d';
      return active ? (activeColor ?? '#007bff') : idleColor;
    };

    const titleColor = (active: boolean): React.CSSProperties['color'] => {
      const activeColor =
        (itemStyle?.titleFontColorActive as string | undefined) ?? tintColor;
      const idleColor =
        (itemStyle?.titleFontColor as string | undefined) ?? '#6c757d';
      return active ? (activeColor ?? '#007bff') : idleColor;
    };

    const renderIcon = (tab: any, active: boolean) => {
      const style: React.CSSProperties = {
        color: iconColor(active),
        fontSize: (itemStyle?.titleFontSize as number | undefined)
          ? Number(itemStyle?.titleFontSize)
          : 24,
        lineHeight: 1,
      };

      // Prefer icon from the route (top of stack), then first route, then tab's own icon
      let routeIcon: any | undefined;
      const tabStack = tabBar.stacks[tab.tabKey];
      if (tabStack) {
        const stackId = tabStack.getId();
        const history = router.getStackHistory(stackId);
        const top = history.length ? history[history.length - 1] : undefined;
        routeIcon =
          top?.options?.tabBarIcon ??
          tabStack.getFirstRoute()?.options?.tabBarIcon;
      }

      const source = routeIcon ?? (tab?.icon as any);

      // String source: render as-is (could be emoji or glyph)
      if (typeof source === 'string' && source) {
        return (
          <span className="web-tab-icon-wrap">
            <span className="web-tab-icon" style={style}>
              {source}
            </span>
            {tab.badgeValue ? (
              <span className="web-tab-badge">{tab.badgeValue}</span>
            ) : null}
          </span>
        );
      }
      // Fallback: empty placeholder keeps layout consistent
      return (
        <span className="web-tab-icon-wrap">
          <span className="web-tab-icon" style={style}>
            •
          </span>
          {tab.badgeValue ? (
            <span className="web-tab-badge">{tab.badgeValue}</span>
          ) : null}
        </span>
      );
    };

    return (
      <TabBarContext.Provider value={tabBar}>
        <div
          className="web-layout"
          style={{ display: 'flex', width: '100%', height: '100%' }}
        >
          <nav className="web-tab-bar" style={{ backgroundColor }}>
            <div className="web-tab-container">
              {tabs.map((tab, i) => {
                const isActive = i === index;
                return (
                  <button
                    key={tab.tabKey}
                    className={`web-tab-item${isActive ? ' active' : ''}`}
                    onClick={() => onTabClick(i)}
                    style={{ color: titleColor(isActive) }}
                  >
                    {renderIcon(tab, isActive)}
                    <span
                      className="web-tab-label"
                      style={{
                        fontFamily: itemStyle?.titleFontFamily as
                          | string
                          | undefined,
                        fontSize: itemStyle?.titleFontSize as
                          | number
                          | undefined,
                        fontWeight: itemStyle?.titleFontWeight as
                          | any
                          | undefined,
                        fontStyle: itemStyle?.titleFontStyle as any | undefined,
                      }}
                    >
                      {tab.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div
            className="web-tab-content"
            style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}
          >
            {stack ? (
              <StackRenderer appearance={appearance} stack={stack} />
            ) : Screen ? (
              <Screen />
            ) : null}
          </div>
        </div>
      </TabBarContext.Provider>
    );
  }
);

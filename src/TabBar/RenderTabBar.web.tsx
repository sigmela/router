import React, {
  useCallback,
  useSyncExternalStore,
  memo,
  useEffect,
} from 'react';
import type { NavigationAppearance } from '../types';
import { StackRenderer } from '../StackRenderer';
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
            const currentPath = router.getVisibleRoute()?.path;
            if (nextIndex === index && toPath === currentPath) return;
            // Use replace to avoid duplicating history entries when switching tabs
            router.replace(toPath, true);
            return;
          }
        }

        // Fallback: just switch tab index (no history push if there is no path)
        router.onTabIndexChange(nextIndex);
      },
      [router, tabBar, tabs, index]
    );

    const tintColor = appearance?.tabBar?.tintColor as string | undefined;
    const itemStyle = appearance?.tabBar?.tabBarItemStyle;

    const titleColor = (active: boolean): React.CSSProperties['color'] => {
      const activeColor =
        (itemStyle?.titleFontColorActive as string | undefined) ?? tintColor;
      const idleColor =
        (itemStyle?.titleFontColor as string | undefined) ?? '#6c757d';
      return active ? (activeColor ?? '#007bff') : idleColor;
    };

    return (
      <div
        className="screen-stack-item"
        data-presentation="push"
        data-phase="active"
      >
        <TabBarContext.Provider value={tabBar}>
          <div className="tab-stacks-container">
            {stack ? (
              <StackRenderer appearance={appearance} stack={stack} />
            ) : Screen ? (
              <Screen />
            ) : null}

            <nav className="web-tab-bar">
              <div className="web-tab-container">
                {tabs.map((tab, i) => {
                  const isActive = i === index;
                  return (
                    <button
                      key={tab.tabKey}
                      className={`web-tab-item${isActive ? ' active' : ''}`}
                      style={{ color: titleColor(isActive) }}
                      onClick={() => onTabClick(i)}
                    >
                      <span className="web-tab-icon-wrap">
                        <span className="web-tab-icon">•</span>
                        {tab.badgeValue ? (
                          <span className="web-tab-badge">
                            {tab.badgeValue}
                          </span>
                        ) : null}
                      </span>
                      <span className="web-tab-label">{tab.title}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>
        </TabBarContext.Provider>
      </div>
    );
  }
);

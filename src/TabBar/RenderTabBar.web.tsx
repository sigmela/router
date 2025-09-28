import type { NavigationAppearance } from '../types';
import { StackRenderer } from '../StackRenderer';
import { TabBarContext } from './TabBarContext';
import { useRouter } from '../RouterContext';
import type { TabBar } from './TabBar';
import { Image, type ImageSourcePropType } from 'react-native';
import React, {
  useCallback,
  useSyncExternalStore,
  memo,
  useEffect,
} from 'react';

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

    const tb = appearance?.tabBar;
    const title = tb?.title;

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

    const getTitleColor = (active: boolean): React.CSSProperties['color'] => {
      const configured = title?.color;
      if (typeof configured === 'string') return configured;
      return active ? '#007bff' : '#6c757d';
    };

    const titleFontStyle: React.CSSProperties = {};
    if (typeof title?.fontFamily === 'string') {
      titleFontStyle.fontFamily = title.fontFamily;
    }
    if (typeof title?.fontSize === 'number') {
      titleFontStyle.fontSize = title.fontSize;
    }
    if (
      typeof title?.fontWeight === 'string' ||
      typeof title?.fontWeight === 'number'
    ) {
      titleFontStyle.fontWeight =
        title.fontWeight as React.CSSProperties['fontWeight'];
    }
    if (typeof title?.fontStyle === 'string') {
      titleFontStyle.fontStyle =
        title.fontStyle as React.CSSProperties['fontStyle'];
    }

    const rnColorToCss = (value: unknown): string | undefined => {
      return typeof value === 'string' ? value : undefined;
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

            <nav
              className="web-tab-bar"
              style={{
                backgroundColor: rnColorToCss(tb?.backgroundColor),
              }}
            >
              <div className="web-tab-container">
                {tabs.map((tab, i) => {
                  const isActive = i === index;
                  return (
                    <button
                      key={tab.tabKey}
                      className={`web-tab-item${isActive ? ' active' : ''}`}
                      style={{
                        color: getTitleColor(isActive),
                        ...titleFontStyle,
                      }}
                      onClick={() => onTabClick(i)}
                    >
                      <span className="web-tab-icon-wrap">
                        <span className="web-tab-icon">
                          {isImageSource(tab.icon) ? (
                            <Image
                              source={tab.icon}
                              tintColor={
                                isActive ? tb?.iconColorActive : tb?.iconColor
                              }
                            />
                          ) : null}
                        </span>
                        {tab.badgeValue ? (
                          <span
                            className="web-tab-badge"
                            style={{
                              backgroundColor: rnColorToCss(
                                tb?.badgeBackgroundColor
                              ),
                            }}
                          >
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

import { type ImageSourcePropType, type ColorValue } from 'react-native';
import type { NavigationAppearance } from '../types';
import { StackRenderer } from '../StackRenderer';
import { TabBarContext } from './TabBarContext';
import { useRouter } from '../RouterContext';
import { NavigationStack } from '../NavigationStack';
import type { NavigationNode } from '../navigationNode';
import type { HistoryItem } from '../types';
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
    <StackRenderer
      appearance={appearance}
      stackId={stackId}
      history={history}
    />
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

const joinPrefixAndPath = (
  prefix: string | undefined,
  path: string
): string => {
  const base = (prefix ?? '').trim();
  const child = (path || '/').trim();
  if (!base) return child || '/';

  const baseNorm =
    base === '/' ? '' : base.endsWith('/') ? base.slice(0, -1) : base;

  if (!child || child === '/') {
    return baseNorm || '/';
  }
  if (child.startsWith('/')) {
    return `${baseNorm}${child}`;
  }
  return `${baseNorm}/${child}`;
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
    const { tabs, index, config } = snapshot;

    const focusedTab = tabs[index];
    const stack = focusedTab ? tabBar.stacks[focusedTab.tabKey] : undefined;
    const node = focusedTab ? tabBar.nodes[focusedTab.tabKey] : undefined;
    const Screen = focusedTab ? tabBar.screens[focusedTab.tabKey] : undefined;

    const onTabClick = useCallback(
      (nextIndex: number) => {
        const targetTab = tabs[nextIndex];
        if (!targetTab) return;
        const targetStack = tabBar.stacks[targetTab.tabKey];
        const targetNode = tabBar.nodes[targetTab.tabKey];

        if (targetStack) {
          // Keep TabBar UI in sync immediately.
          if (nextIndex !== index) {
            tabBar.onIndexChange(nextIndex);
          }
          const firstRoutePath = targetStack.getFirstRoute()?.path;
          if (firstRoutePath) {
            // Web behavior: reset all preserved stacks when switching tabs.
            // This keeps browser URL and Router state always consistent.
            router.reset(firstRoutePath);
            return;
          }
        } else if (targetNode) {
          // Keep TabBar UI in sync immediately.
          if (nextIndex !== index) {
            tabBar.onIndexChange(nextIndex);
          }

          const seedPath = targetNode.seed?.()?.path;
          const fallbackFirstPath = targetNode.getNodeRoutes()?.[0]?.path;
          const path = seedPath ?? fallbackFirstPath ?? '/';
          const fullPath = joinPrefixAndPath(targetTab.tabPrefix, path);
          router.reset(fullPath);
          return;
        }

        if (nextIndex !== index) {
          tabBar.onIndexChange(nextIndex);
        }
      },
      [router, tabBar, tabs, index]
    );

    const tabBarStyle: CSSProperties | undefined = useMemo(() => {
      const tabBarBg = toColorString(appearance?.tabBar?.backgroundColor);
      const style: CSSProperties = {
        ...(tabBarBg
          ? ({
              ['--tabbar-bg' as unknown as keyof CSSProperties]: tabBarBg,
            } as CSSProperties)
          : null),
        ...(tabs.length
          ? ({
              ['--tabbar-tabs-count' as unknown as keyof CSSProperties]: String(
                tabs.length
              ),
              ['--tabbar-active-index' as unknown as keyof CSSProperties]:
                String(index),
            } as CSSProperties)
          : null),
      };
      return Object.keys(style).length ? style : undefined;
    }, [appearance?.tabBar?.backgroundColor, tabs.length, index]);

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

    const CustomTabBar = config.component as
      | ComponentType<TabBarProps>
      | undefined;

    return (
      <TabBarContext.Provider value={tabBar}>
        <div className="tab-stacks-container">
          {stack ? (
            <TabStackRenderer appearance={appearance} stack={stack} />
          ) : node ? (
            <TabNodeRenderer appearance={appearance} node={node} />
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
            <div
              className="tab-bar"
              style={tabBarStyle}
              data-tabs-count={tabs.length}
              data-active-index={index}
            >
              {/* <div className="tab-bar-blur-overlay" /> */}
              <div className="tab-bar-inner">
                <div className="tab-bar-glass" aria-hidden="true" />
                <div className="tab-bar-content">
                  <div
                    className="tab-bar-active-indicator"
                    aria-hidden="true"
                  />
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
                        type="button"
                        data-index={i}
                        data-active={isActive ? 'true' : 'false'}
                        aria-current={isActive ? 'page' : undefined}
                        className={`tab-item${isActive ? ' active' : ''}`}
                        onClick={() => onTabClick(i)}
                      >
                        <div className="tab-item-icon">
                          {isImageSource(tab.icon) ? (
                            <TabIcon source={tab.icon} tintColor={iconTint} />
                          ) : null}
                        </div>
                        <div className="tab-item-label" style={labelStyle}>
                          {tab.title}
                        </div>
                        {tab.badgeValue ? (
                          <span className="tab-item-label-badge">
                            {tab.badgeValue}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </TabBarContext.Provider>
    );
  }
);

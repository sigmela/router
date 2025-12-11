import type { ImageSourcePropType } from 'react-native';
import { NavigationStack } from '../NavigationStack';
import type { ComponentType } from 'react';
import type { TabItem } from '../types';
import React from 'react';
import { RenderTabBar } from './RenderTabBar';
import type { NavigationNode, NodeChild, NodeRoute } from '../navigationNode';

type IOSIconShape =
  | { sfSymbolName: string }
  | { imageSource: ImageSourcePropType }
  | { templateSource: ImageSourcePropType };

type ExtendedIcon = ImageSourcePropType | IOSIconShape;

export type InternalTabItem = Omit<TabItem, 'icon' | 'selectedIcon'> & {
  icon?: ExtendedIcon;
  selectedIcon?: ExtendedIcon;
  badgeValue?: string;
};

export type TabBarProps = {
  onTabPress: (index: number) => void;
  tabs: InternalTabItem[];
  activeIndex: number;
};

export type TabBarDescriptor = {
  renderer?: ComponentType<TabBarProps>;
};

type TabBarConfig = Omit<InternalTabItem, 'tabKey' | 'key'> & {
  stack?: NavigationStack;
  screen?: React.ComponentType<any>;
  component?: ComponentType<TabBarProps>;
};

type TabBarOptions = {
  component?: ComponentType<TabBarProps>;
  config?: TabBarConfig;
  initialIndex?: number;
};

export class TabBar implements NavigationNode {
  private readonly tabBarId: string;
  public screens: Record<string, React.ComponentType<any>> = {};
  public stacks: Record<string, NavigationStack> = {};
  private listeners: Set<() => void> = new Set();

  private state: {
    tabs: InternalTabItem[];
    config: TabBarConfig;
    index: number;
  };

  constructor(options: TabBarOptions = {}) {
    this.tabBarId = `tabbar-${Math.random().toString(36).slice(2)}`;
    this.state = {
      tabs: [],
      index: options.initialIndex ?? 0,
      config: { component: options.component },
    };
  }

  public getId(): string {
    return this.tabBarId;
  }

  public addTab(tab: Omit<TabBarConfig, 'tabKey'> & { key: string }): TabBar {
    const { key, ...rest } = tab;
    const nextIndex = this.state.tabs.length;
    const tabKey = key ?? `tab-${nextIndex}`;

    const nextTabs = [
      ...this.state.tabs,
      {
        tabKey,
        ...rest,
      },
    ];

    this.setState({ tabs: nextTabs });

    if (tab.stack) {
      this.stacks[tabKey] = tab.stack;
    } else if (tab.screen) {
      this.screens[tabKey] = tab.screen;
    }

    return this;
  }

  public setBadge(tabIndex: number, badge: string | null): void {
    this.setState({
      tabs: this.state.tabs.map((route, index) =>
        index === tabIndex
          ? { ...route, badgeValue: badge ?? undefined }
          : route
      ),
    });
  }

  public setTabBarConfig(config: Partial<TabBarConfig>): void {
    this.setState({
      config: {
        ...this.state.config,
        ...config,
      },
    });
  }

  public onIndexChange(index: number) {
    this.setState({ index });
  }

  public getState = () => {
    return this.state;
  };

  private setState(state: Partial<typeof this.state>): void {
    this.state = {
      ...this.state,
      ...state,
    };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getTabs() {
    return this.state.tabs.slice();
  }

  public getInitialIndex(): number {
    return this.state.index ?? 0;
  }

  public getActiveChildId(): string | undefined {
    const activeTab = this.state.tabs[this.state.index];
    if (!activeTab) return undefined;
    const stack = this.stacks[activeTab.tabKey];
    return stack?.getId();
  }

  public switchToRoute(routeId: string): void {
    const idx = this.findTabIndexByRoute(routeId);
    if (idx === -1) return;
    if (idx === this.state.index) return;
    this.setState({ index: idx });
  }

  public hasRoute(routeId: string): boolean {
    return this.findTabIndexByRoute(routeId) !== -1;
  }

  public setActiveChildByRoute(routeId: string): void {
    this.switchToRoute(routeId);
  }

  public getNodeRoutes(): NodeRoute[] {
    return [];
  }

  public getNodeChildren(): NodeChild[] {
    const children: NodeChild[] = [];
    for (let idx = 0; idx < this.state.tabs.length; idx++) {
      const tab = this.state.tabs[idx];
      const stack = tab ? this.stacks[tab.tabKey] : undefined;
      if (stack) {
        children.push({
          prefix: '',
          node: stack as NavigationNode,
          onMatch: () => this.onIndexChange(idx),
        });
      }
    }
    return children;
  }

  public getRenderer(): React.ComponentType<any> {
    // eslint-disable-next-line consistent-this
    const tabBarInstance = this;
    return function TabBarScreen(props: any) {
      return React.createElement(RenderTabBar, {
        tabBar: tabBarInstance,
        appearance: props?.appearance,
      });
    };
  }

  public seed(): {
    routeId: string;
    params?: Record<string, unknown>;
    path: string;
    stackId?: string;
  } | null {
    const activeTab = this.state.tabs[this.state.index];
    if (!activeTab) return null;

    const stack = this.stacks[activeTab.tabKey];
    if (!stack) return null;

    const firstRoute = stack.getFirstRoute();
    if (!firstRoute) return null;

    return {
      routeId: firstRoute.routeId,
      path: firstRoute.path,
      stackId: stack.getId(),
    };
  }

  private findTabIndexByRoute(routeId: string): number {
    for (let i = 0; i < this.state.tabs.length; i++) {
      const tab = this.state.tabs[i];
      const stack = tab && this.stacks[tab.tabKey];
      if (!stack) continue;
      const hasRoute = stack.getRoutes().some((r) => r.routeId === routeId);
      if (hasRoute) {
        return i;
      }
    }
    return -1;
  }
}

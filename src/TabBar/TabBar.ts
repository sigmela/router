import type { ImageSourcePropType } from 'react-native';
import { NavigationStack } from '../NavigationStack';
import type { ComponentType } from 'react';
import type { TabItem } from '../types';
import React from 'react';
import { RenderTabBar } from './RenderTabBar';
import type { NavigationNode, NodeChild, NodeRoute } from '../navigationNode';
import type { PlatformIcon } from 'react-native-screens';

// Legacy icon format for backward compatibility
type LegacyIOSIconShape =
  | { sfSymbolName: string }
  | { imageSource: ImageSourcePropType }
  | { templateSource: ImageSourcePropType };

type ExtendedIcon = ImageSourcePropType | LegacyIOSIconShape | PlatformIcon;

export type InternalTabItem = Omit<TabItem, 'icon' | 'selectedIcon'> & {
  icon?: ExtendedIcon;
  selectedIcon?: ExtendedIcon;
  badgeValue?: string;
  /**
   * Optional base prefix for this tab's navigation subtree, e.g. '/mail'.
   * Used by Router registry building via TabBar.getNodeChildren().
   */
  tabPrefix?: string;
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
  /**
   * Legacy content type: a stack rendered in the tab.
   */
  stack?: NavigationStack;

  /**
   * New content type: any NavigationNode (e.g. SplitView).
   */
  node?: NavigationNode;

  /**
   * Screen component rendered in the tab (no routing).
   */
  screen?: React.ComponentType<any>;

  /**
   * Optional base prefix for node/stack routes, e.g. '/mail'.
   */
  prefix?: string;

  /**
   * Custom tab bar component (UI). Kept for compatibility.
   */
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
  public nodes: Record<string, NavigationNode> = {};
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
    const sourcesCount =
      (tab.stack ? 1 : 0) + (tab.node ? 1 : 0) + (tab.screen ? 1 : 0);
    if (sourcesCount !== 1) {
      throw new Error(
        `TabBar.addTab: exactly one of { stack, node, screen } must be provided (got ${sourcesCount})`
      );
    }

    const { key, ...rest } = tab;
    const nextIndex = this.state.tabs.length;
    const tabKey = key ?? `tab-${nextIndex}`;

    const nextTabs = [
      ...this.state.tabs,
      {
        tabKey,
        tabPrefix: tab.prefix,
        ...rest,
      },
    ];

    this.setState({ tabs: nextTabs });

    if (tab.stack) {
      this.stacks[tabKey] = tab.stack;
    } else if (tab.node) {
      this.nodes[tabKey] = tab.node;
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
    // Do not allow one listener to break all others.
    for (const listener of Array.from(this.listeners)) {
      try {
        listener();
      } catch (e) {
        // TabBar has no debug flag; keep behavior quiet in production.
        if (__DEV__) {
          console.error('[TabBar] listener error', e);
        }
      }
    }
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
    const node = this.nodes[activeTab.tabKey] ?? this.stacks[activeTab.tabKey];
    return node?.getId();
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
      const node = tab
        ? (this.nodes[tab.tabKey] ?? this.stacks[tab.tabKey])
        : undefined;
      if (node) {
        children.push({
          prefix: tab?.tabPrefix ?? '',
          node,
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

    const node = this.nodes[activeTab.tabKey];
    if (node) {
      return node.seed?.() ?? null;
    }

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
      const node = tab
        ? (this.nodes[tab.tabKey] ?? this.stacks[tab.tabKey])
        : undefined;
      if (!node) continue;
      const hasRoute = this.nodeHasRoute(node, routeId);
      if (hasRoute) {
        return i;
      }
    }
    return -1;
  }

  private nodeHasRoute(node: NavigationNode, routeId: string): boolean {
    const routes = node.getNodeRoutes();
    for (const r of routes) {
      if (r.routeId === routeId) return true;
      if (r.childNode) {
        if (this.nodeHasRoute(r.childNode, routeId)) return true;
      }
    }

    const children = node.getNodeChildren();
    for (const child of children) {
      if (this.nodeHasRoute(child.node, routeId)) return true;
    }

    return false;
  }
}

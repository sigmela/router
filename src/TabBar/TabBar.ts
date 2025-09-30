import type { ImageSourcePropType } from 'react-native';
import { NavigationStack } from '../NavigationStack';
import type { ComponentType } from 'react';
import type { TabItem } from '../types';
import React from 'react';

type IOSIconShape =
  | { sfSymbolName: string }
  | { imageSource: ImageSourcePropType }
  | { templateSource: ImageSourcePropType };

type ExtendedIcon = ImageSourcePropType | IOSIconShape;

// Internal representation used by TabBar to support unified icon source while keeping original android props
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

type TabBarConfig = Omit<InternalTabItem, 'tabKey' | 'key'> & {
  stack?: NavigationStack;
  screen?: React.ComponentType<any>;
  component?: ComponentType<TabBarProps>;
};
export class TabBar {
  public screens: Record<string, React.ComponentType<any>> = {};
  public stacks: Record<string, NavigationStack> = {};
  private listeners: Set<() => void> = new Set();

  private state: {
    tabs: InternalTabItem[];
    config: TabBarConfig;
    index: number;
  };

  constructor(config: TabBarConfig = {}) {
    this.state = {
      tabs: [],
      index: 0,
      config,
    };
  }

  public addTab(tab: Omit<TabBarConfig, 'tabKey'> & { key: string }): TabBar {
    const { key, ...rest } = tab;
    const nextIndex = this.state.tabs.length;
    const tabKey = key ?? `tab-${nextIndex}`;

    this.state.tabs.push({
      tabKey,
      ...rest,
    });

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
}

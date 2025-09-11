import React from "react";
import type { ColorValue, ImageSourcePropType } from "react-native";
import type { TabRole, AppleIcon } from "react-native-bottom-tabs";
import { NavigationStack } from "../NavigationStack";

export type BaseRoute = {
  key: string;
  title?: string;
  badge?: string;
  lazy?: boolean;
  focusedIcon?: ImageSourcePropType | AppleIcon;
  unfocusedIcon?: ImageSourcePropType | AppleIcon;
  activeTintColor?: string;
  hidden?: boolean;
  testID?: string;
  role?: TabRole;
  freezeOnBlur?: boolean;
};

export interface TabConfig {
  screen?: React.ComponentType<any>;
  stack?: NavigationStack;
  title?: string;
  badge?: string;
  icon?:
    | ImageSourcePropType
    | AppleIcon
    | ((props: { focused: boolean }) => ImageSourcePropType | AppleIcon);
  activeTintColor?: ColorValue;
  hidden?: boolean;
  testID?: string;
  role?: TabRole;
  freezeOnBlur?: boolean;
  lazy?: boolean;
  iconInsets?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
}

export interface TabBarConfig {
  sidebarAdaptable?: boolean;
  disablePageAnimations?: boolean;
  hapticFeedbackEnabled?: boolean;
  scrollEdgeAppearance?: "default" | "opaque" | "transparent";
  minimizeBehavior?: "automatic" | "onScrollDown" | "onScrollUp" | "never";
}

export class TabBar {
  public screens: Record<string, React.ComponentType<any>> = {};
  public stacks: Record<string, NavigationStack> = {};
  private listeners: Set<() => void> = new Set();

  private state: {
    routes: BaseRoute[];
    config: TabBarConfig;
    index: number;
  };

  constructor(config: TabBarConfig = {}) {
    this.state = {
      routes: [],
      index: 0,
      config,
    };
  }

  public addTab(tab: TabConfig): TabBar {
    const nextIndex = this.state.routes.length;
    const key = `tab-${nextIndex}`;

    const icon =
      typeof tab.icon === "function" ? tab.icon({ focused: false }) : tab.icon;
    const focusedIcon =
      typeof tab.icon === "function" ? tab.icon({ focused: true }) : tab.icon;
    this.state.routes.push({
      key,
      title: tab.title,
      badge: tab.badge,
      focusedIcon,
      unfocusedIcon: icon,
      activeTintColor: tab.activeTintColor as string | undefined,
      hidden: tab.hidden,
      testID: tab.testID,
      role: tab.role,
      freezeOnBlur: tab.freezeOnBlur,
      lazy: tab.lazy,
    });

    if (tab.stack) {
      this.stacks[key] = tab.stack;
    } else if (tab.screen) {
      this.screens[key] = tab.screen;
    }

    return this;
  }

  public setBadge(tabIndex: number, badge: string | null): void {
    this.setState({
      routes: this.state.routes.map((route, index) =>
        index === tabIndex ? { ...route, badge: badge ?? undefined } : route,
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

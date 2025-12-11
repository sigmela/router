import React from 'react';
import type { NavigationNode, NodeChild, NodeRoute } from '../navigationNode';
import type { NavigationStack } from '../NavigationStack';
import { RenderSplitView } from './RenderSplitView';

export type SplitViewOptions = {
  minWidth: number;
  primary: NavigationStack;
  secondary: NavigationStack;
};

class SecondaryStackWrapper implements NavigationNode {
  private readonly stack: NavigationStack;

  constructor(stack: NavigationStack) {
    this.stack = stack;
  }

  public getId(): string {
    return this.stack.getId();
  }

  public getNodeRoutes(): NodeRoute[] {
    // IMPORTANT:
    // - do not mutate routes/options from the original NavigationStack
    // - allowRootPop is used by Router.goBack so that a single-screen secondary can be dismissed
    return this.stack.getNodeRoutes().map((r) => ({
      ...r,
      options: {
        ...(r.options ?? {}),
        allowRootPop: true,
      },
    }));
  }

  public getNodeChildren(): NodeChild[] {
    return this.stack.getNodeChildren();
  }

  public getRenderer(): React.ComponentType<any> {
    return this.stack.getRenderer();
  }

  public seed(): {
    routeId: string;
    params?: Record<string, unknown>;
    path: string;
    stackId?: string;
  } | null {
    return this.stack.seed?.() ?? null;
  }

  public getDefaultOptions() {
    return this.stack.getDefaultOptions?.();
  }
}

export class SplitView implements NavigationNode {
  private readonly splitViewId: string;
  public readonly primary: NavigationStack;
  public readonly secondary: NavigationStack;
  public readonly minWidth: number;

  constructor(options: SplitViewOptions) {
    this.splitViewId = `splitview-${Math.random().toString(36).slice(2)}`;
    this.primary = options.primary;
    this.secondary = options.secondary;
    this.minWidth = options.minWidth;
  }

  public getId(): string {
    return this.splitViewId;
  }

  public getNodeRoutes(): NodeRoute[] {
    return [];
  }

  public getNodeChildren(): NodeChild[] {
    return [
      {
        prefix: '',
        node: this.primary,
      },
      {
        prefix: '',
        node: new SecondaryStackWrapper(this.secondary),
      },
    ];
  }

  public getRenderer(): React.ComponentType<any> {
    // eslint-disable-next-line consistent-this
    const instance = this;
    return function SplitViewScreen(props: any) {
      return React.createElement(RenderSplitView, {
        splitView: instance,
        appearance: props?.appearance,
      });
    };
  }

  public hasRoute(routeId: string): boolean {
    return (
      this.primary.getRoutes().some((r) => r.routeId === routeId) ||
      this.secondary.getRoutes().some((r) => r.routeId === routeId)
    );
  }

  public switchToRoute(_routeId: string): void {
    // SplitView does not have a single "active" child like TabBar.
    // It renders both stacks (or overlays secondary on narrow via CSS).
  }

  public setActiveChildByRoute(routeId: string): void {
    this.switchToRoute(routeId);
  }

  public seed(): {
    routeId: string;
    params?: Record<string, unknown>;
    path: string;
    stackId?: string;
  } | null {
    const firstRoute = this.primary.getFirstRoute();
    if (!firstRoute) return null;
    return {
      routeId: firstRoute.routeId,
      path: firstRoute.path,
      stackId: this.primary.getId(),
    };
  }
}

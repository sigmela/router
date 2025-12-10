import type { ScreenOptions, QueryPattern } from './types';
import type { Controller } from './createController';
import type React from 'react';

export type NodeRoute = {
  routeId: string;
  path: string;
  pathnamePattern: string;
  isWildcardPath: boolean;
  queryPattern: QueryPattern | null;
  baseSpecificity: number;
  matchPath: (path: string) => false | { params: Record<string, any> };
  component: React.ComponentType<any>;
  controller?: Controller<any, any>;
  options?: ScreenOptions;
  childNode?: NavigationNode;
};

export type NodeChild = {
  prefix: string;
  node: NavigationNode;
  /**
   * Optional hook invoked when a route inside this child matches.
   * Used by container nodes (e.g., TabBar) to update internal state.
   */
  onMatch?: () => void;
};

export interface NavigationNode {
  getId(): string;
  getNodeRoutes(): NodeRoute[];
  getNodeChildren(): NodeChild[];
  getRenderer(): React.ComponentType<any>;
  /**
   * Optional: returns currently active child stack id (for container nodes like TabBar).
   */
  getActiveChildId?: () => string | undefined;
  /**
   * Optional: informs container node that a route inside its children became active.
   */
  setActiveChildByRoute?: (routeId: string) => void;
  /**
   * Optional seed for initial history entries (router calls it on startup).
   */
  seed?: () => {
    routeId: string;
    params?: Record<string, unknown>;
    path: string;
    stackId?: string;
  } | null;
  /**
   * Optional method to get default screen options for routes in this node.
   * Used by stacks to provide default options for all screens.
   */
  getDefaultOptions?: () => ScreenOptions | undefined;
}

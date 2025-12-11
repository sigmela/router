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

  onMatch?: () => void;
};

export interface NavigationNode {
  getId(): string;
  getNodeRoutes(): NodeRoute[];
  getNodeChildren(): NodeChild[];
  getRenderer(): React.ComponentType<any>;

  getActiveChildId?: () => string | undefined;

  switchToRoute?: (routeId: string) => void;

  hasRoute?: (routeId: string) => boolean;

  setActiveChildByRoute?: (routeId: string) => void;

  seed?: () => {
    routeId: string;
    params?: Record<string, unknown>;
    path: string;
    stackId?: string;
  } | null;

  getDefaultOptions?: () => ScreenOptions | undefined;
}

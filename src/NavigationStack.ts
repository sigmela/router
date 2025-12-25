import type {
  ScreenOptions,
  NavigationStackOptions,
  QueryPattern,
  QueryToken,
} from './types';
import { nanoid } from 'nanoid/non-secure';
import { match as pathMatchFactory } from 'path-to-regexp';
import qs from 'query-string';
import React from 'react';
import {
  type ComponentWithController,
  type MixedComponent,
} from './createController';
import type { NavigationNode, NodeRoute, NodeChild } from './navigationNode';
import { StackRenderer } from './StackRenderer';

type BuiltRoute = NodeRoute;

type ChildNode = NodeChild;

export class NavigationStack implements NavigationNode {
  private readonly stackId: string;
  private readonly routes: BuiltRoute[] = [];
  private readonly children: ChildNode[] = [];
  private readonly defaultOptions: ScreenOptions | undefined;
  private readonly debugEnabled: boolean = false;
  private readonly provider:
    | React.ComponentType<{ children: React.ReactNode }>
    | undefined;

  constructor();
  constructor(id: string);
  constructor(defaultOptions: NavigationStackOptions);
  constructor(id: string, defaultOptions: NavigationStackOptions);
  constructor(
    id: string,
    defaultOptions: NavigationStackOptions,
    debug: boolean
  );
  constructor(
    idOrOptions?: string | NavigationStackOptions,
    maybeOptions?: NavigationStackOptions,
    maybeDebug?: boolean
  ) {
    if (typeof idOrOptions === 'string') {
      this.stackId = idOrOptions ?? `stack-${nanoid()}`;
      this.defaultOptions = maybeOptions;
      this.debugEnabled = maybeDebug ?? false;
      this.provider = maybeOptions?.provider;
    } else {
      this.stackId = `stack-${nanoid()}`;
      this.defaultOptions = idOrOptions;
      this.debugEnabled = false;
      this.provider = idOrOptions?.provider;
    }
  }

  private log(message: string, data?: any): void {
    if (this.debugEnabled) {
      if (data !== undefined) {
        console.log(`[NavigationStack] ${message}`, data);
      } else {
        console.log(`[NavigationStack] ${message}`);
      }
    }
  }

  public getId(): string {
    return this.stackId;
  }

  public addScreen(
    pathPattern: string,
    mixedComponent: MixedComponent | NavigationNode,
    options?: ScreenOptions
  ): NavigationStack {
    const { component, controller, childNode } =
      this.extractComponent(mixedComponent);

    const parsed = qs.parseUrl(pathPattern);
    const pathnamePattern = parsed.url || '/';
    const rawQuery = parsed.query || {};

    const isWildcardPath = pathnamePattern === '*';

    const queryPattern = this.buildQueryPattern(rawQuery);
    const baseSpecificity = this.computeBaseSpecificity(
      pathnamePattern,
      isWildcardPath,
      queryPattern
    );

    const routeId = `${this.stackId}-route-${this.routes.length}`;

    const pathMatcher = !isWildcardPath
      ? pathMatchFactory(pathnamePattern)
      : null;

    const matchPath = (p: string) => {
      if (isWildcardPath) {
        return { params: {} };
      }
      const result = pathMatcher ? pathMatcher(p) : null;
      return result ? { params: (result as any).params ?? {} } : false;
    };

    const builtRoute: BuiltRoute = {
      routeId,
      path: pathPattern,
      pathnamePattern,
      isWildcardPath,
      queryPattern,
      baseSpecificity,
      matchPath,
      component,
      controller,
      options,
      childNode,
    };

    this.routes.push(builtRoute);

    this.log('addRoute', {
      stackId: this.stackId,
      routeId,
      path: pathPattern,
      pathnamePattern,
      isWildcardPath,
      queryPattern,
      baseSpecificity,
    });

    return this;
  }

  public addModal(
    path: string,
    mixedComponent: MixedComponent | NavigationNode,
    options?: ScreenOptions
  ): NavigationStack {
    return this.addScreen(path, mixedComponent, {
      ...options,
      stackPresentation: 'modal',
    });
  }

  public addSheet(
    path: string,
    mixedComponent: MixedComponent | NavigationNode,
    options?: ScreenOptions
  ): NavigationStack {
    return this.addScreen(path, mixedComponent, {
      ...options,
      stackPresentation: 'sheet',
    });
  }

  public addStack(
    prefixOrStack: string | NavigationStack,
    maybeStack?: NavigationStack
  ): NavigationStack {
    const hasExplicitPrefix = typeof prefixOrStack === 'string';
    const prefixRaw = hasExplicitPrefix ? prefixOrStack : '';
    const stack = hasExplicitPrefix ? maybeStack : prefixOrStack;

    if (!stack) {
      throw new Error('NavigationStack.addStack: child stack is required');
    }

    const prefix = this.normalizePrefix(prefixRaw ?? '');

    this.children.push({ prefix, node: stack });

    this.log('addStack', {
      stackId: this.stackId,
      childId: stack.getId(),
      prefix,
    });

    return this;
  }

  public getChildren(): ChildNode[] {
    return this.children.slice();
  }

  public getRoutes(): BuiltRoute[] {
    return this.routes.slice();
  }

  public getFirstRoute(): BuiltRoute | undefined {
    return this.routes[0];
  }

  public getDefaultOptions(): ScreenOptions | undefined {
    return this.defaultOptions;
  }

  public getNodeRoutes(): BuiltRoute[] {
    return this.getRoutes();
  }

  public getNodeChildren(): ChildNode[] {
    return this.children.slice();
  }

  public getRenderer(): React.ComponentType<any> {
    // eslint-disable-next-line consistent-this
    const stackInstance = this;
    const stackId = stackInstance.getId();
    const provider = this.provider;

    return function NavigationStackRenderer(props: { appearance?: any }) {
      const stackElement = React.createElement(StackRenderer, {
        stackId: stackId,
        appearance: props.appearance,
      });

      if (provider) {
        return React.createElement(provider, null, stackElement);
      }

      return stackElement;
    };
  }

  public seed?(): {
    routeId: string;
    params?: Record<string, unknown>;
    path: string;
    stackId?: string;
  } | null {
    const first = this.getFirstRoute();
    if (!first) return null;
    return {
      routeId: first.routeId,
      params: {},
      path: first.path,
      stackId: this.stackId,
    };
  }

  private extractComponent(component: MixedComponent | NavigationNode) {
    if (this.isNavigationNode(component)) {
      return {
        controller: undefined,
        component: component.getRenderer(),
        childNode: component,
      };
    }

    const componentWithController = component as ComponentWithController & {
      childNode?: NavigationNode;
    };
    if (componentWithController?.component) {
      return {
        controller: componentWithController.controller,
        component: componentWithController.component,
        childNode: componentWithController.childNode,
      };
    }

    return {
      component: component as React.ComponentType<any>,
      controller: undefined,
      childNode: undefined,
    };
  }

  private isNavigationNode(obj: any): obj is NavigationNode {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof (obj as NavigationNode).getNodeRoutes === 'function' &&
      typeof (obj as NavigationNode).getNodeChildren === 'function' &&
      typeof (obj as NavigationNode).getRenderer === 'function'
    );
  }

  private buildQueryPattern(
    rawQuery: Record<string, unknown>
  ): QueryPattern | null {
    const patternEntries: [string, QueryToken][] = [];

    for (const [key, value] of Object.entries(rawQuery)) {
      if (typeof value !== 'string') {
        continue;
      }

      if (value.startsWith(':') && value.length > 1) {
        patternEntries.push([key, { type: 'param', name: value.slice(1) }]);
      } else {
        patternEntries.push([key, { type: 'const', value }]);
      }
    }

    if (!patternEntries.length) return null;

    return Object.fromEntries(patternEntries);
  }

  private computeBaseSpecificity(
    pathnamePattern: string,
    isWildcardPath: boolean,
    queryPattern: QueryPattern | null
  ): number {
    let pathScore = 0;

    if (!isWildcardPath) {
      const segments = pathnamePattern.split('/').filter(Boolean);
      for (const seg of segments) {
        if (seg.startsWith(':')) {
          pathScore += 1;
        } else {
          pathScore += 2;
        }
      }
    } else {
      pathScore = 0;
    }

    let queryScore = 0;
    if (queryPattern) {
      for (const token of Object.values(queryPattern)) {
        if (token.type === 'const') {
          queryScore += 2;
        } else {
          queryScore += 1;
        }
      }
    }

    return pathScore + queryScore;
  }

  private normalizePrefix(input: string): string {
    if (!input || input === '/') {
      return '';
    }

    let normalized = input.startsWith('/') ? input : `/${input}`;
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }
}

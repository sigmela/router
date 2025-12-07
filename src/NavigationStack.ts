import type { ScreenOptions, QueryPattern, QueryToken } from './types';
import { nanoid } from 'nanoid/non-secure';
import { match as pathMatchFactory } from 'path-to-regexp';
import qs from 'query-string';
import {
  type ComponentWithController,
  type MixedComponent,
} from './createController';

type BuiltRoute = {
  routeId: string;
  path: string;
  pathnamePattern: string;
  isWildcardPath: boolean;
  queryPattern: QueryPattern | null;
  baseSpecificity: number;
  matchPath: (path: string) => false | { params: Record<string, any> };
  component: React.ComponentType<any>;
  controller?: ComponentWithController['controller'];
  options?: ScreenOptions;
};

export class NavigationStack {
  private readonly stackId: string;
  private readonly routes: BuiltRoute[] = [];
  private readonly defaultOptions: ScreenOptions | undefined;
  private readonly debugEnabled: boolean = false;

  constructor();
  constructor(id: string);
  constructor(defaultOptions: ScreenOptions);
  constructor(id: string, defaultOptions: ScreenOptions);
  constructor(id: string, defaultOptions: ScreenOptions, debug: boolean);
  constructor(
    idOrOptions?: string | ScreenOptions,
    maybeOptions?: ScreenOptions,
    maybeDebug?: boolean
  ) {
    if (typeof idOrOptions === 'string') {
      this.stackId = idOrOptions ?? `stack-${nanoid()}`;
      this.defaultOptions = maybeOptions;
      this.debugEnabled = maybeDebug ?? false;
    } else {
      this.stackId = `stack-${nanoid()}`;
      this.defaultOptions = idOrOptions;
      this.debugEnabled = false;
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
    mixedComponent: MixedComponent,
    options?: ScreenOptions
  ): NavigationStack {
    const { component, controller } = this.extractComponent(mixedComponent);

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
    mixedComponent: MixedComponent,
    options?: ScreenOptions
  ): NavigationStack {
    return this.addScreen(path, mixedComponent, {
      ...options,
      stackPresentation: 'modal',
    });
  }

  public addSheet(
    path: string,
    mixedComponent: MixedComponent,
    options?: ScreenOptions
  ): NavigationStack {
    return this.addScreen(path, mixedComponent, {
      ...options,
      stackPresentation: 'sheet',
    });
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

  private extractComponent(component: MixedComponent) {
    const componentWithController = component as ComponentWithController;
    if (componentWithController?.component) {
      return {
        controller: componentWithController.controller,
        component: componentWithController.component,
      };
    }

    return {
      component: component as React.ComponentType<any>,
      controller: undefined,
    };
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
}

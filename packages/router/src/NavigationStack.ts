import type { ScreenOptions } from './types';
import { nanoid } from 'nanoid/non-secure';
import { match } from 'path-to-regexp';

type BuiltRoute = {
  routeId: string;
  path: string;
  match: (path: string) => false | { params: Record<string, any> };
  component: React.ComponentType<any>;
  options?: ScreenOptions; // per-screen options only (no stack defaults merged)
};

export class NavigationStack {
  private readonly stackId: string;
  private readonly routes: BuiltRoute[] = [];
  private readonly defaultOptions: ScreenOptions | undefined;

  // Overloads
  constructor();
  constructor(id: string);
  constructor(defaultOptions: ScreenOptions);
  constructor(id: string, defaultOptions: ScreenOptions);
  constructor(idOrOptions?: string | ScreenOptions, maybeOptions?: ScreenOptions) {
    if (typeof idOrOptions === 'string') {
      this.stackId = idOrOptions ?? `stack-${nanoid()}`;
      this.defaultOptions = maybeOptions;
    } else {
      this.stackId = `stack-${nanoid()}`;
      this.defaultOptions = idOrOptions;
    }
  }

  public getId(): string {
    return this.stackId;
  }

  public addScreen(
    path: string,
    screen: React.ComponentType<any>,
    options?: ScreenOptions,
  ): NavigationStack {
    const routeId = `${this.stackId}-route-${this.routes.length}`;
    const matcher = match(path);

    this.routes.push({
      routeId,
      path,
      match: (p: string) => {
        const result = matcher(p);
        return result ? { params: (result as any).params ?? {} } : false;
      },
      component: screen,
      options,
    });

    return this;
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
}

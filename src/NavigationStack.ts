import type { ScreenOptions } from './types';
import { nanoid } from 'nanoid/non-secure';
import { match } from 'path-to-regexp';
import {
  type ComponentWithController,
  type MixedComponent,
} from './createController';

type BuiltRoute = {
  routeId: string;
  path: string;
  match: (path: string) => false | { params: Record<string, any> };
  component: React.ComponentType<any>;
  controller?: ComponentWithController['controller'];
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
  constructor(
    idOrOptions?: string | ScreenOptions,
    maybeOptions?: ScreenOptions
  ) {
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
    mixedComponent: MixedComponent,
    options?: ScreenOptions
  ): NavigationStack {
    const { component, controller } = this.extractComponent(mixedComponent);
    const routeId = `${this.stackId}-route-${this.routes.length}`;
    const matcher = match(path);

    this.routes.push({
      routeId,
      path,
      match: (p: string) => {
        const result = matcher(p);
        return result ? { params: (result as any).params ?? {} } : false;
      },
      component,
      controller,
      options,
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
}

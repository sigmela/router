type ControllerPresenter<P = any> = (passProps?: P) => void;

type ControllerInput<TParams, TQuery> = {
  params: TParams;
  query: TQuery;
};

export type Controller<
  TParams = Record<string, unknown>,
  TQuery = Record<string, unknown>,
> = (
  input: ControllerInput<TParams, TQuery>,
  present: ControllerPresenter
) => void;

export type ComponentWithController = {
  controller?: Controller<any, any>;
  component: React.ComponentType<any>;
  childNode?: import('./navigationNode').NavigationNode;
};

export type MixedComponent = ComponentWithController | React.ComponentType<any>;

export function createController<TParams, TQuery = Record<string, unknown>>(
  controller: Controller<TParams, TQuery>
) {
  return controller;
}

import type { ColorValue, StyleProp, ViewStyle, TextStyle } from 'react-native';
import type {
  BottomTabsScreenProps,
  ScreenProps as RNSScreenProps,
  ScreenStackHeaderConfigProps,
  TabBarItemLabelVisibilityMode,
  TabBarMinimizeBehavior,
} from 'react-native-screens';

export type StackPresentationTypes =
  | 'push'
  | 'modal'
  | 'modalRight'
  | 'transparentModal'
  | 'containedModal'
  | 'containedTransparentModal'
  | 'fullScreenModal'
  | 'formSheet'
  | 'pageSheet'
  | 'sheet';

/**
 * Presentations that behave like modals (overlay on top of content).
 */
export const MODAL_LIKE_PRESENTATIONS: ReadonlySet<StackPresentationTypes> =
  new Set([
    'modal',
    'modalRight',
    'transparentModal',
    'containedModal',
    'containedTransparentModal',
    'fullScreenModal',
    'formSheet',
    'pageSheet',
    'sheet',
  ]);

/**
 * Check if a presentation type is modal-like (renders as overlay).
 */
export function isModalLikePresentation(
  presentation: StackPresentationTypes | undefined
): boolean {
  return (
    presentation !== undefined && MODAL_LIKE_PRESENTATIONS.has(presentation)
  );
}

export type TabItem = Omit<BottomTabsScreenProps, 'isFocused' | 'children'>;

export type NavigationState<Route extends TabItem> = {
  index: number;
  routes: Route[];
};

export type TabBarIcon = { sfSymbolName?: string } | string;

export type ScreenOptions = Partial<
  Omit<RNSScreenProps, 'stackPresentation'>
> & {
  header?: ScreenStackHeaderConfigProps;
  stackPresentation?: StackPresentationTypes;
  convertModalToSheetForAndroid?: boolean;
  syncWithUrl?: boolean;

  tabBarIcon?: TabBarIcon;

  animated?: boolean;

  /**
   * Allows pushing multiple instances of the same screen (same routeId) onto a stack.
   *
   * By default, Router.navigate() will behave like "replace" when targeting the currently
   * active routeId in the same stack (i.e. treat it as "same screen, new data").
   * Set this to true to force "push" even when navigating to the active routeId.
   */
  allowMultipleInstances?: boolean;

  /**
   * Allows Router.goBack() to pop the last (root) screen of a stack.
   * Useful for secondary stacks in split-view / overlays.
   */
  allowRootPop?: boolean;

  /**
   * Maximum width for modal presentation on web (in pixels).
   * Only applies to modal-like presentations on web platform.
   */
  maxWidth?: number;
};

export type HistoryItem = {
  key: string;
  routeId: string;
  component: React.ComponentType<any>;
  options?: ScreenOptions;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  passProps?: any;
  stackId?: string;
  pattern?: string;
  path?: string;
};

export type ActiveRoute = {
  routeId: string;
  stackId?: string;
  tabIndex?: number;
  path?: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
} | null;

export type QueryToken =
  | { type: 'const'; value: string }
  | { type: 'param'; name: string };

export type QueryPattern = Record<string, QueryToken>;

export type CompiledRoute = {
  routeId: string;

  path: string;

  pathnamePattern: string;

  isWildcardPath: boolean;

  queryPattern: QueryPattern | null;

  baseSpecificity: number;

  matchPath: (path: string) => false | { params: Record<string, any> };

  component: React.ComponentType<any>;
  controller?: import('./createController').Controller<any, any>;
  options?: ScreenOptions;
  stackId?: string;

  childNode?: import('./navigationNode').NavigationNode;
};

export type TabBarConfig = {
  tabBarMinimizeBehavior?: TabBarMinimizeBehavior;
};

export type SheetAppearance = {
  androidFullScreenTopInset?: number;
  backgroundColor?: ColorValue;
  cornerRadius?: number;
};

export interface NavigationAppearance {
  tabBar?: {
    backgroundColor?: ColorValue;
    badgeBackgroundColor?: ColorValue;
    iconColor?: ColorValue;
    iconColorActive?: ColorValue;
    androidActiveIndicatorEnabled?: boolean;
    androidActiveIndicatorColor?: ColorValue;
    androidRippleColor?: ColorValue;
    labelVisibilityMode?: TabBarItemLabelVisibilityMode;
    iOSShadowColor?: ColorValue;
    title: {
      fontFamily?: TextStyle['fontFamily'];
      fontSize?: TextStyle['fontSize'];
      fontWeight?: TextStyle['fontWeight'];
      fontStyle?: TextStyle['fontStyle'];
      color?: TextStyle['color'];
      activeColor?: TextStyle['color'];
    };
  };
  screen?: StyleProp<ViewStyle>;
  header?: ScreenStackHeaderConfigProps;
  sheet?: SheetAppearance;
}

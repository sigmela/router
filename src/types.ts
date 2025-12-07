// types.ts
import type { ColorValue, StyleProp, ViewStyle, TextStyle } from 'react-native';
import type {
  BottomTabsScreenProps,
  ScreenProps as RNSScreenProps,
  ScreenStackHeaderConfigProps,
  TabBarItemLabelVisibilityMode,
  TabBarMinimizeBehavior,
} from 'react-native-screens';

// =====================
// Core enums / base types
// =====================

export type StackPresentationTypes =
  | 'push'
  | 'modal'
  | 'transparentModal'
  | 'containedModal'
  | 'containedTransparentModal'
  | 'fullScreenModal'
  | 'formSheet'
  | 'pageSheet'
  | 'sheet';

export type TabItem = Omit<BottomTabsScreenProps, 'isFocused' | 'children'>;

export type NavigationState<Route extends TabItem> = {
  index: number;
  routes: Route[];
};

// Navigation core types
export type Scope = 'global' | 'tab' | 'root';

// Map ScreenOptions to native ScreenStackItem props
export type TabBarIcon = { sfSymbolName?: string } | string;

export type ScreenOptions = Partial<
  Omit<RNSScreenProps, 'stackPresentation'>
> & {
  header?: ScreenStackHeaderConfigProps;
  stackPresentation?: StackPresentationTypes;
  convertModalToSheetForAndroid?: boolean;
  syncWithUrl?: boolean; // default: true
  /**
   * Tab bar icon source for this route (used on web renderer, optional on native).
   */
  tabBarIcon?: TabBarIcon;
};

export type HistoryItem = {
  key: string;
  scope: Scope;
  routeId: string;
  component: React.ComponentType<any>;
  options?: ScreenOptions;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  passProps?: any; // Props passed from controller to component
  tabIndex?: number;
  stackId?: string;
  pattern?: string;
  path?: string;
};

export type VisibleRoute = {
  routeId: string;
  stackId?: string;
  tabIndex?: number;
  scope: Scope;
  path?: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
} | null;

// =====================
// Query pattern support
// =====================

export type QueryToken =
  | { type: 'const'; value: string }
  | { type: 'param'; name: string };

export type QueryPattern = Record<string, QueryToken>;

// =====================
// CompiledRoute with path + query pattern
// =====================

export type CompiledRoute = {
  routeId: string;
  scope: Scope;

  /**
   * Original pattern string as passed to NavigationStack (may include query),
   * e.g. "/auth", "/auth?kind=email", "*?modal=promo"
   */
  path: string;

  /**
   * Pure pathname pattern for path matching, e.g. "/auth" or "*"
   */
  pathnamePattern: string;

  /**
   * Whether this route is a wildcard by path ("*").
   * Wildcard path matches any pathname.
   */
  isWildcardPath: boolean;

  /**
   * Query match pattern (parsed from "?kind=email", "?kind=:kind", etc).
   * Null if no query pattern is specified.
   */
  queryPattern: QueryPattern | null;

  /**
   * Base specificity score (precomputed from path + query pattern).
   * Used to pick the "most specific" route among multiple matches.
   */
  baseSpecificity: number;

  /**
   * Path matcher (only for path, no query here).
   * Returns params if matched, false otherwise.
   */
  matchPath: (path: string) => false | { params: Record<string, any> };

  component: React.ComponentType<any>;
  controller?: import('./createController').Controller<any, any>;
  options?: ScreenOptions;
  tabIndex?: number;
  stackId?: string;
};

// =====================
// Tab bar / appearance
// =====================

export type TabBarConfig = {
  /**
   * @summary Specifies the minimize behavior for the tab bar.
   *
   * Available starting from iOS 26.
   *
   * The following values are currently supported:
   *
   * - `automatic` - resolves to the system default minimize behavior
   * - `never` - the tab bar does not minimize
   * - `onScrollDown` - the tab bar minimizes when scrolling down and
   *   expands when scrolling back up
   * - `onScrollUp` - the tab bar minimizes when scrolling up and expands
   *   when scrolling back down
   *
   * The supported values correspond to the official UIKit documentation:
   * @see {@link https://developer.apple.com/documentation/uikit/uitabbarcontroller/minimizebehavior|UITabBarController.MinimizeBehavior}
   *
   * @default Defaults to `automatic`.
   *
   * @platform ios
   * @supported iOS 26 or higher
   */
  tabBarMinimizeBehavior?: TabBarMinimizeBehavior;
  // #endregion iOS-only appearance
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

import type { ColorValue, StyleProp, ViewStyle, TextStyle } from 'react-native';
import type {
  BottomTabsScreenAppearance,
  BottomTabsScreenProps,
  ScreenProps as RNSScreenProps,
  ScreenStackHeaderConfigProps,
  TabBarItemLabelVisibilityMode,
  TabBarMinimizeBehavior,
} from 'react-native-screens';

export type TabItem = Omit<BottomTabsScreenProps, 'isFocused' | 'children'>;

export type NavigationState<Route extends TabItem> = {
  index: number;
  routes: Route[];
};

// Navigation core types
export type Scope = 'global' | 'tab' | 'root';

// Map ScreenOptions to native ScreenStackItem props
export type TabBarIcon = { sfSymbolName?: string } | string;

export type ScreenOptions = Partial<RNSScreenProps> & {
  header?: ScreenStackHeaderConfigProps;
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

export type CompiledRoute = {
  routeId: string;
  scope: Scope;
  path: string;
  match: (path: string) => false | { params: Record<string, any> };
  component: React.ComponentType<any>;
  controller?: import('./createController').Controller<any, any>;
  options?: ScreenOptions;
  tabIndex?: number;
  stackId?: string;
};

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

// BottomTabsScreenAppearance
export interface NavigationAppearance {
  tabBar?: {
    // #region iOS-only appearance
    /**
     * @summary Specifies the standard tab bar appearance.
     *
     * Allows to customize the appearance depending on the tab bar item layout (stacked,
     * inline, compact inline) and state (normal, selected, focused, disabled).
     *
     * @platform ios
     */
    standardAppearance?: BottomTabsScreenAppearance;
    /**
     * @summary Specifies the tab bar appearace when edge of scrollable content aligns
     * with the edge of the tab bar.
     *
     * Allows to customize the appearance depending on the tab bar item layout (stacked,
     * inline, compact inline) and state (normal, selected, focused, disabled).
     *
     * If this property is `undefined`, UIKit uses `standardAppearance`, modified to
     * have a transparent background.
     *
     * @platform ios
     */
    scrollEdgeAppearance?: BottomTabsScreenAppearance;

    // #endregion Events

    // #region Android-only appearance
    /**
     * @summary Specifies the background color for the entire tab bar.
     *
     * @platform android
     */
    backgroundColor?: ColorValue;
    tabBarItemStyle?: {
      /**
       * @summary Specifies the font family used for the title of each tab bar item.
       *
       * @platform android
       */
      titleFontFamily?: TextStyle['fontFamily'];
      /**
       * @summary Specifies the font size used for the title of each tab bar item.
       *
       * The size is represented in scale-independent pixels (sp).
       *
       * @platform android
       */
      titleFontSize?: TextStyle['fontSize'];
      /**
       * @summary Specifies the font size used for the title of each tab bar item in active state.
       *
       * The size is represented in scale-independent pixels (sp).
       *
       * @platform android
       */
      titleFontSizeActive?: TextStyle['fontSize'];
      /**
       * @summary Specifies the font weight used for the title of each tab bar item.
       *
       * @platform android
       */
      titleFontWeight?: TextStyle['fontWeight'];
      /**
       * @summary Specifies the font style used for the title of each tab bar item.
       *
       * @platform android
       */
      titleFontStyle?: TextStyle['fontStyle'];
      /**
       * @summary Specifies the font color used for the title of each tab bar item.
       *
       * @platform android
       */
      titleFontColor?: TextStyle['color'];
      /**
       * @summary Specifies the font color used for the title of each tab bar item in active state.
       *
       * If not provided, `tabBarItemTitleFontColor` is used.
       *
       * @platform android
       */
      titleFontColorActive?: TextStyle['color'];
      /**
       * @summary Specifies the icon color for each tab bar item.
       *
       * @platform android
       */
      iconColor?: ColorValue;
      /**
       * @summary Specifies the icon color for each tab bar item in active state.
       *
       * If not provided, `tabBarItemIconColor` is used.
       *
       * @platform android
       */
      iconColorActive?: ColorValue;
      /**
       * @summary Specifies the background color of the active indicator.
       *
       * @platform android
       */
      activeIndicatorColor?: ColorValue;
      /**
       * @summary Specifies if the active indicator should be used.
       *
       * @default true
       *
       * @platform android
       */
      activeIndicatorEnabled?: boolean;
      /**
       * @summary Specifies the color of each tab bar item's ripple effect.
       *
       * @platform android
       */
      rippleColor?: ColorValue;
      /**
       * @summary Specifies the label visibility mode.
       *
       * The label visibility mode defines when the labels of each item bar should be displayed.
       *
       * The following values are available:
       * - `auto` - the label behaves as in “labeled” mode when there are 3 items or less, or as in “selected” mode when there are 4 items or more
       * - `selected` - the label is only shown on the selected navigation item
       * - `labeled` - the label is shown on all navigation items
       * - `unlabeled` - the label is hidden for all navigation items
       *
       * The supported values correspond to the official Material Components documentation:
       * @see {@link https://github.com/material-components/material-components-android/blob/master/docs/components/BottomNavigation.md#making-navigation-bar-accessible|Material Components documentation}
       *
       * @default auto
       * @platform android
       */
      labelVisibilityMode?: TabBarItemLabelVisibilityMode;
    };

    // #endregion Android-only appearance

    // #region iOS-only appearance
    /**
     * @summary Specifies the color used for selected tab's text and icon color.
     *
     * Starting from iOS 26, it also impacts glow of Liquid Glass tab
     * selection view.
     *
     * `tabBarItemTitleFontColor` and `tabBarItemIconColor` defined on
     * BottomTabsScreen component override this color.
     *
     * @platform ios
     */
    tintColor?: ColorValue;
    // #region Experimental support
    /**
     * @summary Experimental prop for changing container control.
     *
     * If set to true, tab screen changes need to be handled by JS using
     * onNativeFocusChange callback (controlled/programatically-driven).
     *
     * If set to false, tab screen change will not be prevented by the
     * native side (managed/natively-driven).
     *
     * On iOS, some features are not fully implemented for managed tabs
     * (e.g. overrideScrollViewContentInsetAdjustmentBehavior).
     *
     * On Android, only controlled tabs are currently supported.
     *
     * @default Defaults to `false`.
     *
     * @platform android, ios
     */
    experimentalControlNavigationStateInJS?: boolean;
    // #endregion Experimental support
  };
  screenStyle?: StyleProp<ViewStyle>;
  /**
   * Global header appearance applied to all screens with visible headers.
   * Per-screen header options override these.
   */
  header?: ScreenStackHeaderConfigProps;
}

import type { ImageSourcePropType, ColorValue, StyleProp, ViewStyle } from 'react-native';
import type { ScreenProps as RNSScreenProps, ScreenStackHeaderConfigProps } from 'react-native-screens';
import type { SFSymbol } from 'sf-symbols-typescript';

export type IconSource = string | ImageSourcePropType;

export type AppleIcon = { sfSymbol: SFSymbol };

export type TabRole = 'search';

export type BaseRoute = {
  key: string;
  title?: string;
  badge?: string;
  lazy?: boolean;
  focusedIcon?: ImageSourcePropType | AppleIcon;
  unfocusedIcon?: ImageSourcePropType | AppleIcon;
  activeTintColor?: string;
  hidden?: boolean;
  testID?: string;
  role?: TabRole;
  freezeOnBlur?: boolean;
};

export type NavigationState<Route extends BaseRoute> = {
  index: number;
  routes: Route[];
};

// Navigation core types
export type Scope = 'global' | 'tab' | 'root';

// Map ScreenOptions to native ScreenStackItem props  
export type ScreenOptions = Partial<RNSScreenProps> & {
  header?: ScreenStackHeaderConfigProps;
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

export interface NavigationAppearance {
  tabBar?: {
    labeled?: boolean;
    translucent?: boolean;
    tabBarActiveTintColor?: ColorValue;
    tabBarInactiveTintColor?: ColorValue;
    tabBarStyle?: {
      backgroundColor?: ColorValue;
    };
    tabBarItemStyle?: {
      fontFamily?: string;
      fontWeight?: string;
      fontSize?: number;
    };
    rippleColor?: ColorValue;
    activeIndicatorColor?: ColorValue;
    sceneStyle?: StyleProp<ViewStyle>;
  };
  screenStyle?: StyleProp<ViewStyle>;
}

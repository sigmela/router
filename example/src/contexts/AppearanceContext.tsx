import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { NavigationAppearance } from '@sigmela/router';

interface AppearanceContextType {
  appearance: NavigationAppearance;
  updateAppearance: (newAppearance: Partial<NavigationAppearance>) => void;
  toggleDarkMode: () => void;
  toggleLargeText: () => void;
  isDarkMode: boolean;
  isLargeText: boolean;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(
  undefined
);

interface AppearanceProviderProps {
  children: ReactNode;
}

export const AppearanceProvider: React.FC<AppearanceProviderProps> = ({
  children,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLargeText, setIsLargeText] = useState(false);

  type ThemeColors = {
    tabBarBackground: string;
    iconColor: string;
    iconColorActive: string;
    titleColor: string;
    screenBackground: string;
    headerBackground: string;
    androidActiveIndicatorColor: string;
  };

  const LightTheme: ThemeColors = {
    tabBarBackground: '#FFFFFF',
    iconColor: '#999999',
    iconColorActive: '#007AFF',
    titleColor: '#999999',
    screenBackground: '#f5f5f5',
    headerBackground: '#f5f5f5',
    androidActiveIndicatorColor: '#f5f5f5',
  };

  const DarkTheme: ThemeColors = {
    tabBarBackground: '#10161F',
    iconColor: '#8E8E93',
    iconColorActive: '#0A84FF',
    titleColor: '#0A84FF',
    screenBackground: '#10161F',
    headerBackground: '#10161F',
    androidActiveIndicatorColor: '#17171A',
  };

  const getAppearance = (): NavigationAppearance => {
    const theme = isDarkMode ? DarkTheme : LightTheme;

    return {
      tabBar: {
        labelVisibilityMode: 'labeled',
        // backgroundColor: theme.tabBarBackground,
        iconColor: theme.iconColor,
        iconColorActive: theme.iconColorActive,
        // androidActiveIndicatorColor: theme.androidActiveIndicatorColor,
        iOSShadowColor: 'transparent',
        title: {
          color: theme.iconColor,
          activeColor: theme.iconColorActive,
          fontSize: isLargeText ? 22 : 12,
          fontWeight: isLargeText ? '700' : '600',
        },
      },
      screen: {
        backgroundColor: theme.screenBackground,
      },
      header: {
        backgroundColor: theme.headerBackground,
      },
      sheet: {
        backgroundColor: theme.screenBackground,
        cornerRadius: 18,
      },
    };
  };

  const [appearance, setAppearance] =
    useState<NavigationAppearance>(getAppearance());

  const updateAppearance = (newAppearance: Partial<NavigationAppearance>) => {
    setAppearance((prev: NavigationAppearance) => {
      const hasAnyTabBar = Boolean(prev.tabBar || newAppearance.tabBar);

      const mergedTabBar = hasAnyTabBar
        ? {
            ...(prev.tabBar ?? {}),
            ...(newAppearance.tabBar ?? {}),
            title: {
              color:
                newAppearance.tabBar?.title?.color ??
                prev.tabBar?.title?.color ??
                (isDarkMode ? DarkTheme.titleColor : LightTheme.titleColor),
              fontFamily:
                newAppearance.tabBar?.title?.fontFamily ??
                prev.tabBar?.title?.fontFamily,
              fontSize:
                newAppearance.tabBar?.title?.fontSize ??
                prev.tabBar?.title?.fontSize,
              fontWeight:
                newAppearance.tabBar?.title?.fontWeight ??
                prev.tabBar?.title?.fontWeight,
              fontStyle:
                newAppearance.tabBar?.title?.fontStyle ??
                prev.tabBar?.title?.fontStyle,
            },
          }
        : undefined;

      const next: NavigationAppearance = {
        ...prev,
        ...newAppearance,
        tabBar: mergedTabBar,
      } as NavigationAppearance;

      return next;
    });
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newValue = !prev;
      const newAppearance = getAppearance();
      setAppearance(newAppearance);
      return newValue;
    });
  };

  const toggleLargeText = () => {
    setIsLargeText((prev) => {
      const newValue = !prev;
      const newAppearance = getAppearance();
      setAppearance(newAppearance);
      return newValue;
    });
  };

  // Update appearance when state changes
  React.useEffect(() => {
    setAppearance(getAppearance());

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDarkMode, isLargeText]);

  const value: AppearanceContextType = {
    appearance,
    updateAppearance,
    toggleDarkMode,
    toggleLargeText,
    isDarkMode,
    isLargeText,
  };

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = (): AppearanceContextType => {
  const context = useContext(AppearanceContext);
  if (context === undefined) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
};

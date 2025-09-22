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

  const getAppearance = (): NavigationAppearance => ({
    tabBar: {
      backgroundColor: isDarkMode ? '#10161F' : '#FFFFFF',
      tintColor: isDarkMode ? '#0A84FF' : '#007AFF',
      tabBarItemStyle: {
        titleFontColor: isDarkMode ? '#8E8E93' : '#999999',
        titleFontSize: isLargeText ? 22 : 12,
        titleFontWeight: isLargeText ? '700' : '600',
      },

      standardAppearance: {
        tabBarBackgroundColor: isDarkMode ? '#10161F' : '#FFFFFF',
        tabBarShadowColor: 'transparent',
      },
      scrollEdgeAppearance: {
        tabBarBackgroundColor: isDarkMode ? '#10161F' : '#FFFFFF',
        tabBarShadowColor: 'transparent',
      },
    },
    screenStyle: {
      backgroundColor: isDarkMode ? '#10161F' : '#FFFFFF',
    },
  });

  const [appearance, setAppearance] =
    useState<NavigationAppearance>(getAppearance());

  const updateAppearance = (newAppearance: Partial<NavigationAppearance>) => {
    setAppearance((prev: NavigationAppearance) => ({
      ...prev,
      ...newAppearance,
      tabBar: {
        ...prev.tabBar,
        ...newAppearance.tabBar,
      },
    }));
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

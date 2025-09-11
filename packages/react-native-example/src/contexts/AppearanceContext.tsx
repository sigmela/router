import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { NavigationAppearance } from '@sigmela/router';

interface AppearanceContextType {
  appearance: NavigationAppearance;
  updateAppearance: (newAppearance: Partial<NavigationAppearance>) => void;
  toggleDarkMode: () => void;
  toggleLargeText: () => void;
  isDarkMode: boolean;
  isLargeText: boolean;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

interface AppearanceProviderProps {
  children: ReactNode;
}

export const AppearanceProvider: React.FC<AppearanceProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLargeText, setIsLargeText] = useState(false);

  const getAppearance = (): NavigationAppearance => ({
    tabBar: {
      labeled: true,
      translucent: false,
      tabBarActiveTintColor: isDarkMode ? '#0A84FF' : '#007AFF',
      tabBarInactiveTintColor: isDarkMode ? '#8E8E93' : '#999999',
      tabBarStyle: {
        backgroundColor: isDarkMode ? '#1c1c1e' : '#ffffff',
      },
      tabBarItemStyle: {
        fontSize: isLargeText ? 22 : 12,
        fontWeight: isLargeText ? '700' : '600',
      },
      sceneStyle: {
        backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f8f8',
        paddingHorizontal: 16,
      },
    },
    screenStyle: {
      backgroundColor: isDarkMode ? '#000000' : '#ffffff',
    },
  });

  const [appearance, setAppearance] = useState<NavigationAppearance>(getAppearance());

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
    setIsDarkMode(prev => {
      const newValue = !prev;
      const newAppearance = getAppearance();
      setAppearance(newAppearance);
      return newValue;
    });
  };

  const toggleLargeText = () => {
    setIsLargeText(prev => {
      const newValue = !prev;
      const newAppearance = getAppearance();
      setAppearance(newAppearance);
      return newValue;
    });
  };

  // Update appearance when state changes
  React.useEffect(() => {
    setAppearance(getAppearance());
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
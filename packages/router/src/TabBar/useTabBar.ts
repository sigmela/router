import { useContext } from 'react';
import { TabBarContext } from './TabBarContext';

export const useTabBar = () => {
  const tabBar = useContext(TabBarContext);
  if (!tabBar) {
    throw new Error('useTabBar must be used within a TabBarProvider');
  }
  return tabBar;
};

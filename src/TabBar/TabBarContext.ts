import { createContext } from 'react';
import { TabBar } from './TabBar';

export const TabBarContext = createContext<TabBar | null>(null);

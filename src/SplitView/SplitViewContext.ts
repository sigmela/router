import { createContext } from 'react';
import type { SplitView } from './SplitView';

export const SplitViewContext = createContext<SplitView | null>(null);

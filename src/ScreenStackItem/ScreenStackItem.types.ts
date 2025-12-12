import type {
  HistoryItem,
  NavigationAppearance,
  ScreenOptions,
} from '../types';
import type { TransitionStatus } from 'react-transition-state';
import type { CSSProperties } from 'react';

export type ScreenStackItemPhase = 'active' | 'inactive' | 'exiting';

export interface ScreenStackItemProps {
  item: HistoryItem;
  stackId?: string;
  stackAnimation?: ScreenOptions['stackAnimation'];
  appearance?: NavigationAppearance;
  phase?: ScreenStackItemPhase;
  transitionStatus?: TransitionStatus;
  style?: CSSProperties;
}

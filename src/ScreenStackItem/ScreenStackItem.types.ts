import type {
  HistoryItem,
  NavigationAppearance,
  ScreenOptions,
} from '../types';

export type ScreenStackItemPhase = 'active' | 'exiting';

export interface ScreenStackItemProps {
  item: HistoryItem;
  stackId?: string;
  stackAnimation?: ScreenOptions['stackAnimation'];
  appearance?: NavigationAppearance;
  phase?: ScreenStackItemPhase;
}

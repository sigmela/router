import { useContext } from 'react';
import { SplitViewContext } from './SplitViewContext';

export const useSplitView = () => {
  const splitView = useContext(SplitViewContext);
  if (!splitView) {
    throw new Error('useSplitView must be used within a SplitViewProvider');
  }
  return splitView;
};

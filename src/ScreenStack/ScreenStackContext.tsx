import { createContext, useContext } from 'react';
import type { ScreenStackItemPhase } from '../ScreenStackItem/ScreenStackItem.types';
import type { TransitionStatus } from 'react-transition-state';

export type PresentationTypeClass =
  | 'push'
  | 'modal'
  | 'transparent-modal'
  | 'contained-modal'
  | 'contained-transparent-modal'
  | 'fullscreen-modal'
  | 'formsheet'
  | 'pagesheet'
  | 'sheet';

export type AnimationType =
  | 'push-enter'
  | 'push-exit'
  | 'push-background'
  | 'pop-enter'
  | 'pop-exit'
  | 'pop-background'
  | 'modal-enter'
  | 'modal-exit'
  | 'transparent-modal-enter'
  | 'transparent-modal-exit'
  | 'contained-modal-enter'
  | 'contained-modal-exit'
  | 'fullscreen-modal-enter'
  | 'fullscreen-modal-exit'
  | 'formsheet-enter'
  | 'formsheet-exit'
  | 'pagesheet-enter'
  | 'pagesheet-exit'
  | 'sheet-enter'
  | 'sheet-exit'
  | 'no-animate'
  | 'none';

export type ScreenStackItemState = {
  presentationType: PresentationTypeClass;
  animationType: AnimationType;
  phase: ScreenStackItemPhase;
  transitionStatus: TransitionStatus;
  zIndex: number;
};

export type ScreenStackItemsContextValue = {
  items: {
    [key: string]: ScreenStackItemState;
  };
};

export type ScreenStackAnimatingContextValue = boolean;

export const ScreenStackItemsContext =
  createContext<ScreenStackItemsContextValue | null>(null);

export const ScreenStackAnimatingContext =
  createContext<ScreenStackAnimatingContextValue>(false);

export type ScreenStackConfig = {
  /**
   * When false, the first screen pushed after the stack becomes empty will NOT animate
   * (treated as an initial render). Subsequent pushes/pops still animate normally.
   */
  animateFirstScreenAfterEmpty?: boolean;
};

export const ScreenStackConfigContext = createContext<ScreenStackConfig>({
  animateFirstScreenAfterEmpty: true,
});

export const useScreenStackConfig = () => {
  return useContext(ScreenStackConfigContext);
};

export const useScreenStackItemsContext = () => {
  const ctx = useContext(ScreenStackItemsContext);
  if (!ctx) {
    throw new Error(
      'useScreenStackItemsContext must be used within ScreenStack'
    );
  }
  return ctx;
};

export const useScreenStackAnimatingContext = () => {
  return useContext(ScreenStackAnimatingContext);
};

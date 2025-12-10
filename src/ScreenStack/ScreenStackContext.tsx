import { createContext, useContext } from 'react';
import type { ScreenStackItemPhase } from '../ScreenStackItem/ScreenStackItem.types';
import type { TransitionStatus } from 'react-transition-state';

// Стабильный класс типа presentation (для описания типа экрана)
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

// Динамический класс анимации
export type AnimationType =
  // Push/Pop анимации
  | 'push-enter' // Обычный экран входит при forward
  | 'push-exit' // Обычный экран выходит при forward (rare)
  | 'push-background' // Фоновый экран при forward (сдвиг влево)
  | 'pop-enter' // Обычный экран становится активным при back (возврат из -25%)
  | 'pop-exit' // Верхний экран уезжает при back
  | 'pop-background' // Фоновый экран при back
  // Modal анимации (разные типы)
  | 'modal-enter' // Модалка входит
  | 'modal-exit' // Модалка закрывается
  | 'transparent-modal-enter' // Прозрачная модалка входит
  | 'transparent-modal-exit' // Прозрачная модалка закрывается
  | 'contained-modal-enter' // Встроенная модалка входит
  | 'contained-modal-exit' // Встроенная модалка закрывается
  | 'fullscreen-modal-enter' // Полноэкранная модалка входит
  | 'fullscreen-modal-exit' // Полноэкранная модалка закрывается
  | 'formsheet-enter' // Form sheet входит
  | 'formsheet-exit' // Form sheet закрывается
  | 'pagesheet-enter' // Page sheet входит
  | 'pagesheet-exit' // Page sheet закрывается
  // Sheet анимации (особая анимация для веб)
  | 'sheet-enter' // Sheet входит (bottom sheet на вебе)
  | 'sheet-exit' // Sheet закрывается
  // Специальные
  | 'no-animate' // Без анимации (если screenOptions.animated === false)
  | 'none'; // Без анимации (initial mount)

export type ScreenStackItemState = {
  presentationType: PresentationTypeClass; // Стабильный класс типа экрана
  animationType: AnimationType; // Динамический класс анимации
  phase: ScreenStackItemPhase;
  transitionStatus: TransitionStatus;
  zIndex: number;
};

export type ScreenStackItemsContextValue = {
  items: {
    [key: string]: ScreenStackItemState;
  };
};

// Отдельный контекст для флага анимации (оптимизация производительности)
export type ScreenStackAnimatingContextValue = boolean;

// Контексты
export const ScreenStackItemsContext =
  createContext<ScreenStackItemsContextValue | null>(null);

export const ScreenStackAnimatingContext =
  createContext<ScreenStackAnimatingContextValue>(false);

// Hooks для использования контекстов
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

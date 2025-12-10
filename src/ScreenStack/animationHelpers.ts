import type { StackPresentationTypes } from '../types';
import type {
  PresentationTypeClass,
  AnimationType,
} from './ScreenStackContext';

/**
 * Получает стабильный класс типа presentation
 */
export function getPresentationTypeClass(
  presentation: StackPresentationTypes
): PresentationTypeClass {
  switch (presentation) {
    case 'push':
      return 'push';
    case 'modal':
      return 'modal';
    case 'transparentModal':
      return 'transparent-modal';
    case 'containedModal':
      return 'contained-modal';
    case 'containedTransparentModal':
      return 'contained-transparent-modal';
    case 'fullScreenModal':
      return 'fullscreen-modal';
    case 'formSheet':
      return 'formsheet';
    case 'pageSheet':
      return 'pagesheet';
    case 'sheet':
      return 'sheet';
    default:
      return 'push';
  }
}

/**
 * Получает динамический класс анимации для presentation типа
 */
export function getAnimationTypeForPresentation(
  presentation: StackPresentationTypes,
  isEntering: boolean,
  direction: 'forward' | 'back'
): string {
  const suffix = isEntering ? 'enter' : 'exit';
  const presentationClass = getPresentationTypeClass(presentation);

  // Для push используем направление в имени анимации
  if (presentation === 'push') {
    return direction === 'forward' ? `push-${suffix}` : `pop-${suffix}`;
  }

  // Для остальных используем стабильный класс типа + суффикс
  return `${presentationClass}-${suffix}`;
}

/**
 * Вычисляет тип анимации для элемента стека
 */
export function computeAnimationType(
  _key: string,
  isInStack: boolean,
  isTop: boolean,
  direction: 'forward' | 'back',
  presentation: StackPresentationTypes,
  isInitialPhase: boolean,
  animated: boolean = true
): AnimationType {
  // Если анимация отключена через screenOptions
  if (!animated) {
    return 'no-animate';
  }

  // Initial mount - без анимации
  if (isInitialPhase) {
    return 'none';
  }

  // isEntering вычисляем внутри - используется для определения типа анимации
  const isEntering = isInStack && isTop;

  // Modal/Sheet анимации (разные типы через getAnimationTypeForPresentation)
  const isModalLike = [
    'modal',
    'transparentModal',
    'containedModal',
    'containedTransparentModal',
    'fullScreenModal',
    'formSheet',
    'pageSheet',
    'sheet',
  ].includes(presentation);

  if (isModalLike) {
    if (!isInStack) {
      // Элемент выходит
      return getAnimationTypeForPresentation(
        presentation,
        false,
        direction
      ) as AnimationType;
    }
    if (isEntering) {
      // Элемент входит
      return getAnimationTypeForPresentation(
        presentation,
        true,
        direction
      ) as AnimationType;
    }
    // Фоновая модалка (не должно происходить, но для безопасности)
    return 'none';
  }

  // Push анимации (обычные экраны)
  if (!isInStack) {
    // Элемент выходит
    if (direction === 'forward') {
      return 'push-exit'; // Редкий случай
    } else {
      return 'pop-exit'; // Верхний экран уезжает вправо
    }
  }

  if (isTop) {
    // Верхний элемент
    if (direction === 'forward') {
      return 'push-enter'; // Въезжает справа (CSS через media query может отключить на desktop)
    } else {
      return 'pop-enter'; // Возвращается из -25% в 0
    }
  }

  // Фоновый элемент
  if (direction === 'forward') {
    return 'push-background'; // Сдвигается влево на -25%
  } else {
    // При pop фоновые элементы остаются на -25% (были сдвинуты при push)
    // Используем pop-background вместо none, чтобы сохранить позицию
    return 'pop-background';
  }
}

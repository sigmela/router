import type { StackPresentationTypes } from '../types';
import type {
  PresentationTypeClass,
  AnimationType,
} from './ScreenStackContext';

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

export function getAnimationTypeForPresentation(
  presentation: StackPresentationTypes,
  isEntering: boolean,
  direction: 'forward' | 'back'
): string {
  const suffix = isEntering ? 'enter' : 'exit';
  const presentationClass = getPresentationTypeClass(presentation);

  if (presentation === 'push') {
    return direction === 'forward' ? `push-${suffix}` : `pop-${suffix}`;
  }

  return `${presentationClass}-${suffix}`;
}

export function computeAnimationType(
  _key: string,
  isInStack: boolean,
  isTop: boolean,
  direction: 'forward' | 'back',
  presentation: StackPresentationTypes,
  isInitialPhase: boolean,
  animated: boolean = true
): AnimationType {
  if (!animated) {
    return 'no-animate';
  }

  if (isInitialPhase) {
    return 'none';
  }

  const isEntering = isInStack && isTop;

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
      return getAnimationTypeForPresentation(
        presentation,
        false,
        direction
      ) as AnimationType;
    }
    if (isEntering) {
      return getAnimationTypeForPresentation(
        presentation,
        true,
        direction
      ) as AnimationType;
    }

    // Modal-like screen that's NOT top (background) - animate like push
    // This happens when navigating inside a modal stack
    if (direction === 'forward') {
      return 'push-background';
    } else {
      return 'pop-background';
    }
  }

  if (!isInStack) {
    if (direction === 'forward') {
      return 'push-exit';
    } else {
      return 'pop-exit';
    }
  }

  if (isTop) {
    if (direction === 'forward') {
      return 'push-enter';
    } else {
      return 'pop-enter';
    }
  }

  if (direction === 'forward') {
    return 'push-background';
  } else {
    return 'pop-background';
  }
}

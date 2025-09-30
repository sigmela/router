function whichChild(elem: Element, countNonElements?: boolean) {
  if (!elem?.parentNode) {
    return -1;
  }

  if (countNonElements) {
    return Array.from(elem.parentNode.childNodes).indexOf(elem as ChildNode);
  }

  let i = 0;
  let current: Element | null = elem;
  while ((current = current.previousElementSibling) !== null) ++i;
  return i;
}

function makeTranslate(x: number, y: number) {
  return `translate3d(${x}px, ${y}px, 0)`;
}

function makeTransitionFunction(options: TransitionFunction) {
  return options;
}

const slideModal = makeTransitionFunction({
  callback: (tabContent, prevTabContent, toRight) => {
    const height = prevTabContent.getBoundingClientRect().height;
    const elements: [HTMLElement, HTMLElement] = [tabContent, prevTabContent];
    if (toRight) elements.reverse();
    elements[0].style.filter = `brightness(80%)`;
    elements[1].style.transform = makeTranslate(0, height);

    tabContent.classList.add('active');
    // eslint-disable-next-line no-void
    void tabContent.offsetHeight; // reflow

    tabContent.style.transform = '';
    tabContent.style.filter = '';

    return () => {
      prevTabContent.style.transform = prevTabContent.style.filter = '';
    };
  },
  animateFirst: false,
});

const slideNavigation = makeTransitionFunction({
  callback: (tabContent, prevTabContent, toRight) => {
    const width = prevTabContent.getBoundingClientRect().width;
    const elements: [HTMLElement, HTMLElement] = [tabContent, prevTabContent];
    if (toRight) elements.reverse();
    elements[0].style.filter = `brightness(80%)`;
    elements[0].style.transform = makeTranslate(-width * 0.25, 0);
    elements[1].style.transform = makeTranslate(width, 0);

    tabContent.classList.add('active');
    // eslint-disable-next-line no-void
    void tabContent.offsetWidth; // reflow

    tabContent.style.transform = '';
    tabContent.style.filter = '';

    return () => {
      prevTabContent.style.transform = prevTabContent.style.filter = '';
    };
  },
  animateFirst: false,
});

const transitions: { [type in TransitionStackType]?: TransitionFunction } = {
  navigation: slideNavigation,
  modal: slideModal,
};

export type TransitionStackType = 'modal' | 'navigation';

export type TransitionStackOptions = {
  content: HTMLElement;
  type: TransitionStackType;
  transitionTime: number;
  onTransitionStart?: (id: number) => void;
  onTransitionStartAfter?: (id: number) => void;
  onTransitionEnd?: (id: number) => void;
  isHeavy?: boolean;
  once?: boolean;
  withAnimationListener?: boolean;
  animateFirst?: boolean;
};

type TransitionFunction = {
  callback: (
    tabContent: HTMLElement,
    prevTabContent: HTMLElement,
    toRight: boolean
  ) => () => void;
  animateFirst: boolean;
};

const TransitionStack = (options: TransitionStackOptions) => {
  let { animateFirst = false } = options;
  const {
    type: t,
    content,
    withAnimationListener = true,
    transitionTime,
    onTransitionEnd,
    onTransitionStart,
    onTransitionStartAfter,
    once = false,
  } = options;
  const type = t;

  // Set initial animation type on container; will be overridden per transition based on target's data-presentation
  content.dataset.animation = type;

  const onTransitionEndCallbacks: Map<HTMLElement, () => void> = new Map();
  let from: HTMLElement | null | undefined = null;

  if (withAnimationListener) {
    const listenerName = 'transitionend';

    const onEndEvent = (e: TransitionEvent | AnimationEvent) => {
      // @ts-expect-error - e is TransitionEvent | AnimationEvent
      e = e.originalEvent || e;
      try {
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
        e.returnValue = false;
        e.cancelBubble = true;
      } catch {
        /* empty */
      }

      if ((e.target as HTMLElement).parentElement !== content) {
        return;
      }

      const callback = onTransitionEndCallbacks.get(e.target as HTMLElement);
      callback?.();

      if (e.target !== from) {
        return;
      }

      onTransitionEnd?.(transition.prevId());

      content.classList.remove('animating', 'backwards', 'disable-hover');

      if (once) {
        content.removeEventListener(listenerName, onEndEvent);
        from = undefined;
        onTransitionEndCallbacks.clear();
      }
    };

    content.addEventListener(listenerName, onEndEvent);
  }

  function transition(
    id: number | HTMLElement,
    animate = true,
    overrideFrom?: typeof from
  ): void {
    if (overrideFrom) {
      from = overrideFrom;
    }

    const targetIndex = id instanceof HTMLElement ? whichChild(id) : id;

    const prevId = transition.prevId();
    if (targetIndex === prevId) return;

    onTransitionStart?.(targetIndex);

    const to = content.children[targetIndex] as HTMLElement | undefined;

    // Determine direction and pick animation source
    const goingBack = prevId > targetIndex;

    const sourcePresentation = (from?.dataset.presentation || '') as
      | 'modal'
      | 'navigation'
      | 'push'
      | '';
    const targetPresentation = (to?.dataset.presentation || '') as
      | 'modal'
      | 'navigation'
      | 'push'
      | '';

    const chosenPresentation = goingBack
      ? sourcePresentation
      : targetPresentation;
    const effectiveType: TransitionStackType =
      chosenPresentation === 'modal' ? 'modal' : 'navigation';

    // Update container dataset to drive CSS timing variants
    content.dataset.animation = effectiveType;

    const transitionSpec = transitions[effectiveType];
    const animationFunction = transitionSpec?.callback;
    const animateFirstLocal =
      (transitionSpec?.animateFirst !== undefined
        ? transitionSpec?.animateFirst
        : animateFirst) ?? false;

    if (prevId === -1 && !animateFirstLocal) {
      animate = false;
    }

    if (!withAnimationListener) {
      const timeout = content.dataset.timeout;
      if (timeout !== undefined) {
        clearTimeout(+timeout);
      }

      delete content.dataset.timeout;
    }

    if (!animate) {
      if (from) from.classList.remove('active', 'to', 'from');
      else if (to) {
        const callback = onTransitionEndCallbacks.get(to);
        callback?.();
      }

      if (to) {
        to.classList.remove('to', 'from');
        to.classList.add('active');
      }

      content.classList.remove('animating', 'backwards', 'disable-hover');

      from = to;

      onTransitionEnd?.(targetIndex);
      return;
    }

    if (!withAnimationListener) {
      content.dataset.timeout =
        '' +
        window.setTimeout(() => {
          to?.classList.remove('to');
          from?.classList.remove('from');
          content.classList.remove('animating', 'backwards', 'disable-hover');
          delete content.dataset.timeout;
        }, transitionTime);
    }

    if (from) {
      from.classList.remove('to');
      from.classList.add('from');
    }

    content.classList.add('animating');
    const toRight = prevId < targetIndex;
    content.classList.toggle('backwards', !toRight);

    let onTransitionEndCallback: ReturnType<TransitionFunction['callback']>;
    if (!to) {
      // prevTabContent.classList.remove('active');
    } else {
      if (animationFunction) {
        onTransitionEndCallback = animationFunction(
          to,
          from as HTMLElement,
          toRight
        );
      } else {
        to.classList.add('active');
      }

      onTransitionStartAfter?.(targetIndex);

      to.classList.remove('from');
      to.classList.add('to');
    }

    if (to) {
      const transitionTimeout = to.dataset.transitionTimeout;
      if (transitionTimeout) {
        clearTimeout(+transitionTimeout);
      }

      onTransitionEndCallbacks.set(to, () => {
        to.classList.remove('to');
        onTransitionEndCallbacks.delete(to);
      });
    }

    if (from) {
      let timeout: number;
      const _from = from;
      const callback = () => {
        clearTimeout(timeout);
        _from.classList.remove('active', 'from');

        onTransitionEndCallback?.();

        onTransitionEndCallbacks.delete(_from);
      };

      if (to) {
        timeout = window.setTimeout(callback, transitionTime + 100);
        onTransitionEndCallbacks.set(_from, callback);
      } else {
        timeout = window.setTimeout(callback, transitionTime + 100);
        onTransitionEndCallbacks.set(_from, () => {
          clearTimeout(timeout);
          onTransitionEndCallbacks.delete(_from);
        });
      }

      _from.dataset.transitionTimeout = '' + timeout;
    }

    from = to;
  }

  transition.prevId = () => (from ? whichChild(from) : -1);
  transition.getFrom = () => from;
  transition.setFrom = (_from: HTMLElement) => (from = _from);

  return transition;
};

export default TransitionStack;

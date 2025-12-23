import type { ReactElement, Key, ReactNode } from 'react';
import {
  memo,
  useRef,
  useLayoutEffect,
  useMemo,
  useEffect,
  Children,
  isValidElement,
  Fragment,
  useCallback,
  useContext,
} from 'react';
import type { ScreenStackItemProps } from '../ScreenStackItem/ScreenStackItem.types';
import type { ScreenStackItemPhase } from '../ScreenStackItem/ScreenStackItem.types';
import { useTransitionMap } from 'react-transition-state';
import {
  ScreenStackItemsContext,
  ScreenStackAnimatingContext,
  useScreenStackConfig,
} from './ScreenStackContext';
import {
  getPresentationTypeClass,
  computeAnimationType,
} from './animationHelpers';
import { RouterContext } from '../RouterContext';

type ScreenStackProps = {
  children: ReactNode;
  transitionTime?: number;
  animated?: boolean;
};

type Direction = 'forward' | 'back';


const isScreenStackItemElement = (
  child: ReactNode
): child is ReactElement<ScreenStackItemProps> => {
  if (!isValidElement(child)) return false;
  const anyProps = (child as any).props;
  return anyProps && typeof anyProps === 'object' && 'item' in anyProps;
};

const getItemKey = (child: ReactElement<ScreenStackItemProps>): string => {
  const anyChild = child as any;
  const reactKey: Key | null = anyChild.key ?? null;

  if (
    typeof reactKey === 'string' &&
    reactKey.length > 0 &&
    !reactKey.startsWith('.')
  ) {
    return reactKey;
  }

  const item = anyChild.props?.item;

  if (item?.key && typeof item.key === 'string') {
    return item.key;
  }

  if (item?.routeId) {
    return String(item.routeId);
  }

  throw new Error('[ScreenStack] ScreenStackItem is missing a stable key');
};

const computeDirection = (prev: string[], current: string[]): Direction => {
  if (prev.length === 0 && current.length > 0) {
    return 'forward';
  }

  if (current.length > prev.length) {
    return 'forward';
  }

  if (current.length < prev.length) {
    return 'back';
  }

  const prevTop = prev[prev.length - 1];
  const currentTop = current[current.length - 1];

  if (prevTop === currentTop) {
    return 'forward';
  }

  const prevIndexOfCurrentTop = prev.indexOf(currentTop!);
  const prevIndexOfPrevTop = prev.indexOf(prevTop!);

  if (
    prevIndexOfCurrentTop !== -1 &&
    prevIndexOfPrevTop !== -1 &&
    prevIndexOfCurrentTop < prevIndexOfPrevTop
  ) {
    return 'back';
  }

  return 'forward';
};

export const ScreenStack = memo<ScreenStackProps>((props) => {
  const { children, transitionTime = 250, animated = true } = props;

  const router = useContext(RouterContext);
  const debugEnabled = router?.isDebugEnabled() ?? false;
  const devLog = useCallback(
    (msg: string, data?: any) => {
      if (!debugEnabled) return;
      console.log(msg, data !== undefined ? JSON.stringify(data) : '');
    },
    [debugEnabled]
  );

  devLog('[ScreenStack] Render', {
    transitionTime,
    animated,
    childrenExists: !!children,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);

  const isInitialMountRef = useRef(true);

  const suppressEnterAfterEmptyRef = useRef(false);
  const suppressedEnterKeyRef = useRef<string | null>(null);

  const prevKeysRef = useRef<string[]>([]);

  const lastDirectionRef = useRef<Direction>('forward');

  const childMapRef = useRef<Map<string, ReactElement<ScreenStackItemProps>>>(
    new Map()
  );

  const stackChildren = useMemo(() => {
    const stackItems: ReactElement<ScreenStackItemProps>[] = [];

    Children.forEach(children, (child) => {
      if (isScreenStackItemElement(child)) {
        stackItems.push(child);
      } else if (child != null) {
        devLog('[ScreenStack] Non-ScreenStackItem child ignored', { child });
      }
    });

    devLog('[ScreenStack] Parsed children', {
      stackChildrenLength: stackItems.length,
    });

    return stackItems;
  }, [children]);

  const routeKeys = useMemo(() => {
    const keys = stackChildren.map((child) => {
      const item = child.props.item;
      return item?.key || getItemKey(child);
    });
    devLog('[ScreenStack] routeKeys', keys);
    return keys;
  }, [stackChildren]);

  const childMap = useMemo(() => {
    const map = new Map(childMapRef.current);

    for (const child of stackChildren) {
      const item = child.props.item;
      const key = item?.key || getItemKey(child);
      map.set(key, child);
    }

    childMapRef.current = map;

    devLog('[ScreenStack] childMap updated', {
      size: map.size,
      keys: Array.from(map.keys()),
    });

    return map;
  }, [stackChildren]);

  const { stateMap, toggle, setItem, deleteItem } = useTransitionMap<string>({
    timeout: transitionTime,
    preEnter: true,
    mountOnEnter: true,
    unmountOnExit: false,
    enter: animated,
    exit: animated,
    allowMultiple: true,
    onStateChange: ({ key, current }) => {
      devLog(`[ScreenStack] Transition state change for key ${key}:`, {
        status: current.status,
        isMounted: current.isMounted,
        isEnter: current.isEnter,
        isResolved: current.isResolved,
      });
    },
  });

  devLog(
    '[ScreenStack] Current transition states:',
    Array.from(stateMap.entries()).map(([key, state]) => ({
      key,
      status: state.status,
      isMounted: state.isMounted,
      isEnter: state.isEnter,
      isResolved: state.isResolved,
    }))
  );

  const stateMapEntries = Array.from(stateMap.entries());

  const direction: Direction = useMemo(() => {
    const prevKeys = prevKeysRef.current;
    const computed = computeDirection(prevKeys, routeKeys);

    prevKeysRef.current = routeKeys;
    return computed;
  }, [routeKeys]);

  devLog('[ScreenStack] Computed direction', {
    prevKeys: prevKeysRef.current,
    routeKeys,
    direction,
  });

  const screenStackConfig = useScreenStackConfig();
  const animateFirstScreenAfterEmpty =
    screenStackConfig.animateFirstScreenAfterEmpty ?? true;

  const isInitialPhase = isInitialMountRef.current;

  const keysToRender = useMemo(() => {
    const routeKeySet = new Set(routeKeys);
    const exitingKeys: string[] = [];

    for (const [key, state] of stateMapEntries) {
      if (!state.isMounted) continue;
      if (!routeKeySet.has(key)) {
        exitingKeys.push(key);
      }
    }

    const result = [...routeKeys, ...exitingKeys];

    devLog('[ScreenStack] Keys to render:', {
      result,
      exitingKeys,
    });

    return result;
  }, [routeKeys, stateMapEntries]);

  const containerClassName = useMemo(() => {
    return 'screen-stack';
  }, []);

  useLayoutEffect(() => {
    devLog('[ScreenStack] === LIFECYCLE EFFECT START ===', {
      prevKeys: prevKeysRef.current,
      routeKeys,
      direction,
    });

    const routeKeySet = new Set(routeKeys);

    const existingKeySet = new Set<string>();
    for (const [key] of stateMapEntries) {
      existingKeySet.add(key);
    }

    const newKeys = routeKeys.filter((key) => !existingKeySet.has(key));
    const removedKeys = [...existingKeySet].filter(
      (key) => !routeKeySet.has(key)
    );

    // Track "became empty" state to suppress the next enter animation when configured.
    // This is SplitView-secondary-only (via ScreenStackConfigContext), not global behavior.
    if (!animateFirstScreenAfterEmpty) {
      if (routeKeys.length === 0) {
        suppressEnterAfterEmptyRef.current = true;
        suppressedEnterKeyRef.current = null;
      }
    }

    devLog('[ScreenStack] Lifecycle diff', {
      newKeys,
      removedKeys,
    });

    // If this is the first pushed key after the stack was empty, remember its key so we can
    // suppress only its enter animation (without affecting exit animations).
    if (
      !animateFirstScreenAfterEmpty &&
      suppressEnterAfterEmptyRef.current &&
      routeKeys.length > 0 &&
      newKeys.length > 0
    ) {
      const candidate = newKeys[newKeys.length - 1] ?? null;
      suppressedEnterKeyRef.current = candidate;
      suppressEnterAfterEmptyRef.current = false;
    }

    for (const key of newKeys) {
      devLog(`[ScreenStack] Adding item: ${key}`);
      setItem(key);
      devLog(`[ScreenStack] Entering item: ${key}`);
      toggle(key, true);
    }

    for (const key of removedKeys) {
      const state = stateMap.get(key);
      if (state && state.isEnter) {
        devLog(`[ScreenStack] Starting exit for item: ${key}`, {
          status: state.status,
        });
        toggle(key, false);
      } else {
        devLog(
          `[ScreenStack] Skip exit for item (not entered or missing): ${key}`,
          {
            hasState: !!state,
            status: state?.status,
            isEnter: state?.isEnter,
          }
        );
      }
    }

    lastDirectionRef.current = direction;

    devLog('[ScreenStack] === LIFECYCLE EFFECT END ===');
  }, [
    routeKeys,
    direction,
    setItem,
    toggle,
    stateMapEntries,
    stateMap,
    animateFirstScreenAfterEmpty,
  ]);

  useLayoutEffect(() => {
    devLog('[ScreenStack] === CLEANUP EFFECT START ===');

    const routeKeySet = new Set(routeKeys);

    for (const [key, state] of stateMapEntries) {
      if (!state.isMounted) {
        devLog(`[ScreenStack] Cleanup unmounted item: ${key}`, {
          status: state.status,
          isResolved: state.isResolved,
        });
        deleteItem(key);
        childMapRef.current.delete(key);
        continue;
      }

      const isInStack = routeKeySet.has(key);
      const canCleanup =
        !isInStack && state.status === 'exited' && state.isResolved === true;

      if (canCleanup) {
        devLog(`[ScreenStack] Cleanup exited item: ${key}`, {
          status: state.status,
          isResolved: state.isResolved,
        });
        deleteItem(key);
        childMapRef.current.delete(key);
      }
    }

    devLog('[ScreenStack] === CLEANUP EFFECT END ===');
  }, [routeKeys, stateMapEntries, deleteItem]);

  useEffect(() => {
    if (!isInitialMountRef.current) return;

    const hasMountedItem = stateMapEntries.some(([, st]) => st.isMounted);

    // If the stack mounts empty, we still want the first pushed screen to animate.
    // Mark initial mount as completed immediately in that case.
    if (!hasMountedItem && routeKeys.length === 0) {
      if (animateFirstScreenAfterEmpty) {
        isInitialMountRef.current = false;
        devLog('[ScreenStack] Initial mount completed (empty stack)');
      }
      return;
    }

    if (hasMountedItem) {
      isInitialMountRef.current = false;
      devLog('[ScreenStack] Initial mount completed');
    }
  }, [stateMapEntries, routeKeys.length, animateFirstScreenAfterEmpty]);

  // Clear suppression key once it is no longer the top screen (so it can animate normally as
  // a background when new screens are pushed).
  useLayoutEffect(() => {
    if (animateFirstScreenAfterEmpty) return;
    const topKey = routeKeys[routeKeys.length - 1] ?? null;
    if (!topKey) {
      suppressedEnterKeyRef.current = null;
      return;
    }
    if (
      suppressedEnterKeyRef.current &&
      suppressedEnterKeyRef.current !== topKey
    ) {
      suppressedEnterKeyRef.current = null;
    }
  }, [routeKeys, animateFirstScreenAfterEmpty]);

  useEffect(() => {
    if (!containerRef.current) return;

    const items = containerRef.current.querySelectorAll('.screen-stack-item');
    if (items.length === 0) return;

    devLog('[ScreenStack] DOM State after render:', {
      containerClasses: containerRef.current.className,
      containerDataAnimation: containerRef.current.dataset.animation,
      containerDataDirection: containerRef.current.dataset.direction,
      itemCount: items.length,
    });
  });

  const topKey = routeKeys[routeKeys.length - 1] ?? null;
  const routeKeySet = useMemo(() => new Set(routeKeys), [routeKeys]);

  const itemsContextValue = useMemo(() => {
    const items: { [key: string]: any } = {};

    for (let index = 0; index < keysToRender.length; index++) {
      const key = keysToRender[index];
      if (!key) continue;

      const transitionState = stateMap.get(key);
      const child = childMap.get(key);
      if (!child) continue;

      const item = child.props.item;
      if (!item) continue;

      const presentation = item.options?.stackPresentation ?? 'push';
      const animated = item.options?.animated ?? true;
      const isInStack = routeKeySet.has(key);
      const isTop = isInStack && topKey !== null && key === topKey;

      let phase: ScreenStackItemPhase;
      if (!isInStack) {
        phase = 'exiting';
      } else if (isTop) {
        phase = 'active';
      } else {
        phase = 'inactive';
      }

      const rawStatus = transitionState?.status || 'preEnter';
      const status =
        isInitialPhase && (rawStatus === 'preEnter' || rawStatus === 'entering')
          ? 'entered'
          : rawStatus;

      const routeIndex = routeKeys.indexOf(key);
      const zIndex =
        routeIndex >= 0 ? routeIndex + 1 : keysToRender.length + index + 1;

      const presentationType = getPresentationTypeClass(presentation);
      let animationType = computeAnimationType(
        key,
        isInStack,
        isTop,
        direction,
        presentation,
        isInitialPhase,
        animated
      );

      // SplitView-secondary-only: suppress enter animation for the first screen after empty.
      if (
        !animateFirstScreenAfterEmpty &&
        isTop &&
        direction === 'forward' &&
        suppressedEnterKeyRef.current === key
      ) {
        animationType = 'none';
      }

      items[key] = {
        presentationType,
        animationType,
        phase,
        transitionStatus: status,
        zIndex,
      };
    }

    for (let index = 0; index < routeKeys.length; index++) {
      const key = routeKeys[index];
      if (!key || items[key]) continue;

      const child = childMap.get(key);
      if (!child) continue;

      const item = child.props.item;
      if (!item) continue;

      const presentation = item.options?.stackPresentation ?? 'push';
      const animated = item.options?.animated ?? true;
      const isInStack = routeKeySet.has(key);
      const isTop = isInStack && topKey !== null && key === topKey;

      let phase: ScreenStackItemPhase;
      if (isTop) {
        phase = 'active';
      } else {
        phase = 'inactive';
      }

      const presentationType = getPresentationTypeClass(presentation);

      let animationType = isInitialPhase
        ? 'none'
        : computeAnimationType(
            key,
            isInStack,
            isTop,
            direction,
            presentation,
            isInitialPhase,
            animated
          );

      if (
        !animateFirstScreenAfterEmpty &&
        isTop &&
        direction === 'forward' &&
        suppressedEnterKeyRef.current === key
      ) {
        animationType = 'none';
      }

      items[key] = {
        presentationType,
        animationType,
        phase,
        transitionStatus: 'preEnter' as const,
        zIndex: index + 1,
      };
    }

    return { items };
  }, [
    keysToRender,
    stateMap,
    childMap,
    routeKeySet,
    topKey,
    isInitialPhase,
    routeKeys,
    direction,
    animateFirstScreenAfterEmpty,
  ]);

  const animating = useMemo(() => {
    return stateMapEntries.some(
      ([, state]) =>
        state.isMounted &&
        (state.status === 'entering' ||
          state.status === 'exiting' ||
          state.status === 'preEnter' ||
          state.status === 'preExit')
    );
  }, [stateMapEntries]);

  return (
    <ScreenStackItemsContext.Provider value={itemsContextValue}>
      <ScreenStackAnimatingContext.Provider value={animating}>
        <div
          ref={containerRef}
          className={containerClassName + (animating ? ' animating' : '')}
        >
          {keysToRender.map((key) => {
            const transitionState = stateMap.get(key);

            if (!transitionState || !transitionState.isMounted) {
              devLog(
                `[ScreenStack] Skipping ${key} - no state or not mounted`,
                {
                  hasState: !!transitionState,
                  isMounted: transitionState?.isMounted,
                }
              );
              return null;
            }

            const child = childMap.get(key);
            if (!child) {
              devLog(`[ScreenStack] No child element for ${key}`, {
                availableKeys: Array.from(childMap.keys()),
              });
              return null;
            }

            return <Fragment key={child.key || key}>{child}</Fragment>;
          })}
        </div>
      </ScreenStackAnimatingContext.Provider>
    </ScreenStackItemsContext.Provider>
  );
});

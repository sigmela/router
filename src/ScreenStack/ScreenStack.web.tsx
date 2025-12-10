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
} from 'react';
import type { ScreenStackItemProps } from '../ScreenStackItem/ScreenStackItem.types';
import type { ScreenStackItemPhase } from '../ScreenStackItem/ScreenStackItem.types';
import { useTransitionMap } from 'react-transition-state';
import {
  ScreenStackItemsContext,
  ScreenStackAnimatingContext,
} from './ScreenStackContext';
import {
  getPresentationTypeClass,
  computeAnimationType,
} from './animationHelpers';

type ScreenStackProps = {
  children: ReactNode;
  transitionTime?: number;
  animated?: boolean;
};

type Direction = 'forward' | 'back';

/**
 * Development-only logging helper
 */
const devLog = (_: string, __?: any) => {
  // if (false) {
  //   //if (typeof __DEV__ !== 'undefined' && __DEV__) {
  //   if (data !== undefined) {
  //     // eslint-disable-next-line no-console
  //     console.log(message, data);
  //   } else {
  //     // eslint-disable-next-line no-console
  //     console.log(message);
  //   }
  // }
};

/**
 * Heuristic: считаем элемент ScreenStackItem по наличию props.item
 */
const isScreenStackItemElement = (
  child: ReactNode
): child is ReactElement<ScreenStackItemProps> => {
  if (!isValidElement(child)) return false;
  const anyProps = (child as any).props;
  return anyProps && typeof anyProps === 'object' && 'item' in anyProps;
};

/**
 * Получаем стабильный ключ для элемента стека.
 * Предпочитаем React key, если он строка и не начинается с '.'.
 * Фоллбэк — item.key или item.routeId.
 */
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

/**
 * Определяем направление навигации по предыдущему и текущему списку ключей.
 */
const computeDirection = (prev: string[], current: string[]): Direction => {
  if (prev.length === 0 && current.length > 0) {
    return 'forward';
  }

  if (current.length > prev.length) {
    return 'forward'; // push
  }

  if (current.length < prev.length) {
    return 'back'; // pop / popTo
  }

  // Одинаковая длина: смотрим, поменялся ли топ и был ли он раньше в стеке
  const prevTop = prev[prev.length - 1];
  const currentTop = current[current.length - 1];

  if (prevTop === currentTop) {
    return 'forward'; // нет очевидного движения назад, оставляем forward по умолчанию
  }

  const prevIndexOfCurrentTop = prev.indexOf(currentTop!);
  const prevIndexOfPrevTop = prev.indexOf(prevTop!);

  if (
    prevIndexOfCurrentTop !== -1 &&
    prevIndexOfPrevTop !== -1 &&
    prevIndexOfCurrentTop < prevIndexOfPrevTop
  ) {
    // "прыжок назад"
    return 'back';
  }

  return 'forward';
};

export const ScreenStack = memo<ScreenStackProps>((props) => {
  const {
    children,
    transitionTime = 250,
    animated = true,
  } = props;

  devLog('[ScreenStack] Render', {
    transitionTime,
    animated,
    childrenExists: !!children,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Флаг initial-фазы: пока true — не анимируем первый рендер стека
  const isInitialMountRef = useRef(true);

  // Храним предыдущий список ключей стека
  const prevKeysRef = useRef<string[]>([]);
  // Храним последнее направление навигации (используем для CSS)
  const lastDirectionRef = useRef<Direction>('forward');
  // Кэш элементов по ключу, чтобы уметь рисовать exiting элементы после удаления из children
  const childMapRef = useRef<Map<string, ReactElement<ScreenStackItemProps>>>(
    new Map()
  );

  // Разделяем детей на ScreenStackItem (otherChildren больше не поддерживаем)
  const stackChildren = useMemo(() => {
    const stackItems: ReactElement<ScreenStackItemProps>[] = [];

    Children.forEach(children, (child) => {
      if (isScreenStackItemElement(child)) {
        stackItems.push(child);
      } else if (child != null) {
        // otherChildren больше не поддерживаем - выбрасываем предупреждение в dev
        devLog('[ScreenStack] Non-ScreenStackItem child ignored', { child });
      }
    });

    devLog('[ScreenStack] Parsed children', {
      stackChildrenLength: stackItems.length,
    });

    return stackItems;
  }, [children]);

  // Текущий стек ключей (в порядке снизу вверх)
  // ВАЖНО: используем item.key, а не React key, чтобы совпадало с поиском в контексте
  const routeKeys = useMemo(() => {
    const keys = stackChildren.map((child) => {
      const item = child.props.item;
      return item?.key || getItemKey(child);
    });
    devLog('[ScreenStack] routeKeys', keys);
    return keys;
  }, [stackChildren]);

  // Обновляем childMap так, чтобы exiting элементы оставались доступны
  // ВАЖНО: используем item.key как ключ, чтобы совпадало с поиском в контексте
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
    unmountOnExit: false, // сами решаем, когда удалять
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

  // Сводка текущих transition-состояний
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

  // Текущее направление навигации считается синхронно из prevKeysRef и routeKeys,
  // чтобы не было лагов (как раньше при pop на первом кадре).
  const direction: Direction = useMemo(
    () => computeDirection(prevKeysRef.current, routeKeys),
    [routeKeys]
  );

  devLog('[ScreenStack] Computed direction', {
    prevKeys: prevKeysRef.current,
    routeKeys,
    direction,
  });

  const isInitialPhase = isInitialMountRef.current;

  // Вычисляем список ключей, которые должны быть отрисованы:
  // 1) все текущие routeKeys
  // 2) плюс все exiting (mounted, но уже не в routeKeys)
  const keysToRender = useMemo(() => {
    const routeKeySet = new Set(routeKeys);
    const exitingKeys: string[] = [];

    for (const [key, state] of stateMap.entries()) {
      if (!state.isMounted) continue;
      if (!routeKeySet.has(key)) {
        exitingKeys.push(key);
      }
    }

    // Для стековой навигации: сначала все текущие (снизу вверх),
    // затем exiting (они будут верхними по z-index).
    const result = [...routeKeys, ...exitingKeys];

    devLog('[ScreenStack] Keys to render:', {
      result,
      exitingKeys,
    });

    return result;
  }, [routeKeys, stateMap]);

  const containerClassName = useMemo(() => {
    return 'screen-stack';
  }, []);

  /**
   * EFFECT 1: lifecycle — добавляем новые ключи, запускаем enter,
   * помечаем на exit те, которых больше нет в стеке.
   */
  useLayoutEffect(() => {
    devLog('[ScreenStack] === LIFECYCLE EFFECT START ===', {
      prevKeys: prevKeysRef.current,
      routeKeys,
      direction,
    });

    const routeKeySet = new Set(routeKeys);

    // Какие ключи новые относительно stateMap
    const existingKeySet = new Set<string>();
    for (const [key] of stateMap.entries()) {
      existingKeySet.add(key);
    }

    const newKeys = routeKeys.filter((key) => !existingKeySet.has(key));
    const removedKeys = [...existingKeySet].filter(
      (key) => !routeKeySet.has(key)
    );

    devLog('[ScreenStack] Lifecycle diff', {
      newKeys,
      removedKeys,
    });

    // Новые элементы: регистрируем и включаем enter
    for (const key of newKeys) {
      devLog(`[ScreenStack] Adding item: ${key}`);
      setItem(key);
      devLog(`[ScreenStack] Entering item: ${key}`);
      toggle(key, true);
    }


    // Элементы, которых больше нет в стеке: запускаем exit
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

    // Обновляем prevKeys и последнее направление
    prevKeysRef.current = routeKeys;
    lastDirectionRef.current = direction;

    devLog('[ScreenStack] === LIFECYCLE EFFECT END ===');
  }, [routeKeys, direction, setItem, toggle, stateMap]);

  /**
   * EFFECT 2: cleanup — удаляем из transitionMap и childMap
   * полностью завершённые и/или размонтированные элементы.
   */
  useLayoutEffect(() => {
    devLog('[ScreenStack] === CLEANUP EFFECT START ===');

    const routeKeySet = new Set(routeKeys);

    for (const [key, state] of stateMap.entries()) {
      // Если элемент не смонтирован, можно удалять из карты
      if (!state.isMounted) {
        devLog(`[ScreenStack] Cleanup unmounted item: ${key}`, {
          status: state.status,
          isResolved: state.isResolved,
        });
        deleteItem(key);
        childMapRef.current.delete(key);
        continue;
      }

      // Если ключ не в текущем стеке и анимация завершена — чистим
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
  }, [routeKeys, stateMap, deleteItem]);

  /**
   * EFFECT 3: завершение initial-фазы.
   * Как только появился хотя бы один смонтированный элемент в stateMap,
   * считаем, что initial-mount закончился и дальше анимации включены.
   */
  useEffect(() => {
    if (!isInitialMountRef.current) return;

    const hasMountedItem = Array.from(stateMap.values()).some(
      (st) => st.isMounted
    );

    if (hasMountedItem) {
      isInitialMountRef.current = false;
      devLog('[ScreenStack] Initial mount completed');
    }
  }, [stateMap]);

  // Лог DOM-состояния после рендера (в деве)
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

  // Текущий верхний ключ стека (если есть)
  const topKey = routeKeys[routeKeys.length - 1] ?? null;
  const routeKeySet = useMemo(() => new Set(routeKeys), [routeKeys]);

  // Вычисляем items для контекста через useMemo
  // ВАЖНО: включаем все routeKeys, даже если они еще не в stateMap (для первого рендера)
  const itemsContextValue = useMemo(() => {
    const items: { [key: string]: any } = {};

    // Сначала обрабатываем элементы из keysToRender (те, что уже в stateMap)
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

      // Если элемент еще не в stateMap, используем начальные значения
      const rawStatus = transitionState?.status || 'preEnter';
      const status =
        isInitialPhase && (rawStatus === 'preEnter' || rawStatus === 'entering')
          ? 'entered'
          : rawStatus;

      // Определяем zIndex на основе позиции в routeKeys
      const routeIndex = routeKeys.indexOf(key);
      const zIndex = routeIndex >= 0 ? routeIndex + 1 : keysToRender.length + index + 1;

      const presentationType = getPresentationTypeClass(presentation);
      const animationType = computeAnimationType(
        key,
        isInStack,
        isTop,
        direction,
        presentation,
        isInitialPhase,
        animated
      );

      items[key] = {
        presentationType,
        animationType,
        phase,
        transitionStatus: status,
        zIndex,
      };
    }

    // Теперь добавляем элементы из routeKeys, которых еще нет в items (если они не в stateMap)
    for (let index = 0; index < routeKeys.length; index++) {
      const key = routeKeys[index];
      if (!key || items[key]) continue; // Skip undefined keys или уже добавленные

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
      // Для элементов без stateMap используем начальное состояние
      const animationType = isInitialPhase
        ? 'none'
        : computeAnimationType(key, isInStack, isTop, direction, presentation, isInitialPhase, animated);

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
    routeKeys,
    stateMap,
    childMap,
    routeKeySet,
    topKey,
    direction,
    isInitialPhase,
  ]);

  // Вычисляем animating отдельно через useMemo
  const animating = useMemo(() => {
    return Array.from(stateMap.values()).some(
      (state) =>
        state.isMounted &&
        (state.status === 'entering' ||
          state.status === 'exiting' ||
          state.status === 'preEnter' ||
          state.status === 'preExit')
    );
  }, [stateMap]);


  return (
    <ScreenStackItemsContext.Provider value={itemsContextValue}>
      <ScreenStackAnimatingContext.Provider value={animating}>
        <div
          ref={containerRef}
          className={containerClassName + (animating ? ' animating' : '')}
        >
          {/* Рендерим keysToRender (текущие + exiting) через childMap, как в старой версии */}
          {/* Это позволяет exiting элементам оставаться в DOM для анимации */}
          {keysToRender.map((key) => {
            const transitionState = stateMap.get(key);

            if (!transitionState || !transitionState.isMounted) {
              devLog(`[ScreenStack] Skipping ${key} - no state or not mounted`, {
                hasState: !!transitionState,
                isMounted: transitionState?.isMounted,
              });
              return null;
            }

            const child = childMap.get(key);
            if (!child) {
              devLog(`[ScreenStack] No child element for ${key}`, {
                availableKeys: Array.from(childMap.keys()),
              });
              return null;
            }

            // Используем React key из child, но логический ключ для поиска в контексте - item.key
            // Элемент найдет свои данные в контексте по item.key
            return <Fragment key={child.key || key}>{child}</Fragment>;
          })}
        </div>
      </ScreenStackAnimatingContext.Provider>
    </ScreenStackItemsContext.Provider>
  );
});

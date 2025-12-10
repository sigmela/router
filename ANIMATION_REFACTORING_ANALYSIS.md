# Анализ рефакторинга системы анимаций

## Текущее состояние (проблемы)

1. **Зависимость от родителя**: CSS селекторы зависят от `data-animation` и `data-direction` на `.screen-stack`
2. **cloneElement**: Используется для передачи props, что не является React best practice
3. **Сложные селекторы**: Комбинированные селекторы типа `.screen-stack[data-animation="navigation"][data-direction="forward"] > .screen-stack-item...`

## Предложение

### Структура Context

```typescript
type AnimationType = 
  // Push/Pop анимации
  | 'push-enter'      // Обычный экран входит при forward
  | 'push-exit'       // Обычный экран выходит при forward (rare)
  | 'push-background' // Фоновый экран при forward (сдвиг влево)
  | 'pop-enter'       // Обычный экран становится активным при back (возврат из -25%)
  | 'pop-exit'        // Верхний экран уезжает при back
  | 'pop-background'  // Фоновый экран при back
  
  // Modal анимации (разные типы)
  | 'modal-enter'              // Модалка входит
  | 'modal-exit'               // Модалка закрывается
  | 'transparent-modal-enter'  // Прозрачная модалка входит
  | 'transparent-modal-exit'   // Прозрачная модалка закрывается
  | 'contained-modal-enter'    // Встроенная модалка входит
  | 'contained-modal-exit'     // Встроенная модалка закрывается
  | 'fullscreen-modal-enter'   // Полноэкранная модалка входит
  | 'fullscreen-modal-exit'    // Полноэкранная модалка закрывается
  | 'formsheet-enter'          // Form sheet входит
  | 'formsheet-exit'           // Form sheet закрывается
  | 'pagesheet-enter'          // Page sheet входит
  | 'pagesheet-exit'           // Page sheet закрывается
  
  // Sheet анимации (особая анимация для веб)
  | 'sheet-enter'     // Sheet входит (bottom sheet на вебе)
  | 'sheet-exit'      // Sheet закрывается
  
  // Специальные
  | 'no-animate'      // Без анимации (если screenOptions.animated === false)
  | 'none';           // Без анимации (initial mount)

// Стабильный класс типа presentation (для описания типа экрана)
type PresentationTypeClass = 
  | 'push'
  | 'modal'
  | 'transparent-modal'
  | 'contained-modal'
  | 'contained-transparent-modal'
  | 'fullscreen-modal'
  | 'formsheet'
  | 'pagesheet'
  | 'sheet';

type ScreenStackItemsContextValue = {
  items: {
    [key: string]: {
      presentationType: PresentationTypeClass; // Стабильный класс типа экрана
      animationType: AnimationType;            // Динамический класс анимации
      phase: ScreenStackItemPhase;
      transitionStatus: TransitionStatus;
      zIndex: number;
    };
  };
};

// Отдельный контекст для флага анимации (оптимизация производительности)
type ScreenStackAnimatingContextValue = boolean;
```

### Логика вычисления animationType

```typescript
// Получаем стабильный класс типа presentation
function getPresentationTypeClass(
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

// Получаем динамический класс анимации
function getAnimationTypeForPresentation(
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

function computeAnimationType(
  key: string,
  isInStack: boolean,
  isTop: boolean,
  direction: 'forward' | 'back',
  presentation: StackPresentationTypes,
  isInitialPhase: boolean,
  animated: boolean = true // Из screenOptions.animated
): AnimationType {
  // isEntering вычисляем внутри
  const isEntering = isInStack && isTop;
  // Если анимация отключена через screenOptions
  if (!animated) {
    return 'no-animate';
  }

  // Initial mount - без анимации
  if (isInitialPhase) {
    return 'none';
  }

  // Modal/Sheet анимации (разные типы через getAnimationTypeForPresentation)
  const isModalLike = [
    'modal',
    'transparentModal',
    'containedModal',
    'containedTransparentModal',
    'fullScreenModal',
    'formSheet',
    'pageSheet',
    'sheet'
  ].includes(presentation);
  
  if (isModalLike) {
    if (!isInStack) {
      return getAnimationTypeForPresentation(presentation, false, direction) as AnimationType;
    }
    if (isTop) {
      return getAnimationTypeForPresentation(presentation, true, direction) as AnimationType;
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
    return 'pop-background'; // Возвращается в 0 (или остается на 0)
  }
}
```

## Преимущества решения

### ✅ 1. Убираем cloneElement
- Используем React Context вместо клонирования элементов
- Более идиоматичный подход в React
- Меньше side effects

### ✅ 2. Независимость от родителя
- Каждый item сам знает свою анимацию через `data-animation-type`
- CSS работает только на уровне item
- Легче тестировать и отлаживать

### ✅ 3. Упрощение CSS
**Было:**
```css
.screen-stack[data-animation="navigation"][data-direction="forward"]
  > .screen-stack-item:not([data-presentation='modal']).transition-preEnter {
  transform: translateX(100%);
}
```

**Стало:**
```css
.screen-stack-item[data-animation-type="push-enter"].transition-preEnter {
  transform: translateX(100%);
}
```

### ✅ 4. Расширяемость
Легко добавить новые типы анимаций без изменения структуры:
- `fade-enter/fade-exit`
- `slide-up-enter/slide-up-exit`
- И т.д.

## Реализация

### ScreenStack.web.tsx

```typescript
// 1. Создаем два контекста для оптимизации
const ScreenStackItemsContext = createContext<ScreenStackItemsContextValue | null>(null);
const ScreenStackAnimatingContext = createContext<ScreenStackAnimatingContextValue>(false);

export const useScreenStackItemsContext = () => {
  const ctx = useContext(ScreenStackItemsContext);
  if (!ctx) {
    throw new Error('useScreenStackItemsContext must be used within ScreenStack');
  }
  return ctx;
};

export const useScreenStackAnimatingContext = () => {
  return useContext(ScreenStackAnimatingContext);
};

// 2. Вычисляем items через useMemo (стабильная ссылка)
const itemsContextValue = useMemo(() => {
  const items: ScreenStackItemsContextValue['items'] = {};
  
  for (let index = 0; index < keysToRender.length; index++) {
    const key = keysToRender[index];
    const transitionState = stateMap.get(key);
    if (!transitionState?.isMounted) continue;
    
    const child = childMap.get(key);
    if (!child) continue;
    
    const item = child.props.item;
    const presentation = item?.options?.stackPresentation ?? 'push';
    const animated = item?.options?.animated ?? true;
    const isInStack = routeKeySet.has(key);
    const isTop = isInStack && key === topKey;
    
    let phase: ScreenStackItemPhase;
    if (!isInStack) {
      phase = 'exiting';
    } else if (isTop) {
      phase = 'active';
    } else {
      phase = 'inactive';
    }
    
    const rawStatus = transitionState.status;
    const status = isInitialPhase && 
      (rawStatus === 'preEnter' || rawStatus === 'entering')
        ? 'entered'
        : rawStatus;
    
    const isEntering = isInStack && isTop;
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
      zIndex: index + 1,
    };
  }
  
  return { items };
}, [keysToRender, stateMap, childMap, routeKeySet, topKey, direction, isInitialPhase]);

// 3. Вычисляем animating отдельно через useMemo
const animating = useMemo(() => {
  return Array.from(stateMap.values()).some(
    (state) => state.isMounted && 
    (state.status === 'entering' || state.status === 'exiting' || state.status === 'preEnter' || state.status === 'preExit')
  );
}, [stateMap]);

// 4. Обертываем в два Provider, убираем data-animation/data-direction и otherChildren
return (
  <ScreenStackItemsContext.Provider value={itemsContextValue}>
    <ScreenStackAnimatingContext.Provider value={animating}>
      <div
        ref={containerRef}
        className={containerClassName + (animating ? ' animating' : '')}
      >
        {keysToRender.map((key) => {
          const child = childMap.get(key);
          if (!child) return null;
          
          // Больше не используем cloneElement - стили будут в контексте и props
          return <React.Fragment key={key}>{child}</React.Fragment>;
        })}
      </div>
    </ScreenStackAnimatingContext.Provider>
  </ScreenStackItemsContext.Provider>
);
```

### ScreenStackItem.web.tsx

**Ключевое изменение**: Добавляем стабильный класс типа presentation (`push`, `modal`, `sheet` и т.д.) для описания типа экрана, плюс динамический класс анимации (`push-enter`, `pop-exit` и т.д.)

```typescript
export const ScreenStackItem = memo(({ item, appearance, style }: ScreenStackItemProps) => {
  // Подписываемся только на itemsContext (по ключу) - оптимизация
  const itemsContext = useScreenStackItemsContext();
  const key = item.key; // Вариант C: используем item.key напрямую
  
  const itemState = itemsContext.items[key];
  if (!itemState) {
    // Вариант A: return null если itemState отсутствует
    return null;
  }
  
  // Получаем animating отдельно (может вызывать ререндер, но редко меняется)
  const animating = useScreenStackAnimatingContext();
  
  const { animationType, phase, transitionStatus, zIndex, presentationType } = itemState;
  const presentation = item.options?.stackPresentation ?? 'push';
  
  // Определяем является ли модалкой (для overlay и контейнера)
  const isModalLike = [
    'modal',
    'transparentModal',
    'containedModal',
    'containedTransparentModal',
    'fullScreenModal',
    'formSheet',
    'pageSheet',
    'sheet'
  ].includes(presentation);
  
  const className = useMemo(() => {
    const classes = ['screen-stack-item'];
    
    // Стабильный класс типа экрана (presentation)
    // Например: 'push', 'modal', 'sheet', 'transparent-modal' и т.д.
    if (presentationType) {
      classes.push(presentationType);
    }
    
    // Динамический класс анимации
    // Например: 'push-enter', 'pop-exit', 'modal-enter', 'sheet-exit' и т.д.
    if (animationType && animationType !== 'none' && animationType !== 'no-animate') {
      classes.push(animationType);
    }
    
    // Классы transition статуса
    if (transitionStatus) {
      classes.push(`transition-${transitionStatus}`);
    }
    
    // Классы фазы
    if (phase) {
      classes.push(`phase-${phase}`);
    }
    
    // Активный класс
    if (phase === 'active' || 
        transitionStatus === 'entered' || 
        transitionStatus === 'entering' || 
        transitionStatus === 'preEnter') {
      classes.push('active');
    }
    
    return classes.join(' ');
  }, [presentationType, animationType, transitionStatus, phase]);
  
  // Объединяем стили: базовый, переданный через props, и zIndex из контекста
  const mergedStyle = useMemo(() => ({
    flex: 1,
    ...style,
    zIndex,
  }), [style, zIndex]);
  
  return (
    <div
      style={mergedStyle}
      data-presentation={presentation}
      data-animation-type={animationType}
      data-phase={phase}
      data-transition-status={transitionStatus}
      className={className}
    >
      {/* Overlay для всех modal-типов (CSS решает видимость через data-presentation) */}
      {isModalLike && <div className="stack-modal-overlay" />}
      
      <div className={isModalLike ? 'stack-modal-container' : 'stack-screen-container'}>
        <RouteLocalContext.Provider value={{
          presentation,
          params: item.params,
          query: item.query,
          pattern: item.pattern,
          path: item.path,
        }}>
          <View style={[styles.flex, appearance?.screen]}>
            <item.component {...(item.passProps || {})} />
          </View>
        </RouteLocalContext.Provider>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Кастомная функция сравнения для memo - ререндер только если изменился key
  return prevProps.item.key === nextProps.item.key &&
         prevProps.item === nextProps.item &&
         prevProps.appearance === nextProps.appearance &&
         prevProps.style === nextProps.style;
});
```

**Пример классов на элементе:**
- Push экран при входе: `class="screen-stack-item push push-enter transition-entering phase-active active"`
- Push экран при выходе: `class="screen-stack-item push pop-exit transition-exiting phase-exiting"`
- Фоновый push экран: `class="screen-stack-item push push-background phase-inactive transition-entered"`
- Modal при входе: `class="screen-stack-item modal modal-enter transition-entering phase-active active"`
- Sheet при выходе: `class="screen-stack-item sheet sheet-exit transition-exiting phase-exiting"`

**Преимущества:**
- Стабильный класс типа (`push`, `modal`) позволяет описывать общие стили для типа экрана
- Динамический класс анимации (`push-enter`, `pop-exit`) описывает текущую анимацию
- CSS может использовать комбинации: `.push.push-enter`, `.modal.modal-enter`, `.push.push-background` и т.д.

### CSS рефакторинг

```css
/* Базовые стили остаются */
.screen-stack {
  /* ... */
}

.screen-stack.animating {
  /* Утилитарные стили во время анимации */
  overflow: hidden;
  /* pointer-events: none; если нужно блокировать интеракции */
}

/* ==================== ОБЩИЕ СТИЛИ ПО ТИПУ ЭКРАНА ==================== */

/* Push экраны - базовые стили */
.screen-stack-item.push {
  /* Общие стили для всех push экранов */
}

/* Modal экраны - базовые стили */
.screen-stack-item.modal {
  /* Общие стили для всех modal экранов */
}

/* Sheet экраны - базовые стили */
.screen-stack-item.sheet {
  /* Общие стили для всех sheet экранов */
}

/* ==================== PUSH АНИМАЦИИ ==================== */

/* PUSH ENTER - обычный экран въезжает справа */
.screen-stack-item.push.push-enter.transition-preEnter {
  transform: translateX(100%);
}

.screen-stack-item.push.push-enter.transition-entering,
.screen-stack-item.push.push-enter.transition-entered {
  transform: translateX(0);
}

/* PUSH BACKGROUND - фоновый экран сдвигается влево */
.screen-stack-item.push.push-background {
  transform: translateX(-25%);
}

/* POP EXIT - верхний экран уезжает вправо */
.screen-stack-item.push.pop-exit.transition-exiting {
  transform: translateX(100%);
}

/* POP ENTER - экран возвращается в центр */
.screen-stack-item.push.pop-enter.transition-entering,
.screen-stack-item.push.pop-enter.transition-entered {
  transform: translateX(0);
}

/* ==================== MODAL АНИМАЦИИ ==================== */

/* MODAL ENTER - модалка входит */
/* Mobile: снизу вверх (translateY) */
@media (max-width: 639px) {
  .screen-stack-item.modal.modal-enter 
    .stack-modal-container.transition-preEnter {
    transform: translateY(100%);
  }

  .screen-stack-item.modal.modal-enter 
    .stack-modal-container.transition-entering,
  .screen-stack-item.modal.modal-enter 
    .stack-modal-container.transition-entered {
    transform: translateY(0);
  }

  .screen-stack-item.modal.modal-exit 
    .stack-modal-container.transition-exiting {
    transform: translateY(100%);
  }
}

/* Desktop: справа налево (translateX) */
@media (min-width: 640px) {
  .screen-stack-item.modal.modal-enter 
    .stack-modal-container.transition-preEnter {
    transform: translateX(100%);
  }

  .screen-stack-item.modal.modal-enter 
    .stack-modal-container.transition-entering,
  .screen-stack-item.modal.modal-enter 
    .stack-modal-container.transition-entered {
    transform: translateX(0);
  }

  .screen-stack-item.modal.modal-exit 
    .stack-modal-container.transition-exiting {
    transform: translateX(100%);
  }
}

/* ==================== SHEET АНИМАЦИИ ==================== */

.screen-stack-item.sheet.sheet-enter 
  .stack-modal-container.transition-preEnter {
  transform: translateY(100%);
}

.screen-stack-item.sheet.sheet-enter 
  .stack-modal-container.transition-entering,
.screen-stack-item.sheet.sheet-enter 
  .stack-modal-container.transition-entered {
  transform: translateY(0);
}

.screen-stack-item.sheet.sheet-exit 
  .stack-modal-container.transition-exiting {
  transform: translateY(100%);
}

/* ==================== СПЕЦИАЛЬНЫЕ СЛУЧАИ ==================== */

/* NO-ANIMATE - без анимации (screenOptions.animated === false) */
.screen-stack-item[data-animation-type="no-animate"] {
  transform: translate3d(0, 0, 0) !important;
  transition: none !important;
}

/* NONE - без анимации (initial mount) */
.screen-stack-item[data-animation-type="none"] {
  transform: translate3d(0, 0, 0) !important;
  transition: none !important;
}
```

## Принятые решения ✅

### 1. Ключ для контекста
**Решение: Вариант C** - Использовать `item.key` напрямую
- `item.key` является стабильным идентификатором
- Не требуется дополнительная логика передачи ключа

### 2. Порядок рендеринга
**Решение**: Использовать `useMemo` для `contextValue`
- Гарантирует синхронное обновление контекста для всех items
- Предотвращает лишние ререндеры

### 3. Контроль анимации через screenOptions
**Решение**: Принимать параметр `animated` из `screenOptions`
- Если `screenOptions.animated === false`, устанавливаем `animationType: 'no-animate'`
- CSS для `no-animate` отключает все анимации (аналогично `none`, но семантически различается)
- Альтернатива: можно не ставить классы/атрибуты вообще, если `animated === false`

**Реализация:**
```typescript
const animated = item?.options?.animated ?? true;
const animationType = computeAnimationType(..., animated);
```

**Примечание**: Если поле `animated` отсутствует в типе `ScreenOptions`, его нужно добавить:
```typescript
export type ScreenOptions = Partial<
  Omit<RNSScreenProps, 'stackPresentation'>
> & {
  // ... existing fields ...
  animated?: boolean; // Контроль анимации для конкретного экрана (default: true)
};
```

**CSS:**
```css
.screen-stack-item[data-animation-type="no-animate"] {
  transform: translate3d(0, 0, 0) !important;
  transition: none !important;
}
```

### 4. Модалки на desktop vs mobile
**Решение**: Один тип `'modal-enter'`, CSS через media query решает все
- `animationType: 'modal-enter'` для всех случаев
- CSS через `@media (max-width: 639px)` применяет `translateY` для mobile
- CSS через `@media (min-width: 640px)` применяет `translateX` для desktop

## Вопросы для уточнения перед реализацией

### 1. Другие типы presentation (transparentModal, containedModal, fullScreenModal, formSheet, pageSheet)
**Решение: Вариант B** — Разные animationType для разных типов модалок

**Типы анимаций для presentation:**
- `'push'` → `push-enter`, `push-exit`, `push-background`, `pop-enter`, `pop-exit`, `pop-background`
- `'modal'` → `modal-enter`, `modal-exit`
- `'transparentModal'` → `transparent-modal-enter`, `transparent-modal-exit`
- `'containedModal'` → `contained-modal-enter`, `contained-modal-exit`
- `'fullScreenModal'` → `fullscreen-modal-enter`, `fullscreen-modal-exit`
- `'formSheet'` → `formsheet-enter`, `formsheet-exit`
- `'pageSheet'` → `pagesheet-enter`, `pagesheet-exit`
- `'sheet'` → `sheet-enter`, `sheet-exit` (особая анимация для веб)
- Остальные → fallback к `push-*`

**Реализация:**
```typescript
function getAnimationTypeForPresentation(
  presentation: StackPresentationTypes,
  isEntering: boolean,
  direction: 'forward' | 'back'
): string {
  const suffix = isEntering ? 'enter' : 'exit';
  
  switch (presentation) {
    case 'push': return direction === 'forward' ? `push-${suffix}` : `pop-${suffix}`;
    case 'modal': return `modal-${suffix}`;
    case 'transparentModal': return `transparent-modal-${suffix}`;
    case 'containedModal': return `contained-modal-${suffix}`;
    case 'fullScreenModal': return `fullscreen-modal-${suffix}`;
    case 'formSheet': return `formsheet-${suffix}`;
    case 'pageSheet': return `pagesheet-${suffix}`;
    case 'sheet': return `sheet-${suffix}`;
    default: return `push-${suffix}`;
  }
}
```

### 2. Передача zIndex и style
**Решение: Вариант C** — `zIndex` через контекст, `style` через props

**Реализация:**
- `zIndex` включается в контекст `items[key].zIndex` (вычисляется на основе индекса в `keysToRender`)
- `style` передается через props напрямую (может быть передан извне через `appearance` или другие источники)
- В `ScreenStackItem` объединяем: `style={{ flex: 1, ...style, zIndex }}`

### 3. Fallback когда itemState отсутствует в контексте
**Решение: Вариант A** — `return null`

**Обоснование**: Если item еще не в контексте — он не должен рендериться. Контекст обновляется синхронно через `useMemo`, поэтому такой случай должен быть редким (только при race conditions).

### 4. Sheet на вебе
**Решение: Вариант B** — Свой тип `sheet-enter/sheet-exit` с bottom sheet анимацией

**Реализация:**
- `sheet-enter` и `sheet-exit` для `presentation: 'sheet'`
- Анимация снизу вверх (аналогично mobile modal)
- CSS может отличаться от modal (например, другой corner radius, другая высота)

### 5. Разные transition time для разных анимаций
**Решение: Вариант A** — Оставить в CSS

**Обоснование**: Переходы обычно имеют фиксированное время. Если понадобится динамическое изменение — добавим через CSS переменные позже.

### 6. Разделение контекста (производительность)
**Решение: Вариант B** — Два контекста для оптимизации

**Архитектура:**
```typescript
// Контекст для данных элементов (изменяется реже)
const ScreenStackItemsContext = createContext<{
  items: { [key: string]: ItemState };
} | null>(null);

// Контекст для флага анимации (изменяется чаще)
const ScreenStackAnimatingContext = createContext<boolean>(false);
```

**Преимущества:**
- `ScreenStackItem` подписывается только на `ItemsContext` по своему ключу
- `animating` меняется чаще, но не вызывает ререндер items
- Можно использовать `useMemo` и `memo` для каждого контекста отдельно

### 7. Overlay для других modal-типов
**Решение: Вариант C** — CSS решает через `data-presentation`

**Реализация:**
- Overlay рендерится для всех modal-типов
- CSS через селекторы контролирует видимость и стили:
```css
.screen-stack-item[data-presentation='modal'] .stack-modal-overlay { opacity: 0.5; }
.screen-stack-item[data-presentation='transparentModal'] .stack-modal-overlay { opacity: 0; }
.screen-stack-item[data-presentation='containedModal'] .stack-modal-overlay { opacity: 0.3; }
/* и т.д. */
```

### 8. Обработка быстрых последовательных переходов
**Вопрос**: Что происходит при быстрых переходах (например, два `push` подряд)?
- Текущая реализация должна справляться (через `stateMap`), но нужно убедиться, что `animationType` корректно вычисляется для всех элементов.

**Проверка**: Убедиться, что `computeAnimationType` корректно работает, когда:
- Элемент входит во время выхода другого
- Два элемента одновременно входят/выходят

### 9. `item.key` гарантированно доступен?
**Текущее состояние**: Предполагаем, что `item.key` всегда есть.

**Проверка**: Нужно убедиться, что `item.key`:
- Всегда уникален
- Всегда строка
- Соответствует ключу в `childMap` и `routeKeys`

**Примечание**: В коде уже есть проверка в `getItemKey()`, которая выбрасывает ошибку если ключ отсутствует.

### 10. `otherChildren` вне контекста
**Решение**: Выкидываем `otherChildren` — не поддерживаем нестековые дети внутри `ScreenStack`.

**Обоснование**: Упрощает архитектуру, все дети должны быть `ScreenStackItem`.

### 11. `pop-background` и `push-background` — нужны ли они?
**Текущее состояние**: В CSS нет стилей для `pop-background`, есть только `push-background` (сдвиг влево на -25%).

**Вопрос**: Нужен ли `pop-background` или фоновые элементы при pop всегда остаются на месте?

**Варианты**:
- **A**: `pop-background` не нужен, фоновые элементы остаются на месте (transform: translateX(0))
- **B**: `pop-background` нужен, фоновые элементы возвращаются из -25% в 0

**Текущее поведение в CSS**: Фоновые элементы при pop просто остаются на `translateX(0)`.

**Рекомендация**: Вариант A — `pop-background` не нужен, фоновые элементы при pop остаются на месте. Можно упростить: фоновые элементы всегда `translateX(-25%)` при forward, и `translateX(0)` при back или без анимации.

### 12. `containedTransparentModal` не учтен
**Проблема**: В типах есть `'containedTransparentModal'`, но он не включен в список modal-типов.

**Решение**: Добавить в список:
```typescript
const isModalLike = [
  'modal',
  'transparentModal',
  'containedModal',
  'containedTransparentModal', // <-- добавить
  'fullScreenModal',
  'formSheet',
  'pageSheet',
  'sheet'
].includes(presentation);
```

И добавить в `getAnimationTypeForPresentation`:
```typescript
case 'containedTransparentModal': 
  return `contained-transparent-modal-${suffix}`;
```

### 13. `stackAnimation` из screenOptions — нужен ли?
**Текущее состояние**: В `ScreenOptions` есть `stackAnimation?: 'default' | 'fade' | 'flip' | ...`, но мы используем только `animated: boolean`.

**Вопрос**: Нужно ли учитывать `stackAnimation` для разных типов анимаций (fade, flip и т.д.)?

**Варианты**:
- **A**: Игнорируем `stackAnimation`, используем только `animated: boolean` (для веба всегда slide-анимации)
- **B**: Учитываем `stackAnimation` и меняем `animationType` соответственно (например, `fade-enter`, `flip-enter`)

**Рекомендация**: Вариант A — для веба всегда используются slide-анимации. `stackAnimation` можно учесть позже, если потребуется.

### 14. Prop `type?: TransitionStackType` в ScreenStack
**Текущее состояние**: ScreenStack принимает `type?: 'modal' | 'navigation'`.

**Вопрос**: Нужен ли этот prop после рефакторинга? Раньше он использовался для `data-animation`, который мы убираем.

**Варианты**:
- **A**: Убрать prop `type`, определять тип из presentation элементов
- **B**: Оставить для совместимости или других целей

**Рекомендация**: Вариант A — убрать, тип определяется автоматически из presentation элементов.

### 15. Параметр `isEntering` в `computeAnimationType`
**Вопрос**: Откуда берется `isEntering`? Как его вычислять?

**Решение**: `isEntering = isInStack && isTop && direction === 'forward'` (элемент входит наверх при forward).
Но логичнее использовать уже вычисленные `isInStack`, `isTop`, `direction` внутри функции.

**Исправление**: Убрать параметр `isEntering`, вычислять внутри функции:
```typescript
const isEntering = isInStack && isTop;
const isExiting = !isInStack;
```

### 16. Направление при первом рендере (`prevKeysRef.current.length === 0`)
**Вопрос**: Когда `prevKeysRef.current.length === 0` (первый рендер), `computeDirection` возвращает `'forward'`. Это корректно?

**Решение**: Да, корректно. На первом рендере элементы входят, значит direction = 'forward'. Но так как `isInitialPhase = true`, `animationType` будет `'none'`, так что direction не важен.

### 17. Фоновые элементы для modal-типов
**Вопрос**: Нужен ли `*-background` для modal-типов, или фоновые элементы под модалкой всегда остаются на месте?

**Текущее поведение**: В CSS есть правило, что при наличии активной модалки фоновые элементы не двигаются.

**Решение**: Для modal-типов не нужны background-анимации. Фоновые элементы под модалкой всегда остаются на `translateX(0)`. Это обрабатывается через CSS `:has()` селектор или через логику в `computeAnimationType` (если сверху есть modal, не применяем background).

### 18. Стабильный класс типа presentation + динамический класс анимации
**Решение**: Используем два класса:
- **Стабильный класс типа** (`presentationType`): `'push'`, `'modal'`, `'sheet'` и т.д. — описывает тип экрана
- **Динамический класс анимации** (`animationType`): `'push-enter'`, `'pop-exit'`, `'modal-enter'` и т.д. — описывает текущую анимацию

**Пример классов на элементе:**
- `class="screen-stack-item push push-enter transition-entering phase-active active"`
- `class="screen-stack-item push pop-exit transition-exiting phase-exiting"`
- `class="screen-stack-item modal modal-enter transition-entering phase-active active"`

**Преимущества:**
- CSS может использовать комбинации: `.push.push-enter`, `.push.push-background`, `.modal.modal-enter`
- Стабильный класс позволяет описывать общие стили для типа экрана
- Динамический класс описывает конкретную анимацию

## Итоговая оценка

### ✅ Плюсы
1. Чище архитектура (Context вместо cloneElement)
2. Проще CSS (только item-селекторы)
3. Легче расширять
4. Соответствует React best practices

### ⚠️ Риски
1. Нужно гарантировать синхронизацию ключей между ScreenStack и ScreenStackItem
2. Migration может потребовать внимательной проверки всех edge cases
3. ~~Context может ререндерить все children при изменении~~ → **РЕШЕНО**: Разделение на два контекста + `useMemo` + `memo` компоненты

## Оптимизация производительности ⚡

**Ключевое требование**: Ререндериться должен только нужный `ScreenStackItem`, не все.

### Стратегия оптимизации:

1. **Два контекста** (разделение по частоте изменений):
   - `ScreenStackItemsContext` — меняется при изменении стека (реже)
   - `ScreenStackAnimatingContext` — меняется во время анимации (чаще, но не вызывает ререндер items)

2. **useMemo для контекстов**:
   ```typescript
   const itemsContextValue = useMemo(() => ({ items }), [dependencies]);
   const animating = useMemo(() => boolean, [stateMap]);
   ```

3. **memo для ScreenStackItem**:
   ```typescript
   export const ScreenStackItem = memo(Component, (prev, next) => {
     // Кастомная функция сравнения
     return prev.item.key === next.item.key &&
            prev.item === next.item &&
            prev.appearance === next.appearance &&
            prev.style === next.style;
   });
   ```

4. **useMemo внутри ScreenStackItem**:
   - `className` через `useMemo`
   - `mergedStyle` через `useMemo`
   - Любые вычисления на основе `itemState`

### ⚠️ Важное замечание о ререндерах:
**При изменении React Context ВСЕ потребители контекста ререндерятся**, даже если их конкретное значение в контексте не изменилось. Это фундаментальное поведение React Context.

**Однако:**
- **Ререндер компонента (вызов функции)** — дешевая операция
- **Обновление DOM** — дорогая операция
- `memo` предотвращает обновление DOM, если props не изменились, но сам вызов функции все равно происходит

**Что мы можем гарантировать:**
- ✅ DOM обновляется только для компонентов, у которых изменились props (через `memo`)
- ✅ `useMemo` внутри компонента предотвращает лишние вычисления
- ✅ Разделение контекстов минимизирует количество компонентов, которые видят изменения
- ❌ Мы НЕ можем предотвратить вызов функции компонента при изменении контекста

**Альтернатива**: Если критично избежать вызова функции, можно передавать данные через props вместо контекста, но это усложняет архитектуру.

### 🎯 Рекомендация
**Реализовать**, но с осторожностью:
1. Начать с простых случаев (push-enter, pop-exit)
2. Постепенно мигрировать остальные анимации
3. Добавить fallback для edge cases
4. Тщательно протестировать все сценарии навигации

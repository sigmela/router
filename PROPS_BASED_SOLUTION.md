# Решение: Передача истории через props (top-down)

## Текущая проблема

**Сейчас каждый компонент сам получает историю:**
```typescript
// StackRenderer.tsx
const historyForThisStack = useSyncExternalStore(
  subscribe,
  () => router.getStackHistory(stackId),
  () => router.getStackHistory(stackId)
);

// Navigation.tsx
const rootItems = useStackHistory(router, rootId);
const globalItems = useStackHistory(router, globalId);
```

**Проблемы:**
- Каждый компонент подписывается отдельно
- Каждый компонент вызывает `getStackHistory()`
- Нужна мемоизация для предотвращения ререндеров
- Сложная логика с `useSyncExternalStore`

## ✅ Решение: Передача через props

### Идея: Данные сверху вниз (React-way)

**Вместо того чтобы компоненты сами получали данные:**
1. Router хранит готовые массивы истории для каждого стека
2. При изменении истории обновляет массивы (сохраняя ссылку если не изменилось)
3. Передаем историю через props в компоненты
4. Компоненты просто рендерят то, что получили

### Архитектура:

```
Router (хранит готовые массивы)
  ↓ props: history={rootHistory}
Navigation
  ↓ props: history={stackHistory}
StackRenderer
  ↓ props: item={item}
ScreenStackItem
```

## Реализация

### 1. Router: Храним готовые массивы и обновляем при изменении

```typescript
export class Router {
  // Готовые массивы истории для каждого стека
  private stackHistories = new Map<string, HistoryItem[]>();

  private setState(next: Partial<RouterState>): void {
    const prev = this.state;
    this.state = {
      history: next.history ?? prev.history,
    };
    
    // Обновляем готовые массивы истории
    if (this.state.history !== prev.history) {
      this.updateStackHistories();
    }
    
    this.log('setState', this.state);
  }

  private updateStackHistories(): void {
    // Получаем все уникальные stackId
    const stackIds = new Set<string>();
    this.state.history.forEach(item => {
      if (item.stackId) stackIds.add(item.stackId);
    });

    // Обновляем массивы для каждого стека
    stackIds.forEach(stackId => {
      const current = this.state.history.filter(item => item.stackId === stackId);
      const previous = this.stackHistories.get(stackId);
      
      // Если содержимое не изменилось → сохраняем старую ссылку
      if (previous && this.areArraysEqual(previous, current)) {
        // Не обновляем - старая ссылка останется
        return;
      }
      
      // Содержимое изменилось → сохраняем новый массив
      this.stackHistories.set(stackId, current);
    });

    // Удаляем массивы для стеков, которых больше нет
    const currentStackIds = new Set(stackIds);
    this.stackHistories.forEach((_, stackId) => {
      if (!currentStackIds.has(stackId)) {
        this.stackHistories.delete(stackId);
      }
    });

    // Эмитим события для подписчиков
    stackIds.forEach(stackId => {
      this.emit(this.stackListeners.get(stackId));
    });
  }

  private areArraysEqual(a: HistoryItem[], b: HistoryItem[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Публичный API для получения истории (для совместимости)
  public getStackHistory = (stackId?: string): HistoryItem[] => {
    if (!stackId) return EMPTY_ARRAY;
    return this.stackHistories.get(stackId) ?? EMPTY_ARRAY;
  };

  // Новый метод: получить историю для рендеринга (с подпиской)
  public useStackHistory(stackId?: string): HistoryItem[] {
    // Используем useSyncExternalStore для реактивности
    // Но теперь просто возвращаем готовый массив из stackHistories
    const subscribe = useCallback(
      (cb: () => void) => stackId ? this.subscribeStack(stackId, cb) : () => {},
      [stackId]
    );
    const get = useCallback(
      () => this.getStackHistory(stackId),
      [stackId]
    );
    return useSyncExternalStore(subscribe, get, get);
  }
}
```

### 2. Navigation: Получаем историю и передаем через props

```typescript
export const Navigation = memo<NavigationProps>(({ router, appearance }) => {
  const [root, setRoot] = useState(() => ({
    rootId: router.getRootStackId(),
  }));

  useEffect(() => {
    return router.subscribeRoot(() => {
      setRoot({
        rootId: router.getRootStackId(),
      });
    });
  }, [router]);

  const { rootId } = root;
  const rootTransition = router.getRootTransition();
  const globalId = router.getGlobalStackId();
  
  // Получаем историю через hook (но теперь это просто чтение готового массива)
  const rootItems = router.useStackHistory(rootId);
  const globalItems = router.useStackHistory(globalId);

  return (
    <RouterContext.Provider value={router}>
      <ScreenStack style={styles.flex}>
        {rootItems.map((item) => (
          <ScreenStackItem
            key={`root-${item.key}`}
            stackId={rootId}
            item={item}
            stackAnimation={rootTransition}
            appearance={appearance}
          />
        ))}
        {globalItems.map((item) => (
          <ScreenStackItem
            key={`global-${item.key}`}
            appearance={appearance}
            stackId={globalId}
            item={item}
          />
        ))}
      </ScreenStack>
    </RouterContext.Provider>
  );
});
```

### 3. StackRenderer: Получаем историю через props (если передается)

**Вариант A: Через props (если передается из NavigationStack)**
```typescript
export interface StackRendererProps {
  stack: NavigationStack;
  appearance?: NavigationAppearance;
  history?: HistoryItem[]; // ← Передаем через props
}

export const StackRenderer = memo<StackRendererProps>(
  ({ stack, appearance, history }) => {
    const router = useRouter();
    const stackId = stack.getId();
    
    // Если история передана через props - используем её
    // Иначе получаем через hook (fallback для совместимости)
    const historyForThisStack = history ?? router.useStackHistory(stackId);

    return (
      <ScreenStack
        key={`stack-${stackId}`}
        style={[styles.flex, appearance?.screen]}
      >
        {historyForThisStack.map((item) => (
          <ScreenStackItem
            key={`stack-renderer-${item.key}`}
            appearance={appearance}
            stackId={stackId}
            item={item}
          />
        ))}
      </ScreenStack>
    );
  }
);
```

**Вариант B: NavigationStack передает историю в getRenderer()**

```typescript
// NavigationStack.ts
public getRenderer(): React.ComponentType<any> {
  return (props: { router: Router }) => {
    const stackId = this.getId();
    const history = props.router.useStackHistory(stackId);
    
    return (
      <StackRenderer
        stack={this}
        history={history} // ← Передаем историю
        appearance={props.appearance}
      />
    );
  };
}
```

## Преимущества

### 1. ✅ Проще компоненты
- Нет `useSyncExternalStore` в каждом компоненте
- Нет подписок в каждом компоненте
- Компоненты просто получают props и рендерят

### 2. ✅ Единое место обновления
- Router обновляет массивы один раз при изменении истории
- Сохраняет ссылки если содержимое не изменилось
- Автоматически предотвращает ререндеры

### 3. ✅ Меньше вызовов
- `getStackHistory()` вызывается только при обновлении истории
- Не вызывается при каждом рендере компонента
- Меньше вычислений

### 4. ✅ Более React-way
- Данные сверху вниз (props)
- Компоненты не знают о Router напрямую
- Легче тестировать (можно передать mock историю)

### 5. ✅ Нет необходимости в сложной мемоизации
- Массивы обновляются в одном месте
- Ссылки сохраняются автоматически
- Нет версионирования

## Сравнение

| Критерий | Текущий подход | Props-based подход |
|----------|----------------|---------------------|
| **Подписки** | В каждом компоненте | В Router (один раз) |
| **Вызовы getStackHistory** | При каждом рендере | Только при изменении истории |
| **Мемоизация** | Нужна в getStackHistory | В Router (автоматически) |
| **Сложность компонентов** | Средняя | Низкая |
| **React-way** | ⚠️ Смешанный | ✅ Да (props) |
| **Тестируемость** | ⚠️ Нужен Router | ✅ Можно передать mock |

## Итоговая рекомендация

### ✅ Использовать props-based подход

**Причины:**
1. ✅ Проще компоненты (нет подписок)
2. ✅ Единое место обновления (Router)
3. ✅ Автоматическое предотвращение ререндеров (сохранение ссылок)
4. ✅ Более React-way (данные сверху вниз)
5. ✅ Меньше вычислений (обновление только при изменении)

**Это оптимальное решение:**
- Упрощает компоненты
- Централизует логику в Router
- Автоматически предотвращает ререндеры
- Соответствует React best practices

---

## План миграции

### Шаг 1: Добавить `stackHistories` в Router
- Хранить готовые массивы для каждого стека
- Обновлять при изменении истории
- Сохранять ссылки если содержимое не изменилось

### Шаг 2: Обновить `setState()`
- Вызывать `updateStackHistories()` при изменении истории
- Эмитить события для подписчиков

### Шаг 3: Упростить компоненты
- Убрать `useSyncExternalStore` из компонентов
- Использовать `router.useStackHistory()` (который просто читает готовый массив)
- Или передавать через props (если возможно)

### Шаг 4: Тестирование
- Проверить, что ререндеры не происходят без изменений
- Проверить, что компоненты обновляются при изменении истории
- Проверить производительность

---

## Дополнительная оптимизация

Можно сделать `getRenderer()` в NavigationStack принимающим историю:

```typescript
// NavigationStack.ts
public getRenderer(history?: HistoryItem[]): React.ComponentType<any> {
  return (props: { router: Router }) => {
    const stackId = this.getId();
    // Используем переданную историю или получаем через router
    const stackHistory = history ?? props.router.useStackHistory(stackId);
    
    return (
      <StackRenderer
        stack={this}
        history={stackHistory}
        appearance={props.appearance}
      />
    );
  };
}
```

Тогда Router может передавать историю напрямую при рендеринге!

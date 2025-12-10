# Финальное решение: Props-based с обновлением в setState()

## Идея

Если передаем историю через props компонентам, то:
1. **Вся логика в `setState()`** - обновляем готовые массивы один раз при изменении истории
2. **Сохраняем ссылки** если содержимое не изменилось → предотвращаем ререндеры
3. **Компоненты получают через props** - не вызывают `getStackHistory()`
4. **Просто и эффективно**

## Реализация

### Router: Обновляем готовые массивы в setState()

```typescript
export class Router {
  private state: RouterState = { history: [] };
  
  // Готовые массивы истории для каждого стека
  private stackHistories = new Map<string, HistoryItem[]>();

  private setState(next: Partial<RouterState>): void {
    const prev = this.state;
    this.state = {
      history: next.history ?? prev.history,
    };
    
    // Обновляем готовые массивы истории (один раз при изменении!)
    if (this.state.history !== prev.history) {
      this.updateStackHistories();
    }
    
    this.log('setState', this.state);
  }

  private updateStackHistories(): void {
    // Получаем все уникальные stackId из истории
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
        // Не обновляем - старая ссылка останется → нет ререндера!
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

    // Эмитим события для подписчиков (для useSyncExternalStore)
    stackIds.forEach(stackId => {
      this.emit(this.stackListeners.get(stackId));
    });
  }

  private areArraysEqual(a: HistoryItem[], b: HistoryItem[]): boolean {
    if (a.length !== b.length) return false;
    // Сравниваем ссылки на объекты (элементы истории immutable)
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Публичный API для получения истории (для совместимости или прямого доступа)
  public getStackHistory = (stackId?: string): HistoryItem[] => {
    if (!stackId) return EMPTY_ARRAY;
    // Просто читаем готовый массив (O(1))
    return this.stackHistories.get(stackId) ?? EMPTY_ARRAY;
  };
}
```

### Компоненты: Получают историю через props

```typescript
// Navigation.tsx
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
  
  // Получаем готовые массивы (просто чтение, O(1))
  const rootItems = router.getStackHistory(rootId);
  const globalItems = router.getGlobalStackId() ? router.getStackHistory(globalId) : EMPTY_ARRAY;

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

```typescript
// StackRenderer.tsx
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
    // Иначе получаем из router (fallback)
    const historyForThisStack = history ?? router.getStackHistory(stackId);

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

## Преимущества

### 1. ✅ Вся логика в одном месте
- Обновление массивов происходит **один раз** в `setState()`
- Нет логики в `getStackHistory()` - просто чтение
- Нет мемоизации в `getStackHistory()` - не нужна!

### 2. ✅ Автоматическое предотвращение ререндеров
- Сохраняем ссылки если содержимое не изменилось
- `useSyncExternalStore` видит, что ссылка не изменилась → нет ререндера
- Работает автоматически!

### 3. ✅ Простые компоненты
- Компоненты просто читают готовые массивы
- Нет сложной логики с мемоизацией
- Нет `useSyncExternalStore` в каждом компоненте (если передаем через props)

### 4. ✅ Эффективно
- Фильтрация происходит **один раз** при изменении истории
- `getStackHistory()` просто читает готовый массив (O(1))
- Меньше вычислений

### 5. ✅ React-way
- Данные сверху вниз через props
- Компоненты не знают о внутренней логике Router
- Легче тестировать

## Сравнение подходов

| Критерий | Мемоизация в getStackHistory | Обновление в setState |
|----------|------------------------------|----------------------|
| **Где логика** | В `getStackHistory()` | В `setState()` |
| **Когда обновляется** | При каждом вызове | Один раз при изменении истории |
| **Фильтрация** | При каждом вызове (если нет в мемо) | Один раз при изменении |
| **Сложность** | Средняя | Простая |
| **Производительность** | Хорошая | Отличная |

## Итоговая рекомендация

### ✅ Использовать обновление в `setState()`

**Причины:**
1. ✅ Вся логика в одном месте (`setState()`)
2. ✅ Обновление происходит один раз при изменении истории
3. ✅ `getStackHistory()` просто читает готовый массив (O(1))
4. ✅ Автоматическое предотвращение ререндеров (сохранение ссылок)
5. ✅ Проще и эффективнее

**Это оптимальное решение!**

---

## Что убираем

- ❌ `historyVersion` - не нужен
- ❌ `stackHistoryCache` с версионированием - не нужен
- ❌ Мемоизацию в `getStackHistory()` - не нужна
- ❌ `useSyncExternalStore` в компонентах (если передаем через props)

## Что добавляем

- ✅ `stackHistories` - готовые массивы для каждого стека
- ✅ `updateStackHistories()` - обновление в `setState()`
- ✅ Сохранение ссылок если содержимое не изменилось

## План реализации

1. Добавить `stackHistories` в Router
2. Добавить `updateStackHistories()` в `setState()`
3. Упростить `getStackHistory()` - просто чтение
4. Обновить компоненты - получать через props или `getStackHistory()`
5. Убрать старый кеш и версионирование
6. Тестирование

---

## Дополнительно: useSyncExternalStore для реактивности

Если компоненты все еще используют `useSyncExternalStore` (для реактивности), то:

```typescript
// Navigation.tsx
function useStackHistory(router: Router, stackId?: string) {
  const subscribe = useCallback(
    (cb: () => void) =>
      stackId ? router.subscribeStack(stackId, cb) : () => {},
    [router, stackId]
  );
  const get = useCallback(
    () => (stackId ? router.getStackHistory(stackId) : EMPTY_HISTORY),
    [router, stackId]
  );
  return useSyncExternalStore(subscribe, get, get);
}
```

Но теперь `getStackHistory()` просто читает готовый массив, и если ссылка не изменилась - `useSyncExternalStore` не вызовет ререндер!

**Это идеальное решение!**

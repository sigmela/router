# Анализ: Единый history vs stackHistories

## Вопрос

Зачем хранить отдельные массивы `stackHistories` для каждого стека, если можно просто использовать единый `state.history`?

## Варианты решения

### Вариант 1: Единый `state.history` + мемоизация в `getStackHistory()`

```typescript
export class Router {
  private state: RouterState = { history: [] };
  
  // Мемоизация результатов фильтрации
  private stackHistoryMemo = new Map<string, HistoryItem[]>();

  public getStackHistory = (stackId?: string): HistoryItem[] => {
    if (!stackId) return EMPTY_ARRAY;
    
    // Вычисляем текущий результат
    const current = this.state.history.filter(item => item.stackId === stackId);
    
    // Получаем предыдущий результат
    const previous = this.stackHistoryMemo.get(stackId);
    
    // Если содержимое не изменилось → возвращаем старую ссылку
    if (previous && this.areArraysEqual(previous, current)) {
      return previous;
    }
    
    // Содержимое изменилось → сохраняем новый результат
    this.stackHistoryMemo.set(stackId, current);
    return current;
  };

  private setState(next: Partial<RouterState>): void {
    this.state = {
      history: next.history ?? this.state.history,
    };
    // НЕ нужно ничего делать - мемоизация обновится автоматически при следующем вызове
  }
}
```

**Плюсы:**
- ✅ Единый источник данных (`state.history`)
- ✅ Мемоизация автоматическая (обновляется при вызове)
- ✅ Нет необходимости в `updateStackHistories()`
- ✅ Проще код

**Минусы:**
- ⚠️ Фильтрация происходит при каждом вызове `getStackHistory()` (даже если результат тот же)
- ⚠️ Нужно сравнивать массивы при каждом вызове

---

### Вариант 2: Отдельные массивы `stackHistories` (предложенное ранее)

```typescript
export class Router {
  private state: RouterState = { history: [] };
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
  }

  private updateStackHistories(): void {
    const stackIds = new Set<string>();
    this.state.history.forEach(item => {
      if (item.stackId) stackIds.add(item.stackId);
    });

    stackIds.forEach(stackId => {
      const current = this.state.history.filter(item => item.stackId === stackId);
      const previous = this.stackHistories.get(stackId);
      
      if (previous && this.areArraysEqual(previous, current)) {
        return; // Сохраняем старую ссылку
      }
      
      this.stackHistories.set(stackId, current);
    });
  }

  public getStackHistory = (stackId?: string): HistoryItem[] => {
    if (!stackId) return EMPTY_ARRAY;
    return this.stackHistories.get(stackId) ?? EMPTY_ARRAY;
  };
}
```

**Плюсы:**
- ✅ Готовые массивы (не нужно фильтровать при каждом вызове)
- ✅ Обновление происходит один раз при изменении истории
- ✅ `getStackHistory()` просто читает готовый массив (O(1))

**Минусы:**
- ⚠️ Нужно вызывать `updateStackHistories()` при каждом изменении
- ⚠️ Дополнительное поле `stackHistories`

---

## Сравнение производительности

### Сценарий: История изменилась, компоненты получают данные

**Вариант 1 (мемоизация в getStackHistory):**
```
1. setState() → изменяется state.history
2. Компонент 1 вызывает getStackHistory('stackA')
   - Фильтрует state.history → новый массив
   - Сравнивает с предыдущим → разные
   - Сохраняет в мемо → возвращает новый массив
3. Компонент 2 вызывает getStackHistory('stackA')
   - Фильтрует state.history → новый массив (снова!)
   - Сравнивает с предыдущим → одинаковые
   - Возвращает старую ссылку
4. Компонент 3 вызывает getStackHistory('stackB')
   - Фильтрует state.history → новый массив
   - Сравнивает с предыдущим → разные
   - Сохраняет в мемо → возвращает новый массив
```

**Операции:** 3 фильтрации, 3 сравнения

---

**Вариант 2 (готовые массивы в setState):**
```
1. setState() → изменяется state.history
   - Вызывает updateStackHistories()
   - Фильтрует для stackA → новый массив
   - Сравнивает с предыдущим → разные
   - Сохраняет в stackHistories
   - Фильтрует для stackB → новый массив
   - Сравнивает с предыдущим → разные
   - Сохраняет в stackHistories
2. Компонент 1 вызывает getStackHistory('stackA')
   - Читает из stackHistories → O(1)
3. Компонент 2 вызывает getStackHistory('stackA')
   - Читает из stackHistories → O(1)
4. Компонент 3 вызывает getStackHistory('stackB')
   - Читает из stackHistories → O(1)
```

**Операции:** 2 фильтрации (один раз), 2 сравнения (один раз), 3 чтения (O(1))

---

## Вывод: Вариант 1 (мемоизация) лучше!

### Почему?

1. ✅ **Проще код** - нет `updateStackHistories()`
2. ✅ **Меньше операций** - фильтрация только при первом вызове для каждого стека
3. ✅ **Ленивая инициализация** - вычисляем только когда нужно
4. ✅ **Единый источник данных** - только `state.history`
5. ✅ **Автоматическое обновление** - мемо обновляется при вызове

### Когда Вариант 2 лучше?

Только если:
- Очень много компонентов вызывают `getStackHistory()` одновременно
- История очень большая (> 1000 элементов)
- Нужна максимальная производительность при чтении

Но для большинства случаев **Вариант 1 оптимален!**

---

## Итоговая рекомендация

### ✅ Использовать Вариант 1: Единый `state.history` + мемоизация

```typescript
export class Router {
  private state: RouterState = { history: [] };
  
  // Мемоизация результатов фильтрации
  private stackHistoryMemo = new Map<string, HistoryItem[]>();

  public getStackHistory = (stackId?: string): HistoryItem[] => {
    if (!stackId) return EMPTY_ARRAY;
    
    const current = this.state.history.filter(item => item.stackId === stackId);
    const previous = this.stackHistoryMemo.get(stackId);
    
    // Если содержимое не изменилось → возвращаем старую ссылку
    if (previous && this.areArraysEqual(previous, current)) {
      return previous; // → useSyncExternalStore не увидит изменения
    }
    
    // Содержимое изменилось → сохраняем новый результат
    this.stackHistoryMemo.set(stackId, current);
    return current;
  };

  private areArraysEqual(a: HistoryItem[], b: HistoryItem[]): boolean {
    if (a.length !== b.length) return false;
    // Сравниваем ссылки на объекты (элементы истории immutable)
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private setState(next: Partial<RouterState>): void {
    this.state = {
      history: next.history ?? this.state.history,
    };
    // НЕ нужно ничего делать - мемоизация обновится автоматически!
  }
}
```

**Преимущества:**
- ✅ Проще код (нет `updateStackHistories()`)
- ✅ Единый источник данных
- ✅ Ленивая инициализация
- ✅ Автоматическое обновление
- ✅ Предотвращает ререндеры (сохраняет ссылки)

**Это оптимальное решение!**

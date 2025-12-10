# Решение проблемы ререндеров без сложного кеша

## Проблема

`useSyncExternalStore` использует **сравнение по ссылке** (`Object.is`) для определения изменений:

```typescript
// Если каждый раз создается новый массив:
const history1 = router.getStackHistory(stackId); // новый массив []
const history2 = router.getStackHistory(stackId); // новый массив [] (другая ссылка!)

// useSyncExternalStore увидит изменение, даже если содержимое одинаковое!
Object.is(history1, history2) // false → ререндер!
```

## Решение: Упрощенная мемоизация

### Идея: Хранить последний результат для каждого stackId

**Ключевое отличие от текущего кеша:**
- ❌ Нет версионирования (`historyVersion`)
- ❌ Нет инвалидации через `clear()`
- ✅ Простое сравнение: если содержимое не изменилось → возвращаем старую ссылку

### Реализация:

```typescript
export class Router {
  // Упрощенный кеш: только последний результат для каждого stackId
  private stackHistoryMemo = new Map<string, HistoryItem[]>();

  public getStackHistory = (stackId?: string): HistoryItem[] => {
    if (!stackId) return EMPTY_ARRAY;
    
    // Вычисляем текущий результат
    const current = this.state.history.filter(item => item.stackId === stackId);
    
    // Получаем предыдущий результат
    const previous = this.stackHistoryMemo.get(stackId);
    
    // Сравниваем содержимое (не ссылки!)
    if (previous && this.areArraysEqual(previous, current)) {
      // Содержимое не изменилось → возвращаем старую ссылку
      return previous;
    }
    
    // Содержимое изменилось → сохраняем новый результат
    this.stackHistoryMemo.set(stackId, current);
    return current;
  };

  private areArraysEqual(a: HistoryItem[], b: HistoryItem[]): boolean {
    if (a.length !== b.length) return false;
    // Сравниваем по ключам (key - уникальный идентификатор)
    for (let i = 0; i < a.length; i++) {
      if (a[i]?.key !== b[i]?.key) return false;
    }
    return true;
  }

  private setState(next: Partial<RouterState>): void {
    this.state = {
      history: next.history ?? this.state.history,
    };
    // НЕ очищаем мемо! Оно само обновится при следующем вызове getStackHistory
    this.log('setState', this.state);
  }
}
```

## Преимущества

### 1. ✅ Предотвращает ненужные ререндеры
- Если содержимое не изменилось → возвращаем старую ссылку
- `useSyncExternalStore` видит, что ссылка не изменилась → нет ререндера

### 2. ✅ Проще текущего кеша
- Нет версионирования
- Нет инвалидации
- Нет `clear()` в `setState()`
- Автоматическое обновление при изменении

### 3. ✅ Всегда актуальные данные
- Если содержимое изменилось → возвращаем новый массив
- Мемо обновляется автоматически

### 4. ✅ Минимальная память
- Храним только последний результат для каждого stackId
- Старые результаты автоматически заменяются

## Оптимизация: Сравнение по ключам

Вместо глубокого сравнения объектов, сравниваем только ключи:

```typescript
private areArraysEqual(a: HistoryItem[], b: HistoryItem[]): boolean {
  if (a.length !== b.length) return false;
  // key - уникальный идентификатор элемента истории
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.key !== b[i]?.key) return false;
  }
  return true;
}
```

**Почему это работает:**
- `key` - уникальный идентификатор каждого элемента истории
- Если ключи совпадают в том же порядке → содержимое не изменилось
- Быстрое сравнение (O(n), где n обычно < 10)

## Альтернатива: Сравнение по ссылкам элементов

Если элементы истории не мутируются (immutable), можно сравнивать по ссылкам:

```typescript
private areArraysEqual(a: HistoryItem[], b: HistoryItem[]): boolean {
  if (a.length !== b.length) return false;
  // Сравниваем ссылки на объекты (быстрее!)
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
```

**Преимущество:** O(1) сравнение ссылок vs O(n) сравнение ключей

## Полная реализация

```typescript
export class Router {
  // Упрощенная мемоизация (без версионирования)
  private stackHistoryMemo = new Map<string, HistoryItem[]>();

  public getStackHistory = (stackId?: string): HistoryItem[] => {
    if (!stackId) return EMPTY_ARRAY;
    
    // Вычисляем текущий результат
    const current = this.state.history.filter(item => item.stackId === stackId);
    
    // Получаем предыдущий результат
    const previous = this.stackHistoryMemo.get(stackId);
    
    // Если предыдущий результат существует и содержимое не изменилось
    if (previous && this.areArraysEqual(previous, current)) {
      // Возвращаем старую ссылку → useSyncExternalStore не увидит изменения
      return previous;
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
    // НЕ нужно очищать мемо - оно обновится автоматически при следующем вызове
    this.log('setState', this.state);
  }

  // Убрать:
  // - private getStackSlice()
  // - private stackHistoryCache
  // - private historyVersion
  // - this.stackHistoryCache.clear() в setState()
}
```

## Сравнение решений

| Критерий | Текущий кеш | Без кеша | Упрощенная мемоизация |
|----------|-------------|----------|----------------------|
| **Предотвращает ререндеры** | ✅ Да | ❌ Нет | ✅ Да |
| **Сложность** | ⚠️ Средняя | ✅ Простая | ✅✅ Простая |
| **Версионирование** | ❌ Есть | ✅ Нет | ✅ Нет |
| **Инвалидация** | ❌ Нужна | ✅ Нет | ✅ Автоматическая |
| **Память** | ⚠️ Средняя | ✅ Минимальная | ✅ Минимальная |
| **Код** | ⚠️ Больше | ✅ Меньше | ✅ Меньше |

## Итоговая рекомендация

### ✅ Использовать упрощенную мемоизацию

**Причины:**
1. ✅ Предотвращает ненужные ререндеры
2. ✅ Проще текущего кеша (нет версионирования)
3. ✅ Автоматическое обновление
4. ✅ Минимальная память
5. ✅ Меньше кода

**Это оптимальный баланс между:**
- Простотой (проще текущего кеша)
- Функциональностью (предотвращает ререндеры)
- Производительностью (быстрое сравнение)

---

## Дополнительная оптимизация (опционально)

Если история очень большая, можно кешировать результат `filter()`:

```typescript
private stackHistoryMemo = new Map<string, {
  result: HistoryItem[];
  historyLength: number; // Длина state.history при последнем вычислении
}>();

public getStackHistory = (stackId?: string): HistoryItem[] => {
  if (!stackId) return EMPTY_ARRAY;
  
  const memo = this.stackHistoryMemo.get(stackId);
  const currentHistoryLength = this.state.history.length;
  
  // Если длина истории не изменилась и есть мемо
  if (memo && memo.historyLength === currentHistoryLength) {
    // Проверяем, не изменилось ли содержимое
    if (this.areArraysEqual(memo.result, this.state.history.filter(item => item.stackId === stackId))) {
      return memo.result;
    }
  }
  
  // Вычисляем и сохраняем
  const result = this.state.history.filter(item => item.stackId === stackId);
  this.stackHistoryMemo.set(stackId, {
    result,
    historyLength: currentHistoryLength,
  });
  return result;
};
```

Но для большинства случаев простая версия достаточна!

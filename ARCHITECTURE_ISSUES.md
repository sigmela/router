# Упрощение архитектуры Router

## Критическое требование: Сохранение ключей

**⚠️ ВАЖНО:** При изменении маршрутов (обновление query-параметров, params, path) ключи (`key`) НЕ должны пересоздаваться. Существующий ключ должен сохраняться.

**Почему это важно:**
- React использует `key` для идентификации компонентов
- Пересоздание ключа приводит к размонтированию и повторному монтированию компонента
- Это теряет состояние компонента (local state, refs, эффекты)
- Это нарушает пользовательский опыт (потеря скролла, фокуса, анимаций)

**Правила сохранения ключей:**

1. **При `push` нового маршрута** — создается новый ключ (это нормально)
2. **При `replace` существующего маршрута** — ключ сохраняется из старого элемента
3. **При `popTo` существующего маршрута** — ключ сохраняется из найденного элемента
4. **При обновлении query/params существующего маршрута** — ключ сохраняется

**Текущая реализация:**
```typescript
// ✅ ПРАВИЛЬНО: При replace сохраняется ключ
if (action === 'replace') {
  copy[i] = {
    ...item,
    key: h.key, // Сохраняем старый ключ
  };
}

// ✅ ПРАВИЛЬНО: При popTo сохраняется ключ
if (action === 'popTo') {
  const updatedItem: HistoryItem = {
    ...foundItem,
    ...item,
    key: targetKey, // Сохраняем ключ найденного элемента
  };
}

// ✅ ПРАВИЛЬНО: При нахождении существующего маршрута сохраняется ключ
if (existing) {
  const updatedExisting: HistoryItem = {
    ...existing, // existing.key сохраняется
    params: normalizedParams,
    query: query as any,
    path: fullPath,
  };
}
```

**Требование при упрощении:**
Все упрощения должны гарантировать сохранение ключей при обновлении существующих маршрутов.

---

## Принципы упрощения

1. **Один источник истины** — `state.history` является единственным источником данных
2. **Вычисляемые производные** — все остальное вычисляется из `state.history` на лету
3. **Простая логика** — убрать сложные fallback-проверки, использовать один четкий алгоритм
4. **Меньше состояния** — убрать дублирующие структуры данных
5. **Без библиотек** — все упрощения на чистом TypeScript
6. **Сохранение ключей** — ключи не пересоздаются при обновлении маршрутов ⚠️

---

## Ключевые упрощения

### 1. Убрать `stackSlices` как хранимое состояние

**Текущая проблема:**
- `stackSlices` хранится как `Map<string, HistoryItem[]>`
- Перестраивается после каждого изменения истории (`rebuildStackSlicesFromHistory()`)
- Риск рассинхронизации с `state.history`
- Сложная логика с fallback-проверками

**Решение:**
Вычислять `stackSlices` на лету через простой getter.

**Изменения:**

```typescript
// БЫЛО:
private stackSlices = new Map<string, HistoryItem[]>();

private rebuildStackSlicesFromHistory(): void {
  const next = new Map<string, HistoryItem[]>();
  for (const item of this.state.history) {
    if (!item.stackId) continue;
    let arr = next.get(item.stackId);
    if (!arr) {
      arr = [];
      next.set(item.stackId, arr);
    }
    arr.push(item);
  }
  this.stackSlices = next;
}

// СТАЛО:
// Убрать поле stackSlices
// Убрать метод rebuildStackSlicesFromHistory

// Добавить вычисляемый метод:
private getStackSlice(stackId: string): HistoryItem[] {
  return this.state.history.filter(item => item.stackId === stackId);
}

// Обновить getStackHistory:
public getStackHistory = (stackId?: string): HistoryItem[] => {
  if (!stackId) return EMPTY_ARRAY;
  return this.getStackSlice(stackId);
};
```

**Преимущества:**
- Нет дублирования состояния
- Нет риска рассинхронизации
- Нет необходимости в `rebuildStackSlicesFromHistory()`
- Всегда актуальные данные

**Производительность:**
- O(n) при каждом вызове, но:
  - Обычно вызывается редко (при подписке на изменения стека)
  - История обычно небольшая (< 100 элементов)
  - Можно добавить простую мемоизацию при необходимости

---

### 2. Упростить дедупликацию маршрутов

**Текущая проблема:**
- Сложная логика с множественными fallback-проверками (строки 420-547)
- Проверка в `stackSlices`, затем в `state.history`, затем по `routeId`, затем по `pathname+params`
- Неочевидное поведение

**Решение:**
Один простой алгоритм поиска в `state.history`.

**⚠️ ВАЖНО:** При нахождении существующего маршрута обязательно сохранять его ключ!

**Изменения:**

```typescript
// БЫЛО: Сложная логика с множественными проверками (строки 420-547)

// СТАЛО: Простой поиск в истории
private findExistingRoute(
  stackId: string,
  routeId: string,
  pathname: string,
  params: Record<string, any>
): HistoryItem | undefined {
  // Ищем в истории стека
  const stackHistory = this.getStackSlice(stackId);
  
  // Проверяем по routeId + pathname + params
  return stackHistory.find(item => {
    if (item.routeId !== routeId) return false;
    
    const itemPathname = item.path ? this.parsePath(item.path).pathname : '';
    if (itemPathname !== pathname) return false;
    
    return this.areShallowEqual(
      (item.params ?? {}) as Record<string, any>,
      params
    );
  });
}

// Использование в performNavigation:
if (base.stackId) {
  const existing = this.findExistingRoute(
    base.stackId,
    base.routeId,
    pathname,
    params ?? {}
  );
  
  if (existing) {
    // ⚠️ КРИТИЧНО: Сохраняем ключ существующего маршрута!
    // Обновляем существующий маршрут с сохранением ключа
    const updatedExisting: HistoryItem = {
      ...existing, // existing.key сохраняется автоматически
      params: params && Object.keys(params).length > 0 ? params : undefined,
      query: query as any,
      path: fullPath,
      // key: existing.key - не нужно явно указывать, т.к. ...existing уже содержит key
    };
    this.applyHistoryChange('popTo', updatedExisting);
    return;
  }
}
```

**Преимущества:**
- Один четкий алгоритм
- Легко понять и отладить
- Нет сложных fallback-проверок
- Проще тестировать

---

### 3. Упростить `applyHistoryChange`

**Текущая проблема:**
- После изменения истории вызывается `rebuildStackSlicesFromHistory()`
- Это лишняя операция, если `stackSlices` вычисляется на лету

**⚠️ ВАЖНО:** При всех операциях (`replace`, `popTo`) обязательно сохранять ключи!

**Изменения:**

```typescript
// БЫЛО:
private applyHistoryChange(...) {
  // ... изменение state.history
  this.setState({ history: nextHist });
  
  // Rebuild stack slices from the updated history
  this.rebuildStackSlicesFromHistory(); // ❌ Убрать
  
  this.emit(this.stackListeners.get(stackId));
  this.recomputeVisibleRoute();
  this.emit(this.listeners);
}

// СТАЛО:
private applyHistoryChange(
  action: 'push' | 'replace' | 'pop' | 'popTo',
  item: HistoryItem
): void {
  const stackId = item.stackId;
  if (!stackId) return;

  const prevHist = this.state.history;
  let nextHist = prevHist;

  if (action === 'push') {
    // Новый маршрут - создается новый ключ (это нормально)
    nextHist = [...prevHist, item];
  } else if (action === 'replace') {
    // ⚠️ КРИТИЧНО: Сохраняем ключ из старого элемента!
    let replaced = false;
    const copy = [...prevHist];
    for (let i = copy.length - 1; i >= 0; i--) {
      const h = copy[i];
      if (h && h.stackId === stackId) {
        copy[i] = {
          ...item,
          key: h.key, // Сохраняем старый ключ
        };
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      copy.push(item);
    }
    nextHist = copy;
  } else if (action === 'pop') {
    const copy = [...prevHist];
    for (let i = copy.length - 1; i >= 0; i--) {
      const h = copy[i]!;
      if (h.stackId === stackId) {
        copy.splice(i, 1);
        break;
      }
    }
    nextHist = copy;
  } else if (action === 'popTo') {
    // ⚠️ КРИТИЧНО: Сохраняем ключ из найденного элемента!
    const targetKey = item.key;
    const keysToRemove = new Set<string>();
    let foundItem: HistoryItem | null = null;

    for (let i = prevHist.length - 1; i >= 0; i--) {
      const h = prevHist[i]!;
      if (h.stackId !== stackId) continue;
      if (h.key === targetKey) {
        foundItem = h;
        break;
      }
      keysToRemove.add(h.key);
    }

    if (!foundItem) return;

    const copy = prevHist.filter((h) => !keysToRemove.has(h.key));
    const updatedItem: HistoryItem = {
      ...foundItem,
      ...item,
      key: targetKey, // Сохраняем ключ найденного элемента
    };

    const itemIndex = copy.findIndex(h => h.key === targetKey);
    if (itemIndex >= 0) {
      copy.splice(itemIndex, 1);
    }
    copy.push(updatedItem);
    nextHist = copy;
  }

  this.setState({ history: nextHist });
  
  // stackSlices вычисляется на лету, ничего перестраивать не нужно
  
  this.emit(this.stackListeners.get(stackId));
  this.recomputeVisibleRoute();
  this.emit(this.listeners);
}
```

**Преимущества:**
- Меньше операций
- Проще код
- Нет риска рассинхронизации

---

### 4. Упростить `getTopForTarget`

**Текущая проблема:**
- Использует `stackSlices`, который может быть не синхронизирован

**Изменения:**

```typescript
// БЫЛО:
private getTopForTarget(stackId?: string): HistoryItem | undefined {
  if (!stackId) return undefined;
  const slice = this.stackSlices.get(stackId) ?? EMPTY_ARRAY;
  return slice.length ? slice[slice.length - 1] : undefined;
}

// СТАЛО:
private getTopForTarget(stackId?: string): HistoryItem | undefined {
  if (!stackId) return undefined;
  const slice = this.getStackSlice(stackId);
  return slice.length > 0 ? slice[slice.length - 1] : undefined;
}
```

**Преимущества:**
- Всегда актуальные данные
- Нет зависимости от синхронизации

---

### 5. Упростить логику определения активного стека в `goBack`

**Текущая проблема:**
- Логика определения активного стека неочевидна
- Зависит от `visibleRoute.stackId`

**Упрощение:**
Явная логика: активный стек = стек последнего элемента в истории.

**Изменения:**

```typescript
// БЫЛО: Сложная логика в tryPopActiveStack()

// СТАЛО: Простая логика
private popOnce(): boolean {
  if (this.state.history.length === 0) return false;
  
  // Активный стек = стек последнего элемента истории
  const lastItem = this.state.history[this.state.history.length - 1];
  if (!lastItem || !lastItem.stackId) return false;
  
  const stackHistory = this.getStackSlice(lastItem.stackId);
  
  // Нельзя уйти ниже корня стека
  if (stackHistory.length <= 1) return false;
  
  // Удаляем последний элемент активного стека
  this.applyHistoryChange('pop', lastItem);
  return true;
}
```

**Преимущества:**
- Явная и понятная логика
- Легко понять поведение
- Проще тестировать

---

### 6. Упростить `setRoot`

**Текущая проблема:**
- Очищает `stackSlices`, который больше не нужен

**Изменения:**

```typescript
// БЫЛО:
public setRoot(...) {
  // ...
  this.stackSlices.clear(); // ❌ Убрать
  // ...
}

// СТАЛО:
public setRoot(...) {
  // ...
  // stackSlices больше не хранится, ничего очищать не нужно
  // ...
}
```

---

## Итоговые изменения

### Удалить:
1. Поле `private stackSlices = new Map<string, HistoryItem[]>()`
2. Метод `rebuildStackSlicesFromHistory()`
3. Вызовы `rebuildStackSlicesFromHistory()` в `applyHistoryChange()` и других местах
4. Очистку `stackSlices` в `setRoot()`
5. Сложную логику дедупликации с множественными fallback-проверками

### Добавить:
1. Метод `private getStackSlice(stackId: string): HistoryItem[]`
2. Метод `private findExistingRoute(...)` для простого поиска
3. Упрощенную логику в `performNavigation`
4. Упрощенную логику в `goBack()`

### Изменить:
1. `getStackHistory()` — использовать `getStackSlice()`
2. `getTopForTarget()` — использовать `getStackSlice()`
3. `performNavigation()` — использовать `findExistingRoute()`
4. `applyHistoryChange()` — убрать `rebuildStackSlicesFromHistory()`, **сохранять ключи при replace/popTo**
5. `setRoot()` — убрать очистку `stackSlices`

### ⚠️ Критически важно:
**При всех операциях обновления маршрутов (`replace`, `popTo`, обновление query/params) ключи должны сохраняться из существующих элементов истории.**

---

## Преимущества упрощения

### 1. Меньше состояния
- Один источник истины (`state.history`)
- Нет дублирования данных
- Нет риска рассинхронизации

### 2. Проще код
- Убрано ~100 строк сложной логики
- Один четкий алгоритм вместо множественных fallback-проверок
- Легче понять и отладить

### 3. Меньше багов
- Нет рассинхронизации между `stackSlices` и `history`
- Всегда актуальные данные
- Проще тестировать

### 4. Проще поддерживать
- Меньше кода для поддержки
- Явная логика вместо неявных зависимостей
- Легче добавлять новые функции

### 5. Производительность
- Убрана лишняя операция `rebuildStackSlicesFromHistory()` при каждом изменении
- Вычисление `stackSlices` происходит только при необходимости
- Обычно история небольшая, O(n) не проблема

---

## Потенциальные проблемы и решения

### Проблема: Производительность при большой истории

**Решение:**
Если история становится очень большой (> 1000 элементов), можно добавить простую мемоизацию:

```typescript
private stackSliceCache: Map<string, HistoryItem[]> | null = null;
private stackSliceCacheHistoryLength: number = 0;

private getStackSlice(stackId: string): HistoryItem[] {
  // Инвалидируем кеш при изменении истории
  if (this.stackSliceCache === null || 
      this.stackSliceCacheHistoryLength !== this.state.history.length) {
    this.stackSliceCache = new Map();
    this.stackSliceCacheHistoryLength = this.state.history.length;
  }
  
  if (!this.stackSliceCache.has(stackId)) {
    const slice = this.state.history.filter(item => item.stackId === stackId);
    this.stackSliceCache.set(stackId, slice);
  }
  
  return this.stackSliceCache.get(stackId)!;
}

// Инвалидировать кеш при изменении истории:
private setState(next: Partial<RouterState>): void {
  this.stackSliceCache = null; // Инвалидируем кеш
  // ... остальной код
}
```

Но в большинстве случаев это не нужно.

---

### Проблема: Изменение поведения при переключении табов

**Текущее поведение:**
При переключении таба ищется существующий маршрут по множественным критериям.

**Новое поведение:**
Ищется только в истории текущего стека по `routeId + pathname + params`.

**Решение:**
Это упрощение, а не проблема. Новое поведение более предсказуемо:
- Если маршрут существует в стеке — используется существующий
- Если нет — создается новый

Это соответствует ожидаемому поведению.

---

## План внедрения

### Шаг 1: Добавить новые методы
1. Добавить `getStackSlice()`
2. Добавить `findExistingRoute()`

### Шаг 2: Обновить использование
1. Обновить `getStackHistory()` — использовать `getStackSlice()`
2. Обновить `getTopForTarget()` — использовать `getStackSlice()`
3. Обновить `performNavigation()` — использовать `findExistingRoute()`

### Шаг 3: Упростить логику
1. Упростить `goBack()` / `popOnce()`
2. Упростить `applyHistoryChange()` — убрать `rebuildStackSlicesFromHistory()`
3. **⚠️ Проверить, что ключи сохраняются при всех операциях**

### Шаг 4: Удалить старое
1. Удалить поле `stackSlices`
2. Удалить метод `rebuildStackSlicesFromHistory()`
3. Удалить очистку `stackSlices` в `setRoot()`

### Шаг 5: Тестирование
1. Запустить все существующие тесты
2. Убедиться, что поведение не изменилось
3. **⚠️ Проверить, что ключи не пересоздаются при обновлении маршрутов**
4. Проверить производительность

### ⚠️ Критическая проверка ключей:
После всех изменений необходимо убедиться:
- При `navigate('/path?query=1')` → `navigate('/path?query=2')` ключ сохраняется
- При `navigate('/users/1')` → `navigate('/users/2')` создается новый ключ (это правильно)
- При `navigate('/catalog')` → `navigate('/catalog')` (тот же путь) ключ сохраняется
- При переключении табов и возврате ключи сохраняются

---

## Заключение

Предложенные упрощения:
- ✅ Убирают дублирование состояния
- ✅ Упрощают код (~100 строк меньше)
- ✅ Делают логику более понятной
- ✅ Сохраняют всю функциональность
- ✅ Не требуют библиотек
- ✅ Не усложняют архитектуру

Основная идея: **один источник истины (`state.history`), все остальное вычисляется на лету**.

Это классический подход "single source of truth" — простой, надежный и легко поддерживаемый.

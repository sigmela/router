# Пересмотренные предложения по переименованию методов

## Детальный анализ каждого метода

### 1. `popOnce` → ?

**Текущий код:**
```typescript
private popOnce(): HistoryItem | null {
  const visible = this.visibleRoute;
  // Находит видимый элемент в истории
  // Удаляет последний элемент из стека видимого маршрута
}
```

**Анализ:**
- Работает с `visibleRoute` (видимым маршрутом)
- Находит видимый элемент по `stackId`
- Удаляет последний элемент из стека видимого маршрута
- Не обязательно "активный" стек, а именно "видимый"

**Предложение:**
- ✅ `popFromActiveStack` - отражает работу с активным стеком
- ✅ `popTopFromActiveStack` - еще точнее (удаляет top элемент)

**Финальное предложение:** `popFromActiveStack`

---

### 2. `parse` → ?

**Текущий код:**
```typescript
private parse(url: string): void {
  // Парсит URL на pathname и query
  // Находит маршруты
  // Создает массив items из префиксов пути
  // Добавляет overlay routes
  // Применяет все items к истории через applyHistoryChange
  // Вызывает seed для childNodes
}
```

**Анализ:**
- Парсит URL
- Строит полную историю из URL (deep linking)
- Применяет изменения к истории
- Инициализирует состояние роутера из URL

**Предложение:**
- ⚠️ `parseAndNavigate` - не совсем точно, это не навигация, а инициализация
- ⚠️ `navigateFromUrl` - тоже не совсем точно
- ✅ `initializeFromUrl` - точнее отражает, что это инициализация
- ✅ `parseUrlAndBuildHistory` - более описательное
- ✅ `buildHistoryFromUrl` - короче и понятнее

**Финальное предложение:** `buildHistoryFromUrl` или `initializeFromUrl`

---

### 3. `getTopForTarget` → ?

**Текущий код:**
```typescript
private getTopForTarget(stackId?: string): HistoryItem | undefined {
  if (!stackId) return undefined;
  const slice = this.getStackHistory(stackId);
  return slice.length > 0 ? slice[slice.length - 1] : undefined;
}
```

**Анализ:**
- Принимает `stackId`
- Возвращает последний элемент стека (top)
- Используется в контексте dedupe для проверки top стека
- "ForTarget" неясно - для какого target?

**Предложение:**
- ✅ `getTopOfStack` - понятно и точно
- ✅ `getStackTop` - короче, тоже понятно

**Финальное предложение:** `getTopOfStack`

---

### 4. `addChildNodeSeeds` → ?

**Текущий код:**
```typescript
private addChildNodeSeeds(routeId: string, items: HistoryItem[], finalRouteId?: string): void {
  // Находит childNode для routeId
  // Получает seed для childNode
  // Создает HistoryItem
  // Добавляет в массив items (не в историю!)
  // Рекурсивно вызывает себя
}
```

**Анализ:**
- Принимает массив `items: HistoryItem[]`
- Добавляет seed для childNode в этот массив
- НЕ добавляет в историю напрямую
- Используется при парсинге URL для построения массива items

**Предложение:**
- ✅ `addChildNodeSeedsToItems` - точно отражает, что добавляет в items

**Финальное предложение:** `addChildNodeSeedsToItems`

---

### 5. `seedChildNodes` → ?

**Текущий код:**
```typescript
private seedChildNodes(routeId: string): void {
  // Находит childNode для routeId
  // Получает seed для childNode
  // Создает HistoryItem
  // Вызывает applyHistoryChange('push', childItem) - добавляет в историю!
  // Рекурсивно вызывает себя
}
```

**Анализ:**
- Добавляет seed для childNode напрямую в историю
- Использует `applyHistoryChange('push', childItem)`
- Используется при инициализации (seedInitialHistory)

**Предложение:**
- ✅ `addChildNodeSeedsToHistory` - точно отражает, что добавляет в историю

**Финальное предложение:** `addChildNodeSeedsToHistory`

---

### 6. `getPersistenceForPath` → ?

**Текущий код:**
```typescript
private getPersistenceForPath(path: string): boolean {
  // Проверяет syncWithUrl опцию для маршрута
  // Возвращает boolean
}
```

**Анализ:**
- Возвращает `boolean`
- Проверяет, нужно ли синхронизировать путь с URL
- Используется для определения `syncWithUrl`

**Предложение:**
- ✅ `shouldSyncPathWithUrl` - понятное boolean название
- ✅ `shouldPersistPathInUrl` - альтернатива

**Финальное предложение:** `shouldSyncPathWithUrl`

---

### 7. `readIndex` → ?

**Текущий код:**
```typescript
private readIndex(state: unknown): number {
  // Читает __srIndex из state
  // Это индекс истории роутера в браузере
}
```

**Анализ:**
- Читает `__srIndex` из state браузера
- Это индекс истории роутера (router history index)
- Используется для синхронизации с браузерной историей

**Предложение:**
- ✅ `readHistoryIndex` - точно отражает, что это индекс истории
- ✅ `readRouterHistoryIndex` - еще точнее, но длиннее

**Финальное предложение:** `readHistoryIndex`

---

### 8. `patchHistoryOnce` → ?

**Текущий код:**
```typescript
private patchHistoryOnce(): void {
  // Патчит history.pushState и history.replaceState
  // Добавляет события pushState и replaceState
  // Это для браузера
}
```

**Анализ:**
- Патчит методы браузерной истории
- Добавляет события для pushState/replaceState
- Это специфично для браузера

**Предложение:**
- ✅ `patchBrowserHistoryOnce` - точно отражает, что это для браузера

**Финальное предложение:** `patchBrowserHistoryOnce`

---

### 9. `syncUrlWithStateAfterInternalPop` → ?

**Текущий код:**
```typescript
private syncUrlWithStateAfterInternalPop(popped: HistoryItem): void {
  // Синхронизирует URL после внутреннего pop
  // Обрабатывает query routes
  // Строит URL из visibleRoute
}
```

**Анализ:**
- Синхронизирует URL после pop
- "InternalPop" важно - это не браузерный pop, а внутренний
- Обрабатывает специальные случаи (query routes)

**Предложение:**
- ⚠️ `syncUrlAfterPop` - теряет важную информацию о "internal"
- ✅ `syncUrlAfterInternalPop` - сохраняет важную информацию
- ✅ `syncUrlWithStateAfterPop` - короче, но теряет "internal"

**Финальное предложение:** `syncUrlAfterInternalPop` (компромисс между длиной и точностью)

---

## Итоговые пересмотренные предложения

| Текущее название | Пересмотренное предложение | Приоритет | Комментарий |
|-----------------|---------------------------|-----------|-------------|
| `popOnce` | `popFromActiveStack` | Высокий | Работает с активным стеком |
| `parse` | `buildHistoryFromUrl` или `initializeFromUrl` | Высокий | Более точно отражает инициализацию из URL |
| `getTopForTarget` | `getTopOfStack` | Высокий | Убирает неясное "ForTarget" |
| `addChildNodeSeeds` | `addChildNodeSeedsToItems` | Средний | Точнее отражает, что добавляет в items |
| `seedChildNodes` | `addChildNodeSeedsToHistory` | Средний | Точнее отражает, что добавляет в историю |
| `getPersistenceForPath` | `shouldSyncPathWithUrl` | Средний | Понятное boolean название |
| `readIndex` | `readHistoryIndex` | Средний | Точнее отражает, что это индекс истории |
| `patchHistoryOnce` | `patchBrowserHistoryOnce` | Средний | Точнее отражает, что это для браузера |
| `syncUrlWithStateAfterInternalPop` | `syncUrlAfterInternalPop` | Средний | Короче, но сохраняет важную информацию |

## Ключевые изменения в предложениях

1. **`popOnce`**: `popFromActiveStack` - отражает работу с активным стеком
2. **`parse`**: Изменено с `parseAndNavigate` на `buildHistoryFromUrl` - более точно отражает инициализацию
3. **`syncUrlWithStateAfterInternalPop`**: Изменено с `syncUrlAfterPop` на `syncUrlAfterInternalPop` - сохраняет важную информацию о "internal"

## Вывод

Пересмотренные предложения более точно отражают суть методов, особенно:
- Работа с активным стеком
- Инициализация из URL, а не просто парсинг
- Сохранение важной информации о "internal" pop

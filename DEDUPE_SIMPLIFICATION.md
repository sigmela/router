# Упрощение логики dedupe-блока

## Проблема

**Текущая ситуация:**
Блок `dedupe: already at target, no-op` (строки 486-670) содержит ~185 строк сложной логики:
1. Определение `targetStackId` и `targetRouteId` для активации TabBar (строки 493-532)
2. Поиск TabBar в истории root stack (строки 534-552)
3. Поиск TabBar в registry (строки 554-565)
4. Активация стека (строки 567-573)
5. Добавление seed для пустых стеков (строки 578-624)
6. Обновление `visibleRoute` (строки 626-669)

**Проблемы:**
- ❌ Хрупкая логика с множественными проверками
- ❌ Сложно тестировать
- ❌ Много edge cases
- ❌ Дублирование кода (поиск TabBar в двух местах)
- ❌ Использование `as any` для `findTabIndexByRoute`

## Анализ логики

### Что делает этот блок?

Когда навигация происходит на тот же маршрут (`sameIdentity && sameQuery`), но нужно:
1. **Активировать правильный таб** - если переключаемся между табами
2. **Обновить видимый маршрут** - чтобы он соответствовал активному табу
3. **Добавить seed для пустых стеков** - если таб еще не был использован

### Почему это сложно?

1. **Определение targetStackId** - сложная логика для случая `pathname === '/'`
2. **Поиск TabBar** - ищем в истории, потом в registry (дублирование)
3. **Добавление seed** - прямая манипуляция историей, обход `applyHistoryChange`
4. **Обновление visibleRoute** - сложная логика с множественными условиями

## Решения

### Вариант 1: Вынести логику в отдельные методы (рекомендуемый)

**Идея:** Разбить сложный блок на маленькие методы с четкой ответственностью.

```typescript
private performNavigation(...) {
  // ...
  
  if (sameIdentity && sameQuery) {
    this.log('dedupe: already at target, no-op');
    this.handleDedupeNoOp(base, pathname, params, query);
    return;
  }
}

private handleDedupeNoOp(
  base: CompiledRoute,
  pathname: string,
  params: Record<string, any> | undefined,
  query: Record<string, unknown>
): void {
  if (!base.stackId) {
    this.recomputeVisibleRoute();
    this.emit(this.listeners);
    return;
  }

  // Определяем целевой стек и маршрут
  const { targetStackId, targetRouteId } = this.resolveTargetStackAndRoute(
    base,
    pathname
  );

  // Активируем TabBar (если есть)
  this.activateTabBarForRoute(targetRouteId, base.stackId);

  // Активируем стек
  this.activateStack(targetStackId);

  // Обеспечиваем seed для пустого стека
  this.ensureStackHasSeed(targetStackId);

  // Обновляем видимый маршрут
  this.updateVisibleRouteFromStack(targetStackId, pathname);

  this.emit(this.listeners);
}

private resolveTargetStackAndRoute(
  base: CompiledRoute,
  pathname: string
): { targetStackId: string; targetRouteId: string } {
  const rootStackId = this.root?.getId();
  let targetStackId = base.stackId!;
  let targetRouteId = base.routeId;

  // Специальный случай: pathname === '/' может быть в разных табах
  if (base.stackId === rootStackId && pathname === '/') {
    const childStackRoute = this.findChildStackRouteForPathname(
      rootStackId!,
      pathname
    );
    if (childStackRoute) {
      targetStackId = childStackRoute.stackId!;
      targetRouteId = childStackRoute.routeId;
    }
  }

  return { targetStackId, targetRouteId };
}

private findChildStackRouteForPathname(
  rootStackId: string,
  pathname: string
): CompiledRoute | undefined {
  // Ищем дочерний стек (таб) с таким же pathname
  for (const route of this.registry) {
    if (
      route.stackId !== rootStackId &&
      route.pathnamePattern === pathname &&
      !route.queryPattern
    ) {
      // Проверяем, что это таб TabBar
      const rootRoute = this.findRootRouteWithTabBar(rootStackId);
      if (rootRoute && this.isRouteInTabBar(route.routeId, rootRoute.childNode!)) {
        return route;
      }
    }
  }
  return undefined;
}

private findRootRouteWithTabBar(
  rootStackId: string
): CompiledRoute | undefined {
  return this.registry.find(
    (r) =>
      r.stackId === rootStackId &&
      r.childNode &&
      hasSetActiveChildByRoute(r.childNode)
  );
}

private isRouteInTabBar(
  routeId: string,
  tabBar: NavigationNode
): boolean {
  // Проверяем, что routeId принадлежит TabBar
  // Это можно сделать через проверку всех табов TabBar
  // Но для этого нужен доступ к TabBar.stacks или TabBar.tabs
  // Пока используем findTabIndexByRoute как fallback
  if (typeof (tabBar as any).findTabIndexByRoute === 'function') {
    const tabIndex = (tabBar as any).findTabIndexByRoute(routeId);
    return tabIndex !== -1;
  }
  return false;
}

private activateTabBarForRoute(
  targetRouteId: string,
  rootStackId: string
): void {
  const tabBar = this.findTabBarInStack(rootStackId);
  if (tabBar && hasSetActiveChildByRoute(tabBar)) {
    tabBar.setActiveChildByRoute(targetRouteId);
  }
}

private findTabBarInStack(stackId: string): NavigationNode | undefined {
  // Сначала ищем в истории
  const stackHistory = this.getStackHistory(stackId);
  for (let i = stackHistory.length - 1; i >= 0; i--) {
    const item = stackHistory[i];
    if (item) {
      const compiled = this.registry.find((r) => r.routeId === item.routeId);
      if (compiled?.childNode && hasSetActiveChildByRoute(compiled.childNode)) {
        return compiled.childNode;
      }
    }
  }

  // Если не нашли в истории, ищем в registry
  const rootRoute = this.findRootRouteWithTabBar(stackId);
  return rootRoute?.childNode;
}

private activateStack(stackId: string): void {
  const activator = this.stackActivators.get(stackId);
  if (activator) {
    activator();
  }
}

private ensureStackHasSeed(stackId: string): void {
  const stackHistory = this.getStackHistory(stackId);
  if (stackHistory.length > 0) return;

  const stackNode = this.stackById.get(stackId);
  if (!stackNode) return;

  const seed = this.getAutoSeed(stackNode);
  if (!seed) return;

  const compiled = this.registry.find((r) => r.routeId === seed.routeId);
  const meta = this.routeById.get(seed.routeId);
  const path = compiled?.path ?? meta?.path ?? seed.path;
  const seedStackId = seed.stackId ?? stackNode.getId();

  const item: HistoryItem = {
    key: this.generateKey(),
    routeId: seed.routeId,
    component: compiled?.component ?? (() => null),
    options: this.mergeOptions(compiled?.options, seedStackId),
    params: seed.params ?? {},
    stackId: seedStackId,
    path,
    pattern: compiled?.path ?? seed.path,
  };

  // Добавляем seed в историю
  const prevHist = this.state.history;
  const nextHist = [...prevHist, item];
  this.setState({ history: nextHist });

  // Эмитим события для stack listeners
  this.emit(this.stackListeners.get(seedStackId));

  // Если это дочерний стек (таб), активируем TabBar
  const rootStackId = this.root?.getId();
  if (seedStackId !== stackId && rootStackId) {
    this.activateTabBarForRoute(seed.routeId, rootStackId);
  }
}

private updateVisibleRouteFromStack(
  stackId: string,
  pathname: string
): void {
  const stackHistory = this.getStackHistory(stackId);

  if (stackHistory.length > 0) {
    const topOfStack = stackHistory[stackHistory.length - 1];
    if (topOfStack) {
      const meta = this.routeById.get(topOfStack.routeId);
      this.visibleRoute = meta
        ? {
            ...meta,
            routeId: topOfStack.routeId,
            params: topOfStack.params,
            query: topOfStack.query,
            path: topOfStack.path,
          }
        : {
            routeId: topOfStack.routeId,
            stackId: topOfStack.stackId,
            params: topOfStack.params,
            query: topOfStack.query,
            path: topOfStack.path,
          };
      return;
    }
  }

  // Если в истории нет элементов, используем routeId из registry
  const targetRoute = this.registry.find(
    (r) => r.stackId === stackId && r.pathnamePattern === pathname
  );
  if (targetRoute) {
    const meta = this.routeById.get(targetRoute.routeId);
    this.visibleRoute = meta
      ? {
          ...meta,
          routeId: targetRoute.routeId,
          params: {},
          query: {},
          path: targetRoute.path,
        }
      : {
          routeId: targetRoute.routeId,
          stackId: stackId,
          params: {},
          query: {},
          path: targetRoute.path,
        };
  }
}
```

**Преимущества:**
- ✅ Каждый метод имеет четкую ответственность
- ✅ Легче тестировать (можно тестировать каждый метод отдельно)
- ✅ Легче понять логику
- ✅ Меньше дублирования кода
- ✅ Легче поддерживать

---

### Вариант 2: Упростить логику определения targetStackId

**Проблема:** Сложная логика для случая `pathname === '/'` (строки 502-532).

**Решение:** Использовать `matchBaseRoute` для поиска правильного стека.

```typescript
private resolveTargetStackAndRoute(
  base: CompiledRoute,
  pathname: string
): { targetStackId: string; targetRouteId: string } {
  // Если base.stackId - это root stack, но pathname может быть в дочернем стеке,
  // используем matchBaseRoute для поиска правильного стека
  const rootStackId = this.root?.getId();
  
  if (base.stackId === rootStackId) {
    // Пробуем найти более специфичный маршрут в дочерних стеках
    const childRoute = this.matchBaseRoute(pathname, {});
    if (childRoute && childRoute.stackId !== rootStackId) {
      return {
        targetStackId: childRoute.stackId!,
        targetRouteId: childRoute.routeId,
      };
    }
  }

  return {
    targetStackId: base.stackId!,
    targetRouteId: base.routeId,
  };
}
```

**Преимущества:**
- ✅ Использует существующую логику `matchBaseRoute`
- ✅ Проще и понятнее
- ✅ Меньше специальных случаев

---

### Вариант 3: Упростить поиск TabBar

**Проблема:** Поиск TabBar в двух местах (история и registry).

**Решение:** Единый метод поиска.

```typescript
private findTabBarInStack(stackId: string): NavigationNode | undefined {
  // Сначала ищем в истории (более актуально)
  const stackHistory = this.getStackHistory(stackId);
  for (let i = stackHistory.length - 1; i >= 0; i--) {
    const item = stackHistory[i];
    if (item) {
      const compiled = this.registry.find((r) => r.routeId === item.routeId);
      if (compiled?.childNode && hasSetActiveChildByRoute(compiled.childNode)) {
        return compiled.childNode;
      }
    }
  }

  // Если не нашли в истории, ищем в registry
  const rootRoute = this.registry.find(
    (r) =>
      r.stackId === stackId &&
      r.childNode &&
      hasSetActiveChildByRoute(r.childNode)
  );
  return rootRoute?.childNode;
}
```

**Преимущества:**
- ✅ Единое место поиска
- ✅ Нет дублирования
- ✅ Легче поддерживать

---

### Вариант 4: Упростить добавление seed

**Проблема:** Прямая манипуляция историей, обход `applyHistoryChange`.

**Решение:** Использовать существующий метод или создать отдельный.

```typescript
private ensureStackHasSeed(stackId: string): void {
  const stackHistory = this.getStackHistory(stackId);
  if (stackHistory.length > 0) return;

  const stackNode = this.stackById.get(stackId);
  if (!stackNode) return;

  const seed = this.getAutoSeed(stackNode);
  if (!seed) return;

  // Используем существующий метод для создания HistoryItem
  const compiled = this.registry.find((r) => r.routeId === seed.routeId);
  const meta = this.routeById.get(seed.routeId);
  const path = compiled?.path ?? meta?.path ?? seed.path;
  const seedStackId = seed.stackId ?? stackNode.getId();

  const item: HistoryItem = {
    key: this.generateKey(),
    routeId: seed.routeId,
    component: compiled?.component ?? (() => null),
    options: this.mergeOptions(compiled?.options, seedStackId),
    params: seed.params ?? {},
    stackId: seedStackId,
    path,
    pattern: compiled?.path ?? seed.path,
  };

  // Используем setState для добавления seed
  const prevHist = this.state.history;
  const nextHist = [...prevHist, item];
  this.setState({ history: nextHist });

  // Эмитим события
  this.emit(this.stackListeners.get(seedStackId));

  // Активируем TabBar если нужно
  const rootStackId = this.root?.getId();
  if (seedStackId !== stackId && rootStackId) {
    this.activateTabBarForRoute(seed.routeId, rootStackId);
  }
}
```

**Преимущества:**
- ✅ Использует существующие методы
- ✅ Единая логика создания HistoryItem
- ✅ Правильная синхронизация состояния

---

## Рекомендуемое решение

### ✅ Комбинация всех вариантов

1. **Вынести логику в отдельные методы** (Вариант 1)
2. **Упростить определение targetStackId** (Вариант 2)
3. **Упростить поиск TabBar** (Вариант 3)
4. **Упростить добавление seed** (Вариант 4)

### План рефакторинга

1. Создать метод `handleDedupeNoOp()` - главный метод
2. Создать метод `resolveTargetStackAndRoute()` - определение целевого стека
3. Создать метод `findTabBarInStack()` - поиск TabBar
4. Создать метод `activateTabBarForRoute()` - активация TabBar
5. Создать метод `activateStack()` - активация стека
6. Создать метод `ensureStackHasSeed()` - добавление seed
7. Создать метод `updateVisibleRouteFromStack()` - обновление visibleRoute

### Преимущества после рефакторинга

1. ✅ **Проще понять** - каждый метод делает одну вещь
2. ✅ **Легче тестировать** - можно тестировать каждый метод отдельно
3. ✅ **Меньше дублирования** - единые методы для поиска TabBar
4. ✅ **Легче поддерживать** - изменения в одном месте
5. ✅ **Меньше edge cases** - четкая логика в каждом методе

---

## Дополнительные улучшения

### Убрать использование `as any` для `findTabIndexByRoute`

**Проблема:** Использование `as any` для вызова `findTabIndexByRoute` (строка 520).

**Решение:** Добавить метод в интерфейс NavigationNode или использовать другой подход.

```typescript
// Вариант 1: Добавить в NavigationNode (если это общий паттерн)
export interface NavigationNode {
  // ...
  findChildIndexByRoute?: (routeId: string) => number;
}

// Вариант 2: Использовать getActiveChildId для проверки
private isRouteInTabBar(routeId: string, tabBar: NavigationNode): boolean {
  // Можно проверить через getActiveChildId, если он возвращает stackId
  // Но это требует знания структуры TabBar
}
```

---

## Итоговая рекомендация

### ✅ Вынести логику в отдельные методы

**Причины:**
1. ✅ Упрощает понимание
2. ✅ Упрощает тестирование
3. ✅ Уменьшает дублирование
4. ✅ Упрощает поддержку

**Это оптимальное решение для упрощения сложной логики!**

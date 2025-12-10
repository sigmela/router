# План рефакторинга: Универсальные способности NavigationNode

## Проблема

**Текущая ситуация:**
- Router использует TabBar-специфичные методы через `as any` касты (`findTabIndexByRoute`)
- Нарушение инверсии зависимостей: Router знает о деталях реализации TabBar
- Контракт `NavigationNode` не отражает реальные ожидания
- Сложно добавлять новые контейнеры (Drawer, Carousel и т.д.)

**Цель:**
- Универсальный контракт через опциональные способности
- Router не знает о TabBar или других конкретных реализациях
- Легко расширять новыми контейнерами

---

## Контракт (src/navigationNode.ts)

### Базовые методы (без изменений)
```typescript
export interface NavigationNode {
  getId(): string;
  getNodeRoutes(): NodeRoute[];
  getNodeChildren(): NodeChild[];
  getRenderer(): React.ComponentType<any>;
  seed?: () => { ... } | null;
  getDefaultOptions?: () => ScreenOptions | undefined;
  getActiveChildId?: () => string | undefined; // Уже есть
}
```

### Новые опциональные способности
```typescript
export interface NavigationNode {
  // ... базовые методы ...
  
  /**
   * Optional: Activates a child node by route ID.
   * Used by container nodes (TabBar, Drawer, etc.) to switch active child.
   * 
   * @param routeId - Route ID to activate
   */
  activateByRoute?: (routeId: string) => void;
  
  /**
   * Optional: Checks if a route exists in this container node.
   * Used for fast route lookup without iterating all children.
   * 
   * @param routeId - Route ID to check
   * @returns true if route exists in this container
   */
  hasRoute?: (routeId: string) => boolean;
}
```

### Type Guards (src/Router.ts)
```typescript
/**
 * Type guard to check if a NavigationNode can activate children by route.
 */
function isActivatable(
  node: NavigationNode | undefined
): node is NavigationNode & { activateByRoute: (routeId: string) => void } {
  return node !== undefined && typeof node.activateByRoute === 'function';
}

/**
 * Type guard to check if a NavigationNode can lookup routes.
 */
function canLookupRoutes(
  node: NavigationNode | undefined
): node is NavigationNode & { hasRoute: (routeId: string) => boolean } {
  return node !== undefined && typeof node.hasRoute === 'function';
}
```

**Примечание:** `setActiveChildByRoute` остается для обратной совместимости, но будет заменен на `activateByRoute` везде.

---

## Изменения в Router.ts

### 1. Заменить type guard `hasSetActiveChildByRoute`

**Было:**
```typescript
function hasSetActiveChildByRoute(
  node: NavigationNode | undefined
): node is NavigationNode & { setActiveChildByRoute: (routeId: string) => void } {
  return node !== undefined && typeof node.setActiveChildByRoute === 'function';
}
```

**Стало:**
```typescript
function isActivatable(
  node: NavigationNode | undefined
): node is NavigationNode & { activateByRoute: (routeId: string) => void } {
  return node !== undefined && typeof node.activateByRoute === 'function';
}

// Оставить старый для обратной совместимости (deprecated)
function hasSetActiveChildByRoute(
  node: NavigationNode | undefined
): node is NavigationNode & { setActiveChildByRoute: (routeId: string) => void } {
  return node !== undefined && typeof node.setActiveChildByRoute === 'function';
}
```

### 2. Метод `isRouteInTabBar` → `isRouteInContainer`

**Файл:** `src/Router.ts:887-898`

**Было:**
```typescript
private isRouteInTabBar(
  routeId: string,
  tabBar: NavigationNode
): boolean {
  if (typeof (tabBar as any).findTabIndexByRoute === 'function') {
    const tabIndex = (tabBar as any).findTabIndexByRoute(routeId);
    return tabIndex !== -1;
  }
  return false;
}
```

**Стало:**
```typescript
private isRouteInContainer(
  routeId: string,
  container: NavigationNode
): boolean {
  if (canLookupRoutes(container)) {
    return container.hasRoute(routeId);
  }
  // Fallback: проверяем через getNodeChildren
  const children = container.getNodeChildren();
  return children.some(child => {
    const routes = child.node.getNodeRoutes();
    return routes.some(r => r.routeId === routeId);
  });
}
```

### 3. Метод `activateTabBarForRoute` → `activateContainerForRoute`

**Файл:** `src/Router.ts:903-911`

**Было:**
```typescript
private activateTabBarForRoute(
  targetRouteId: string,
  rootStackId: string
): void {
  const tabBar = this.findTabBarInStack(rootStackId);
  if (tabBar && hasSetActiveChildByRoute(tabBar)) {
    tabBar.setActiveChildByRoute(targetRouteId);
  }
}
```

**Стало:**
```typescript
private activateContainerForRoute(
  targetRouteId: string,
  rootStackId: string
): void {
  const container = this.findContainerInStack(rootStackId);
  if (container && isActivatable(container)) {
    container.activateByRoute(targetRouteId);
  }
}
```

### 4. Метод `findTabBarInStack` → `findContainerInStack`

**Файл:** `src/Router.ts:917-936`

**Было:**
```typescript
private findTabBarInStack(stackId: string): NavigationNode | undefined {
  // Сначала ищем в истории (более актуально)
  const stackHistory = this.getStackHistory(stackId);
  for (let i = stackHistory.length - 1; i >= 0; i--) {
    const item = stackHistory[i];
    if (item) {
      const compiled = this.registry.find((r) => r.routeId === item.routeId);
      if (
        compiled?.childNode &&
        hasSetActiveChildByRoute(compiled.childNode)
      ) {
        return compiled.childNode;
      }
    }
  }

  // Если не нашли в истории, ищем в registry
  const rootRoute = this.findRootRouteWithTabBar(stackId);
  return rootRoute?.childNode;
}
```

**Стало:**
```typescript
private findContainerInStack(stackId: string): NavigationNode | undefined {
  // Сначала ищем в истории (более актуально)
  const stackHistory = this.getStackHistory(stackId);
  for (let i = stackHistory.length - 1; i >= 0; i--) {
    const item = stackHistory[i];
    if (item) {
      const compiled = this.registry.find((r) => r.routeId === item.routeId);
      if (compiled?.childNode && isActivatable(compiled.childNode)) {
        return compiled.childNode;
      }
    }
  }

  // Если не нашли в истории, ищем в registry
  const rootRoute = this.findRootRouteWithContainer(stackId);
  return rootRoute?.childNode;
}
```

### 5. Метод `findRootRouteWithTabBar` → `findRootRouteWithContainer`

**Файл:** `src/Router.ts:872-880`

**Было:**
```typescript
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
```

**Стало:**
```typescript
private findRootRouteWithContainer(
  rootStackId: string
): CompiledRoute | undefined {
  return this.registry.find(
    (r) =>
      r.stackId === rootStackId &&
      r.childNode &&
      isActivatable(r.childNode)
  );
}
```

### 6. Метод `findChildStackRouteForPathname`

**Файл:** `src/Router.ts:837-865`

**Было:**
```typescript
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
```

**Стало:**
```typescript
private findChildStackRouteForPathname(
  rootStackId: string,
  pathname: string
): CompiledRoute | undefined {
  // Ищем дочерний стек (контейнер) с таким же pathname
  for (const route of this.registry) {
    if (
      route.stackId !== rootStackId &&
      route.pathnamePattern === pathname &&
      !route.queryPattern
    ) {
      // Проверяем, что это дочерний элемент контейнера
      const rootRoute = this.findRootRouteWithContainer(rootStackId);
      if (rootRoute?.childNode && this.isRouteInContainer(route.routeId, rootRoute.childNode)) {
        return route;
      }
    }
  }
  return undefined;
}
```

### 7. Метод `syncStateForSameRoute`

**Файл:** `src/Router.ts:789-794`

**Было:**
```typescript
// Активируем TabBar (если есть)
if (rootStackId) {
  this.activateTabBarForRoute(targetRouteId, rootStackId);
}
```

**Стало:**
```typescript
// Активируем контейнер (если есть)
if (rootStackId) {
  this.activateContainerForRoute(targetRouteId, rootStackId);
}
```

### 8. Метод `ensureStackHasSeed`

**Файл:** `src/Router.ts:989-992`

**Было:**
```typescript
// Если это дочерний стек (таб), активируем TabBar
if (seedStackId !== stackId && rootStackId) {
  this.activateTabBarForRoute(seed.routeId, rootStackId);
}
```

**Стало:**
```typescript
// Если это дочерний стек (контейнер), активируем контейнер
if (seedStackId !== stackId && rootStackId) {
  this.activateContainerForRoute(seed.routeId, rootStackId);
}
```

### 9. Метод `addChildNodeSeedsToItems`

**Файл:** `src/Router.ts:1368-1370`

**Было:**
```typescript
// Если есть finalRouteId и childNode поддерживает setActiveChildByRoute,
// устанавливаем активный дочерний элемент на основе конечного маршрута
if (finalRouteId && hasSetActiveChildByRoute(childNode)) {
  this.log('addChildNodeSeeds: setting active child', { finalRouteId });
  childNode.setActiveChildByRoute(finalRouteId);
}
```

**Стало:**
```typescript
// Если есть finalRouteId и childNode поддерживает activateByRoute,
// устанавливаем активный дочерний элемент на основе конечного маршрута
if (finalRouteId && isActivatable(childNode)) {
  this.log('addChildNodeSeeds: setting active child', { finalRouteId });
  childNode.activateByRoute(finalRouteId);
}
```

### 10. Метод `matchBaseRoute` (приоритет при равной специфичности)

**Файл:** `src/Router.ts:1523-1603`

**Добавить логику:**
```typescript
// Если есть несколько кандидатов с одинаковой специфичностью,
// приоритет отдаем контейнерам с hasRoute
if (candidates.length > 1) {
  // ... существующая логика ...
  
  // Дополнительная проверка: если у контейнера есть hasRoute и routeId в нем,
  // приоритет выше
  for (const candidate of candidates) {
    const candidateStackId = candidate.route.stackId;
    if (candidateStackId !== rootStackId) {
      // Проверяем, есть ли этот routeId в контейнере
      const rootRoute = this.findRootRouteWithContainer(rootStackId);
      if (rootRoute?.childNode && canLookupRoutes(rootRoute.childNode)) {
        if (rootRoute.childNode.hasRoute(candidate.route.routeId)) {
          // Приоритет контейнеру с этим routeId
          best = { route: candidate.route, specificity: best.specificity };
          break;
        }
      }
    }
  }
}
```

---

## Изменения в TabBar.ts

### 1. Добавить методы `activateByRoute` и `hasRoute`

**Файл:** `src/TabBar/TabBar.ts`

**Добавить:**
```typescript
/**
 * Activates a tab by route ID.
 * Implements NavigationNode.activateByRoute capability.
 */
public activateByRoute(routeId: string): void {
  const idx = this.findTabIndexByRoute(routeId);
  if (idx === -1) return;
  if (idx === this.state.index) return;
  this.setState({ index: idx });
}

/**
 * Checks if a route exists in any tab.
 * Implements NavigationNode.hasRoute capability.
 */
public hasRoute(routeId: string): boolean {
  return this.findTabIndexByRoute(routeId) !== -1;
}
```

### 2. Обновить `setActiveChildByRoute` (для обратной совместимости)

**Файл:** `src/TabBar/TabBar.ts:155-160`

**Было:**
```typescript
public setActiveChildByRoute(routeId: string): void {
  const idx = this.findTabIndexByRoute(routeId);
  if (idx === -1) return;
  if (idx === this.state.index) return;
  this.setState({ index: idx });
}
```

**Стало:**
```typescript
public setActiveChildByRoute(routeId: string): void {
  // Делегируем в activateByRoute для единой логики
  this.activateByRoute(routeId);
}
```

### 3. Сделать `findTabIndexByRoute` публичным (или оставить приватным)

**Решение:** Оставить приватным, так как теперь используется только внутри TabBar через `activateByRoute` и `hasRoute`.

---

## Изменения в NavigationStack.ts

**Без изменений** - NavigationStack не является контейнером, поэтому не реализует `activateByRoute` и `hasRoute`.

---

## Порядок реализации

### Шаг 1: Обновить контракт
1. Добавить `activateByRoute?` и `hasRoute?` в `NavigationNode`
2. Добавить type guards `isActivatable` и `canLookupRoutes` в Router

### Шаг 2: Реализовать в TabBar
1. Добавить `activateByRoute` и `hasRoute`
2. Обновить `setActiveChildByRoute` для обратной совместимости

### Шаг 3: Обновить Router (постепенно)
1. Заменить `isRouteInTabBar` → `isRouteInContainer`
2. Заменить `activateTabBarForRoute` → `activateContainerForRoute`
3. Заменить `findTabBarInStack` → `findContainerInStack`
4. Заменить `findRootRouteWithTabBar` → `findRootRouteWithContainer`
5. Обновить все вызовы этих методов
6. Обновить `addChildNodeSeedsToItems`
7. Обновить `matchBaseRoute` (опционально, для приоритета)

### Шаг 4: Тестирование
1. Запустить все тесты
2. Проверить линтер
3. Убедиться, что нет упоминаний TabBar в Router (кроме комментариев)

### Шаг 5: Очистка (опционально)
1. Удалить старый type guard `hasSetActiveChildByRoute` (если не используется)
2. Обновить комментарии, убрав упоминания TabBar

---

## Преимущества

1. **Инверсия зависимостей:** Router не знает о TabBar
2. **Расширяемость:** Легко добавить Drawer, Carousel и т.д.
3. **Чистый контракт:** Опциональные способности вместо кастов
4. **Тестируемость:** Легко создать моки для контейнеров
5. **Типобезопасность:** Type guards вместо `as any`

---

## Обратная совместимость

- `setActiveChildByRoute` остается в контракте для обратной совместимости
- TabBar реализует оба метода (`setActiveChildByRoute` и `activateByRoute`)
- Старый код продолжит работать, но постепенно мигрирует на новые методы

---

## Итоговый контракт

```typescript
export interface NavigationNode {
  // Базовые методы
  getId(): string;
  getNodeRoutes(): NodeRoute[];
  getNodeChildren(): NodeChild[];
  getRenderer(): React.ComponentType<any>;
  
  // Опциональные базовые способности
  seed?: () => { ... } | null;
  getDefaultOptions?: () => ScreenOptions | undefined;
  getActiveChildId?: () => string | undefined;
  
  // Опциональные способности контейнера
  activateByRoute?: (routeId: string) => void;  // NEW
  hasRoute?: (routeId: string) => boolean;       // NEW
  
  // Deprecated (для обратной совместимости)
  setActiveChildByRoute?: (routeId: string) => void;
}
```

**Router знает только:**
- `isActivatable(node)` → вызывает `node.activateByRoute(routeId)`
- `canLookupRoutes(node)` → вызывает `node.hasRoute(routeId)`
- `node.getActiveChildId()` → для auto-seed

**Никаких упоминаний TabBar, Drawer или других конкретных реализаций!**

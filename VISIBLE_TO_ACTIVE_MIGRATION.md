# Миграция "visible" → "active"

## Места, где используется "visible"

### 1. Типы и интерфейсы

**Файл: `src/types.ts`**
- `export type VisibleRoute = ...` → `export type ActiveRoute = ...`

### 2. Router.ts - Поля класса

**Файл: `src/Router.ts`**
- `private visibleRoute: VisibleRoute = null;` → `private activeRoute: ActiveRoute = null;`

### 3. Router.ts - Публичные методы

**Файл: `src/Router.ts`**
- `public getVisibleRoute = (): VisibleRoute => ...` → `public getActiveRoute = (): ActiveRoute => ...`

### 4. Router.ts - Приватные методы

**Файл: `src/Router.ts`**
- `private recomputeVisibleRoute(): void` → `private recomputeActiveRoute(): void`
- `private updateVisibleRouteFromStack(...)` → `private updateActiveRouteFromStack(...)`
- `private buildUrlFromVisibleRoute(): string | null` → `private buildUrlFromActiveRoute(): string | null`

### 5. Router.ts - Использование поля

**Файл: `src/Router.ts`**
- `this.visibleRoute` → `this.activeRoute` (множество мест)
- `this.recomputeVisibleRoute()` → `this.recomputeActiveRoute()` (множество мест)
- `this.updateVisibleRouteFromStack(...)` → `this.updateActiveRouteFromStack(...)`
- `this.buildUrlFromVisibleRoute()` → `this.buildUrlFromActiveRoute()`

### 6. Router.ts - Локальные переменные

**Файл: `src/Router.ts`**
- `const visible = this.visibleRoute;` → `const active = this.activeRoute;`
- `let visibleItem: HistoryItem | undefined;` → `let activeItem: HistoryItem | undefined;`
- `const currentVisiblePath = this.visibleRoute?.path;` → `const currentActivePath = this.activeRoute?.path;`
- `const currentVisiblePathname = ...` → `const currentActivePathname = ...`
- `const vr = this.visibleRoute;` → `const ar = this.activeRoute;` (или `activeRoute`)

### 7. Router.ts - Debug метод

**Файл: `src/Router.ts`**
- `visibleRoute: this.visibleRoute,` → `activeRoute: this.activeRoute,`

### 8. Router.ts - Комментарии

**Файл: `src/Router.ts`**
- `// Find the topmost item in history (the currently visible route)` → `// Find the topmost item in history (the currently active route)`
- `'syncUrlWithStateAfterInternalPop: no visibleRoute, skip URL sync'` → `'syncUrlWithStateAfterInternalPop: no activeRoute, skip URL sync'`

### 9. RouterContext.tsx

**Файл: `src/RouterContext.tsx`**
- `router.getVisibleRoute()` → `router.getActiveRoute()`

### 10. RenderTabBar.web.tsx

**Файл: `src/TabBar/RenderTabBar.web.tsx`**
- `router.getVisibleRoute()?.path` → `router.getActiveRoute()?.path`

### 11. Тесты - navigation-contract.test.ts

**Файл: `src/__tests__/navigation-contract.test.ts`**

**Функции-хелперы:**
- `function getVisibleRoutePath(...)` → `function getActiveRoutePath(...)`
- `function getVisibleRouteParams(...)` → `function getActiveRouteParams(...)`
- `function getVisibleRouteQuery(...)` → `function getActiveRouteQuery(...)`

**Использование в тестах:**
- `router.debugGetState().visibleRoute` → `router.debugGetState().activeRoute` (множество мест)
- `router.getVisibleRoute()` → `router.getActiveRoute()` (множество мест)
- `getVisibleRoutePath(router)` → `getActiveRoutePath(router)` (множество мест)
- `getVisibleRouteParams(router)` → `getActiveRouteParams(router)` (множество мест)
- `getVisibleRouteQuery(router)` → `getActiveRouteQuery(router)` (множество мест)
- `const visibleRoute = ...` → `const activeRoute = ...` (множество мест)
- `const visibleRouteAfterSwitch = ...` → `const activeRouteAfterSwitch = ...`
- `const visibleRouteBeforeSwitch = ...` → `const activeRouteBeforeSwitch = ...`
- `// Check that visible route is from ...` → `// Check that active route is from ...`
- `// Modal should be last (visible)` → `// Modal should be last (active)`

### 12. Тесты - web-history.test.ts

**Файл: `src/__tests__/web-history.test.ts`**
- `state.visibleRoute` → `state.activeRoute` (множество мест)
- `router.debugGetState().visibleRoute` → `router.debugGetState().activeRoute` (множество мест)
- `const vr = router.debugGetState().visibleRoute;` → `const ar = router.debugGetState().activeRoute;`

## План миграции

### Шаг 1: Типы
1. Переименовать `VisibleRoute` → `ActiveRoute` в `src/types.ts`
2. Обновить импорты в `src/Router.ts`

### Шаг 2: Router.ts - Поля и методы
1. Переименовать поле `visibleRoute` → `activeRoute`
2. Переименовать метод `getVisibleRoute()` → `getActiveRoute()`
3. Переименовать метод `recomputeVisibleRoute()` → `recomputeActiveRoute()`
4. Переименовать метод `updateVisibleRouteFromStack()` → `updateActiveRouteFromStack()`
5. Переименовать метод `buildUrlFromVisibleRoute()` → `buildUrlFromActiveRoute()`
6. Обновить все использования в `Router.ts`

### Шаг 3: Другие файлы
1. Обновить `src/RouterContext.tsx`
2. Обновить `src/TabBar/RenderTabBar.web.tsx`

### Шаг 4: Тесты
1. Обновить функции-хелперы в `navigation-contract.test.ts`
2. Обновить все использования в тестах
3. Обновить `web-history.test.ts`

### Шаг 5: Проверка
1. Запустить линтер
2. Запустить все тесты
3. Проверить, что нет упоминаний "visible" в контексте роутера

## Статистика

- **Всего упоминаний "visible":** ~203
- **В Router.ts:** ~40
- **В тестах:** ~160
- **В других файлах:** ~3

## Важные замечания

1. **Тип `VisibleRoute`** используется как публичный API, поэтому его переименование может затронуть внешние зависимости
2. **Метод `getVisibleRoute()`** - публичный API, нужно проверить использование вне проекта
3. **Debug метод `debugGetState()`** возвращает `visibleRoute`, это тоже нужно обновить
4. В тестах много локальных переменных с именем `visibleRoute`, их тоже нужно переименовать

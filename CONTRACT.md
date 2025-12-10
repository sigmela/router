# Контракт Router API

## Обзор

**Router** — это движок навигации, который управляет маршрутизацией и историей переходов в приложении. Router работает с объектами, реализующими интерфейс **NavigationNode**, и делегирует им логику определения маршрутов и структуры навигации.

Этот документ описывает **публичный API Router** — что на входе, что на выходе, и как должно работать поведение навигации.

---

## Входные данные (Input)

### Инициализация

```typescript
interface RouterConfig {
  root: NavigationNode;           // Корневой узел навигации (TabBar или NavigationStack)
  screenOptions?: ScreenOptions;   // Глобальные опции экранов (опционально)
  debug?: boolean;                // Включить отладочный режим (опционально)
}

const router = new Router(config: RouterConfig);
```

**Требования:**
- `root` должен быть валидным объектом, реализующим интерфейс `NavigationNode`
- При инициализации Router автоматически:
  - Строит реестр маршрутов из `root` и всех дочерних узлов
  - На веб-платформах: парсит текущий URL и восстанавливает состояние
  - На нативных платформах: вызывает `seed()` для получения начального маршрута
  - Вычисляет видимый маршрут (`visibleRoute`)

### Методы навигации

#### `navigate(path: string): void`

Переход на новый маршрут (push операция).

**Вход:**
- `path: string` — путь для навигации (например, `/catalog`, `/catalog/products/123`, `/auth?kind=email`)

**Поведение:**
- Парсит путь и query-параметры
- Находит соответствующий маршрут в реестре
- Добавляет новый элемент в историю (push)
- Обновляет состояние стека, к которому относится маршрут
- Вычисляет новый видимый маршрут
- На веб-платформах: синхронизирует URL с состоянием (если `syncWithUrl !== false`)

**Особенности:**
- Если навигация на тот же путь с теми же параметрами — дубликат не создается (история не изменяется)
- При переключении между табами история каждого таба сохраняется
- Модальные окна могут открываться поверх текущего экрана

#### `replace(path: string, dedupe?: boolean): void`

Замена текущего маршрута (replace операция).

**Вход:**
- `path: string` — путь для замены
- `dedupe?: boolean` — опциональный флаг для дедупликации

**Поведение:**
- Аналогично `navigate`, но заменяет последний элемент истории вместо добавления нового
- История не увеличивается в размере
- `goBack()` после `replace` вернет к предыдущему маршруту (не к замененному)

#### `goBack(): void`

Возврат к предыдущему маршруту (pop операция).

**Вход:** Нет параметров

**Поведение:**
- Определяет активный стек (из `visibleRoute.stackId`)
- Удаляет последний элемент из истории активного стека
- Если стек пуст (только корневой маршрут) — операция игнорируется (история не изменяется)
- Вычисляет новый видимый маршрут
- На веб-платформах: синхронизирует URL с состоянием

**Особенности:**
- `goBack()` работает в контексте активного стека
- При закрытии модального окна возврат идет к экрану, который был до открытия модала
- При переключении табов `goBack()` работает в контексте активного таба

#### `setRoot(nextRoot: NavigationNode, options?: { transition?: RootTransition }): void`

Динамическая замена корневого узла навигации.

**Вход:**
- `nextRoot: NavigationNode` — новый корневой узел
- `options?: { transition?: RootTransition }` — опции перехода (опционально)

**Поведение:**
- Полностью очищает текущую историю и состояние
- Перестраивает реестр маршрутов из нового `nextRoot`
- Создает начальную историю через `seed()`
- Уведомляет подписчиков об изменении корня

---

## Выходные данные (Output)

### Типы данных

#### `VisibleRoute`

Текущий видимый маршрут.

```typescript
type VisibleRoute = {
  routeId: string;                    // ID маршрута
  stackId?: string;                    // ID стека, к которому относится маршрут
  tabIndex?: number;                   // Индекс активного таба (если применимо)
  path?: string;                       // Полный путь с query
  params?: Record<string, unknown>;    // Параметры пути (например, { productId: "123" })
  query?: Record<string, unknown>;     // Query-параметры (например, { kind: "email" })
} | null;
```

**Особенности:**
- `null` если история пуста (не должно происходить в нормальной работе)
- `path` содержит полный путь с query-параметрами (например, `/auth?kind=email`)
- `params` извлекаются из пути по паттерну (например, `/catalog/products/:productId` → `{ productId: "123" }`)
- `query` парсятся из query-строки (например, `?kind=email&redirect=/home` → `{ kind: "email", redirect: "/home" }`)

#### `HistoryItem`

Элемент истории навигации.

```typescript
type HistoryItem = {
  key: string;                         // Уникальный ключ записи
  routeId: string;                     // ID маршрута
  component: React.ComponentType<any>; // React компонент для рендеринга
  options?: ScreenOptions;             // Опции экрана (header, animation и т.д.)
  params?: Record<string, unknown>;    // Параметры пути
  query?: Record<string, unknown>;     // Query-параметры
  passProps?: any;                     // Props, переданные из контроллера
  stackId?: string;                    // ID стека
  pattern?: string;                    // Паттерн маршрута
  path?: string;                       // Полный путь
};
```

#### `RouterState`

Полное состояние роутера.

```typescript
type RouterState = {
  history: HistoryItem[];              // Полная история навигации
};
```

### Методы получения состояния

#### `getVisibleRoute(): VisibleRoute`

Возвращает текущий видимый маршрут.

**Выход:** `VisibleRoute | null`

**Использование:**
```typescript
const route = router.getVisibleRoute();
if (route) {
  console.log(route.path);           // "/catalog/products/123"
  console.log(route.params);         // { productId: "123" }
  console.log(route.query);          // { kind: "email" }
}
```

#### `getStackHistory(stackId?: string): HistoryItem[]`

Возвращает историю конкретного стека.

**Вход:**
- `stackId?: string` — ID стека (опционально)

**Выход:** `HistoryItem[]` — массив элементов истории стека

**Поведение:**
- Если `stackId` не передан или не найден — возвращает пустой массив
- Возвращает историю в порядке добавления (первый элемент — корневой маршрут)
- Каждый стек имеет свою независимую историю

**Использование:**
```typescript
const catalogStackId = catalogStack.getId();
const history = router.getStackHistory(catalogStackId);
console.log(history.length);         // Количество экранов в стеке
console.log(history[0].path);        // Первый (корневой) маршрут
console.log(history[history.length - 1].path); // Последний (текущий) маршрут
```

#### `getState(): RouterState`

Возвращает полное состояние роутера.

**Выход:** `RouterState`

**Использование:**
```typescript
const state = router.getState();
console.log(state.history.length);   // Общее количество элементов истории
```

### Методы подписки

#### `subscribe(listener: () => void): () => void`

Подписка на все изменения навигации.

**Вход:**
- `listener: () => void` — функция-коллбек, вызываемая при любом изменении навигации

**Выход:** `() => void` — функция для отписки

**Поведение:**
- Вызывается при любом изменении навигации (navigate, replace, goBack, setRoot)
- Используется для обновления UI при изменении состояния

#### `subscribeStack(stackId: string, listener: () => void): () => void`

Подписка на изменения конкретного стека.

**Вход:**
- `stackId: string` — ID стека
- `listener: () => void` — функция-коллбек

**Выход:** `() => void` — функция для отписки

**Поведение:**
- Вызывается только при изменении истории конкретного стека
- Используется компонентами (например, `NavigationStack`) для обновления UI

#### `subscribeRoot(listener: () => void): () => void`

Подписка на изменение корневого узла.

**Вход:**
- `listener: () => void` — функция-коллбек

**Выход:** `() => void` — функция для отписки

**Поведение:**
- Вызывается при вызове `setRoot()`
- Используется для обработки смены корня навигации

---

## Поведение навигации

### Базовые сценарии

#### 1. Навигация по простым путям

```typescript
const router = new Router({ root: tabBar });

// Начальное состояние
router.getVisibleRoute()?.path;        // "/" (корневой маршрут)

// Навигация
router.navigate('/catalog');
router.getVisibleRoute()?.path;        // "/catalog"

router.navigate('/settings');
router.getVisibleRoute()?.path;        // "/settings"
```

#### 2. Навигация с параметрами пути

```typescript
router.navigate('/catalog/products/123');
const route = router.getVisibleRoute();
route?.path;                           // "/catalog/products/123"
route?.params;                         // { productId: "123" }

router.navigate('/orders/2024/12');
const route2 = router.getVisibleRoute();
route2?.path;                          // "/orders/2024/12"
route2?.params;                        // { year: "2024", month: "12" }
```

#### 3. Навигация с query-параметрами

```typescript
router.navigate('/auth?kind=email');
const route = router.getVisibleRoute();
route?.path;                           // "/auth?kind=email"
route?.query;                          // { kind: "email" }

router.navigate('/auth?kind=sms&redirect=/home');
const route2 = router.getVisibleRoute();
route2?.query;                         // { kind: "sms", redirect: "/home" }
```

#### 4. Возврат назад (goBack)

```typescript
router.navigate('/catalog');
router.navigate('/catalog/products/123');
router.getVisibleRoute()?.path;        // "/catalog/products/123"

router.goBack();
router.getVisibleRoute()?.path;        // "/catalog"

router.goBack();
router.getVisibleRoute()?.path;        // "/" (или остается "/catalog" если это корневой маршрут)
```

#### 5. Замена маршрута (replace)

```typescript
router.navigate('/catalog');
router.navigate('/catalog/products/1');
router.navigate('/catalog/products/2');
// История: ["/catalog", "/catalog/products/1", "/catalog/products/2"]

router.replace('/catalog/products/3');
// История: ["/catalog", "/catalog/products/1", "/catalog/products/3"]
// (заменен последний элемент)

router.goBack();
router.getVisibleRoute()?.path;        // "/catalog/products/1" (не "/catalog/products/2")
```

### Навигация с табами

#### Переключение между табами

```typescript
const router = new Router({ root: tabBar });

const homeStackId = homeStack.getId();
const catalogStackId = catalogStack.getId();

// Начальное состояние (активен home tab)
router.getVisibleRoute()?.path;        // "/"
router.getStackHistory(homeStackId).length;    // 1

// Переключение на catalog tab
router.navigate('/catalog');
router.getVisibleRoute()?.path;        // "/catalog"
router.getStackHistory(catalogStackId).length; // 1
router.getStackHistory(homeStackId).length;    // 1 (сохранена)

// Переключение обратно на home tab
router.navigate('/');
router.getVisibleRoute()?.path;        // "/"
router.getStackHistory(homeStackId).length;    // 1 (восстановлена)
router.getStackHistory(catalogStackId).length; // 1 (сохранена)
```

#### Глубокая навигация в табе

```typescript
// Навигация глубоко в catalog tab
router.navigate('/catalog');
router.navigate('/catalog/products/123');
router.getStackHistory(catalogStackId).length; // 2
router.getVisibleRoute()?.path;        // "/catalog/products/123"

// Переключение на другой tab
router.navigate('/settings');
router.getVisibleRoute()?.path;        // "/settings"
router.getStackHistory(settingsStackId).length; // 1

// История catalog tab сохранена
router.getStackHistory(catalogStackId).length; // 2

// Возврат в catalog tab восстанавливает состояние
router.navigate('/catalog/products/123');
router.getVisibleRoute()?.path;        // "/catalog/products/123"
router.getStackHistory(catalogStackId).length; // 2 (не увеличилась)
```

#### goBack в контексте таба

```typescript
// Навигация в catalog tab
router.navigate('/catalog');
router.navigate('/catalog/products/123');
router.getStackHistory(catalogStackId).length; // 2

// Переключение на settings tab
router.navigate('/settings');
router.getStackHistory(settingsStackId).length; // 1

// goBack работает в контексте активного таба (settings)
router.goBack();
router.getStackHistory(settingsStackId).length; // 1 (не может уйти ниже корня)

// Возврат в catalog tab
router.navigate('/catalog/products/123');
router.getStackHistory(catalogStackId).length; // 2

// goBack теперь работает в контексте catalog tab
router.goBack();
router.getVisibleRoute()?.path;        // "/catalog"
router.getStackHistory(catalogStackId).length; // 1
```

### Модальные окна

#### Открытие модального окна

```typescript
const router = new Router({ root: rootStack });

// Навигация к базовому экрану
router.navigate('/catalog');
router.getVisibleRoute()?.path;        // "/catalog"

// Открытие модального окна через query-параметр
router.navigate('/catalog?modal=promo');
router.getVisibleRoute()?.path;        // "/catalog?modal=promo" (или содержит "modal=promo")
```

#### Закрытие модального окна (goBack)

```typescript
router.navigate('/catalog');
router.navigate('/catalog?modal=promo');
router.getVisibleRoute()?.path;        // содержит "modal=promo"

router.goBack();
router.getVisibleRoute()?.path;        // "/catalog" (модал закрыт)
```

#### Модальные окна с параметрами

```typescript
router.navigate('/auth');
router.getVisibleRoute()?.path;        // "/auth"

router.navigate('/auth?kind=email');
router.getVisibleRoute()?.query?.kind; // "email"

router.navigate('/auth?kind=sms');
router.getVisibleRoute()?.query?.kind; // "sms"

// goBack возвращает к предыдущему состоянию модала
router.goBack();
router.getVisibleRoute()?.query?.kind; // "email"

router.goBack();
router.getVisibleRoute()?.path;        // "/auth" (query отсутствует)
```

### Дедупликация маршрутов

#### Предотвращение дубликатов

```typescript
router.navigate('/catalog');
router.getStackHistory(catalogStackId).length; // 1

// Навигация на тот же путь не создает дубликат
router.navigate('/catalog');
router.getStackHistory(catalogStackId).length; // 1 (не изменилась)

// Навигация на тот же путь с теми же параметрами не создает дубликат
router.navigate('/catalog/products/123');
router.getStackHistory(catalogStackId).length; // 2

router.navigate('/catalog/products/123');
router.getStackHistory(catalogStackId).length; // 2 (не изменилась)
```

### Сложные сценарии

#### Комбинированная навигация (табы + глубокая навигация + модалы)

```typescript
const router = new Router({ root: rootStack });

// 1. Навигация в catalog tab
router.navigate('/catalog');
router.getStackHistory(catalogStackId).length; // 1

// 2. Глубокая навигация
router.navigate('/catalog/products/1');
router.navigate('/catalog/products/2');
router.getStackHistory(catalogStackId).length; // 3

// 3. Открытие модального окна
router.navigate('/catalog/products/2?modal=promo');
router.getVisibleRoute()?.path;        // содержит "modal=promo"

// 4. Закрытие модала
router.goBack();
router.getVisibleRoute()?.path;        // "/catalog/products/2"

// 5. Продолжение возврата назад
router.goBack();
router.getVisibleRoute()?.path;        // "/catalog/products/1"

router.goBack();
router.getVisibleRoute()?.path;        // "/catalog"

router.goBack();
router.getVisibleRoute()?.path;        // "/" (или остается "/catalog" если это корневой маршрут)
```

---

## Контракт поведения

### Обязательные гарантии

1. **Сохранение истории табов**
   - При переключении между табами история каждого таба сохраняется
   - Возврат в таб восстанавливает его последнее состояние

2. **Работа goBack в контексте стека**
   - `goBack()` всегда работает в контексте активного стека
   - Нельзя уйти ниже корневого маршрута стека

3. **Дедупликация маршрутов**
   - Навигация на тот же путь с теми же параметрами не создает дубликат
   - История не увеличивается при повторной навигации на текущий маршрут

4. **Извлечение параметров**
   - Параметры пути извлекаются из URL по паттерну маршрута
   - Query-параметры парсятся из query-строки
   - Параметры доступны в `visibleRoute.params` и `visibleRoute.query`

5. **Синхронизация URL (веб)**
   - На веб-платформах URL синхронизируется с состоянием навигации
   - Изменение URL в браузере обрабатывается и обновляет состояние

6. **Начальное состояние**
   - При инициализации Router всегда имеет валидное начальное состояние
   - На веб: парсится из URL
   - На нативных платформах: вызывается `seed()` для получения начального маршрута

### Ограничения

1. **Нельзя уйти ниже корня**
   - `goBack()` на корневом маршруте не изменяет состояние
   - История стека всегда содержит хотя бы один элемент (корневой маршрут)

2. **Маршрут должен существовать**
   - Навигация на несуществующий маршрут должна обрабатываться (поведение зависит от реализации)
   - Router использует реестр маршрутов для поиска соответствий

3. **Один видимый маршрут**
   - В любой момент времени существует только один видимый маршрут
   - `getVisibleRoute()` возвращает последний элемент истории (top of stack)

---

## Структура навигации: древовидная маршрутизация, плоская история

### Древовидная структура маршрутов

Router поддерживает **древовидную структуру навигации** — стеки могут быть вложены друг в друга через `childNode`.

**Пример:**
```
Root Stack (stack-1)
  ├─ Route: "/" (route-1, childNode: TabBar)
  │   └─ TabBar (tabbar-1)
  │       ├─ Child: Home Stack (stack-home)
  │       │   └─ Route: "/home"
  │       └─ Child: Catalog Stack (stack-catalog)
  │           ├─ Route: "/catalog"
  │           └─ Route: "/catalog/products/:productId"
  └─ Route: "/auth" (route-2)
      └─ Auth Stack (stack-auth)
          ├─ Route: "/auth"
          └─ Route: "/auth?kind=email"
```

**Как это работает:**
- Каждый `NavigationNode` может иметь дочерние узлы через `getNodeChildren()`
- Маршрут может иметь `childNode`, который становится частью иерархии
- Router рекурсивно обходит дерево узлов при построении реестра маршрутов
- Пути комбинируются: дочерний маршрут получает префикс от родительского

**Пример кода:**
```typescript
const catalogStack = new NavigationStack()
  .addScreen('/catalog', CatalogScreen)
  .addScreen('/catalog/products/:productId', ProductScreen);

const tabBar = new TabBar()
  .addTab({ key: 'catalog', stack: catalogStack, title: 'Catalog' });

const rootStack = new NavigationStack()
  .addScreen('/', tabBar) // TabBar как childNode маршрута "/"
  .addScreen('/auth', AuthScreen);
```

### Плоская история навигации

**Важно:** Хотя структура маршрутов древовидная, **история навигации хранится как плоский массив**.

```typescript
type RouterState = {
  history: HistoryItem[];  // Плоский массив, не дерево
};
```

**Каждый элемент истории содержит:**
- `stackId` — ID стека, к которому относится маршрут
- `routeId` — ID маршрута
- `path`, `params`, `query` — данные маршрута
- `key` — уникальный ключ для React

**Пример истории:**
```typescript
// История может выглядеть так:
[
  { key: 'route-1', stackId: 'stack-home', routeId: 'route-home', path: '/home' },
  { key: 'route-2', stackId: 'stack-catalog', routeId: 'route-catalog', path: '/catalog' },
  { key: 'route-3', stackId: 'stack-catalog', routeId: 'route-product', path: '/catalog/products/123' },
  { key: 'route-4', stackId: 'stack-auth', routeId: 'route-auth', path: '/auth?kind=email' },
]
```

**Получение истории конкретного стека:**
```typescript
// Получить историю конкретного стека
const catalogHistory = router.getStackHistory('stack-catalog');
// Вернет только элементы с stackId === 'stack-catalog'
// [
//   { key: 'route-2', stackId: 'stack-catalog', ... },
//   { key: 'route-3', stackId: 'stack-catalog', ... },
// ]
```

**Почему плоская история:**
- Проще управлять и синхронизировать
- Легче реализовать операции push/pop/replace
- `stackId` позволяет группировать элементы по стекам
- `getStackHistory(stackId)` фильтрует историю по стеку

**Поведение при навигации:**
- При навигации в стек добавляется элемент в плоскую историю
- При `goBack()` удаляется последний элемент активного стека
- При переключении табов история каждого таба сохраняется (фильтруется по `stackId`)

---

## Связь с NavigationNode

Router работает исключительно через интерфейс `NavigationNode`. Подробное описание контракта `NavigationNode` и архитектуры делегирования см. в [ROUTER_CONTRACT.md](./ROUTER_CONTRACT.md).

**Ключевые моменты:**
- Router не знает о конкретных реализациях (`NavigationStack`, `TabBar`)
- Вся логика определения маршрутов делегируется `NavigationNode`
- Router координирует навигацию и управляет историей
- `NavigationNode` определяет структуру навигации и компоненты
- **Структура маршрутов древовидная, история — плоская**

---

## Отладочные методы

Для отладки Router предоставляет дополнительные методы (не являются частью публичного API, но могут использоваться в тестах):

- `debugGetState()` — полное состояние роутера с историей, стеками и реестром
- `debugMatchRoute(path: string)` — информация о матчинге маршрута
- `debugGetStackInfo(stackId: string)` — информация о конкретном стеке
- `debugGetAllStacks()` — информация о всех стеках

Эти методы используются в тестах для проверки внутреннего состояния и не должны использоваться в production коде.

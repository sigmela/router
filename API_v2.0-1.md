# Sigmela Router 2.0 API Documentation

## Философия дизайна

Sigmela Router 2.0 — это **URL-driven** система навигации с древовидной структурой стеков для web и react-native. Ключевые принципы:

1. **URL как единственный источник истины** - Router строит состояние навигации из URL
2. **Древовидная структура стеков** - NavigationStack может содержать вложенные стеки
3. **Декларативный API** - NavigationStack описывает структуру, Router управляет runtime
4. **Детерминированность** - один URL → одно представление стеков
5. **Платформенная агностичность** - веб использует browser URL, mobile (react-native) — эфемерный внутренний URL

---

## Основные концепции

### Древовидные стеки

Router 2.0 поддерживает произвольную вложенность стеков:

```
RootStack
├── Screen: /
├── Screen: /profile
└── NestedStack: /catalog
    ├── Screen: / → /catalog
    ├── Screen: /products/:id → /catalog/products/:id
    └── DeepNestedStack: /admin
        ├── Screen: / → /catalog/admin
        └── Screen: /settings → /catalog/admin/settings
```

**URL mapping:**
- `/` → HomeScreen (RootStack)
- `/profile` → ProfileScreen (RootStack)
- `/catalog` → CatalogHomeScreen (NestedStack)
- `/catalog/products/123` → ProductScreen (NestedStack, params: {id: "123"})
- `/catalog/admin` → AdminScreen (DeepNestedStack)
- `/catalog/admin/settings` → AdminSettingsScreen (DeepNestedStack)

### Deep Linking и построение стека

**Ключевая особенность**: При переходе на глубокий URL Router автоматически строит **полный стек** из всех промежуточных экранов.

#### Пример построения стека

```typescript
const catalogStack = new NavigationStack()
  .addScreen('/', CatalogHomeScreen)           // /catalog
  .addScreen('/products', ProductsListScreen)   // /catalog/products
  .addScreen('/products/:id', ProductDetailScreen); // /catalog/products/:id

const rootStack = new NavigationStack()
  .addScreen('/', HomeScreen)
  .addStack('/catalog', catalogStack);

const router = new Router({ root: rootStack });
```

**URL → История стека:**

```typescript
// URL: /catalog/products/123
// Router строит историю стека:
[
  { path: '/catalog', component: CatalogHomeScreen },
  { path: '/catalog/products', component: ProductsListScreen },
  { path: '/catalog/products/123', component: ProductDetailScreen, params: { id: '123' } }
]

// Все три экрана рендерятся в стеке одновременно
// goBack() вернёт на /catalog/products
```

**Инварианты Deep Linking:**
- Router анализирует URL по сегментам: `/catalog` → `/catalog/products` → `/catalog/products/123`
- Для каждого сегмента ищет совпадающий маршрут
- Если маршрут найден — добавляет его в историю стека
- Если промежуточный маршрут не найден — пропускает этот сегмент
- Финальный сегмент **должен** совпадать, иначе ошибка (404)

### URL как источник истины

**Фундаментальный принцип**: URL всегда определяет состояние навигации. Router не хранит бизнес-состояние приложения — он **реконструирует навигационное состояние** из URL (и ephemeral-слоя на web).

#### URL-Driven Architecture

```
┌─────────────┐
│     URL     │ ← Единственный источник истины
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ Router.parseURL()│ ← Парсинг URL → StackModel
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Stack History   │ ← Построенная история стеков
└──────────────────┘
```

**На веб-платформе:**
- Router работает напрямую с `window.location` и Browser History API
- `router.navigate('/profile')` → `history.pushState()` → изменяет URL → пересобирает стеки
- Browser back button → `popstate` event → Router парсит новый URL → пересобирает стеки
- URL в адресной строке **всегда** синхронизирован с состоянием

**На мобильных платформах (react-native):**
- Router поддерживает **эфемерный внутренний URL**
- `router.navigate('/profile')` → обновляет internal URL → пересобирает стеки
- Операции навигации (`push`, `pop`, `replace`) управляют internal URL
- Internal URL работает как "виртуальная адресная строка"

#### Reconciliation механизм

При **любом** изменении URL Router выполняет reconciliation:

```typescript
// 1. URL изменился (любым способом)
URL: /catalog/products/123

// 2. Router парсит URL и строит StackModel
Router.parseURL('/catalog/products/123')
  → Анализирует сегменты: ['/catalog', '/catalog/products', '/catalog/products/123']
  → Матчит с зарегистрированными маршрутами
  → Строит историю стека

// 3. Reconciliation с существующей историей
Текущая история: [
  { key: 'route-abc', path: '/catalog', ... }
]

Новая история: [
  { key: 'route-abc', path: '/catalog', ... },        // ← key сохранён!
  { key: 'route-xyz', path: '/catalog/products', ... },
  { key: 'route-123', path: '/catalog/products/123', ... }
]

// 4. React рендерит обновлённую историю
```

**Алгоритм Reconciliation:**

Router использует **двухуровневый алгоритм сравнения**, чтобы переиспользовать существующие `HistoryItem` и избежать лишних ререндеров:

```typescript
function reconcile(oldHistory, rawNewHistory) {
  const result = [];

  for (let i = 0; i < rawNewHistory.length; i++) {
    const raw = rawNewHistory[i];
    const old = oldHistory[i];

    if (old && isSameRoute(old, raw) && isSamePayload(old, raw)) {
      result.push(old); // zero re-render — возвращаем ту же ссылку
      continue;
    }

    if (old && isSameRoute(old, raw)) {
      result.push({ ...raw, key: old.key }); // тот же экран, но новые params/query/options
      continue;
    }

    result.push({ ...raw, key: generateKey() }); // совершенно новый экран
  }

  return result;
}

function isSameRoute(old, raw) {
  return old.routeId === raw.routeId && old.path === raw.path && old.component === raw.component;
}

function isSamePayload(old, raw) {
  return (
    shallowEqual(old.params, raw.params) &&
    shallowEqual(old.query, raw.query) &&
    old.options === raw.options
  );
}
```

**Характеристики производительности:**
- **O(n)** сложность, где n — длина новой истории
- Нет дорогих операций поиска или сравнения
- Работает за **один проход** по массиву
- Минимальное создание новых объектов (только для изменённых элементов)
- **Синхронное выполнение** — без асинхронных задержек

**Инварианты Reconciliation:**
- **Ключи экранов стабильны**: Если экран уже существует в истории — его `key` не меняется
- **Incremental updates**: `push` добавляет новый item, `pop` удаляет последний
- **Immutable operations**: История никогда не мутируется, только пересоздаётся
- **Детерминированность**: Один URL → одна история стеков (всегда)
- **Быстрое выполнение**: Reconciliation занимает ~1-2ms даже для глубоких стеков (10+ экранов)
- **Zero re-render rule**: Router переиспользует существующие `HistoryItem` ссылки для всех неизменённых позиций, поэтому React не рендерит заново экраны ниже по стеку — меняется только хвост истории (push/pop реализованы через reuse префикса / усечение массива)

#### Операции навигации

**`navigate(path)` - Push:**
```typescript
router.navigate('/catalog/products/123');

// Web:
// 1. history.pushState() → изменяет URL
// 2. Router парсит новый URL
// 3. Reconciliation: добавляет новые items в историю, сохраняя ключи существующих

// Mobile (react-native):
// 1. Обновляет internal URL
// 2. Router парсит internal URL
// 3. Reconciliation: аналогично веб
```

**`goBack()` - Pop:**
```typescript
router.goBack();

// Web:
// 1. Проверяет глубину стека - можно ли сделать goBack()
// 2. Если стек пустой или нет предыдущего маршрута → игнорирует действие
// 3. history.back() → браузер меняет URL на предыдущий
// 4. popstate event → Router получает новый URL
// 5. Reconciliation: удаляет последние items, сохраняя ключи остальных

// Mobile:
// 1. Проверяет internal history - есть ли предыдущий URL
// 2. Если нет → игнорирует действие
// 3. Удаляет последний URL из internal history
// 4. Router парсит предыдущий URL
// 5. Reconciliation: аналогично веб
```

**Инварианты `goBack()`:**
- **Boundary protection**: `goBack()` не выполняется, если это приведёт к выходу за пределы приложения
- **Depth check**: Router проверяет глубину стека перед выполнением операции
- **Graceful ignore**: Если `goBack()` невозможен — операция игнорируется без ошибок
- **Web safety**: Предотвращает случайный переход на внешние сайты через browser history

**`replace(path)` - Replace:**
```typescript
router.replace('/settings');

// Web:
// 1. history.replaceState() → заменяет текущий URL
// 2. Router парсит новый URL
// 3. Reconciliation: заменяет текущие items, сохраняя ключи других

// Mobile:
// 1. Заменяет последний URL в internal history
// 2. Router парсит новый URL
// 3. Reconciliation: аналогично веб
```

**Ключевые гарантии:**
- URL меняется **до** reconciliation
- Reconciliation происходит **синхронно** после изменения URL
- React рендер происходит **после** reconciliation
- Ключи экранов **стабильны** при любых операциях
- `goBack()` проверяет глубину стека и **игнорирует** операцию при выходе за границы приложения

### Query параметры для роутинга

**Ключевая особенность**: Query параметры можно добавлять к **любому** path для вариативности отображения - как для модалов поверх базового экрана, так и для обычных экранов с разными состояниями.

#### Wildcard паттерны (`*?param=value`)

Wildcard паттерн `*` позволяет отобразить экран **поверх любого пути** в приложении:

```typescript
const globalStack = new NavigationStack()
  .addModal('*?modal=promo', PromoModalScreen, {
    header: { title: 'Promo' },
  })
  .addModal('*?modal=auth', AuthModalScreen, {
    header: { title: 'Sign in' },
  });

const router = new Router({ root: globalStack });
```

**URL mapping:**
- `/catalog?modal=promo` → CatalogScreen + PromoModal
- `/users/42?modal=promo` → UserScreen (params: {id: "42"}) + PromoModal
- `/profile?modal=auth` → ProfileScreen + AuthModal
- `/?modal=promo` → HomeScreen + PromoModal

**Инварианты wildcard паттернов:**
- `*` совпадает с **любым pathname**
- Query pattern обязателен для wildcard: `*?modal=promo`
- По умолчанию рендерится **поверх** базового экрана (если используется `.addModal()`)
- Можно использовать `.addScreen()` для полной замены базового экрана
- Можно комбинировать несколько query параметров: `*?modal=promo&source=email`

#### Query параметры на конкретных path

Query параметры можно использовать для вариативности на одном path - как для модалов, так и для обычных экранов:

```typescript
const authStack = new NavigationStack()
  .addScreen('/auth', AuthRootScreen, {
    header: { title: 'Login', hidden: true },
  })
  .addModal('/auth?kind=email', EmailAuthModal, {
    header: { title: 'Email login' },
  })
  .addModal('/auth?kind=sms', SmsAuthModal, {
    header: { title: 'SMS login' },
  })
  .addModal('/auth?kind=:kind', GenericAuthModal); // Fallback с параметром
```

**URL mapping:**
- `/auth` → AuthRootScreen (базовый экран)
- `/auth?kind=email` → AuthRootScreen + EmailAuthModal
- `/auth?kind=sms` → AuthRootScreen + SmsAuthModal
- `/auth?kind=phone` → AuthRootScreen + GenericAuthModal (params: {kind: "phone"})

**Инварианты query параметров:**
- Если используется `.addModal()` - базовый path рендерится **под** модалом
- Если используется `.addScreen()` - базовый path **заменяется** новым экраном
- Query pattern может быть константой: `?kind=email` (высокая специфичность)
- Query pattern может быть параметром: `?kind=:kind` (низкая специфичность)
- Более конкретные паттерны имеют приоритет над параметризованными

**Пример с обычными экранами (не модалами):**

```typescript
const productsStack = new NavigationStack()
  .addScreen('/products', ProductsListScreen)
  .addScreen('/products?view=grid', ProductsGridScreen)
  .addScreen('/products?view=list', ProductsListScreen) // или тот же компонент
  .addScreen('/products?view=:viewType', ProductsCustomViewScreen);

// URL определяет какой экран рендерить:
router.navigate('/products');              // ProductsListScreen
router.navigate('/products?view=grid');    // ProductsGridScreen (заменяет base)
router.navigate('/products?view=list');    // ProductsListScreen (заменяет base)
router.navigate('/products?view=table');   // ProductsCustomViewScreen (viewType: 'table')
```

#### Комбинирование query параметров

Можно комбинировать несколько query параметров для сложной логики:

```typescript
const stack = new NavigationStack()
  .addScreen('/products', ProductsScreen)
  .addModal('/products?filter=:category', FilterModal)
  .addModal('/products?filter=:category&sort=:order', FilterAndSortModal);
```

**URL mapping:**
- `/products` → ProductsScreen
- `/products?filter=electronics` → ProductsScreen + FilterModal
- `/products?filter=electronics&sort=asc` → ProductsScreen + FilterAndSortModal

**Специфичность:**
- `/products?filter=electronics&sort=asc` (2 query params) > `/products?filter=electronics` (1 query param)
- Более конкретный query pattern выбирается при матчинге

#### Query параметры на вложенных стеках

Query маршруты (как экраны, так и модалы) работают на **любом уровне вложенности**:

```typescript
const catalogStack = new NavigationStack()
  .addScreen('/', CatalogHome)
  .addScreen('/products/:id', ProductDetail)
  .addModal('*?share=:platform', ShareModal); // Wildcard внутри вложенного стека

const rootStack = new NavigationStack()
  .addScreen('/', HomeScreen)
  .addStack('/catalog', catalogStack);

const router = new Router({ root: rootStack });
```

**URL mapping:**
- `/catalog?share=twitter` → CatalogHome + ShareModal (platform: "twitter")
- `/catalog/products/123?share=facebook` → ProductDetail + ShareModal (platform: "facebook")

**Инварианты:**
- Wildcard `*` внутри вложенного стека работает только для путей **этого стека**
- `/catalog/*` совпадает с `/catalog`, `/catalog/products/123`, но не с `/profile`

### Presentation Types

Поддерживаемые типы представления экранов:

```typescript
type StackPresentationTypes =
  | 'push'                      // Стандартный push
  | 'modal'                     // Модальное окно
  | 'transparentModal'          // Прозрачный модал
  | 'containedModal'            // Встроенный модал
  | 'containedTransparentModal' // Встроенный прозрачный модал
  | 'fullScreenModal'           // Полноэкранный модал
  | 'formSheet'                 // Form sheet (iOS)
  | 'pageSheet'                 // Page sheet (iOS)
  | 'sheet'                     // Нативный sheet
```

---

## Core API

### Router

**Router** — это стейт-машина, которая смотрит на текущий URL и строит модель стеков.

#### Создание Router

```typescript
import { Router, NavigationStack } from '@sigmela/router';

const rootStack = new NavigationStack()
  .addScreen('/', HomeScreen)
  .addScreen('/profile', ProfileScreen);

const router = new Router({
  root: rootStack,                // Обязательно - instance корневого NavigationStack/TabBar
  notFoundScreen?: React.ComponentType<any>, // Опционально - экран 404
  screenOptions?: ScreenOptions,  // Опционально - глобальные опции
  debug?: boolean                 // Опционально (default: false)
});
```

**Инварианты:**
- Router получает **статическую конфигурацию** стеков через `root`
- На каждый URL Router **детерминированно** строит модель стеков
- Модель стеков **иммутабельна** и пересоздаётся при изменении URL
- Router **не мутирует** NavigationStack конфигурацию

#### Методы навигации

```typescript
// Навигация на новый экран (push URL)
router.navigate(path: string): void

// Замена текущего экрана (replace URL)
router.replace(path: string): void

// Возврат назад
router.goBack(): void

// Возврат к конкретному экрану в истории
router.popTo(path: string): void
```

**Инварианты навигации:**

**`navigate(path)`:**
- Добавляет новый элемент в browser history (веб) или internal history (mobile)
- URL изменяется на `path`
- Router пересоздаёт модель стеков на основе нового URL
- История текущего стека увеличивается

**`replace(path)`:**
- Заменяет текущий элемент в history
- URL изменяется на `path`
- История не растёт
- Router пересоздаёт модель стеков

**`goBack()`:**
- Проверяет глубину стека перед выполнением операции
- Если нет предыдущего маршрута в пределах приложения — игнорирует операцию (no-op)
- Удаляет верхний элемент из history
- URL изменяется на предыдущий
- Router пересоздаёт модель стеков через `Router.parseURL()`
- **Защита от выхода**: Предотвращает уход за пределы приложения через browser history

**`popTo(path)`:**
- Находит `path` в текущей истории стека
- Удаляет все элементы после найденного
- URL изменяется на `path`
- Если `path` не найден — no-op

#### Получение состояния

```typescript
// Получить текущий URL
router.getCurrentUrl(): string

// Получить модель стеков для текущего URL
router.getStackModel(): StackModel

// Подписка на изменения URL
router.subscribe(listener: (url: string) => void): () => void
```

**StackModel (Public API):**

```typescript
export type StackModel = {
  stackId: string;                       // Совпадает со StackConfig и runtime-состоянием Router
  basePath: string;                      // Префикс путей этого стека
  history: HistoryItem[];                // История экранов (LIFO)
  children: Map<string, StackModel>;     // Дерево дочерних стеков
};

export type HistoryItem = {
  key: string;                           // Стабильный ключ для React
  routeId: string;                       // Ссылка на RouteConfigNode
  path: string;                          // Полный путь "/catalog/products/123"
  params: Record<string, string>;        // Path-параметры
  query: Record<string, unknown>;        // Query-параметры
  component: React.ComponentType<any>;   // Компонент экрана
  options?: ScreenOptions;               // Итоговые ScreenOptions
  controller?: ControllerFn;             // Контроллер, если есть
};

// router.getStackModel() возвращает корневой StackModel, у которого всё дерево доступно через children.
```

---

### NavigationStack

**NavigationStack** — это **builder** для декларативного описания структуры навигации. Это статическая конфигурация, которую Router использует для построения runtime модели.

#### Создание стека

```typescript
// Различные конструкторы
new NavigationStack()
new NavigationStack(id: string)
new NavigationStack(defaultOptions: ScreenOptions)
new NavigationStack(id: string, defaultOptions: ScreenOptions)
```

**Инварианты:**
- Каждый стек имеет уникальный `stackId` (авто-генерируется или задаётся вручную)
- `defaultOptions` применяются ко всем экранам и вложенным стекам
- NavigationStack — builder: `addScreen/addModal/addStack` мутируют конфигурацию и возвращают `this`
- После передачи root в `new Router({ root })` конфигурация стеков фиксируется (Router её не мутирует). То есть “immutability” гарантируется на уровне Router, а не при самом построении builder’а.

#### Добавление экранов

```typescript
// Добавить обычный экран
stack.addScreen(
  pathPattern: string,
  component: MixedComponent,
  options?: ScreenOptions
): NavigationStack

// Добавить модальный экран
stack.addModal(
  path: string,
  component: MixedComponent,
  options?: ScreenOptions
): NavigationStack

// Добавить sheet экран
stack.addSheet(
  path: string,
  component: MixedComponent,
  options?: ScreenOptions
): NavigationStack
```

#### Добавление вложенных стеков

```typescript
// Добавить вложенный стек
stack.addStack(
  basePath: string,
  childStack: NavigationStack,
  options?: ScreenOptions
): NavigationStack
```

**Пример:**

```typescript
const nestedStack = new NavigationStack('catalog-stack')
  .addScreen('/', CatalogHomeScreen)
  .addScreen('/products/:id', ProductDetailScreen);

const rootStack = new NavigationStack('root-stack')
  .addScreen('/', HomeScreen)
  .addStack('/catalog', nestedStack);

const router = new Router({ root: rootStack });
```

**URL mapping:**
- `/` → HomeScreen
- `/catalog` → CatalogHomeScreen
- `/catalog/products/123` → ProductDetailScreen (params: {id: "123"})

**Инварианты вложенных стеков:**
- Вложенный стек **наследует** `basePath` от родителя
- Все пути вложенного стека **префиксятся** `basePath`
- Вложенный стек может иметь свои `defaultOptions`
- Глубина вложенности **неограничена**
- Каждый стек имеет **независимую** историю навигации

#### Path Pattern синтаксис

```typescript
// Статический путь
"/profile"

// Динамический параметр
"/user/:id"
"/products/:category/:productId"

// Query параметры
"/auth?kind=email"                    // Константа
"/auth?kind=:authKind"                // Параметр
"/settings?tab=:tab&section=:section" // Несколько параметров

// Относительные пути (для вложенных стеков)
"/"                    // Корень стека
"/products/:id"        // Относительный путь
```

**Инварианты path matching:**
- Более конкретные пути имеют приоритет над общими
- Статический сегмент приоритетнее динамического
- Query pattern увеличивает специфичность
- При матчинге Router проверяет **все стеки в дереве** (depth-first)

#### Методы

```typescript
// Получить ID стека
stack.getId(): string

// Получить конфигурацию маршрутов
stack.getRoutes(): Route[]

// Получить вложенные стеки
stack.getNestedStacks(): Map<string, { basePath: string, stack: NavigationStack }>

// Получить дефолтные опции
stack.getDefaultOptions(): ScreenOptions | undefined
```

---

### TabBar

**TabBar** — это **расширение `NavigationStack`**. Он использует те же базовые механизмы, но добавляет свою мета-информацию о вкладках и регистрирует кастомный рендерер.

#### Концепция

1. `class TabBar extends NavigationStack`
   - Стековые операции (`addScreen`, `addStack`, `.getRoutes()`) работают так же, как у обычного NavigationStack
   - TabBar добавляет только `tabsMeta` и `customRenderer` в `StackModel`

2. **Где угодно в дереве**
   - TabBar может быть корнем
   - Может быть вложен в другой NavigationStack (через `.addStack()`)
   - Может быть вложен внутрь другого TabBar (если это нужно)

3. **Router / Navigation / StackRenderer**
   - Router не имеет специальных веток под TabBar — он видит обычный стек
   - Navigation и StackRenderer **не проверяют** `model.isTabBar`
   - Любой стек с `model.customRenderer` рендерится через него

4. **Активный таб**
   - Router определяет активный таб по URL
   - `model.history` содержит только историю активного таба

**Примеры вложенности:**

```typescript
// TabBar в корне
const tabBar = new TabBar()
  .addTab({ title: 'Home', stack: homeStack })
  .addTab({ title: 'Profile', stack: profileStack });

const router = new Router({ root: tabBar });

// TabBar внутри NavigationStack
const catalogStack = new NavigationStack()
  .addScreen('/', CatalogHome)
  .addStack('/categories', categoriesTabBar); // ← TabBar внутри стека

const rootStack = new NavigationStack()
  .addScreen('/', HomeScreen)
  .addStack('/catalog', catalogStack);

// TabBar внутри TabBar (возможно, хоть и странно)
const nestedTabBar = new TabBar().addTab({ title: 'Tab1', stack: someStack });
const mainTabBar = new TabBar().addTab({ title: 'Main', stack: nestedTabBar });
```

Если нужен предустановленный активный таб или кастомный UI панели, передайте соответствующие опции в `new TabBar()` (см. раздел ниже).

#### Создание TabBar

```typescript
import { TabBar, NavigationStack } from '@sigmela/router';

const homeStack = new NavigationStack()
  .addScreen('/', HomeScreen)
  .addScreen('/feed', FeedScreen);

const profileStack = new NavigationStack()
  .addScreen('/', ProfileScreen)
  .addScreen('/settings', SettingsScreen);

const tabBar = new TabBar({
  initialIndex?: number,                        // default: 0
  component?: React.ComponentType<TabBarProps>, // кастомный UI табов
})
  .addTab({ key: 'home', stack: homeStack, title: 'Home' })
  .addTab({ key: 'profile', stack: profileStack, title: 'Profile' });

const router = new Router({ root: tabBar });
```

#### Добавление вкладок

```typescript
tabBar.addTab({
  key: string,                         // Уникальный ключ вкладки (обязательно)
  stack: NavigationStack,              // Стек для вкладки (обязательно)

  // TabItem properties (опционально)
  title?: string,
  icon?: ExtendedIcon,
  selectedIcon?: ExtendedIcon,
  testID?: string,
  accessibilityLabel?: string,
  // ... другие свойства
}): TabBar
```

**Инварианты TabBar:**
- Каждая вкладка **должна** иметь `stack`
- `key` должен быть **уникальным** в пределах TabBar
- Переключение вкладки **не очищает** историю других вкладок
- Каждый стек вкладки **изолирован** от других
- TabBar не влияет на URL-роутинг (все стеки работают с общим URL)
- TabBar **не создаёт искусственные path** — он берёт первый маршрут у стека (`stack.getFirstRoute().pathnamePattern`) и использует его как entry path вкладки
- При добавлении TabBar проверяет, что путь первого маршрута ещё не использован ни одной вкладкой. При конфликте выбрасывается ошибка — две вкладки не могут обслуживать один и тот же URL.

#### URL и TabBar

TabBar **не управляет URL напрямую**. Вместо этого:
- При навигации внутри таба URL меняется согласно маршрутам стека
- Router определяет активный таб на основе URL и истории вложенных стеков
- Если URL не соответствует ни одному табу, используется `initialIndex`

**Пример:**

```typescript
// Tab 1: homeStack - пути: /, /feed
// Tab 2: profileStack - пути: /, /settings

router.navigate('/feed')      // → активирует Tab 1, переходит в FeedScreen
router.navigate('/settings')  // → активирует Tab 2, переходит в SettingsScreen
```

#### Кастомный рендерер

TabBar сам указывает, как рендерить свой стек:

```typescript
class TabBar extends NavigationStack {
  constructor(options?: TabBarOptions) {
    super({ ...options, customRenderer: TabBarRenderer });
  }

  getRenderer(): React.ComponentType<StackRendererProps> {
    return TabBarRenderer;
  }
}
```

Если при создании передан `component`, TabBarRenderer использует его вместо дефолтного UI и передаёт ему `tabs` + `activeIndex` из `model.tabsMeta`:

```typescript
type TabBarProps = {
  tabs: Array<{
    key: string;
    title: string;
    path: string;
    icon?: ExtendedIcon;
    badge?: string | number | null;
  }>;
  activeIndex: number;
  onSelectTab?: (key: string) => void;
};

const tabBar = new TabBar({ component: CustomTabBar });

function CustomTabBar({ tabs, activeIndex, onSelectTab }: TabBarProps) {
  return (
    <NativeTabBar
      tabs={tabs}
      activeIndex={activeIndex}
      onPressTab={onSelectTab}
    />
  );
}
```

#### StackRenderer

`StackRenderer` не знает о TabBar. Он просто проверяет `model.customRenderer` и, если есть, вызывает его, передавая `model` и `rendererProps` (если стек их задал):

```tsx
function StackRenderer({ model }: { model: StackModel }) {
  const router = useRouter();
  const CustomRenderer = model.customRenderer;

  if (CustomRenderer) {
    return (
      <CustomRenderer
        model={model}
        rendererProps={model.rendererProps}
        activateTab={(key: string) => {
          const tab = model.tabsMeta?.tabs.find((t) => t.key === key);
          if (tab) {
            router.navigate(tab.path);
          }
        }}
      />
    );
  }

  return (
    <ScreenStack key={`stack-${model.stackId}`}>
      {model.history.map(item => (
        <ScreenStackItem key={item.key}>
          {item.isNestedStack ? (
            <StackRenderer model={item.nestedModel} />
          ) : (
            <item.component {...item.params} />
          )}
        </ScreenStackItem>
      ))}
    </ScreenStack>
  );
}
```

`ScreenStack` и `ScreenStackItem` — это компоненты из `react-native-screens`, поэтому StackRenderer повторяет паттерн рендера, ожидаемый этим нативным стеком.

> `rendererProps` — произвольный объект, который стек может прикрепить к `StackModel`. TabBar как раз использует его, чтобы передать ссылку на себя (`{ tabBar: this }`). Дополнительно StackRenderer всегда передаёт helper `activateTab(key)`, который внутри делает `router.navigate(entryPath)` — именно так TabBarRenderer осуществляет переключение вкладок.

#### TabBarRenderer

TabBarRenderer получает обычный `StackModel` + `tabsMeta`:

```tsx
function TabBarRenderer({ model }: { model: StackModel }) {
  const { tabs, activeIndex } = model.tabsMeta;

  return (
    <View style={{ flex: 1 }}>
      <TabBarNavigation>
        {tabs.map((tab, index) => (
          <TabButton key={tab.path} active={index === activeIndex}>
            {tab.title}
          </TabButton>
        ))}
      </TabBarNavigation>

      {/* История уже содержит только активный таб */}
      <ScreenStack>
        {model.history.map(item => (
          <ScreenStackItem key={item.key}>
            {item.isNestedStack ? (
              <StackRenderer model={item.nestedModel} />
            ) : (
              <item.component {...item.params} />
            )}
          </ScreenStackItem>
        ))}
      </ScreenStack>
    </View>
  );
}
```

#### StackModel и Router

Router строит модель TabBar как обычный стек:

```typescript
// URL: /profile
Router.parseURL('/profile');
// →
{
  stackId: 'tabbar-id',
  history: [
    { path: '/profile', component: ProfileScreen, ... }
  ],
  tabsMeta: {
    tabs: [
      { title: 'Home', path: '/home' },
      { title: 'Profile', path: '/profile' }
    ],
    activeIndex: 1
  },
  customRenderer: TabBarRenderer
}
```

`tabsMeta.tabs` содержит статическую конфигурацию (title, icon, path), а `model.history` описывает активный стек.

#### Управление табами и метаданными

TabBar не держит собственного стора поверх NavigationStack. Все метаданные (badges, иконки, подписи) передаются через `tabsMeta` в `StackModel` и доступны внутри `TabBarRenderer`. Router и Navigation не подписываются на TabBar напрямую — они просто работают с его `StackModel`.

```typescript
function TabBarRenderer({ model }: { model: StackModel }) {
  const tabsMeta = model.tabsMeta;

  return (
    <NativeTabBar
      tabs={tabsMeta.tabs}        // title/icon/badge/routePath
      activeIndex={tabsMeta.activeIndex}
    />
  );
}
```

Если нужно обновить метаданные табов (например, badge), это делается через собственный state UI-компонента `TabBarRenderer` или через внешние сторы (Redux/Zustand). TabBar как NavigationStack остаётся чисто декларативным описанием маршрутов, без дополнительных подписок.

##### API `setBadge`

TabBar предоставляет лёгкий imperative-API для бейджей. Внутри TabBar хранится локальный стор `badges: Record<string, number | null>` и список слушателей:

```typescript
tabBar.setBadge(tabKey: string, value: number | null): void
tabBar.getBadges(): Record<string, number | null>
tabBar.subscribeBadges(listener: () => void): () => void
```

`setBadge` просто обновляет стор и уведомляет подписчиков. Router об этом ничего не знает — это чисто UI-состояние.

```tsx
// TabBar при построении StackModel кладёт себя в rendererProps и передаёт helper activateTab
function TabBarRenderer({
  model,
  rendererProps,
  activateTab,
}: {
  model: StackModel;
  rendererProps?: { tabBar: TabBar };
  activateTab: (key: string) => void;
}) {
  const tabBar = rendererProps?.tabBar;
  const badgeSnapshot = useSyncExternalStore(
    tabBar.subscribeBadges,
    tabBar.getBadges,
    tabBar.getBadges
  );

  const tabs = model.tabsMeta.tabs.map((tab) => ({
    ...tab,
    badge: badgeSnapshot[tab.key] ?? tab.badge ?? null,
  }));

  return (
    <CustomTabBar
      tabs={tabs}
      activeIndex={model.tabsMeta.activeIndex}
      onSelectTab={activateTab}
    />
  );
}

// Где-то в приложении
tabBar.setBadge('messages', 12);
tabBar.setBadge('profile', null); // убрать badge

// Внутри TabBar:
class TabBar extends NavigationStack {
  getRenderer() {
    const Renderer = super.getRenderer();
    return (props: StackRendererProps) => (
      <Renderer
        {...props}
        rendererProps={{ tabBar: this }}
        activateTab={(key) => {
          const tab = props.model.tabsMeta.tabs.find((t) => t.key === key);
          if (tab) {
            router.navigate(tab.path);
          }
        }}
      />
    );
  }
}
```

Такой подход даёт удобный публичный метод, не ломая главный принцип: Router и StackRenderer остаются детерминированными, а динамические бейджи живут в UI-слое, подписанном через `useSyncExternalStore`.

#### Официальная спецификация TabBar

1. **Назначение**
   - Группирует несколько `NavigationStack` во вкладки, отображает активный стек по URL, рендерит UI вкладок (иконки, title, badge) и не вмешивается в URL-роутинг.
   - Router не знает про TabBar: воспринимает его как обычный стек с вложенными стеками и `customRenderer`.

2. **Статическая модель**
   - `class TabBar extends NavigationStack { constructor(options?: TabBarOptions); addTab(opts: AddTabOptions): TabBar; }`
   - `TabBarOptions`: `{ initialIndex?: number; component?: React.ComponentType<TabBarProps>; }`
   - `AddTabOptions`: `{ key: string; stack: NavigationStack; title?: string; icon?: ExtendedIcon; selectedIcon?: ExtendedIcon; badge?: string | number | null; testID?: string; accessibilityLabel?: string; }`

3. **Инварианты**
   - Каждая вкладка содержит NavigationStack, TabBar вызывает `this.addStack(...)`.
   - `key` вкладки уникален. TabBar может быть корнем, вложенным стеком или вложенным TabBar.
   - TabBar не объявляет отдельные path — entry path определяется первым маршрутом вложенного стека.

4. **Встраивание**
   - `tabBar.addTab({ key, stack })` → `this.addStack(basePathForTab, stack)`, где `basePathForTab = this.basePath + stack.getFirstRoute().pathnamePattern`.
   - Внутри TabBar хранит `TabInternalMeta` `{ key, stackId, entryPath, title?, icon?, selectedIcon?, badge? }`.
   - Router лишь переносит эти данные в `tabsMeta`, сам их не анализирует.

5. **StackModel**
   - TabBar обязан добавить:
     ```typescript
     interface TabsMeta {
       tabs: Array<{ key: string; title?: string; path: string; icon?: ExtendedIcon; selectedIcon?: ExtendedIcon; badge?: string | number | null; }>;
       activeIndex: number;
     }
     ```
   - `stackModel.customRenderer = TabBarRenderer; stackModel.tabsMeta = tabsMeta;`.

6. **Определение активной вкладки**
   - Router строит дерево стеков; активной считается вкладка, чей дочерний стек совпал при матчинге URL (`stackId == matchedChildStackId`).
   - Если ни одна не совпала — используется `initialIndex`, и Router навигирует на entryPath этой вкладки.

7. **TabBarRenderer ↔ Router**
   - `TabBarRendererProps`: `{ tabsMeta: TabsMeta; model: StackModel; activateTab: (key: string) => void; rendererProps?: { tabBar: TabBar } }`.
   - `activateTab(key)` реализуется как `router.navigate(tab.path)` — переключение вкладки всегда через URL.

8. **Навигация**
   - Любой URL, принадлежащий стеку конкретной вкладки, автоматически делает её активной.
   - Навигация внутри вкладки — обычные операции вложенного NavigationStack. TabBar сам не меняет URL.

9. **goBack и история вкладок**
   - `router.goBack()` работает как всегда (browser history / internal history). TabBar не вмешивается; истории вкладок восстанавливаются из URL.

10. **Ephemeral**
    - `syncWithUrl:false` внутри вкладки → обычный ephemeral поверх активной вкладки.
    - Global-ephemeral (принадлежащие TabBar-стеку) накладываются поверх всего TabBar. Специальной логики TabBar не требует.

11. **Динамические метаданные**
    - TabBar предоставляет UI API (`setBadge`, `getBadges`, `subscribeBadges`). Router не использует эти данные для навигации; при построении `tabsMeta` TabBar подставляет актуальные badge.

12. **Конфигурация**
    - Пути вкладок не должны конфликтовать по path/query.
    - Первый маршрут каждого стек-вкладки должен однозначно определять entryPath.
    - Все стеки вкладок добавляются как nested-стеки TabBar.
    - Router core не содержит `if (stack.type === 'tabbar')`.

13. **Внутренний инвариант**
    - TabBar не меняет алгоритмы Router’а (matching, построение стеков, контроллеры, URL).
    - Единственное, что добавляет TabBar: `customRenderer` и `tabsMeta`.

14. **Резюме**
    - TabBar = NavigationStack + nested стеки вкладок + `customRenderer`.
    - Router Core ничего не знает о TabBar; вкладки определяются URL и nested стеком; истории восстановимы из URL/ephemeral; TabBar отвечает только за UI вкладок.

---

### SplitView (beta)

SplitView — builder, который объединяет два NavigationStack'а (primary/secondary) и задаёт кастомный split layout. Router воспринимает его как обычный NavigationStack.

#### Конструктор

```typescript
interface SplitViewOptions {
  basePath: string;
  minWidth: number;
  primary: NavigationStack;
  secondary: NavigationStack;
  id?: string;
}

const splitView = new SplitView({
  basePath: '/mail',
  minWidth: 900,
  primary: masterStack,
  secondary: detailStack,
  id: 'mail-split'
});
```

- Builder создаёт NavigationStack (SplitViewStack) с указанными `id` и `basePath`.
- В SplitViewStack добавляются ровно два дочерних стека: `primary` и `secondary`.
- SplitViewStack регистрирует кастомный рендерер (SplitViewRenderer). Дополнительных `meta` или runtime-хранилищ не используется.

#### StackModel

RouterState → StackModel строится по тем же правилам, что и для TabBar/NavigationStack:

```typescript
{
  stackId: 'mail-split',
  basePath: '/mail',
  history: [...],
  children: [
    primaryStackModel,   // stack.children[0]
    secondaryStackModel  // stack.children[1]
  ],
  customRenderer: SplitViewRenderer
}
```

- SplitView не влияет на matching URL, goBack, navigate, syncWithUrl.
- Router core не делает специальных проверок — это такой же NavigationStack с вложенными деревьями.

#### Custom Renderer

```tsx
function SplitViewRenderer({ model, rendererProps }: { model: StackModel; rendererProps?: { minWidth?: number } }) {
  const [primary, secondary] = Array.from(model.children.values());
  const isWide = useWindowWidth() >= (rendererProps?.minWidth ?? 0);

  if (isWide) {
    return (
      <Row>
        <StackRenderer model={primary} />
        <StackRenderer model={secondary} />
      </Row>
    );
  }

  return (
    <Overlay>
      <StackRenderer model={primary} />
      <OverlayPane>
        <StackRenderer model={secondary} />
      </OverlayPane>
    </Overlay>
  );
}
```

- Renderer получает `StackModel` и произвольные `rendererProps` (например, `minWidth`).
- Его задача — расположить два `StackRenderer` (рядом при ширине ≥ minWidth или overlay при узкой ширине). Никакой логики Router/StackModel он не анализирует.

#### Навигационные инварианты

- **Deep linking**: Router строит полную историю (primary → secondary), как в обычном nested stack.
- **navigate / replace**: Работают как в любом NavigationStack.
- **goBack**: Удаляет последний HistoryItem SplitViewStack — если secondary был поверх, он закрывается автоматически.
- **syncWithUrl / ephemeral**: Поведение полностью идентично обычному стеку; SplitView не добавляет правил.

SplitView = NavigationStack + customRenderer. Router core ничего о нём не знает, а layout/брейкпоинты реализуются в пользовательском renderer'е.

---

### Обработка 404 (`notFoundScreen`)

```typescript
const router = new Router({
  root: rootStack,
  notFoundScreen: NotFoundScreen
});
```

- Если ни один маршрут не совпал с URL, Router строит минимальный StackModel с одним HistoryItem, где `component = notFoundScreen`, `path = запрошенный URL`, `params` может содержать `{ requestedUrl: url.href }`.
- `notFoundScreen` получает те же props, что и обычные экраны (`useParams`, `useRouter` и т.д.) и может реагировать так, как нужно (показать сообщение, сделать `router.replace('/')`).
- Если `notFoundScreen` не передан, Router может выбрасывать ошибку или fallback'иться на первый маршрут — реализация определяет поведение.

```tsx
const NotFoundScreen = () => {
  const params = useParams<{ requestedUrl: string }>();
  const router = useRouter();

  return (
    <View>
      <Text>Page not found: {params.requestedUrl}</Text>
      <Button title="Go Home" onPress={() => router.replace('/')} />
    </View>
  );
};
```

---

### createController

Контроллеры позволяют выполнять логику перед отображением экрана.

#### Определение

```typescript
type Controller<TParams, TQuery> = (
  input: { params: TParams; query: TQuery },
  present: (passProps?: any) => void
) => void | Promise<void>

// В исходниках:
type ControllerPresenter<P = any> = (passProps?: P) => void;
type ControllerInput<TParams, TQuery> = { params: TParams; query: TQuery };

export type Controller<TParams, TQuery> = (
  input: ControllerInput<TParams, TQuery>,
  present: ControllerPresenter
) => void;

export type ComponentWithController = {
  controller?: Controller<any, any>;
  component: React.ComponentType<any>;
};

export type MixedComponent = ComponentWithController | React.ComponentType<any>;

export function createController<TParams, TQuery>(
  controller: Controller<TParams, TQuery>
) {
  return controller;
}
```

**Протокол работы:**

1. Router находит маршрут и **останавливает** любые изменения истории.
2. Если у маршрута есть controller, выполняется вызов `controller(input, present)`.
3. Пока controller не вызовет `present()`, Router:
   - Не меняет StackModel/HistoryItem.
   - Не рендерит новый экран.
   - Сохраняет предыдущий URL/ephemeral state.
4. Только после `present()` Router продолжает навигацию:
   - Фиксирует новый HistoryItem.
   - Прокидывает `passProps` в компонент.
   - Запускает reconciliation и рендер.
5. Если controller завершился без `present()` — навигация отменяется (никаких изменений состояния не происходит).

#### Использование

```typescript
import { createController } from '@sigmela/router';

const authController = createController<
  { userId: string },
  { redirect?: string }
>((input, present) => {
  const { params, query } = input;

  // Логика перед отображением
  if (!isAuthorized(params.userId)) {
    // Просто отменяем навигацию — Router остаётся на предыдущем состоянии
    return;
  }

  // Отобразить экран с passProps
  present({
    userData: fetchUserData(params.userId),
    redirectUrl: query.redirect
  });
});

// Подключение к стеку
const AuthScreenWithController = {
  controller: authController,
  component: AuthScreen
};

stack.addScreen('/auth/:userId', AuthScreenWithController);
```

**Инварианты:**
- `present()` — единственная точка, где Router применяет навигацию. До этого момента состояние не меняется.
- Если `present()` не вызван (или controller выбросил ошибку), переход отменяется тихо.
- Router **не ждёт** контроллер: он вызвал функцию и сразу остановился. Хотите продолжить навигацию — вызовите `present()`. Нет controller — Router выполняет обычную логику (то, что обычно помещают в `present()`).
- Controller может быть **асинхронным**; Router не блокируется, потому что уже ничего не делает после вызова функции. Любые side-effects зависят от того, вызовет ли controller `present()`.
- `passProps` передаются компоненту через props, но только после успешного `present()`.
- Controllers — чисто вспомогательные функции: они не должны напрямую мутировать Router или стеки, а только решать — показывать ли экран и с какими данными.
- Контроллер не должен вызывать `router.navigate/replace/goBack` напрямую. Контроллер либо вызывает `present(passProps)` (чтобы применить навигацию), либо `return` (чтобы отменить её).
- “Зависший” controller не ломает приложение: пока `present()` не вызван, Router продолжает отображать прошлое состояние (URL не меняется), поэтому можно безопасно ожидать долгой асинхронной операции или ручной отмены.
- `createController` — просто helper для типизации; можно передавать controller напрямую, но helper даёт inference типов `params/query`.

#### Ошибки и таймауты контроллеров

Router не навязывает стратегию обработки ошибок — контроллер сам решает, что делать. Рекомендуем следующее:

1. **try/catch вокруг асинхронного кода.**
   - Пример: `try { const data = await fetch(); present({ data }); } catch (err) { router.navigate('/error'); }`
   - Если ошибка не обработана и `present()` не вызван, Router просто останется на предыдущем экране.
2. **Таймауты.**
   - Используйте `Promise.race([... , timeoutPromise])`, чтобы не зависать бесконечно, или явно отменяйте запрос.
   - После таймаута можно либо вызвать `present()` с fallback-данными, либо отменить навигацию (просто не вызывать `present()`).
3. **Fallback UI.**
   - Если хочется показать состояние загрузки прямо в текущем экране, можно вызвать `present({ loading: true })`, а после получения данных — `router.replace('/same-path')` или другой переход.
4. **Отмена по пользовательскому действию.**
   - Контроллер может хранить ссылку на `AbortController`/`subscription`. При отмене он просто не вызывает `present()`, оставляя приложение на прежнем состоянии.

```typescript
const productController = createController(async (input, present) => {
  const abort = new AbortController();
  try {
    const data = await fetchProduct(input.params.id, { signal: abort.signal });
    present({ data });
  } catch (err) {
    if (abort.signal.aborted) {
      // Пользователь отменил, ничего не делаем: Router так и останется на предыдущем экране
      return;
    }
    router.navigate('/error');
  }
});

// Где-то в UI
function CancelButton() {
  return <Button title="Cancel" onPress={() => abortController.abort()} />;
}
```

Таким образом, “зависший” controller — это допустимое состояние. Router просто ждёт `present()` и не меняет историю; если `present()` не вызван, состояние приложения не меняется. Всё управление (включая показ/скрытие экранов) происходит только внутри `present()`, поэтому контроллеры не могут “сломать” Router, даже если зависнут навсегда.

---

## React API

### Navigation Component

Главный компонент для рендера навигации.

```typescript
import { Navigation } from '@sigmela/router';

<Navigation
  router={router}
  appearance={appearance}
/>
```

**Как работает рендер:**

1. `<Navigation>` подписывается на изменения Router
2. При изменении URL получает новую `StackModel`
3. Рекурсивно рендерит стеки с помощью `StackRenderer`

**Структура рендера:**

```tsx
<Navigation router={router} appearance={appearance} />
```

Внутри `Navigation` уже реализован полный рекурсивный обход дерева стеков:

```tsx
function Navigation({ router, appearance }: NavigationProps) {
  const model = useSyncExternalStore(
    router.subscribe,
    router.getStackModel
  );

  return <StackRenderer model={model} appearance={appearance} />;
}
```

`StackRenderer` рекурсивно обходит `model.history`, создаёт `<ScreenStackItem>` и, если нужно, вызывает сам себя для вложенных стеков. Пользовательскому коду не нужно вручную пробегать по стеку или вызывать `StackRenderer` для дочерних элементов — всё это делает `Navigation`.

> `ScreenStack` и `ScreenStackItem`, которые использует `StackRenderer`, предоставляются библиотекой `react-native-screens`, поэтому весь рендер повторяет их ожидаемую структуру.

**TabBar рендеринг:**

Navigation и StackRenderer **не имеют специальных веток для TabBar**. Любой стек, который добавил `customRenderer`, будет отрисован через него (см. код StackRenderer в разделе TabBar выше). `TabBarRenderer` получает обычную `StackModel` и сам решает, как рисовать UI вкладок и рендерить контент через вложенный `StackRenderer`.

**Инварианты Navigation:**
- Единственный корневой компонент навигации
- Автоматически подписывается на Router
- Рекурсивно рендерит любую глубину вложенности стеков
- Оптимизирован с помощью `React.memo` и `useSyncExternalStore`

**NavigationAppearance:**

```typescript
interface NavigationAppearance {
  tabBar?: {
    backgroundColor?: ColorValue;
    iconColor?: ColorValue;
    iconColorActive?: ColorValue;
    // ... TabBar стили
  };
  screen?: StyleProp<ViewStyle>;
  header?: ScreenStackHeaderConfigProps;
  sheet?: {
    backgroundColor?: ColorValue;
    cornerRadius?: number;
  };
}
```

---

### React Hooks

#### useRouter

Доступ к экземпляру Router.

```typescript
const router = useRouter();
```

#### useParams

Получить параметры пути текущего экрана.

```typescript
const params = useParams<{ userId: string }>();
// params.userId - типобезопасно
```

#### useQueryParams

Получить query параметры текущего экрана.

```typescript
const query = useQueryParams<{ tab?: string }>();
// query.tab - типобезопасно
```

#### useCurrentUrl

Получить текущий URL с автоматическим обновлением.

```typescript
const currentUrl = useCurrentUrl();
// Автоматически обновляется при навигации
```

#### useRoute

Получить полную информацию о текущем роуте.

```typescript
const route = useRoute();
// {
//   path: "/user/123",
//   params: { id: "123" },
//   query: {},
//   presentation: "push"
// }
```

---

## ScreenOptions

Конфигурация для экранов и стеков.

```typescript
type ScreenOptions = {
  // Тип презентации
  stackPresentation?: StackPresentationTypes;

  // Конвертация модалов в sheet для Android
  convertModalToSheetForAndroid?: boolean;

  // Синхронизация с URL (только веб)
  syncWithUrl?: boolean;  // default: true

  // Настройки header
  header?: ScreenStackHeaderConfigProps;

  // Анимация
  stackAnimation?: 'default' | 'fade' | 'flip' | 'simple_push' | 'slide_from_bottom' | 'slide_from_right' | 'slide_from_left' | 'fade_from_bottom' | 'none';

  // ... другие свойства из react-native-screens
}
```

**Порядок применения:**
1. NavigationStack `defaultOptions`
2. Route-specific `options`
3. Router `screenOptions` (highest priority)

---

## Внутренняя структура данных

### Формальные контракты Router 2.0

#### 1. Статическая модель конфигурации

Router работает только с внутренним URL вида `"/path/segments?query=values"`. Любые внешние URL (`https://`, `myapp://`) платформа должна преобразовать в такую строку **до** передачи в Router.

##### 1.1. Идентификаторы

```typescript
type RouteId = string;
type StackId = string;
type ControllerId = string;
type RouteKind = 'screen' | 'modal' | 'sheet';
```

##### 1.2. Path / Query паттерны

```typescript
type NormalizedPathSegment =
  | { type: 'literal'; value: string }
  | { type: 'param'; name: string }
  | { type: 'wildcard' };

interface NormalizedPathPattern {
  segments: NormalizedPathSegment[];
}

type QueryPattern = {
  [key: string]:
    | { type: 'const'; value: string }
    | { type: 'param' }
    | { type: 'wildcard' }; // ключ опционален и не влияет на специфичность
};
```

##### 1.3. RouteConfigNode

```typescript
interface RouteConfigNode {
  id: RouteId;
  stackId: StackId;
  kind: RouteKind;
  path: NormalizedPathPattern;
  query?: QueryPattern;
  syncWithUrl?: boolean;
  controller?: ControllerId;
  nestedStackId?: StackId | null;
}
```

##### 1.4. StackConfig

```typescript
interface StackConfigBase {
  id: StackId;
  type: 'navigation' | 'tabbar';
  basePath: string;
  routes: RouteId[];
}

interface NavigationStackConfig extends StackConfigBase {
  type: 'navigation';
}

interface TabBarConfig extends StackConfigBase {
  type: 'tabbar';
  tabs: Array<{ tabId: string; rootRouteId: RouteId }>;
}
```

##### 1.5. RouterConfig

```typescript
interface RouterConfig {
  rootStackId: StackId;
  stacks: Map<StackId, StackConfig>;
  routes: Map<RouteId, RouteConfigNode>;
  controllers: Map<ControllerId, ControllerFn>;
}
```

##### 1.6. Валидация конфигурации

1. `(pathPattern, queryPattern)` уникальны глобально.
2. `nestedStackId` должны существовать и иметь совместимый `basePath`.
3. В TabBar `rootRouteId` уникальны, их path/query уникальны глобально; конфликт → ошибка.

#### 2. Runtime модель

```typescript
interface UrlState {
  href: string;
  path: string;
  segments: string[];
  query: URLSearchParams;
}

interface EphemeralEntry {
  anchorUrl: string;
  stackId: StackId;
  entry: HistoryItem;
  createdAt: number;
}

interface EphemeralState {
  entries: EphemeralEntry[];
}

interface RouterState {
  url: UrlState;
  rootStack: StackModel;
  ephemeral: EphemeralState;
  notFoundScreen?: React.ComponentType<any>;
}

---

## Core API Router (внешний контракт)

### Создание Router

```typescript
const router = new Router({
  root: NavigationStack,
  screenOptions?: ScreenOptions,
  debug?: boolean
});
```

Гарантии:
- Конфигурация стеков фиксируется при создании Router.
- Browser/internal history и RouterUrl синхронизированы: URL ↔ состояние стеков.

### Методы навигации

```typescript
router.navigate(path: string): void;
router.replace(path: string): void;
router.goBack(): void;
router.popTo(path: string): void;
router.setRoot(root: NavigationStack): void;
```

#### navigate(path)
- По умолчанию (`syncWithUrl=true`) меняет URL (`pushState` / internal history) и добавляет элемент в history.
- Если маршрут явно отмечен `syncWithUrl=false`, URL не меняется, запись добавляется только в ephemeral.
- Перед любым navigate Router очищает все ephemeral-записи, привязанные к текущему URL (эпемерное состояние временное и не переносится при переходе).
- После изменения Router пересобирает стек и уведомляет подписчиков.

#### replace(path)
- По умолчанию (`syncWithUrl=true`) заменяет текущий URL (`replaceState` / internal history).
- Если маршрут помечен `syncWithUrl=false`, вместо этого заменяет последний ephemeral-элемент (URL остаётся прежним).
- Перед replace Router также очищает все ephemeral-записи для текущего URL (аналогично navigate).
- Пересобирает стек и уведомляет подписчиков.

#### goBack()
- Если есть ephemeral для текущего URL — удаляет последний, URL не меняет, пересобирает стек.
- Иначе пытается откатить history:
  - web: `history.back()` (если можно).
  - mobile: декремент internal history + `_applyUrl`.
- Если откат невозможен — no-op. После смены URL всегда пересобирает стек.

#### popTo(path)
- Находит `path` в history:
  - если найден — удаляет записи после него, меняет URL, пересобирает стек;
  - если нет — no-op.
- Ephemeral для текущего URL обрезается до соответствующих записей (если реализовано).

### Методы состояния

```typescript
router.getCurrentUrl(): string;
router.getStackModel(): StackModel;
router.subscribe((url: string) => void): () => void;
```

- `getCurrentUrl()` — возвращает текущий RouterUrl.
- `getStackModel()` — текущая модель стеков с учётом ephemeral.
- `subscribe()` — listener вызывается после каждого успешного события (navigate/replace/goBack/popTo/popstate/deeplink). Возвращаемая функция — отписка.

---

## Адаптеры (web / mobile)

### Web-адаптер

1. На старте читает `location.pathname + location.search`, вызывает `router._applyUrl(url, 'initial')`.
2. `router.navigate(path)`:
   ```typescript
   window.history.pushState(null, '', path);
   router._applyUrl(path, 'navigate');
   ```
3. `router.replace(path)` — `history.replaceState` + `_applyUrl(path, 'replace')`.
4. `window.onpopstate` → адаптер читает новый RouterUrl и вызывает `_applyUrl(url, 'popstate')`.

### Mobile-адаптер

Держит `urlHistory: string[]` и `historyIndex`.

```typescript
router.navigate(path):
  urlHistory = urlHistory.slice(0, historyIndex + 1);
  urlHistory.push(path);
  historyIndex++;
  router._applyUrl(path, 'navigate');

router.replace(path):
  if (historyIndex >= 0) urlHistory[historyIndex] = path;
  else { urlHistory = [path]; historyIndex = 0; }
  router._applyUrl(path, 'replace');

router.goBack():
  if (historyIndex <= 0) return;
  historyIndex--;
  router._applyUrl(urlHistory[historyIndex], 'back');
```

Deep-link: адаптер преобразует `myapp://path?query` → `"/path?query"`, вставляет в history и вызывает `_applyUrl(url, 'deeplink')`.

---

## setRoot(root: NavigationStack)

### Назначение

Полностью заменить корневую конфигурацию (NavigationStack), сбросить runtime-состояние и, при необходимости, сделать redirect на entry path нового дерева. Используется для сценариев вроде `/auth → TabBar`.

### Семантика

1. **Замена RouterConfig**
   - Новый root builder (NavigationStack/TabBar) компилируется в свежие StackConfig/RouteConfig.
   - Старый RouterConfig заменяется целиком.
   - После вызова setRoot навигационные методы работают уже с новой конфигурацией.

2. **Сброс состояния**
   - Очищается `ephemeral`.
   - Текущие StackModel считаются невалидными.
   - Внутренние структуры для reconciliation (history, ключи) сбрасываются.
   - На mobile можно обрезать internal history до одной записи (аналог `replace`), чтобы back не возвращал в прежнее приложение.

3. **URL и redirect**
   - Router пытается интерпретировать текущий RouterUrl через новую конфигурацию.
   - Если URL валиден (финальный маршрут найден) — используется он: RouterState.rootStack строится по нему без изменения URL.
   - Если URL не покрывается новым деревом:
     - Для TabBar: применяется `initialIndex` → `entryPath` вкладки → `router.replace(entryPath)`.
     - Для NavigationStack: используется первый маршрут root-стека (`stack.getFirstRoute().pathnamePattern`, обычно '/') → `router.replace(entryPath)`.
   - Redirect всегда через `replace`, чтобы нельзя было вернуться back к предыдущему приложению.

4. **Инварианты**
   - Web: `State = f(URL, EphemeralState)` остаётся в силе — setRoot либо подтверждает текущий URL, либо делает replace(entryPath).
   - Mobile: `syncWithUrl=false` игнорируется, поэтому setRoot влияет только на внутренний URL-history.
   - Любые контроллеры/операции, запущенные до setRoot, не продолжают работу после смены root (Router полностью сбрасывает runtime).

### Пошаговый протокол

```typescript
function setRoot(root: NavigationStack) {
  this.config = compileConfig(root);
  this.ephemeral = [];

  const currentUrl = this.getCurrentUrl();
  const canMatch = tryMatchUrl(currentUrl, this.config);

  if (canMatch) {
    this.applyUrl(currentUrl); // пересборка стеков по новому дереву
  } else {
    const entryPath = getEntryPathForNewRoot(root);
    this.replace(entryPath); // replaceState / internal history replace
  }
}
```

`getEntryPathForNewRoot`:
- Для TabBar → вкладка `initialIndex` → `stack.getFirstRoute().pathnamePattern`.
- Для NavigationStack → `root.getFirstRoute().pathnamePattern`.

### Пример: `/auth` → TabBar

```typescript
const authStack = new NavigationStack()
  .addScreen('/auth', AuthScreen);

const homeStack = new NavigationStack().addScreen('/', HomeScreen);
const profileStack = new NavigationStack().addScreen('/', ProfileScreen);

const appTabBar = new TabBar({ initialIndex: 0 })
  .addTab({ key: 'home', stack: homeStack, title: 'Home' })
  .addTab({ key: 'profile', stack: profileStack, title: 'Profile' });

const router = new Router({ root: authStack });

function onLoginSuccess() {
  router.setRoot(appTabBar);
}
```

Ход событий:
1. Router заменяет конфигурацию на TabBar, очищает ephemeral.
2. URL `/auth` не совпадает ни с одной вкладкой → используется `initialIndex = 0`.
3. Entry path homeStack → `'/'`; Router выполняет `replace('/')`.
4. Новая `StackModel` строится для homeStack, активен таб `home`.
5. `subscribe`-listeners получают обновление URL `'/'`.

---

## Псевдокод core-методов Router

```typescript
class Router {
  private rootStack: NavigationStack;
  private currentUrl = '/';
  private currentStackModel: StackModel | null = null;
  private ephemeral: HistoryItem[] = [];
  private listeners = new Set<(url: string) => void>();

  // Mobile-only
  private urlHistory: string[] = [];
  private historyIndex = -1;

  private applyUrl(newUrl: string) {
    this.currentUrl = newUrl;
    const baseModel = buildStackModelFromUrl(this.rootStack, newUrl);
    const withEphemeral = overlayEphemeral(baseModel, this.ephemeral, newUrl);
    const reconciled = reconcileModels(this.currentStackModel, withEphemeral);
    this.currentStackModel = reconciled;
    for (const listener of this.listeners) listener(this.currentUrl);
  }

  navigate(path: string) { /* логика как в секции 4.3 */ }
  replace(path: string) { /* секция 4.4 */ }
  goBack() { /* секция 4.5 */ }

  getCurrentUrl() { return this.currentUrl; }

  getStackModel() {
    if (!this.currentStackModel) this.applyUrl(this.currentUrl);
    return this.currentStackModel!;
  }

  subscribe(listener: (url: string) => void) {
    this.listeners.add(listener);
    listener(this.currentUrl);
    return () => this.listeners.delete(listener);
  }
}
```

> Подробные ветки navigate/replace/goBack (включая `syncWithUrl=false` и очистку ephemeral) вынесены в секцию “Псевдокод core-методов Router”.
```

#### 3. Парсинг RouterUrl → StackModel

- `matchPath(pattern, segments, startIndex)` — literal +3, param +2, wildcard +1.
- `matchQuery(pattern, urlQuery)` — const +2, param +1, wildcard 0.
- `score = pathScore * 100 + queryScore`; tie → маршрут объявленный раньше.
- Query keys, не указанные в pattern, игнорируются (они не добавляют очков и не мешают совпадению).
- `token.type === 'wildcard'` обозначает «опциональный ключ» — он не влияет на score и используется только, чтобы явно разрешить произвольное значение/отсутствие ключа.
- `findBestRoute(stackId, startIndex)` возвращает лучший маршрут в стеке.
- `buildStackForStackId(stackId, startIndex)` рекурсивно строит дерево.

#### 4. Контроллеры

```typescript
interface ControllerInput {
  url: UrlState;
  route: RouteConfigNode;
  params: Record<string, string>;
}

type PresentFn = (passProps?: Record<string, unknown>) => void;
type ControllerFn = (input: ControllerInput, present: PresentFn) => void;
```

- Router парсит URL, строит дерево, находит активный маршрут.
- Если контроллера нет → Router сразу применяет базовое состояние (как обычно).
- Если есть → Router вызывает controller и больше ничего не делает, пока controller сам не вызовет `present(passProps?)`.
- `present(passProps)` выполняет тот же шаг, что и стандартная навигация без контроллера: Router применяет построенную модель и пробрасывает `passProps` в компонент. Для редиректов/отката controller должен явно вызвать `router.navigate/replace/goBack` — `present()` не принимает action.
- `syncWithUrl:false` маршруты не инициируют контроллеры (они живут в ephemeral слое).

#### 5. Ephemeral state и `goBack`

- `syncWithUrl=true` → состояние кодируется в URL.
- `syncWithUrl=false` → состояние существует только в `EphemeralState` (только web).
- Ephemeral навигация: URL не меняется, в `ephemeral.entries` добавляется элемент с `anchorUrl` = текущий URL, затем коммитится база + overlay.
- `applyEphemeralOverlay` накладывает все записи с текущим `anchorUrl` на соответствующие стеки.
- `goBack` сначала смотрит ephemeral (LIFO). Если на текущем URL есть записи — удаляет их и коммитит заново. Если нет — делегирует платформе (`history.back()` / internal history).
- Reload/прямой URL → `ephemeral.entries = []`, модалки с `syncWithUrl=false` не восстанавливаются.
- При `navigate/replace/goBack` Router очищает `ephemeral` для текущего URL (эпемерное состояние не переносится между базовыми URL).

---

### StackModel - представление состояния стеков

Router использует **внутреннюю структуру данных** для эффективного построения истории стеков из URL.

#### Структура StackModel

```typescript
type StackModel = {
  stackId: string;
  basePath: string;
  history: HistoryItem[];
  children: Map<string, StackModel>;
};

type HistoryItem = {
  key: string;
  routeId: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, unknown>;
  component: React.ComponentType<any>;
  options?: ScreenOptions;
  controller?: ControllerFn;
};
```

**Единая модель**

- Router оперирует **единственной** структурой `StackModel`. Это и есть реальное состояние дерева стеков.
- Каждый стек имеет собственный `history: HistoryItem[]`, а вложенные стеки доступны через `children`. Вся навигация описывается одной рекурсивной структурой.
- Navigation/StackRenderer обходят дерево через `children`, а Router выполняет reconciliation над теми же объектами — без параллельных структур.

#### Связь RouterState → StackModel

```typescript
interface RouterState {
  url: UrlState;
  rootStack: StackModel;
  ephemeral: EphemeralState;
}

function buildStackModel(
  state: RouterState,
  config: RouterConfig
): StackModel {
  return buildStackModelForRuntime(state.rootStack, config);
}

function buildStackModelForRuntime(
  runtime: StackModel,
  config: RouterConfig
): StackModel {
  const history: HistoryItem[] = runtime.history.map((entry, index) => {
    const route = config.routes.get(entry.routeId)!;

    return {
      ...entry,
      key: getOrCreateKey(runtime.stackId, index, entry),
      path: entry.path ?? materializePath(runtime.basePath, entry, config),
      params: entry.params ?? extractParams(entry, config),
      query: entry.query ?? {},
      component: route.component,
      options: resolveScreenOptions(route),
      controller: route.controller,
    };
  });

  const children = new Map<string, StackModel>();
  for (const [childId, childRuntime] of runtime.children) {
    children.set(childId, buildStackModelForRuntime(childRuntime, config));
  }

  return {
    stackId: runtime.stackId,
    basePath: runtime.basePath,
    history,
    children,
  };
}
```

#### Требования к структуре данных

**Простая и эффективная структура для реальных сценариев (5-10 экранов):**

1. **Поиск маршрутов**
   - Линейный перебор массива маршрутов (достаточно быстро для <50 маршрутов)
   - Маршруты отсортированы по специфичности при инициализации
   - Compiled маршруты (path-to-regexp) создаются один раз при `addScreen()`

2. **Построение истории**
   - Простой массив `HistoryItem[]` для каждого стека
   - Для вложенных стеков: рекурсивный обход с префиксацией путей

3. **Reconciliation**
   - Простое сравнение `oldHistory[i].path === newHistory[i].path`
   - Переиспользование key если path совпадает
   - Новый key только для измененных элементов

4. **Query pattern matching**
   - При регистрации маршрута: парсим query pattern один раз
   - При матчинге: простое сравнение каждого query ключа
   - Scoring = количество matched ключей

**Прагматичная архитектура:**

```typescript
class Router {
  // Корневой стек
  private rootStack: NavigationStack;

  // Текущая история (для reconciliation)
  private currentHistory: HistoryItem[] = [];

  // История URL (для mobile)
  private urlHistory: string[] = [];

  constructor(rootStack: NavigationStack) {
    this.rootStack = rootStack;
  }

  // Основной метод: URL → HistoryItem[]
  parseURL(url: string): HistoryItem[] {
    const { pathname, query } = parseURL(url);
    const segments = pathname.split('/').filter(Boolean);

    const newHistory: HistoryItem[] = [];
    let currentStack = this.rootStack;

    // Простой линейный проход по сегментам
    for (let i = 0; i < segments.length; i++) {
      const path = '/' + segments.slice(0, i + 1).join('/');
      const route = this.findRoute(currentStack, path, query);

      if (route) {
        newHistory.push({
          key: this.getOrCreateKey(i, path), // Переиспользуем ключи
          routeId: route.id,
          path,
          component: route.component,
          params: route.params,
          query,
          options: route.options,
          controller: route.controller,
        });

        if (route.childStack) {
          currentStack = route.childStack;
        }
      }
    }

    this.currentHistory = newHistory;
    return newHistory;
  }

  // Простой поиск: линейный перебор отсортированного массива
  private findRoute(stack: NavigationStack, path: string, query: any) {
    const routes = stack.getRoutes(); // уже отсортированы по специфичности

    for (const route of routes) {
      if (route.matchPath(path) && this.matchQuery(route, query)) {
        return route;
      }
    }

    return null;
  }

  // Reconciliation: переиспользуем ключи по индексу и path
  private getOrCreateKey(index: number, path: string): string {
    const oldItem = this.currentHistory[index];
    if (oldItem && oldItem.path === path) {
      return oldItem.key; // Переиспользуем
    }
    return nanoid(); // Новый ключ
  }
}
```

---

## Инварианты системы

### URL-Driven Navigation

1. **URL → State (детерминированность)**
   - Web: `State = f(URL, EphemeralState)` — Ephemeral живёт пока не сменился базовый URL и пока не было reload (после reload остаётся только URL).
   - Mobile: `State = f(internal URL history)` — `syncWithUrl=false` игнорируется, поэтому состояние полностью определяется внутренним URL.
   - Для syncWithUrl=true маршрутов справедливо: один URL всегда приводит к одному состоянию стеков.

2. **State → URL (синхронизация)**
   - Каждая операция навигации изменяет URL
   - URL изменяется **до** пересоздания модели стеков

3. **Reconciliation (производительность)**
   - Алгоритм работает за **O(n)** где n — длина новой истории
   - Выполняется **синхронно** за ~1-2ms даже для глубоких стеков
   - Переиспользует существующие keys для стабильности компонентов
   - Минимизирует создание новых объектов

4. **History management**
   - Web: Browser history API
   - Mobile: Внутренний массив URL
   - `goBack()` всегда работает с history, а не с внутренним состоянием

### Древовидные стеки

1. **Независимость стеков**
   - Каждый стек управляет своей историей независимо
   - История вложенного стека изолирована от родителя

2. **BasePath наследование**
   - Вложенный стек получает `basePath` от родителя
   - Все пути вложенного стека префиксятся `basePath`
   - `basePath` **не изменяется** в runtime

3. **Рекурсивный рендер**
   - `<Navigation>` рендерит стеки рекурсивно
   - Глубина вложенности не ограничена
   - Каждый стек рендерится в своём `<StackRenderer>`

4. **Deep Linking и построение стека**
   - При переходе на глубокий URL Router строит **полный стек** промежуточных экранов
   - Пример: `/catalog/products/123` → `[/catalog, /catalog/products, /catalog/products/123]`
   - Каждый сегмент URL проверяется на совпадение с маршрутами
   - Промежуточные экраны добавляются в историю стека автоматически
   - `goBack()` работает через весь построенный стек
   - `goBack()` проверяет границы приложения и игнорирует операцию при выходе за пределы

### TabBar

1. **Расширение NavigationStack**
   - `TabBar` наследует NavigationStack и использует те же API
   - Дополнительно добавляет `tabsMeta` + `customRenderer`
   - Router и Navigation не делают специальных проверок

2. **Любая вложенность**
   - TabBar можно размещать в корне, внутри обычного стека или внутри другого TabBar
   - URL сегменты определяют какой дочерний стек активен
   - В истории `model.history` остаётся только активный таб

3. **Renderer по месту**
   - TabBar сам регистрирует `TabBarRenderer`
   - `StackRenderer` смотрит только на `model.customRenderer`
   - TabBarRenderer получает `StackModel + tabsMeta` и сам рендерит UI вкладок + активный стек

### Query параметры для роутинга

1. **Wildcard паттерны (`*?param=value`)**
   - `*` совпадает с **любым pathname** в стеке
   - `.addModal('*?param=value')` — рендерится **поверх** базового экрана
   - `.addScreen('*?param=value')` — **заменяет** базовый экран
   - Можно использовать в любом стеке (root, nested, tab)
   - Wildcard в вложенном стеке работает только для путей этого стека

2. **Query pattern matching**
   - Константный pattern: `?view=grid` (высокая специфичность)
   - Параметризованный pattern: `?view=:type` (низкая специфичность)
   - Множественные параметры: `?filter=:cat&sort=:order` (выше специфичность)
   - Router выбирает **наиболее конкретный** pattern

**Формальные правила приоритета:**

1. Сначала сравнивается **path** (больше сегментов = выше специфичность, статический сегмент приоритетнее динамического).
2. Затем применяется scoring по query:
   - +2 очка за каждый ключ со статичным значением (`?view=grid`).
   - +1 очко за каждый параметризованный ключ (`?view=:type`).
   - При равном счёте побеждает маршрут, объявленный позже (ближе к пользователю), чтобы можно было перекрывать дефолтные правила.
3. Wildcard `*` всегда имеет самую низкую специфичность, даже если query конкретный.

**Пример:**

```typescript
const productsStack = new NavigationStack()
  .addScreen('/products', ProductsList)                                 // score: path=/products, query=0
  .addScreen('/products?view=grid', ProductsGrid)                       // score: path=/products, +2 за view=grid
  .addScreen('/products?view=list', ProductsListView)                   // score: path=/products, +2
  .addScreen('/products?view=:type', ProductsCustomView)                // score: path=/products, +1
  .addModal('/products?view=grid&sort=price', GridPriceModal)           // score: path=/products, +4 (2+2)
  .addModal('/products?*?modal=share', ShareModal);                     // wildcard, минимальный приоритет
```

| Входной URL                         | Матчится маршрут                        | Причина / История стека                                                                 |
|-------------------------------------|-----------------------------------------|-----------------------------------------------------------------------------------------|
| `/products`                         | `/products` (ProductsList)              | Базовый path, score 0                                                                   |
| `/products?view=grid`               | `/products?view=grid` (ProductsGrid)    | path совпал, query score 2 > 1 (fallback), история: `[ProductsGrid]`                   |
| `/products?view=table`              | `/products?view=:type`                  | Статичных матчей нет, параметризованный pattern получает score 1                        |
| `/products?view=grid&sort=price`    | `/products?view=grid&sort=price` modal  | Находит наиболее конкретный modal; итоговый стек: `[ProductsGrid, GridPriceModal]`     |
| `/products?modal=share`             | `*?modal=share` (ShareModal)            | Path не влияет, wildcard с query выигрывает над отсутствием match                       |

**Пример выбора маршрута с "лишними" query:**

```typescript
const stack = new NavigationStack()
  .addScreen('/products', ProductsScreen)                              // score: path=/products, query=0
  .addModal('/products?filter=:category', FilterModal)                 // score: path=/products, +1
  .addModal('/products?filter=:category&sort=:order', FilterAndSort);  // score: path=/products, +2

// URL: /products?filter=electronics&sort=asc&lang=en
// → Побеждает FilterAndSort (query score 2 > 1). Параметр lang не участвует в scoring, но и не мешает совпадению.
```

**Структура истории (пример для `/products?view=grid&sort=price`):**

```
[
  { path: '/products', component: ProductsGrid },
  { path: '/products?view=grid&sort=price', component: GridPriceModal, presentation: 'modal' }
]
```

Такой подход даёт предсказуемое поведение: статические правила всегда приоритетнее параметризованных, а wildcard используется только как последний шанс.

#### Наследование query-параметров и wildcard

Query живёт в глобальном URL, поэтому каждый стек на пути получает один и тот же набор параметров. Если зарегистрированы маршруты `/catalog` и `/catalog/product/:productId`, то при входе `/catalog/product/1?filter=some_filter` в истории присутствуют оба:

```
[
  { path: '/catalog', component: CatalogHome, query: { filter: 'some_filter' } },
  { path: '/catalog/product/1', component: ProductDetail, params: { productId: '1' }, query: { filter: 'some_filter' } }
]
```

Изменение query (`router.navigate('/catalog/product/1?filter=popular')`) не пересоздаёт стеки: Router видит, что `path` совпадает, переиспользует HistoryItem с прежним `key`, просто обновляя `query`. Это гарантирует, что оба экрана получают актуальные параметры без лишних ререндеров.

**Что с wildcard-паттернами?**

```
const globalStack = new NavigationStack()
  .addModal('*?modal=promo', PromoModal)
  .addModal('*?modal=auth', AuthModal);

const catalogStack = new NavigationStack()
  .addScreen('/catalog', CatalogHome)
  .addScreen('/catalog/product/:id', ProductDetail);

const router = new Router({ root: catalogStack.addStack('/overlays', globalStack) });
```

- Базовые маршруты `/catalog` и `/catalog/product/:id` читают query из URL (например, `filter`, `sort`).
- Wildcard `*?modal=promo` живёт в отдельном стеке (здесь — `globalStack`). При `router.navigate('/catalog/product/1?modal=promo&filter=sale')` Router строит модель:
  ```
  [
    { path: '/catalog', ... , query: { modal: 'promo', filter: 'sale' } },
    { path: '/catalog/product/1', ..., query: { modal: 'promo', filter: 'sale' } },
    { path: '*?modal=promo', component: PromoModal, query: { modal: 'promo', filter: 'sale' } }
  ]
  ```
- Wildcard получает **те же** query, что и основная цепочка. Это важно: PromoModal может знать, что открыт продукт `1` с `filter=sale`, без дополнительной передачи параметров.
- При смене query Router снова сравнивает маршруты по path, переиспользует ключи и обновляет query во всех HistoryItem.

Таким образом, wildcard-паттерны (`*?modal=...`) вписываются в общую архитектуру: они просто ещё один стек, который получает тот же URL. Единственное отличие — они матчятся на любые path и накладываются поверх, но правила наследования query и переиспользования ключей такие же, как у обычных маршрутов.

3. **`.addScreen()` vs `.addModal()` с query**
   - `.addScreen('/path?query=value')` — **заменяет** базовый экран на `/path`
   - `.addModal('/path?query=value')` — **накладывается поверх** базового экрана
   - Базовый path: `/products` → ProductsScreen
   - Query screen: `/products?view=grid` → ProductsGridScreen (замена)
   - Query modal: `/products?modal=filter` → ProductsScreen + FilterModal (overlay)

4. **Query параметры и навигация**
   - Query параметры можно добавлять к любому URL
   - `router.navigate('/profile?tab=posts')` — валидно для обычных экранов
   - `router.navigate('/profile?modal=edit')` — валидно для модалов
   - `router.goBack()` удаляет весь URL (включая query)
   - Query не влияет на path matching (только после совпадения path)

### Web-платформа

1. **Browser history sync**
   - Router слушает `popstate` события
   - `navigate()` → `history.pushState()`
   - `replace()` → `history.replaceState()`

2. **Deep linking**
   - При первой загрузке Router парсит `window.location`
   - Строит **полный стек** из URL-сегментов
   - Пример: `/catalog/products/123` → стек из 3 экранов
   - Поддерживает любую глубину вложенности
   - Query параметры в URL автоматически обрабатываются
   - Промежуточные экраны добавляются в историю для корректной работы `goBack()`

3. **URL persistence**
   - `syncWithUrl=false` предотвращает изменение browser URL
   - Внутренний URL Router'а всё равно обновляется
   - Полезно для модалов, которые не должны менять адресную строку

### Mobile-платформа

- Основана на `react-native-screens`. Все рендереры (`ScreenStack`, `ScreenStackItem`) приходят из этой библиотеки и одинаково ведут себя на iOS и Android.
- Router на мобильных устройствах не работает с browser history, вместо этого поддерживает внутренний список URL (`internalHistory: string[]`), но алгоритм построения `StackModel` тот же.
- Параметр `syncWithUrl` **игнорируется**: на mobile нет адресной строки, поэтому все маршруты ведут себя как `syncWithUrl=true`. Эфемерные состояния используются только на вебе (см. ниже), чтобы скрыть модалки из URL.
- Для Web мы поставляем совместимые обёртки `ScreenStack`/`ScreenStackItem`, повторяющие API и жизненный цикл `react-native-screens`, чтобы код TabBar/StackRenderer оставался идентичным между платформами.

#### Механика `syncWithUrl`

Даже при строгом правиле “URL — источник истины”, некоторые маршруты (обычно модалы или вспомогательные оверлеи) не должны менять адресную строку. Для них задаётся `syncWithUrl=false`, и Router управляет дополнительным состоянием:

1. **Два слоя состояния**
   - **URL state** — строка браузера (или internal URL на mobile). Содержит только те сегменты, которые `syncWithUrl=true`.
   - **Ephemeral state** — массив HistoryItem'ов со `syncWithUrl=false`, который хранится внутри Router.

2. **Построение StackModel**
   - Router парсит URL → строит базовую историю.
   - Затем поверх добавляет элементы из ephemeral state (в порядке добавления).
   - В итоге StackModel всегда отражает `URL + ephemeral`, хотя адресная строка изменяется только для первой части.

3. **navigate()**
   - Если финальный маршрут `syncWithUrl=true`: делаем `history.pushState` и очищаем связанные ephemeral элементы (ведь базовый URL изменился).
   - Если `syncWithUrl=false`: URL не меняем. Вместо этого Router добавляет HistoryItem в ephemeral state и пересобирает модель.

4. **goBack() / popTo()**
   - Сначала проверяется ephemeral state. Если там есть элементы, удаляем их по одному (или до нужного ключа для `popTo`) и пересобираем стеки без обращения к browser history.
   - Только когда ephemeral пуст, Router дергает `history.back()`/`history.go()` и повторяет обычный цикл парсинга URL.

5. **replace()**
   - Со `syncWithUrl=true`: `history.replaceState` + полное пересобрание.
   - Со `syncWithUrl=false`: последний элемент в ephemeral state заменяется новым (URL не меняется).

6. **Инварианты**
   - Ephemeral state всегда относится к текущему URL. Любой переход на другой URL (push/replace c `syncWithUrl=true`, browser back/forward) очищает его.
   - Router никогда не вставляет ephemeral элементы в browser history, поэтому back/forward живут в пределах URL-сегментов.
   - Построение моделей детерминировано: `StackModel(URL, ephemeral) → HistoryItem[]` всегда даёт одинаковый результат для одного и того же набора данных.
   - **Race-safe навигация**:
     - Router обрабатывает навигации последовательно (очередь). Новая операция не начнётся, пока не завершена предыдущая (парсинг + сборка модели).
     - На вебе Router подписан на `popstate`. Если браузер меняет URL в момент, когда мы ещё обрабатываем `navigate()`, Router сначала завершает текущий цикл, а затем повторно читает `window.location` и строит модель заново — тем самым гарантируя, что фактический URL всегда победит.
     - Любая операция, которая меняет ephemeral state (navigate/goBack/replace с `syncWithUrl=false`), блокируется до тех пор, пока Router не завершит пересборку и не зафиксирует новый набор HistoryItem'ов. Это исключает наложение двух модалов или потерю состояния.
    - Если внешнее событие (например, deep link или force reload) меняет URL, Router сбрасывает очередь навигаций и полностью пересобирает состояние с нуля.
   - При `window.location.reload()` ephemeral state не восстанавливается — Router читает только URL. Поэтому модалки с `syncWithUrl=false` исчезают после перезагрузки (ожидаемое поведение).
   - На мобильных платформах `syncWithUrl=false` игнорируется: там нет адресной строки, поэтому все маршруты всегда попадают только в основной URL-слой.

Такой механизм позволяет придерживаться правила “URL ведёт за собой всё приложение”, но при этом не менять адресную строку для вспомогательных маршрутов. Все операции навигации автоматически учитывают оба слоя состояния.

##### Пример: `/settings` + модал без изменения URL

```typescript
const settingsStack = new NavigationStack()
  .addScreen('/settings', SettingsHome)
  .addModal('/settings?modal=profile', ProfileModal, {
    options: { syncWithUrl: false }
  });

const router = new Router({ root: settingsStack });
```

1. **Вход:** `router.navigate('/settings')`
   - URL: `/settings`
   - Ephemeral: []
   - Stack history: `[ '/settings' → SettingsHome ]`

2. **Открываем модал:** `router.navigate('/settings?modal=profile')`
   - Маршрут помечен `syncWithUrl=false`, поэтому браузер остаётся на `/settings`.
   - Ephemeral state: `[ { path: '/settings?modal=profile', component: ProfileModal } ]`
   - Итоговая история стека:
     ```
     [
       { path: '/settings', component: SettingsHome },
       { path: '/settings?modal=profile', component: ProfileModal, presentation: 'modal' }
     ]
     ```
     URL не менялся, но StackModel содержит оба экрана.

3. **Пользователь закрывает модал:** `router.goBack()`
   - Router видит, что в ephemeral есть элементы, удаляет последний, пересобирает стеки.
   - URL остаётся `/settings`.
   - История снова `[ '/settings' → SettingsHome ]`.

4. **Переход на другой URL:** `router.navigate('/home')`
   - Перед push Router очищает ephemeral state (чтобы модал не утёк за пределы `/settings`).
   - Новый URL: `/home`, история строится с нуля.

Таким образом, **вход** (`/settings` + “виртуальный” модал) и **выход** (StackModel с двумя элементами) явно разделены: URL управляет базовым стеком, а `syncWithUrl=false` добавляет временные элементы поверх него без изменения адресной строки.

---

## Паттерны использования

### Базовая навигация

```typescript
const stack = new NavigationStack()
  .addScreen('/', HomeScreen)
  .addScreen('/profile', ProfileScreen)
  .addScreen('/settings', SettingsScreen);

const router = new Router({ root: stack });

// Навигация
router.navigate('/profile');
router.goBack();
router.replace('/settings');
```

### Вложенные стеки с Deep Linking

```typescript
const adminStack = new NavigationStack('admin')
  .addScreen('/', AdminDashboard)
  .addScreen('/users', UserManagement)
  .addScreen('/users/:id', UserDetailScreen)
  .addScreen('/settings', AdminSettings);

const catalogStack = new NavigationStack('catalog')
  .addScreen('/', CatalogHome)
  .addScreen('/products', ProductsListScreen)
  .addScreen('/products/:id', ProductDetail)
  .addStack('/admin', adminStack);  // Вложенный стек

const rootStack = new NavigationStack('root')
  .addScreen('/', HomeScreen)
  .addStack('/catalog', catalogStack);

const router = new Router({ root: rootStack });

// URL mapping с построением полного стека:

// 1. Простой переход
router.navigate('/catalog');
// История стека: [/catalog]
// Рендер: CatalogHome

// 2. Deep link - автоматическое построение стека
router.navigate('/catalog/products/123');
// История стека: [/catalog, /catalog/products, /catalog/products/123]
// Рендер: CatalogHome → ProductsListScreen → ProductDetail
// goBack() → /catalog/products
// goBack() → /catalog

// 3. Ещё более глубокий deep link
router.navigate('/catalog/admin/users/456');
// История стека: [
//   /catalog,
//   /catalog/admin,
//   /catalog/admin/users,
//   /catalog/admin/users/456
// ]
// Рендер: CatalogHome → AdminDashboard → UserManagement → UserDetailScreen
// goBack() проходит через весь стек

// 4. Прямой переход без промежуточных экранов
const catalogStackSimple = new NavigationStack('catalog')
  .addScreen('/', CatalogHome)
  .addScreen('/products/:id', ProductDetail); // Нет /products маршрута

router.navigate('/catalog/products/123');
// История стека: [/catalog, /catalog/products/123]
// Пропущен /catalog/products (не зарегистрирован)
// Рендер: CatalogHome → ProductDetail
```

**Инварианты Deep Linking:**
- Router **всегда** пытается построить полный стек из URL
- Если промежуточный маршрут не зарегистрирован — он пропускается
- Финальный маршрут **обязателен** — иначе 404
- `goBack()` работает через весь построенный стек
- `goBack()` проверяет границы приложения: если это последний маршрут — операция игнорируется
- При повторной навигации на тот же URL стек не пересоздаётся

**Визуализация построения стека:**

```
URL: /catalog/products/123

Анализ сегментов:
├─ /catalog          → ✓ CatalogHome (найден)
├─ /catalog/products → ✓ ProductsListScreen (найден)
└─ /catalog/products/123 → ✓ ProductDetail (найден)

Результат - История стека:
┌─────────────────────────────────┐
│ ProductDetail                   │ ← Top (visible)
│ params: { id: '123' }          │
├─────────────────────────────────┤
│ ProductsListScreen              │
├─────────────────────────────────┤
│ CatalogHome                     │ ← Bottom
└─────────────────────────────────┘

goBack() последовательность:
  /catalog/products/123
  → goBack() → /catalog/products
  → goBack() → /catalog
  → goBack() → проверка глубины:
    - Если есть предыдущий маршрут в приложении → переход на него
    - Если нет (граница приложения) → игнорирует операцию (no-op)
```

### TabBar с вложенными стеками

```typescript
const homeStack = new NavigationStack()
  .addScreen('/', HomeScreen)
  .addScreen('/feed', FeedScreen);

const exploreStack = new NavigationStack()
  .addScreen('/', ExploreScreen)
  .addScreen('/search', SearchScreen);

const profileStack = new NavigationStack()
  .addScreen('/', ProfileScreen)
  .addScreen('/settings', SettingsScreen)
  .addScreen('/edit', EditProfileScreen);

const tabBar = new TabBar()
  .addTab({ key: 'home', stack: homeStack, title: 'Home' })
  .addTab({ key: 'explore', stack: exploreStack, title: 'Explore' })
  .addTab({ key: 'profile', stack: profileStack, title: 'Profile' });

const router = new Router({ root: tabBar });

// URL определяет активный таб:
router.navigate('/feed');      // Home tab, FeedScreen
router.navigate('/search');    // Explore tab, SearchScreen
router.navigate('/settings');  // Profile tab, SettingsScreen
```

### Wildcard модалы для глобальных overlay

```typescript
const globalStack = new NavigationStack()
  .addModal('*?modal=promo', PromoModalScreen)
  .addModal('*?modal=auth', AuthModalScreen)
  .addModal('*?modal=share', ShareModalScreen);

const mainStack = new NavigationStack()
  .addScreen('/', HomeScreen)
  .addScreen('/feed', FeedScreen)
  .addScreen('/profile', ProfileScreen);

// Объединяем через вложенный стек или root
const router = new Router({
  root: mainStack.addStack('/overlays', globalStack)
});

// Модалы открываются поверх ЛЮБОГО экрана:
router.navigate('/?modal=promo');         // HomeScreen + PromoModal
router.navigate('/feed?modal=auth');      // FeedScreen + AuthModal
router.navigate('/profile?modal=share');  // ProfileScreen + ShareModal

// Можно комбинировать с params:
router.navigate('/users/123?modal=share'); // UserScreen(id:123) + ShareModal
```

### Вариативные модалы через query на одном path

```typescript
const authStack = new NavigationStack()
  .addScreen('/auth', AuthRootScreen)
  // Конкретные значения (высокий приоритет)
  .addModal('/auth?kind=email', EmailAuthModal)
  .addModal('/auth?kind=sms', SmsAuthModal)
  .addModal('/auth?kind=google', GoogleAuthModal)
  // Параметризованный fallback (низкий приоритет)
  .addModal('/auth?kind=:kind', GenericAuthModal);

const router = new Router({ root: authStack });

// URL определяет конкретный модал:
router.navigate('/auth');              // AuthRootScreen (без модала)
router.navigate('/auth?kind=email');   // AuthRootScreen + EmailAuthModal
router.navigate('/auth?kind=sms');     // AuthRootScreen + SmsAuthModal
router.navigate('/auth?kind=phone');   // AuthRootScreen + GenericAuthModal (fallback)

// В GenericAuthModal:
function GenericAuthModal() {
  const query = useQueryParams<{ kind: string }>();
  // query.kind === 'phone'
  // Можно рендерить UI в зависимости от kind
}
```

### Комбинирование нескольких query параметров

```typescript
const productsStack = new NavigationStack()
  .addScreen('/products', ProductsScreen)
  // Один параметр
  .addModal('/products?filter=:category', FilterModal)
  // Два параметра (выше специфичность)
  .addModal('/products?filter=:category&sort=:order', FilterAndSortModal)
  // Константа + параметр
  .addModal('/products?filter=sale&highlight=:tag', SaleHighlightModal);

const router = new Router({ root: productsStack });

router.navigate('/products?filter=electronics');
// → ProductsScreen + FilterModal (category: 'electronics')

router.navigate('/products?filter=electronics&sort=price');
// → ProductsScreen + FilterAndSortModal (category: 'electronics', order: 'price')

router.navigate('/products?filter=sale&highlight=new');
// → ProductsScreen + SaleHighlightModal (tag: 'new')
```

### Query экраны вместо модалов

Query параметры работают не только для модалов, но и для обычных экранов:

```typescript
const dashboardStack = new NavigationStack()
  .addScreen('/dashboard', DashboardOverviewScreen)
  .addScreen('/dashboard?view=analytics', AnalyticsScreen)
  .addScreen('/dashboard?view=reports', ReportsScreen)
  .addScreen('/dashboard?view=:viewType', CustomDashboardScreen);

const router = new Router({ root: dashboardStack });

// Каждый URL полностью заменяет экран:
router.navigate('/dashboard');               // DashboardOverviewScreen
router.navigate('/dashboard?view=analytics'); // AnalyticsScreen (не overlay!)
router.navigate('/dashboard?view=reports');   // ReportsScreen (не overlay!)
router.navigate('/dashboard?view=metrics');   // CustomDashboardScreen (viewType: 'metrics')

// В компоненте:
function CustomDashboardScreen() {
  const query = useQueryParams<{ viewType: string }>();

  return <div>Custom view: {query.viewType}</div>;
}
```

### Wildcard экраны для глобальных действий

```typescript
const rootStack = new NavigationStack()
  .addScreen('/', HomeScreen)
  .addScreen('/products', ProductsScreen)
  .addScreen('/profile', ProfileScreen)
  // Wildcard screen для поиска на любой странице
  .addScreen('*?search=:query', GlobalSearchScreen, {
    stackPresentation: 'fullScreenModal'
  });

const router = new Router({ root: rootStack });

// Поиск работает на любой странице:
router.navigate('/?search=laptop');          // HomeScreen → GlobalSearchScreen
router.navigate('/products?search=phone');   // ProductsScreen → GlobalSearchScreen
router.navigate('/profile?search=settings'); // ProfileScreen → GlobalSearchScreen

// GlobalSearchScreen заменяет текущий экран (не overlay)
```

### Комбинация query экранов и модалов

Можно использовать query для обоих типов одновременно:

```typescript
const settingsStack = new NavigationStack()
  .addScreen('/settings', SettingsHomeScreen)
  // Query экраны - заменяют base
  .addScreen('/settings?tab=account', AccountSettingsScreen)
  .addScreen('/settings?tab=privacy', PrivacySettingsScreen)
  .addScreen('/settings?tab=notifications', NotificationsScreen)
  // Query модалы - overlay поверх base или query экранов
  .addModal('/settings?edit=:field', EditFieldModal)
  .addModal('*?confirm=:action', ConfirmationModal);

const router = new Router({ root: settingsStack });

// Query экран заменяет base:
router.navigate('/settings?tab=account');
// → AccountSettingsScreen (не SettingsHomeScreen!)

// Query модал накладывается поверх query экрана:
router.navigate('/settings?tab=account&edit=email');
// → AccountSettingsScreen + EditFieldModal (field: 'email')

// Wildcard модал работает везде:
router.navigate('/settings?confirm=logout');
// → SettingsHomeScreen + ConfirmationModal

router.navigate('/settings?tab=privacy&confirm=delete');
// → PrivacySettingsScreen + ConfirmationModal
```

**Инварианты комбинации:**
- Query экраны (`.addScreen()`) имеют приоритет над базовым path
- Query модалы (`.addModal()`) накладываются поверх query экранов
- Можно иметь несколько query модалов одновременно
- Специфичность определяет какой маршрут выбрать при матчинге

### Контроллеры с асинхронной логикой

```typescript
const productController = createController<
  { productId: string },
  {}
>(async (input, present) => {
  const { params } = input;

  const product = await fetchProduct(params.productId);

  if (!product) {
    router.navigate('/not-found');
    return;
  }

  present({ product });
});

stack.addScreen('/products/:productId', {
  controller: productController,
  component: ProductScreen
});
```

---

## Лучшие практики

1. **Используйте вложенные стеки для группировки** экранов по фичам
2. **Задавайте уникальные `stackId`** для отладки
3. **Используйте `defaultOptions`** на уровне стека для консистентности
4. **Типизируйте `params` и `query`** в контроллерах
5. **Для модалов используйте wildcard** с query parameters
6. **Проверяйте `syncWithUrl`** для модалов, которые не должны менять URL
7. **Используйте `replace()` вместо `navigate()`** для редиректов

---

## Отладка

Включите debug режим:

```typescript
const router = new Router({
  root: stack,
  debug: true
});
```

Логи будут содержать:
- Парсинг URL
- Построение модели стеков
- Матчинг маршрутов (depth-first)
- Операции навигации (push, pop, replace, popTo)
- Изменения browser history

---

## Технические детали

### Query параметры

Для парсинга и сериализации query параметров используется библиотека **[query-string](https://github.com/sindresorhus/query-string)** (v9+).

#### Парсинг URL

```typescript
import qs from 'query-string';

// Внутри Router
const parsed = qs.parseUrl('/profile?tab=posts&userId=123');
// {
//   url: '/profile',
//   query: { tab: 'posts', userId: '123' }
// }
```

#### Сериализация query

```typescript
import qs from 'query-string';

const query = { tab: 'posts', userId: '123' };
const search = qs.stringify(query);
// 'tab=posts&userId=123'

const fullUrl = `/profile?${search}`;
// '/profile?tab=posts&userId=123'
```

#### Особенности query-string

**Поддерживаемые типы:**
- Строки: `?name=John` → `{ name: 'John' }`
- Массивы: `?tags=foo&tags=bar` → `{ tags: ['foo', 'bar'] }`
- Числа остаются строками: `?id=123` → `{ id: '123' }` (не `123`)
- Boolean остаются строками: `?active=true` → `{ active: 'true' }` (не `true`)

**Инварианты:**
- Все значения парсятся как **строки**
- Для типизации используйте generic в hooks: `useQueryParams<{ id: string }>()`
- Пустые значения: `?filter=` → `{ filter: '' }`
- Отсутствующие значения не попадают в объект

**Пример с типизацией:**

```typescript
// ❌ Неправильно - числа это строки
const query = useQueryParams<{ page: number }>();
query.page; // На самом деле string, не number!

// ✅ Правильно
const query = useQueryParams<{ page: string }>();
const pageNumber = parseInt(query.page || '1', 10);
```

### Path matching

Для матчинга путей используется библиотека **[path-to-regexp](https://github.com/pillarjs/path-to-regexp)**.

#### Поддерживаемые паттерны

```typescript
// Статический путь
'/profile' → совпадает только '/profile'

// Именованные параметры
'/user/:id' → совпадает '/user/123', params: { id: '123' }
'/products/:category/:id' → совпадает '/products/books/456'
  params: { category: 'books', id: '456' }

// Optional параметры
'/posts/:id?' → совпадает '/posts' и '/posts/123'

// Wildcard
'*' → совпадает с любым путём
```

#### Инварианты path-to-regexp

- Все параметры извлекаются как **строки**
- Параметры всегда декодируются (URL decode)
- Путь должен совпадать **полностью** (не частично)
- Case-sensitive по умолчанию

### Генерация уникальных ID

Для генерации уникальных ключей (`stackId`, `routeId`, item keys) используется **[nanoid](https://github.com/ai/nanoid)**.

```typescript
import { nanoid } from 'nanoid/non-secure';

// Генерация stackId
const stackId = `stack-${nanoid()}`;
// 'stack-V1StGXR8_Z5jdHi6B-myT'

// Генерация route key
const key = `route-${nanoid()}`;
// 'route-4n5pxq24kpiob12og9'
```

**Инварианты:**
- Используется **non-secure** версия (без crypto, быстрее)
- Длина ID: 21 символ (default nanoid)
- Вероятность коллизии: крайне низкая (~1 миллион лет при 1000 ID/час)
- ID **не sequential** и не предсказуемы

---

## Совместимость

### Требуемые версии

- **React**: 19.x
- **React Native**: 0.81+
- **react-native-screens**: 4.17+
- **TypeScript**: 5.0+ (опционально, но рекомендуется)

### Зависимости

```json
{
  "dependencies": {
    "query-string": "^9.3.1",
    "nanoid": "^5.0.0",
    "path-to-regexp": "^8.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-native": "^0.81.0",
    "react-native-screens": "^4.17.0"
  }
}
```

### Платформы

- **Web**: Современные браузеры с History API (Chrome 90+, Firefox 88+, Safari 14+)
- **iOS**: iOS 13+ (требует react-native-screens native модуль)
- **Android**: Android 6.0+ (API 23+, требует react-native-screens native модуль)
- Если текущий URL не покрывается новой конфигурацией → Router выполняет `replace(entryPath)` (entryPath = `initialIndex` вкладки для TabBar или первый маршрут NavigationStack). Это срабатывает как redirect без возможности вернуться назад.
- После каждого успешного `setRoot` Router уведомляет подписчиков так же, как после `navigate/replace/goBack`.

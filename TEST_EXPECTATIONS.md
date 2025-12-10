# Ожидания для тестов навигации

## Основные ожидания из CONTRACT.md

### 1. Базовые сценарии навигации ✅

#### 1.1 Навигация по простым путям
- ✅ `navigate('/catalog')` → `visibleRoute.path === '/catalog'`
- ✅ `navigate('/settings')` → `visibleRoute.path === '/settings'`
- ✅ Начальное состояние: `visibleRoute.path === '/'` (корневой маршрут)

#### 1.2 Навигация с параметрами пути
- ✅ `navigate('/catalog/products/123')` → `params.productId === '123'`
- ✅ `navigate('/orders/2024/12')` → `params.year === '2024'`, `params.month === '12'`
- ✅ `navigate('/users/42')` → `params.userId === '42'`

#### 1.3 Навигация с query-параметрами
- ✅ `navigate('/auth?kind=email')` → `query.kind === 'email'`
- ✅ `navigate('/auth?kind=sms&redirect=/home')` → `query.kind === 'sms'`, `query.redirect === '/home'`

#### 1.4 Возврат назад (goBack)
- ✅ `navigate('/catalog')` → `navigate('/catalog/products/123')` → `goBack()` → `visibleRoute.path === '/catalog'`
- ✅ `goBack()` на корневом маршруте не изменяет состояние

#### 1.5 Замена маршрута (replace)
- ✅ `navigate('/catalog')` → `navigate('/catalog/products/1')` → `navigate('/catalog/products/2')` → `replace('/catalog/products/3')` → история: `['/catalog', '/catalog/products/1', '/catalog/products/3']`
- ✅ После `replace` → `goBack()` возвращает к предыдущему маршруту (не к замененному)

### 2. Навигация с табами ✅

#### 2.1 Переключение между табами
- ✅ При переключении табов история каждого таба сохраняется
- ✅ `navigate('/catalog')` → `getStackHistory(catalogStackId).length === 1`
- ✅ `navigate('/')` (home) → `getStackHistory(homeStackId).length === 1` (сохранена)
- ✅ Возврат в таб восстанавливает его последнее состояние

#### 2.2 Глубокая навигация в табе
- ✅ `navigate('/catalog')` → `navigate('/catalog/products/123')` → `getStackHistory(catalogStackId).length === 2`
- ✅ Переключение на другой tab → история catalog tab сохраняется
- ✅ Возврат в catalog tab → восстанавливается состояние `/catalog/products/123`

#### 2.3 goBack в контексте таба
- ✅ `goBack()` работает в контексте активного стека
- ✅ `goBack()` на корневом маршруте стека не изменяет состояние
- ✅ При переключении табов `goBack()` работает в контексте активного таба

### 3. Модальные окна ✅

#### 3.1 Открытие модального окна
- ✅ `navigate('/catalog')` → `navigate('/catalog?modal=promo')` → `visibleRoute.query.modal === 'promo'`
- ✅ `navigate('/auth')` → `navigate('/auth?kind=email')` → `visibleRoute.query.kind === 'email'`

#### 3.2 Закрытие модального окна (goBack)
- ✅ `navigate('/catalog')` → `navigate('/catalog?modal=promo')` → `goBack()` → `visibleRoute.path === '/catalog'`
- ✅ `navigate('/auth')` → `navigate('/auth?kind=email')` → `goBack()` → `visibleRoute.path === '/auth'` (query отсутствует)

#### 3.3 Модальные окна с параметрами
- ✅ `navigate('/auth')` → `navigate('/auth?kind=email')` → `navigate('/auth?kind=sms')` → `goBack()` → `query.kind === 'email'`

### 4. Дедупликация маршрутов ✅

#### 4.1 Предотвращение дубликатов
- ✅ `navigate('/catalog')` → `navigate('/catalog')` → `getStackHistory(catalogStackId).length === 1` (не изменилась)
- ✅ `navigate('/catalog/products/123')` → `navigate('/catalog/products/123')` → `getStackHistory(catalogStackId).length === 2` (не изменилась)

### 5. Сохранение ключей (Key Preservation) ⚠️ КРИТИЧНО

#### 5.1 При обновлении query-параметров
- ✅ `navigate('/auth')` → `navigate('/auth?kind=email')` → ключ сохраняется (тот же маршрут, разные query)
- ✅ `navigate('/auth?kind=email')` → `navigate('/auth?kind=sms')` → ключ сохраняется

#### 5.2 При навигации на тот же путь
- ✅ `navigate('/catalog')` → `navigate('/catalog')` → ключ сохраняется
- ✅ `navigate('/catalog/products/123')` → `navigate('/catalog/products/123')` → ключ сохраняется

#### 5.3 При replace операции
- ✅ `navigate('/catalog/products/1')` → `replace('/catalog/products/2')` → ключ сохраняется из старого элемента

#### 5.4 При переключении табов
- ✅ `navigate('/catalog/products/123')` → `navigate('/')` → `navigate('/catalog/products/123')` → ключ сохраняется

#### 5.5 При goBack
- ✅ Ключи сохраняются при `goBack()` (только последний элемент удаляется)

#### 5.6 При открытии/закрытии модалов
- ✅ `navigate('/catalog')` → `navigate('/catalog?modal=promo')` → `goBack()` → ключ catalog сохраняется

#### 5.7 При навигации на новый маршрут
- ✅ `navigate('/catalog')` → `navigate('/catalog/products/123')` → создается новый ключ (это правильно)
- ✅ `navigate('/catalog/products/123')` → `navigate('/catalog/products/456')` → создается новый ключ (разные params)

### 6. Плоская история навигации ✅

#### 6.1 Структура истории
- ✅ `history` — плоский массив `HistoryItem[]`
- ✅ Каждый элемент содержит `stackId`, `routeId`, `path`, `params`, `query`, `key`
- ✅ `getStackHistory(stackId)` фильтрует историю по `stackId`

#### 6.2 История содержит элементы из разных стеков
- ✅ История может содержать элементы из разных стеков (home, catalog, orders)
- ✅ `getStackHistory(homeStackId)` возвращает только элементы с `stackId === homeStackId`

### 7. Сложные сценарии ✅

#### 7.1 Комбинированная навигация (табы + глубокая навигация + модалы)
- ✅ `navigate('/catalog')` → `navigate('/catalog/products/1')` → `navigate('/catalog/products/2')` → `navigate('/catalog/products/2?modal=promo')` → `goBack()` → `visibleRoute.path === '/catalog/products/2'` → `goBack()` → `visibleRoute.path === '/catalog/products/1'` → `goBack()` → `visibleRoute.path === '/catalog'`

## Критические требования из ARCHITECTURE_ISSUES.md

### ⚠️ ВАЖНО: Сохранение ключей

**Правила сохранения ключей:**

1. **При `push` нового маршрута** — создается новый ключ (это нормально) ✅
2. **При `replace` существующего маршрута** — ключ сохраняется из старого элемента ✅
3. **При `popTo` существующего маршрута** — ключ сохраняется из найденного элемента ✅
4. **При обновлении query/params существующего маршрута** — ключ сохраняется ✅

## Проверка соответствия тестов

### ✅ Покрыты тестами:
- Базовые сценарии навигации
- Навигация с параметрами
- Навигация с query-параметрами
- goBack сценарии
- Навигация с табами
- Модальные окна
- Дедупликация маршрутов
- Сохранение ключей (Key Preservation)
- Плоская история навигации
- Сложные комбинированные сценарии

### ⚠️ Потенциальные проблемы:

1. **Тест "goBack from auth modal with query to auth root"** (строка 536-548):
   - **Текущее ожидание:** `goBack()` → `visibleRoute.path === '/'`
   - **Согласно CONTRACT.md (строки 445-450):** `goBack()` должен вернуть к `/auth` (без query)
   - **Проблема:** Тест ожидает возврат к `/`, но контракт говорит, что должен быть возврат к `/auth`
   - **Структура rootStack:**
     - `/` - tabBar (корневой экран)
     - `/auth` - экран (`.addScreen('/auth', ...)`)
     - `/auth?kind=email` - модал (`.addModal('/auth?kind=email', ...)`)
   - **Вопрос:** Если `/auth` - это экран в rootStack, то при `navigate('/auth')` он должен заменить `/` или открыться поверх?
   - **Рекомендация:** Проверить логику - возможно, тест неверен, и должно быть `visibleRoute.path === '/auth'` после первого `goBack()`

2. **Тест "goBack from promo modal"** (строка 570-601):
   - Есть `console.log` - тест в процессе отладки
   - Нужно убрать отладочные логи

3. **Тест "goBack when switching tabs preserves stacks"** (строка 641-678):
   - Есть `console.log` - тест в процессе отладки
   - Нужно убрать отладочные логи

4. **Тест "navigate to different tabs, goBack preserves state"** (строка 785-832):
   - Есть `console.log` - тест в процессе отладки
   - Нужно убрать отладочные логи

5. **Тест "complex flow: tabs -> deep navigation -> modal -> goBack chain"** (строка 849-898):
   - Есть `console.log` - тест в процессе отладки
   - Нужно убрать отладочные логи

## Рекомендации

1. Убрать все `console.log` из тестов
2. Проверить логику теста "goBack from auth modal with query to auth root" - возможно, ожидание неверно
3. Убедиться, что все тесты на сохранение ключей проходят
4. Проверить, что тесты соответствуют структуре из `example/src/navigation/stacks.ts`

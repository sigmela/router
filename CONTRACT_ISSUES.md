# Найденные несоответствия реализации контракту

## Критические проблемы

### 1. Router знает о конкретной реализации NavigationStack

**Проблема:** Router использует `instanceof NavigationStack` и типы с конкретными реализациями.

**Нарушение контракта:** 
> "Router не знает о конкретных реализациях — он работает только через интерфейс NavigationNode"

**Места:**

#### 1.1 Тип root
```typescript
// src/Router.ts:29-30
private root: NavigationStack | NavigationNode | null = null;
public root: NavigationStack | NavigationNode | null = null;
```
**Должно быть:**
```typescript
private root: NavigationNode | null = null;
public root: NavigationNode | null = null;
```

#### 1.2 Метод setRoot
```typescript
// src/Router.ts:182-184
public setRoot(
  nextRoot: NavigationNode | NavigationStack,
  options?: { transition?: RootTransition }
): void
```
**Должно быть:**
```typescript
public setRoot(
  nextRoot: NavigationNode,
  options?: { transition?: RootTransition }
): void
```

#### 1.3 Проверка instanceof NavigationStack (2 места)
```typescript
// src/Router.ts:588
const isStack = node instanceof NavigationStack;

// src/Router.ts:656
if (child.node instanceof NavigationStack) {
```
**Проблема:** Router проверяет конкретный тип вместо работы через интерфейс.

**Решения:**
1. Убрать проверку `isStack` - если нужно определить, является ли узел стеком, это должно быть через интерфейс или поведение
2. Для получения `stackId` использовать `getId()` из интерфейса
3. Для определения, нужен ли `stackId`, можно проверять наличие в реестре или полагаться на наличие маршрутов

#### 1.4 Map с конкретным типом
```typescript
// src/Router.ts:44
private stackById = new Map<string, NavigationStack>();
```
**Должно быть:**
```typescript
private stackById = new Map<string, NavigationNode>();
```
Или вообще убрать, если это не нужно для контракта.

#### 1.5 Метод findStackById
```typescript
// src/Router.ts:879-881
private findStackById(stackId: string): NavigationStack | undefined {
  return this.stackById.get(stackId);
}
```
**Должно быть:**
```typescript
private findStackById(stackId: string): NavigationNode | undefined {
  return this.stackById.get(stackId);
}
```

### 2. Использование метода, не входящего в контракт

**Проблема:** Router вызывает `getDefaultOptions()`, который не является частью интерфейса `NavigationNode`.

```typescript
// src/Router.ts:857
? (this.findStackById(stackId)?.getDefaultOptions() as any)
```

**Нарушение:** Router не должен вызывать методы, которых нет в контракте NavigationNode.

**Решение:** 
- Либо добавить `getDefaultOptions?()` в интерфейс NavigationNode (как опциональный метод)
- Либо убрать эту логику из Router и обрабатывать default options по-другому
- Либо хранить default options в реестре при построении, а не запрашивать их из узла

### 3. Неопределенная функция isNavigationStackLike

```typescript
// src/Router.ts:666
if (isNavigationStackLike(this.root)) {
```

**Проблема:** Функция используется, но не определена. Это может быть:
- Ошибка компиляции
- Удаленная функция
- Неправильное имя

**Решение:** Убрать эту проверку и использовать универсальную проверку через интерфейс:
```typescript
if (this.root && typeof (this.root as any).getNodeRoutes === 'function') {
```

### 4. Дублирование интерфейса NavigationNode

```typescript
// src/navigationNode.ts:30-38 и 41-46
export interface NavigationNode {
  getId(): string;
  getNodeRoutes(): NodeRoute[];
  getNodeChildren(): NodeChild[];
  getRenderer(): React.ComponentType<any>;
  seed?: () => { ... } | null;
}

export interface NavigationNode {  // Дублирование!
  getId(): string;
  getNodeRoutes(): NodeRoute[];
  getNodeChildren(): NodeChild[];
  getRenderer(): React.ComponentType<any>;
}
```

**Проблема:** Интерфейс объявлен дважды, второй раз без опционального метода `seed`.

**Решение:** Объединить в один интерфейс.

---

## Средние проблемы

### 5. Неявное приведение типов

```typescript
// src/Router.ts:589-591
const routes: NodeRoute[] = (node as any).getNodeRoutes
  ? (node as any).getNodeRoutes()
  : [];
```

**Проблема:** Использование `as any` вместо проверки через интерфейс.

**Решение:** Использовать type guard или явную проверку:
```typescript
const routes: NodeRoute[] = 
  typeof node.getNodeRoutes === 'function' 
    ? node.getNodeRoutes() 
    : [];
```

### 6. Проверка наличия метода через условие

```typescript
// src/Router.ts:650-652
const children: NodeChild[] = (node as any).getNodeChildren
  ? (node as any).getNodeChildren()
  : [];
```

**Проблема:** Такая же, как в пункте 5.

**Решение:** Использовать явную проверку интерфейса.

---

## Рекомендации по исправлению

### Шаг 1: Исправить типы
1. Изменить тип `root` на `NavigationNode | null`
2. Изменить тип параметра `setRoot` на `NavigationNode`
3. Изменить `Map<string, NavigationStack>` на `Map<string, NavigationNode>` или убрать

### Шаг 2: Убрать проверки instanceof
1. Убрать `instanceof NavigationStack` проверки
2. Использовать только методы из интерфейса `NavigationNode`
3. Если нужна логика "это стек", добавить опциональный метод в контракт или определять по поведению

### Шаг 3: Решить проблему getDefaultOptions
**Вариант A:** Добавить в интерфейс:
```typescript
export interface NavigationNode {
  // ... существующие методы
  getDefaultOptions?(): ScreenOptions | undefined;
}
```

**Вариант B:** Хранить default options при построении реестра:
- При обходе узлов сохранять default options в CompiledRoute или отдельной Map
- Использовать сохраненные значения вместо запроса из узла

**Вариант C:** Убрать использование getDefaultOptions из Router
- Передавать default options через другой механизм

### Шаг 4: Исправить isNavigationStackLike
Заменить на проверку через интерфейс:
```typescript
if (this.root && typeof (this.root as any).getNodeRoutes === 'function') {
  addFromNode(this.root, '');
}
```

### Шаг 5: Объединить интерфейс NavigationNode
Убрать дублирование в `navigationNode.ts`.

---

## Дополнительные замечания

### Положительные моменты
1. ✅ RouterConfig правильно использует `NavigationNode`:
   ```typescript
   export interface RouterConfig {
     root: NavigationNode;  // ✅ Правильно, не конкретный тип
     screenOptions?: ScreenOptions;
     debug?: boolean;
   }
   ```
2. ✅ Router использует `getNodeRoutes()`, `getNodeChildren()`, `getId()` из интерфейса
3. ✅ Router работает с узлами рекурсивно через интерфейс в методе `buildRegistry`
4. ✅ Основная логика навигации (matchBaseRoute, performNavigation) соответствует контракту
5. ✅ Использование `seed()` из интерфейса для начальной истории

### Вопросы для обсуждения
1. Нужен ли Router доступ к `getDefaultOptions()`? Это часть контракта или внутренняя деталь NavigationStack?
2. Нужно ли Router хранить ссылки на узлы в `stackById`, или достаточно работать только с ID?
3. Как определить, является ли узел "стеком" без проверки конкретного типа? Нужен ли для этого метод в контракте?

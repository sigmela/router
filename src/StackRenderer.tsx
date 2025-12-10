import type { HistoryItem, NavigationAppearance } from './types';
import { memo, useCallback, useSyncExternalStore } from 'react';
import { ScreenStackItem } from './ScreenStackItem';
import { NavigationStack } from './NavigationStack';
import { ScreenStack } from './ScreenStack';
import { useRouter } from './RouterContext';
import { StyleSheet } from 'react-native';

export interface StackRendererProps {
  stack: NavigationStack;
  appearance?: NavigationAppearance;
  history?: HistoryItem[]; // ← История передается через props
}

export const StackRenderer = memo<StackRendererProps>(
  ({ stack, appearance, history }) => {
    const router = useRouter();
    const stackId = stack.getId();

    // Всегда вызываем useSyncExternalStore для реактивности (хуки должны вызываться безусловно)
    // Но если история передана через props - используем её (родительский компонент уже реактивен)
    const subscribe = useCallback(
      (cb: () => void) => router.subscribeStack(stackId, cb),
      [router, stackId]
    );
    const get = useCallback(
      () => router.getStackHistory(stackId),
      [router, stackId]
    );
    const historyFromStore: HistoryItem[] = useSyncExternalStore(
      subscribe,
      get,
      get
    );

    // Используем переданную историю или получаем из store
    const historyForThisStack = history ?? historyFromStore;

    return (
      <ScreenStack
        key={`stack-${stackId}`}
        style={[styles.flex, appearance?.screen]}
      >
        {historyForThisStack.map((item) => (
          <ScreenStackItem
            key={`stack-renderer-${item.key}`}
            appearance={appearance}
            stackId={stackId}
            item={item}
          />
        ))}
      </ScreenStack>
    );
  }
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

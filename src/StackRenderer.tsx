import type { HistoryItem, NavigationAppearance } from './types';
import { memo, useCallback, useSyncExternalStore } from 'react';
import { ScreenStackItem } from './ScreenStackItem';
import { ScreenStack } from './ScreenStack';
import { useRouter } from './RouterContext';
import { StyleSheet } from 'react-native';

export interface StackRendererProps {
  stackId: string;
  appearance?: NavigationAppearance;
  history?: HistoryItem[];
}

export const StackRenderer = memo<StackRendererProps>(
  ({ stackId, appearance, history }) => {
    const router = useRouter();

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

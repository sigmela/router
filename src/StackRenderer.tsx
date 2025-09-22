import { memo, useCallback, useSyncExternalStore } from 'react';
import { ScreenStackItem } from './ScreenStackItem';
import { NavigationStack } from './NavigationStack';
import { ScreenStack } from 'react-native-screens';
import { useRouter } from './RouterContext';
import type { HistoryItem } from './types';
import { StyleSheet } from 'react-native';

export interface StackRendererProps {
  stack: NavigationStack;
}

export const StackRenderer = memo<StackRendererProps>(({ stack }) => {
  const router = useRouter();
  const stackId = stack.getId();
  const subscribe = useCallback(
    (cb: () => void) => router.subscribeStack(stackId, cb),
    [router, stackId]
  );
  const get = useCallback(
    () => router.getStackHistory(stackId),
    [router, stackId]
  );
  const historyForThisStack: HistoryItem[] = useSyncExternalStore(
    subscribe,
    get,
    get
  );

  return (
    <ScreenStack style={styles.flex}>
      {historyForThisStack.map((item) => (
        <ScreenStackItem key={item.key} item={item} stackId={stackId} />
      ))}
    </ScreenStack>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

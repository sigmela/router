import { WebScreenStack, WebScreenStackItem } from '../web/WebScreenStack';
import type { HistoryItem, NavigationAppearance } from '../types';
import { memo, useCallback, useSyncExternalStore } from 'react';
import { ScreenStackItem } from '../ScreenStackItem';
import { NavigationStack } from '../NavigationStack';
import { useRouter } from '../RouterContext';

export interface StackRendererProps {
  stack: NavigationStack;
  appearance?: NavigationAppearance;
}

export const StackRenderer = memo<StackRendererProps>(
  ({ stack, appearance }) => {
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

    const renderItem = useCallback(
      (item: HistoryItem, phase: 'active' | 'exiting') => (
        <WebScreenStackItem phase={phase}>
          <ScreenStackItem
            appearance={appearance}
            stackId={stackId}
            key={item.key}
            item={item}
          />
        </WebScreenStackItem>
      ),
      [appearance, stackId]
    );

    return (
      <WebScreenStack
        key={stackId}
        type="navigation"
        transitionTime={250}
        items={historyForThisStack}
        getKey={(item) => item.key}
        renderItem={renderItem}
        animated={true}
      />
      //  <ScreenStack style={[styles.flex, appearance?.screenStyle]}>
      //    {historyForThisStack.map((item) => (
      //      <ScreenStackItem
      //        appearance={appearance}
      //        stackId={stackId}
      //        key={item.key}
      //        item={item}
      //      />
      //    ))}
      //  </ScreenStack>
    );
  }
);

// const styles = StyleSheet.create({
//   flex: { flex: 1 },
// });

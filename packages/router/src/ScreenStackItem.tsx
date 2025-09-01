import { ScreenStackItem as RNSScreenStackItem } from 'react-native-screens';
import { RouteLocalContext, useRouter } from './RouterContext';
import type { HistoryItem, ScreenOptions } from './types';
import { StyleSheet } from 'react-native';
import { memo } from 'react';

interface ScreenStackItemProps {
  item: HistoryItem;
  stackId?: string;
  stackAnimation?: ScreenOptions['stackAnimation'];
}

export const ScreenStackItem = memo<ScreenStackItemProps>(
  ({ item, stackId, stackAnimation }) => {
    const router = useRouter();

    const onDismissed = () => {
      if (stackId) {
        const history = router.getStackHistory(stackId);
        const topKey = history.length ? history[history.length - 1].key : null;
        if (topKey && topKey === item.key) {
          router.goBack();
        }
      }
    };

    const value = {
      params: item.params,
      query: item.query,
      pattern: item.pattern,
      path: item.path,
    };

    return (
      <RNSScreenStackItem
        key={item.key}
        screenId={item.key}
        onDismissed={onDismissed}
        style={StyleSheet.absoluteFill}
        {...item.options}
        stackAnimation={stackAnimation ?? item.options?.stackAnimation}
      >
        <RouteLocalContext.Provider value={value}>
          <item.component />
        </RouteLocalContext.Provider>
      </RNSScreenStackItem>
    );
  },
);

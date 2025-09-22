import { ScreenStackItem as RNSScreenStackItem } from 'react-native-screens';
import { RouteLocalContext, useRouter } from './RouterContext';
import type { HistoryItem, ScreenOptions, NavigationAppearance } from './types';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { memo } from 'react';

interface ScreenStackItemProps {
  item: HistoryItem;
  stackId?: string;
  stackAnimation?: ScreenOptions['stackAnimation'];
  screenStyle?: StyleProp<ViewStyle>;
  headerAppearance?: NavigationAppearance['header'];
}

export const ScreenStackItem = memo<ScreenStackItemProps>(
  ({ item, stackId, stackAnimation, screenStyle }) => {
    const router = useRouter();

    const onDismissed = () => {
      if (stackId) {
        const history = router.getStackHistory(stackId);
        const topKey = history.length ? history[history.length - 1]?.key : null;
        if (topKey && topKey === item.key) {
          router.goBack();
        }
      }
    };

    const value = {
      presentation: item.options?.stackPresentation ?? 'push',
      params: item.params,
      query: item.query,
      pattern: item.pattern,
      path: item.path,
    };

    const { header, ...screenProps } = item.options || {};
    // Merge global header appearance with per-screen header options
    // const mergedHeader = {
    //   ...(headerAppearance ?? {}),
    //   ...(header ?? {}),
    // } as any;
    // Hide header by default if not specified
    const headerConfig = header ?? { hidden: true };

    // console.log('headerConfig', headerAppearance, item.key);
    return (
      <RNSScreenStackItem
        key={item.key}
        screenId={item.key}
        onDismissed={onDismissed}
        style={StyleSheet.absoluteFill}
        contentStyle={screenStyle}
        headerConfig={headerConfig}
        {...screenProps}
        stackAnimation={stackAnimation ?? item.options?.stackAnimation}
      >
        <RouteLocalContext.Provider value={value}>
          <item.component {...(item.passProps || {})} />
        </RouteLocalContext.Provider>
      </RNSScreenStackItem>
    );
  }
);

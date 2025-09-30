import { ScreenStackItem as RNSScreenStackItem } from 'react-native-screens';
import type { ScreenStackItemProps } from './ScreenStackItem.types';
import { RouteLocalContext, useRouter } from '../RouterContext';
import { StyleSheet } from 'react-native';
import { memo } from 'react';

export const ScreenStackItem = memo<ScreenStackItemProps>(
  ({ item, stackId, stackAnimation, appearance }) => {
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

    const headerConfig = {
      ...header,
      hidden: !header?.title || header?.hidden,
      backgroundColor: appearance?.header?.backgroundColor ?? 'transparent',
    };

    return (
      <RNSScreenStackItem
        key={item.key}
        screenId={item.key}
        onDismissed={onDismissed}
        style={StyleSheet.absoluteFill}
        contentStyle={appearance?.screen}
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

import {
  ScreenStackItem as RNSScreenStackItem,
  type StackPresentationTypes,
} from 'react-native-screens';
import type { ScreenStackItemProps } from './ScreenStackItem.types';
import { RouteLocalContext, useRouter } from '../RouterContext';
import { ScreenStackSheetItem } from '../ScreenStackSheetItem';
import { StyleSheet } from 'react-native';
import { memo } from 'react';

export const ScreenStackItem = memo<ScreenStackItemProps>(
  ({ item, stackId, stackAnimation, appearance }) => {
    const { header, stackPresentation, ...screenProps } = item.options || {};
    const route = {
      presentation: stackPresentation ?? 'push',
      params: item.params,
      query: item.query,
      pattern: item.pattern,
      path: item.path,
    };

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

    const headerConfig = {
      ...header,
      hidden: !header?.title || header?.hidden,
      backgroundColor: appearance?.header?.backgroundColor ?? 'transparent',
    };

    if (route.presentation === 'sheet') {
      return (
        <ScreenStackSheetItem
          appearance={appearance?.sheet}
          onDismissed={onDismissed}
          route={route}
          item={item}
        />
      );
    }

    return (
      <RNSScreenStackItem
        key={item.key}
        {...screenProps}
        screenId={item.key}
        onDismissed={onDismissed}
        style={StyleSheet.absoluteFill}
        contentStyle={appearance?.screen}
        headerConfig={headerConfig}
        stackPresentation={stackPresentation as StackPresentationTypes}
        stackAnimation={stackAnimation ?? item.options?.stackAnimation}
      >
        <RouteLocalContext.Provider value={route}>
          <item.component {...item.passProps} appearance={appearance} />
        </RouteLocalContext.Provider>
      </RNSScreenStackItem>
    );
  }
);

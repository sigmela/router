import type { ScreenStackItemProps } from './ScreenStackItem.types';
import { RouteLocalContext } from '../RouterContext';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

export const ScreenStackItem = memo(
  ({ phase = 'active', item, appearance }: ScreenStackItemProps) => {
    const value = {
      presentation: item.options?.stackPresentation ?? 'push',
      params: item.params,
      query: item.query,
      pattern: item.pattern,
      path: item.path,
    };

    return (
      <div
        data-presentation={value.presentation}
        className="screen-stack-item"
        data-phase={phase}
      >
        <RouteLocalContext.Provider value={value}>
          <View style={[styles.flex, appearance?.screen]}>
            <item.component {...(item.passProps || {})} />
          </View>
        </RouteLocalContext.Provider>
      </div>
    );
  }
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

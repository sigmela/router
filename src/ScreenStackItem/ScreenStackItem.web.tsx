import type { ScreenStackItemProps } from './ScreenStackItem.types';
import { RouteLocalContext } from '../RouterContext';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useScreenStackItemsContext } from '../ScreenStack/ScreenStackContext';

const devLog = (_: string, __?: any) => {};

export const ScreenStackItem = memo(
  ({ item, appearance, style }: ScreenStackItemProps) => {
    const itemsContext = useScreenStackItemsContext();
    const key = item.key;

    const itemState = itemsContext.items[key];
    const presentationType = itemState?.presentationType;
    const animationType = itemState?.animationType;
    const phase = itemState?.phase;
    const transitionStatus = itemState?.transitionStatus;
    const zIndex = itemState?.zIndex ?? 0;
    const presentation = item.options?.stackPresentation ?? 'push';

    const isModalLike = [
      'modal',
      'transparentModal',
      'containedModal',
      'containedTransparentModal',
      'fullScreenModal',
      'formSheet',
      'pageSheet',
      'sheet',
    ].includes(presentation);

    const className = useMemo(() => {
      const classes = ['screen-stack-item'];

      if (presentationType) {
        classes.push(presentationType);
      }

      if (animationType) {
        classes.push(animationType);
      }

      if (transitionStatus) {
        classes.push(`transition-${transitionStatus}`);
      }

      if (phase) {
        classes.push(`phase-${phase}`);
      }

      devLog('[ScreenStackItem] className', {
        key: item.key,
        path: item.path,
        presentationType,
        animationType,
        phase,
        transitionStatus,
        className: classes.join(' '),
      });

      return classes.join(' ');
    }, [
      presentationType,
      animationType,
      transitionStatus,
      phase,
      item.key,
      item.path,
    ]);

    const mergedStyle = useMemo(
      () => ({
        flex: 1,
        ...style,
        zIndex,
      }),
      [style, zIndex]
    );

    const value = {
      presentation,
      params: item.params,
      query: item.query,
      pattern: item.pattern,
      path: item.path,
    };

    if (!itemState) {
      return null;
    }

    return (
      <div style={mergedStyle} className={className}>
        {}
        {isModalLike && <div className="stack-modal-overlay" />}

        <div
          className={
            isModalLike ? 'stack-modal-container' : 'stack-screen-container'
          }
        >
          {appearance?.screen ? (
            <View style={[appearance?.screen, styles.flex]}>
              <RouteLocalContext.Provider value={value}>
                <item.component
                  {...(item.passProps || {})}
                  appearance={appearance}
                />
              </RouteLocalContext.Provider>
            </View>
          ) : (
            <RouteLocalContext.Provider value={value}>
              <item.component
                {...(item.passProps || {})}
                appearance={appearance}
              />
            </RouteLocalContext.Provider>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.key === nextProps.item.key &&
      prevProps.item === nextProps.item &&
      prevProps.appearance === nextProps.appearance &&
      prevProps.style === nextProps.style
    );
  }
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

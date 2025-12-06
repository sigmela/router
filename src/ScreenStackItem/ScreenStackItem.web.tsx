import type { ScreenStackItemProps } from './ScreenStackItem.types';
import { RouteLocalContext } from '../RouterContext';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

const devLog = (message: string, data?: any) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (data !== undefined) {
      // eslint-disable-next-line no-console
      console.log(message, data);
    } else {
      // eslint-disable-next-line no-console
      console.log(message);
    }
  }
};

export const ScreenStackItem = memo(
  ({
    phase = 'active',
    transitionStatus,
    item,
    appearance,
    style,
  }: ScreenStackItemProps) => {
    const value = {
      presentation: item.options?.stackPresentation ?? 'push',
      params: item.params,
      query: item.query,
      pattern: item.pattern,
      path: item.path,
    };

    const isModal = value.presentation === 'modal';

    const className = useMemo(() => {
      const classes = ['screen-stack-item'];

      if (transitionStatus) {
        classes.push(`transition-${transitionStatus}`);
      }

      if (phase) {
        classes.push(`phase-${phase}`);
      }

      if (
        phase === 'active' ||
        transitionStatus === 'entered' ||
        transitionStatus === 'entering' ||
        transitionStatus === 'preEnter'
      ) {
        classes.push('active');
      }

      devLog('[ScreenStackItem] className', {
        key: item.key,
        path: item.path,
        phase,
        transitionStatus,
        className: classes.join(' '),
      });

      return classes.join(' ');
    }, [transitionStatus, phase, item.key, item.path]);

    return (
      <div
        style={{ flex: 1, ...style }}
        data-presentation={value.presentation}
        className={className}
        data-phase={phase}
        data-transition-status={transitionStatus}
      >
        {/* Overlay только для модалки */}
        {isModal && <div className="stack-modal-overlay" />}

        {/* Внутренний контейнер:
            - для модалки: stack-modal-container (будет анимироваться)
            - для обычного экрана: stack-screen-container (без спец. правил) */}
        <div
          className={
            isModal ? 'stack-modal-container' : 'stack-screen-container'
          }
        >
          <RouteLocalContext.Provider value={value}>
            <View style={[styles.flex, appearance?.screen]}>
              <item.component {...(item.passProps || {})} />
            </View>
          </RouteLocalContext.Provider>
        </div>
      </div>
    );
  }
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

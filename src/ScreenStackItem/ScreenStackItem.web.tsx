import type { ScreenStackItemProps } from './ScreenStackItem.types';
import { RouteLocalContext } from '../RouterContext';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useScreenStackItemsContext } from '../ScreenStack/ScreenStackContext';

const devLog = (_: string, __?: any) => {
  // if (false) {
  //   //if (typeof __DEV__ !== 'undefined' && __DEV__) {
  //   if (data !== undefined) {
  //     // eslint-disable-next-line no-console
  //     console.log(message, data);
  //   } else {
  //     // eslint-disable-next-line no-console
  //     console.log(message);
  //   }
  // }
};

export const ScreenStackItem = memo(
  ({ item, appearance, style }: ScreenStackItemProps) => {
    // Подписываемся только на itemsContext (по ключу) - оптимизация
    const itemsContext = useScreenStackItemsContext();
    const key = item.key; // Используем item.key напрямую

    const itemState = itemsContext.items[key];
    const presentationType = itemState?.presentationType;
    const animationType = itemState?.animationType;
    const phase = itemState?.phase;
    const transitionStatus = itemState?.transitionStatus;
    const zIndex = itemState?.zIndex ?? 0;
    const presentation = item.options?.stackPresentation ?? 'push';

    // Определяем является ли модалкой (для overlay и контейнера)
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

      // Стабильный класс типа экрана (presentation)
      // Например: 'push', 'modal', 'sheet', 'transparent-modal' и т.д.
      if (presentationType) {
        classes.push(presentationType);
      }

      // Динамический класс анимации
      // Например: 'push-enter', 'pop-exit', 'modal-enter', 'sheet-exit' и т.д.
      if (animationType) {
        classes.push(animationType);
      }

      // Классы transition статуса
      if (transitionStatus) {
        classes.push(`transition-${transitionStatus}`);
      }

      // Классы фазы
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

    // Объединяем стили: базовый, переданный через props, и zIndex из контекста
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
      // Нет данных в контексте — соблюдаем порядок хуков, но не рендерим элемент
      return null;
    }

    return (
      <div style={mergedStyle} className={className}>
        {/* Overlay для всех modal-типов (CSS решает видимость по классам presentation) */}
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
    // Кастомная функция сравнения для memo - ререндер только если изменился key
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

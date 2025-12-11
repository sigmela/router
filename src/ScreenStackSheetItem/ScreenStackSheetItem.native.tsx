import { ScreenStackItem as RNSScreenStackItem } from 'react-native-screens';
import { NativeSheetView, Commands } from '@sigmela/native-sheet';
import { RouteLocalContext, useRouter } from '../RouterContext';
import type { RouteLocalContextValue } from '../RouterContext';
import type { HistoryItem, SheetAppearance } from '../types';
import { memo, useRef, useEffect } from 'react';
import { StyleSheet } from 'react-native';

interface ScreenStackSheetItemProps {
  route: RouteLocalContextValue;
  appearance?: SheetAppearance;
  onDismissed: () => void;
  item: HistoryItem;
}

export const ScreenStackSheetItem = memo<ScreenStackSheetItemProps>((props) => {
  const { item, onDismissed, route, appearance } = props;
  const { convertModalToSheetForAndroid } = item.options || {};
  const headerConfig = { hidden: true };

  const ref = useRef<React.ComponentRef<typeof NativeSheetView>>(null);
  const router = useRouter();

  useEffect(() => {
    if (route.presentation === 'sheet') {
      router.registerSheetDismisser(item.key, () => {
        if (ref.current) {
          Commands.dismiss(ref.current);
        }
      });

      return () => router.unregisterSheetDismisser(item.key);
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSheetDismissed = () => {
    router.unregisterSheetDismisser(item.key);
    onDismissed();
  };

  return (
    <RNSScreenStackItem
      stackPresentation="transparentModal"
      headerConfig={headerConfig}
      style={StyleSheet.absoluteFill}
      key={`${item.key}-sheet-item`}
      contentStyle={styles.content}
      screenId={item.key}
      stackAnimation="none"
      onDismissed={onDismissed}
    >
      <NativeSheetView
        containerBackgroundColor={appearance?.backgroundColor}
        cornerRadius={appearance?.cornerRadius ?? 18}
        onDismissed={handleSheetDismissed}
        style={styles.flex}
        ref={ref}
        fullscreenTopInset={
          convertModalToSheetForAndroid
            ? (appearance?.androidFullScreenTopInset ?? 40)
            : undefined
        }
      >
        <RouteLocalContext.Provider value={route}>
          <item.component {...item.passProps} />
        </RouteLocalContext.Provider>
      </NativeSheetView>
    </RNSScreenStackItem>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    backgroundColor: 'transparent',
  },
});

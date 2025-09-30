import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TabBarProps } from '@sigmela/router';
import { memo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  type ImageSourcePropType,
} from 'react-native';

const isImageSource = (value: unknown): value is ImageSourcePropType => {
  if (value == null) return false;
  const valueType = typeof value;
  if (valueType === 'number') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (valueType === 'object') {
    const v = value as Record<string, unknown>;
    if ('uri' in v || 'width' in v || 'height' in v) return true;
  }
  return false;
};

export const CustomIosTabBar = memo<TabBarProps>(
  ({ tabs, activeIndex, onTabPress }) => {
    const insets = useSafeAreaInsets();

    return (
      <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
        {tabs.map((tab, index) => {
          const isActive = index === activeIndex;
          return (
            <Pressable
              key={tab.tabKey}
              style={styles.item}
              onPress={() => onTabPress(index)}
            >
              {isImageSource(tab.icon) ? (
                <Image
                  source={tab.icon}
                  style={[styles.icon, isActive && styles.iconActive]}
                  resizeMode="contain"
                />
              ) : null}
              <Text
                style={[styles.label, isActive && styles.labelActive]}
                numberOfLines={1}
              >
                {tab.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingHorizontal: 8,
    borderTopColor: '#c6c6c8',
    backgroundColor: '#ffffffee',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  icon: {
    width: 22,
    height: 22,
    tintColor: '#8e8e93',
    marginBottom: 2,
  },
  iconActive: {
    tintColor: '#007aff',
  },
  label: {
    fontSize: 10,
    color: '#8e8e93',
  },
  labelActive: {
    color: '#007aff',
    fontWeight: '600',
  },
});

export default CustomIosTabBar;

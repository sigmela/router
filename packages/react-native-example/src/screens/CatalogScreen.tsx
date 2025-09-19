import { Button, Text, View } from 'react-native';
import { router } from '../navigation/router';
import { useQueryParams } from '@sigmela/router';
import { StyleSheet } from 'react-native-unistyles';

export const CatalogScreen = () => {
  const { search, sort } = useQueryParams<{ search?: string; sort?: 'asc' | 'desc' }>();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Catalog</Text>
      <Text style={styles.text}>
        Search: {search ?? '—'} | Sort: {sort ?? '—'}
      </Text>
      <View style={styles.buttonRow}>
        <Button
          title="Open Product #1"
          onPress={() => router.navigate('/catalog/products/1?coupon=VIP')}
        />
        <Button
          title="Open Product #2 (replace)"
          onPress={() => router.replace('/catalog/products/2?coupon=SPRING')}
        />
      </View>
      <View style={styles.buttonRow}>
        <Button
          title="Apply filters"
          onPress={() => router.navigate('/catalog?search=chair&sort=asc')}
        />
        <Button
          title="Show Auth (global)"
          onPress={() => router.navigate('/auth?returnTo=/catalog')}
        />
        <Button title="Back" onPress={() => router.goBack()} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.gap(2.5),
  },
  title: {
    color: theme.colors.typography,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  text: { color: theme.colors.typography },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
}));

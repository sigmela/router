import { Button, StyleSheet, Text, View } from 'react-native';
import { useQueryParams, useRouter } from '@sigmela/router';

export const CatalogScreen = () => {
  const router = useRouter();
  const { search, sort } = useQueryParams<{
    search?: string;
    sort?: 'asc' | 'desc';
  }>();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Catalog</Text>
      <Text>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
});

import { Button, StyleSheet, Text, View } from 'react-native';
import { useParams, useQueryParams, useRouter } from '@sigmela/router';

type ProductParams = {
  productId: string;
  coupon?: string;
};

type ProductQuery = {
  coupon?: string;
};

export const ProductScreen = () => {
  const { productId } = useParams<ProductParams>();
  const { coupon } = useQueryParams<ProductQuery>();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Product {productId ?? '(unknown)'} </Text>
      <Text>Coupon: {coupon ?? '—'}</Text>
      <View style={styles.buttonRow}>
        <Button
          title="Replace with #7"
          onPress={() => router.replace('/catalog/products/7')}
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

    padding: 20,
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
});

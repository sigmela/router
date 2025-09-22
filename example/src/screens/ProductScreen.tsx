import { Button, StyleSheet, Text, View } from 'react-native';
import { useParams, useQueryParams, useRouter } from '@sigmela/router';
import { createController } from '@sigmela/router';

type ProductParams = {
  productId: string;
  coupon?: string;
};

type ProductQuery = {
  coupon?: string;
};

export const ProductController = createController<ProductParams>(
  (input, present) => {
    console.log('ProductController', input);
    setTimeout(() => {
      present();
    }, 1000);
  }
);

interface ProductScreenProps {
  test: string;
}

export const ProductScreen = (props: ProductScreenProps) => {
  const { test } = props;
  const { productId } = useParams<ProductParams>();
  const { coupon } = useQueryParams<ProductQuery>();
  const router = useRouter();

  console.log(test);

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
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
});

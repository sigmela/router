import { Button, Text, View } from 'react-native';
import { router } from '../navigation/router';
import { useParams, useQueryParams } from '@sigmela/router';
import { createController } from '@sigmela/router';
import { StyleSheet } from 'react-native-unistyles';

type ProductParams = {
  productId: string;
  coupon?: string;
};

type ProductQuery = {
  coupon?: string;
};

export const ProductController = createController<ProductParams>((input, present) => {
  console.log('ProductController', input);
  setTimeout(() => {
    present();
  }, 1000);
});

interface ProductScreenProps {
  test: string;
}

export const ProductScreen = (props: ProductScreenProps) => {
  const { test } = props;
  const { productId } = useParams<ProductParams>();
  const { coupon } = useQueryParams<ProductQuery>();

  console.log(test);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Product {productId ?? '(unknown)'} </Text>
      <Text style={styles.text}>Coupon: {coupon ?? '—'}</Text>
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

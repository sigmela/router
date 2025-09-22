import { Button, StyleSheet, Text, View } from 'react-native';
import { useParams, useRouter } from '@sigmela/router';

export const OrdersScreen = () => {
  const router = useRouter();
  const { year: yStr, month: mStr } = useParams<{
    year?: string;
    month?: string;
  }>();

  // Fallbacks if params are missing (e.g., tab seeded without params)
  const now = new Date();
  let y = Number(yStr ?? now.getFullYear());
  let m = Number(mStr ?? now.getMonth() + 1);
  if (!Number.isFinite(y) || y <= 0) y = now.getFullYear();
  if (!Number.isFinite(m) || m < 1 || m > 12) m = now.getMonth() + 1;

  const pad = (n: number) => String(n).padStart(2, '0');
  const label = `${y}-${pad(m)}`;

  const go = (yy: number, mm: number) =>
    router.navigate(`/orders/${yy}/${pad(mm)}`);

  const prev = () => {
    const mm = m - 1;
    if (mm < 1) go(y - 1, 12);
    else go(y, mm);
  };

  const next = () => {
    const mm = m + 1;
    if (mm > 12) go(y + 1, 1);
    else go(y, mm);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Orders {label}</Text>
      <View style={styles.row}>
        <Button title="Prev month" onPress={prev} />
        <Button title="Next month" onPress={next} />
      </View>
      <Button title="Back" onPress={() => router.goBack()} />
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
  row: { flexDirection: 'row', gap: 12, marginVertical: 12 },
});

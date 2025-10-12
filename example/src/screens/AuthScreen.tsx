import { Button, StyleSheet, Text, View } from 'react-native';
import { useRouter } from '@sigmela/router';

export const AuthScreen = () => {
  const router = useRouter();
  return (
    <>
      <View testID="sheet-header" style={styles.header}>
        <Text>Header</Text>
      </View>
      <View testID="sheet-content" style={styles.screen}>
        <Text style={styles.title}>Sign in</Text>
        <View style={styles.buttonRow}>
          <Button title="Close" onPress={() => router.goBack()} />
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    height: 400,
  },
  header: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
});

import { Button, StyleSheet, Text, View } from 'react-native';
import { useRouter } from '@sigmela/router';

export const AuthScreen = () => {
  const router = useRouter();
  return (
    <View style={styles.screen} testID="sheet-content">
      <Text style={styles.title}>Sign in</Text>
      <View style={styles.buttonRow}>
        <Button title="Close" onPress={() => router.goBack()} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
});

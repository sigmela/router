import { Button, StyleSheet, Text, View } from 'react-native';
import { router } from '../navigation/router';

export const AuthScreen = () => {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Sign in</Text>
      <View style={styles.buttonRow}>
        <Button title="Close" onPress={() => router.goBack()} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
});



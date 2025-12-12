import { Button, StyleSheet, Text, View } from 'react-native';
import { useRouter } from '@sigmela/router';

export const MailListScreen = () => {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Mail</Text>
      <Text style={styles.subtitle}>Select a thread</Text>

      <View style={styles.buttonRow}>
        <Button
          title="Open thread #1"
          onPress={() => router.navigate('/mail/1')}
        />
        <Button
          title="Open thread #2"
          onPress={() => router.navigate('/mail/2')}
        />
      </View>

      <View style={styles.buttonRow}>
        <Button
          title="Replace with thread #3"
          onPress={() => router.replace('/mail/3')}
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
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
});

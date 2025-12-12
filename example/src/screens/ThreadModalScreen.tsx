import { Button, StyleSheet, Text, View } from 'react-native';
import { useParams, useRouter } from '@sigmela/router';

type ThreadParams = {
  threadId: string;
};

export const ThreadModalScreen = () => {
  const router = useRouter();
  const { threadId } = useParams<ThreadParams>();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Modal in thread {threadId}</Text>
      <Text style={styles.subtitle}>This modal is pushed from secondary stack</Text>

      <View style={styles.buttonRow}>
        <Button title="Close" onPress={() => router.goBack()} />
        <Button title="Go to info" onPress={() => router.navigate(`/mail/${threadId}/info`)} />
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

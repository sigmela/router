import { Button, StyleSheet, Text, View } from 'react-native';
import { useParams, useRouter } from '@sigmela/router';

type ThreadParams = {
  threadId: string;
};

export const ThreadInfoScreen = () => {
  const router = useRouter();
  const { threadId } = useParams<ThreadParams>();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Thread {threadId} info</Text>
      <Text style={styles.subtitle}>
        This is a deeper screen in secondary stack
      </Text>

      <View style={styles.buttonRow}>
        <Button title="Back" onPress={() => router.goBack()} />
        <Button
          title="Go to thread #2"
          onPress={() => router.replace('/mail/2/info')}
        />
        <Button
          title="Open modal"
          onPress={() => router.navigate(`/mail/${threadId}/modal`)}
        />
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

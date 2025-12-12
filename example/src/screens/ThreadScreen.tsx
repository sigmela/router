import { Button, StyleSheet, Text, View } from 'react-native';
import { useParams, useRouter } from '@sigmela/router';

type ThreadParams = {
  threadId: string;
};

export const ThreadScreen = () => {
  const router = useRouter();
  const { threadId } = useParams<ThreadParams>();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Thread {threadId ?? '(unknown)'}</Text>

      <View style={styles.buttonRow}>
        <Button title="Open #1" onPress={() => router.replace('/mail/1')} />
        <Button title="Open #2" onPress={() => router.replace('/mail/2')} />
      </View>

      <View style={styles.buttonRow}>
        <Button
          title="Open info"
          onPress={() => router.navigate(`/mail/${threadId}/info`)}
        />
        <Button
          title="Open modal"
          onPress={() => router.navigate(`/mail/${threadId}/modal`)}
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

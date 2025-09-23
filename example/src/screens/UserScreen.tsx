import { Button, StyleSheet, Text, View } from 'react-native';
import { useParams, useRouter } from '@sigmela/router';

export const UserScreen = () => {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>User {userId}</Text>
      <Button
        title="Open details"
        onPress={() => router.navigate(`/users/${userId}/details`)}
      />
    </View>
  );
};

export const UserDetailsScreen = () => {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Details of {userId}</Text>
      <Button title="Back" onPress={() => router.goBack()} />
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
});

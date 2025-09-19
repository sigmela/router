import { Button, Text, View } from 'react-native';
import { useParams } from '@sigmela/router';
import { router } from '../navigation/router';
import { StyleSheet } from 'react-native-unistyles';

export const UserScreen = () => {
  const { userId } = useParams<{ userId: string }>();
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
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Details of {userId}</Text>
      <Button title="Back" onPress={() => router.goBack()} />
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
}));

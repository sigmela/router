import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export const ChatScreen = () => {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Chat</Text>
      <Text style={styles.subtitle}>Your messages appear here</Text>
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
  subtitle: {
    color: theme.colors.muted,
    fontSize: 16,
    marginBottom: 20,
  },
}));

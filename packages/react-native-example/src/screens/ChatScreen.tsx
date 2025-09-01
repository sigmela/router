import { StyleSheet, Text, View } from 'react-native';

export const ChatScreen = () => (
  <View style={styles.screen}>
    <Text style={styles.title}>Chat</Text>
    <Text style={styles.subtitle}>Your messages appear here</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
});

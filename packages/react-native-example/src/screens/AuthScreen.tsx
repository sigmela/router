import { Button, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
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
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
}));

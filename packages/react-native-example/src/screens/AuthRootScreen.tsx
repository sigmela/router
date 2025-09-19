import { Button, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { router } from '../navigation/router';
import { tabBar } from '../navigation/tabBar';

export const AuthRootScreen = () => {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Please sign in</Text>
      <Button
        title="Login"
        onPress={() => router.setRoot(tabBar, { transition: 'fade' })}
      />
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
    marginBottom: 16,
  },
}));

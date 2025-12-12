import { Button, StyleSheet, Text, View } from 'react-native';
import { useRouter } from '@sigmela/router';

export const AuthRootScreen = () => {
  const router = useRouter();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Please sign in</Text>
      <Button
        title="Login"
        onPress={() => {
          router.setRoot('app', { transition: 'fade' });
        }}
      />
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
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
});

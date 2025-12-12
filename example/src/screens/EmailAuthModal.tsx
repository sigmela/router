import { Button, StyleSheet, Text, View } from 'react-native';
import { useRouter } from '@sigmela/router';

export const EmailAuthModal = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EmailAuthModal</Text>
      <Button title="Go Back" onPress={() => router.goBack()} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

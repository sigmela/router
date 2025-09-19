import { Button, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useTabBar } from '@sigmela/router';
import { router } from '../navigation/router';
import { authStack } from '../navigation/stacks';
import { StyleSheet } from 'react-native-unistyles';

export const ProfileScreen = () => {
  const [notificationCount, setNotificationCount] = useState(0);
  const tabBar = useTabBar();

  useEffect(() => {
    const interval = setInterval(() => {
      const count = Math.floor(Math.random() * 10);
      setNotificationCount(count);
      tabBar.setBadge(3, count > 0 ? count.toString() : null);
    }, 3000);

    return () => clearInterval(interval);
  }, [tabBar]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Auto-updating badge every 3 seconds</Text>
      <Text style={styles.text}>Current notifications: {notificationCount}</Text>
      <View style={{ height: 12 }} />
      <Button title="Logout" onPress={() => router.setRoot(authStack, { transition: 'slide_from_right' })} />
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
  text: { color: theme.colors.typography },
}));

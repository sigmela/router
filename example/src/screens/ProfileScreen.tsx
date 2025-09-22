import { Button, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useTabBar, useRouter } from '@sigmela/router';
import { authStack } from '../navigation/stacks';

export const ProfileScreen = () => {
  const [notificationCount, setNotificationCount] = useState(0);
  const router = useRouter();
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
      <Text>Current notifications: {notificationCount}</Text>
      <View style={{ height: 12 }} />
      <Button
        title="Logout"
        onPress={() =>
          router.setRoot(authStack, { transition: 'slide_from_right' })
        }
      />
    </View>
  );
};

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

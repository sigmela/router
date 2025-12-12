import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTabBar, useRouter } from '@sigmela/router';
import { useState } from 'react';

export const HomeScreen = () => {
  const [messageCount, setMessageCount] = useState(5);
  const router = useRouter();
  const tabBar = useTabBar();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView>
        <View style={styles.screen}>
          <Text style={styles.title}>Home</Text>
          <Text style={styles.subtitle}>Dynamic Badge Example</Text>

          <View style={styles.section}>
            <Text>Messages Badge: {messageCount}</Text>
            <View style={styles.buttonRow}>
              <Button
                title="Add Message"
                onPress={() => {
                  const newCount = messageCount + 1;
                  setMessageCount(newCount);
                  tabBar.setBadge(2, newCount.toString());
                }}
              />
              <Button
                title="Clear Badge"
                onPress={() => {
                  setMessageCount(0);
                  tabBar.setBadge(2, null);
                }}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text>Navigation Examples</Text>
            <View style={styles.buttonRow}>
              <Button
                title="Open Catalog"
                onPress={() => router.navigate('/catalog')}
              />
              <Button
                title="Open Mail"
                onPress={() => router.navigate('/mail')}
              />
              <Button
                title="Open Product #42"
                onPress={() => router.navigate('/catalog/products/42')}
              />
            </View>
            <View style={styles.buttonRow}>
              <Button
                title="Go Settings tab"
                onPress={() => router.navigate('/settings')}
              />
              <Button
                title="Show Auth (global)"
                onPress={() => router.navigate('/auth')}
              />
              <Button title="Back" onPress={() => router.goBack()} />
            </View>
            <View style={styles.buttonRow}>
              <Button
                title="Logout (switch root)"
                onPress={() => router.setRoot('auth', { transition: 'fade' })}
              />
            </View>
          </View>
        </View>

        {Array.from({ length: 100 }).map((_, index) => (
          <View key={index} style={styles.screen}>
            <Text key={index}>{index}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    // flex: 1,
    alignItems: 'center',
    justifyContent: 'center',

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
  section: {
    marginTop: 20,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
});

import { Button, ScrollView, Text, View } from 'react-native';
import { useTabBar } from '@sigmela/router';
import { router } from '../navigation/router';
import { useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';

export const HomeScreen = () => {
  const [messageCount, setMessageCount] = useState(5);
  const tabBar = useTabBar();

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.screen}>
          <Text style={styles.title}>Home</Text>
          <Text style={styles.subtitle}>Dynamic Badge Example</Text>

          <View style={styles.section}>
            <Text style={styles.text}>Messages Badge: {messageCount}</Text>
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
            <Text style={styles.text}>Navigation Examples</Text>
            <View style={styles.buttonRow}>
              <Button title="Open Catalog" onPress={() => router.navigate('/catalog')} />
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
          </View>
        </View>

        {Array.from({ length: 100 }).map((_, index) => (
          <View key={index} style={styles.screen}>
            <Text key={index} style={styles.text}>
              {index}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  screen: {
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
  section: {
    marginTop: 20,
    padding: 20,
    backgroundColor: theme.colors.card,
    borderRadius: 10,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
}));

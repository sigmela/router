import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTabBar } from '@sigmela/router';
import { useState } from 'react';

export const SettingsScreen = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const tabBar = useTabBar();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Dynamic Style Example</Text>

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <Text>Dark Mode</Text>
          <Switch
            value={darkMode}
            onValueChange={value => {
              setDarkMode(value);
              tabBar.setTabBarStyle({
                backgroundColor: value ? '#1c1c1e' : '#ffffff',
              });
              tabBar.setTabBarConfig({
                tabBarActiveTintColor: value ? '#0A84FF' : '#007AFF',
                tabBarInactiveTintColor: value ? '#8E8E93' : '#999999',
              });
            }}
          />
        </View>

        <View style={styles.settingRow}>
          <Text>Large Text</Text>
          <Switch
            value={largeText}
            onValueChange={value => {
              setLargeText(value);
              tabBar.setTabItemStyle({
                fontSize: value ? 22 : 12,
                fontWeight: value ? '700' : '600',
              });
            }}
          />
        </View>
      </View>
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
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
});

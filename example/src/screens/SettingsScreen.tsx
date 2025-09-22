import { StyleSheet, Switch, Text, View } from 'react-native';
import { useAppearance } from '../contexts/AppearanceContext';

export const SettingsScreen = () => {
  const { isDarkMode, isLargeText, toggleDarkMode, toggleLargeText } =
    useAppearance();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Dynamic Appearance Example</Text>

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <Text>Dark Mode</Text>
          <Switch value={isDarkMode} onValueChange={toggleDarkMode} />
        </View>

        <View style={styles.settingRow}>
          <Text>Large Text</Text>
          <Switch value={isLargeText} onValueChange={toggleLargeText} />
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

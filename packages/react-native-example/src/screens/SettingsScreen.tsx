import { Switch, Text, View } from 'react-native';
import { useAppearance } from '../contexts/AppearanceContext';
import { StyleSheet } from 'react-native-unistyles';

export const SettingsScreen = () => {
  const { isDarkMode, isLargeText, toggleDarkMode, toggleLargeText } = useAppearance();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Dynamic Appearance Example</Text>

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <Text style={styles.text}>Dark Mode</Text>
          <Switch value={isDarkMode} onValueChange={toggleDarkMode} />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.text}>Large Text</Text>
          <Switch value={isLargeText} onValueChange={toggleLargeText} />
        </View>
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
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
}));

import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from '@sigmela/router';

/**
 * First screen of the Email Verification modal stack.
 * Demonstrates navigation inside a modal with a simple "Next" button.
 */
export const EmailVerifyInputScreen = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header with close button */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.title}>Verify Email</Text>
        <TouchableOpacity
          onPress={() => router.dismiss()}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.description}>
          This is the first screen of the modal stack.
        </Text>
        <Text style={styles.description}>
          Tap "Next" to navigate to the second screen inside this modal.
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            title="Next"
            onPress={() => router.navigate('/verify/sent')}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 24,
    width: 200,
  },
});

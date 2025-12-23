import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from '@sigmela/router';

/**
 * Second screen of the Email Verification modal stack.
 * Shows confirmation that the email was sent.
 * Demonstrates goBack() within modal and dismiss() to close entire modal.
 */
export const EmailVerifySentScreen = () => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header with back and close buttons */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Check Your Inbox</Text>
        <TouchableOpacity
          onPress={() => router.dismiss()}
          style={styles.closeButton}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📧</Text>
        </View>

        <Text style={styles.heading}>Email Sent!</Text>

        <Text style={styles.description}>
          We've sent a verification link to your email address.
          {'\n\n'}
          Please check your inbox and click the link to verify your account.
        </Text>

        <View style={styles.buttonContainer}>
          <Button title="Done" onPress={() => router.dismiss()} />
        </View>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the email? </Text>
          <TouchableOpacity onPress={() => router.goBack()}>
            <Text style={styles.resendLink}>Try again</Text>
          </TouchableOpacity>
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
  backButton: {
    paddingVertical: 8,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
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
    alignItems: 'center',
  },
  iconContainer: {
    marginTop: 40,
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 24,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#666',
  },
  resendLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});

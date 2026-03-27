import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Typography variant="headlineMd">
          {user?.displayName ? `Hi, ${user.displayName}` : 'Dashboard'}
        </Typography>
      </View>

      <View style={styles.section}>
        <Typography variant="titleMd" color="onSurfaceVariant">
          My Daily Stack
        </Typography>
        <Typography variant="bodyLg" color="onSurfaceVariant" style={styles.empty}>
          No scheduled medications yet. Tap + to add one.
        </Typography>
      </View>

      <View style={styles.section}>
        <Typography variant="titleMd" color="onSurfaceVariant">
          One-Time Tracking
        </Typography>
        <Typography variant="bodyLg" color="onSurfaceVariant" style={styles.empty}>
          No pills being tracked right now.
        </Typography>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[6],
  },
  header: {
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  section: {
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  empty: {
    paddingVertical: spacing[8],
    textAlign: 'center',
  },
});

import { View, StyleSheet } from 'react-native';
import { Typography, Button } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Typography variant="headlineLg" align="center">
          Welcome to HalfLifeControl
        </Typography>
        <Typography
          variant="bodyLg"
          color="onSurfaceVariant"
          align="center"
          style={styles.subtitle}
        >
          Track your medications and know exactly how long they stay in your system.
        </Typography>
      </View>

      <View style={styles.actions}>
        <Button
          title="I take pills on a schedule"
          onPress={() => {
            // TODO: Navigate to drug search / pill stack setup
            router.replace('/(main)/dashboard');
          }}
        />
        <Button
          title="Just track a pill I took"
          variant="outline"
          onPress={() => router.replace('/(main)/dashboard')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[24],
    paddingBottom: spacing[10],
  },
  content: {
    alignItems: 'center',
    gap: spacing[4],
  },
  subtitle: {
    maxWidth: 300,
  },
  actions: {
    gap: spacing[4],
  },
});

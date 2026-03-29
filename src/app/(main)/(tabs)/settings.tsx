import React from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '@/components/ui';
import { Card } from '@/components/ui/Card';
import { colors, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { signOut } from '@/services/firebase/auth';

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Typography variant="headlineMd">Settings</Typography>

        {/* Account card */}
        <Card variant="elevated">
          <Typography variant="titleMd">Account</Typography>
          <Typography variant="bodyMd" color="onSurfaceVariant" style={styles.email}>
            {user?.email ?? 'Not signed in'}
          </Typography>
        </Card>

        {/* Legal */}
        <Card variant="elevated">
          <Pressable style={styles.settingRow}>
            <Typography variant="bodyLg">Terms of Service</Typography>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.settingRow}>
            <Typography variant="bodyLg">Privacy Policy</Typography>
          </Pressable>
        </Card>

        {/* Sign out */}
        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <Typography variant="labelLg" color="error">
            Sign Out
          </Typography>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    gap: spacing[5],
  },
  email: {
    marginTop: spacing[1],
  },
  settingRow: {
    paddingVertical: spacing[3],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.outlineVariant,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    backgroundColor: colors.errorContainer,
    borderRadius: borderRadius.lg,
    marginTop: spacing[4],
  },
});

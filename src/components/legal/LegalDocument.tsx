import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography, ScreenHeader } from '@/components/ui';
import { colors, spacing } from '@/theme';

export type LegalDocType = 'terms' | 'privacy';

const LEGAL_CONTENT: Record<string, { title: string; body: string }> = {
  terms: {
    title: 'Terms of Service',
    body:
      'Last updated: November 2026\n\n' +
      '1. About this app\n' +
      'HalfLifeControl is a demonstration app built as a software portfolio project. ' +
      'It is not a commercial product and is not distributed through public app stores.\n\n' +
      '2. Not medical advice\n' +
      'HalfLifeControl estimates how long a medication stays in your body using standard ' +
      'half-life math and typical reference values. Real-world absorption and elimination vary ' +
      'with age, weight, liver and kidney function, other medications and many other factors. ' +
      'The timers, reminders and history are informational only. Never change, skip or double a ' +
      'dose based on this app — follow your doctor\'s or pharmacist\'s instructions.\n\n' +
      '3. Your account\n' +
      'You are responsible for the accuracy of what you enter and for keeping your sign-in ' +
      'credentials private.\n\n' +
      '4. Subscriptions\n' +
      'Pro plans are offered for demonstration through test purchases. Any real billing would be ' +
      'handled by Google Play or the App Store under their terms.\n\n' +
      '5. No warranty\n' +
      'The app is provided "as is", without warranties of any kind. Features may change or be ' +
      'removed, and the service may be unavailable at times.\n\n' +
      '6. Changes\n' +
      'These terms may be updated as the project evolves. Continuing to use the app means you ' +
      'accept the current version.',
  },
  privacy: {
    title: 'Privacy Policy',
    body:
      'Last updated: November 2026\n\n' +
      'What we store\n' +
      '• Account: your email address, and your name if you sign in with Google.\n' +
      '• Medications: the pills you add, their schedules, and the doses you record.\n' +
      '• Settings: your reminder and notification preferences.\n\n' +
      'Where it lives\n' +
      'Data is stored with Supabase, our database provider, and protected so each account can ' +
      'only read its own records. A copy is kept on your device, encrypted, so the app works ' +
      'offline. Sign-in tokens are kept in the device\'s secure storage.\n\n' +
      'Services we use\n' +
      '• Supabase — accounts and data storage.\n' +
      '• Google — only if you choose "Sign in with Google".\n' +
      '• RevenueCat — subscription status, linked to your account ID.\n' +
      '• Sentry — crash reports (error details, device type, your account ID and email) so bugs can be fixed.\n' +
      '• openFDA — drug-name searches are sent to the U.S. FDA public database, without your account details.\n\n' +
      'What we don\'t do\n' +
      'We do not sell your data, show ads, or share your medication information with anyone.\n\n' +
      'Notifications\n' +
      'Reminders are scheduled on your device. You can turn them off in Settings at any time.\n\n' +
      'Deleting your data\n' +
      'Deleting a pill removes it from your stack. To delete your whole account and its data, ' +
      'contact the developer and it will be removed.',
  },
};

interface LegalDocumentProps {
  type?: string;
  onBack: () => void;
}

/**
 * Terms / Privacy page body. Rendered by two routes: `app/legal.tsx` (root,
 * reachable while signed out from Register) and `(main)/(tabs)/policies.tsx`
 * (from Settings, so the bottom tab bar stays visible).
 */
export function LegalDocument({ type, onBack }: LegalDocumentProps) {
  const content = LEGAL_CONTENT[type ?? ''] ?? LEGAL_CONTENT.terms;
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={content.title} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Typography variant="bodyLg" color="onSurface" style={styles.body}>
          {content.body}
        </Typography>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
  },
  body: {
    lineHeight: 24,
  },
});

import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Typography } from '@/components/ui';
import { colors, spacing } from '@/theme';

const LEGAL_CONTENT: Record<string, { title: string; body: string }> = {
  terms: {
    title: 'Terms of Service',
    body:
      'Terms of Service content has not been configured yet.\n\n' +
      'The app developer needs to provide the actual Terms of Service text. ' +
      'Please check back later or contact the developer for more information.\n\n' +
      'To add your Terms of Service, edit src/app/legal.tsx and replace this placeholder text.',
  },
  privacy: {
    title: 'Privacy Policy',
    body:
      'Privacy Policy content has not been configured yet.\n\n' +
      'The app developer needs to provide the actual Privacy Policy text. ' +
      'Please check back later or contact the developer for more information.\n\n' +
      'To add your Privacy Policy, edit src/app/legal.tsx and replace this placeholder text.',
  },
};

export default function LegalScreen() {
  const router = useRouter();
  const { type, from } = useLocalSearchParams<{ type: string; from?: string }>();
  const content = LEGAL_CONTENT[type ?? ''] ?? LEGAL_CONTENT.terms;

  // legal.tsx lives at the root route (parallel to (main) and (auth)) so it's
  // reachable from both the Register screen and Settings. router.back() at this
  // depth can fall through to the root (dashboard) when the route stack hasn't
  // captured the entry. Using the `from` param dispatches us back to the exact
  // origin, which is the user's expectation.
  const handleBack = () => {
    if (from === 'settings') {
      router.replace('/(main)/(tabs)/settings');
    } else if (from === 'register') {
      router.replace('/(auth)/register');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(main)/(tabs)/settings');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Typography variant="bodyLg" color="primary">Back</Typography>
          </Pressable>
          <Typography variant="titleLg">{content.title}</Typography>
          <View style={{ width: 40 }} />
        </View>

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
    paddingBottom: spacing[24],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
    marginBottom: spacing[4],
  },
  body: {
    lineHeight: 24,
  },
});

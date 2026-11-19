import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LegalDocument } from '@/components/legal/LegalDocument';

/**
 * Terms / Privacy opened from Settings. Lives in the tab navigator (hidden
 * from the bar, like the paywall) so the bottom menu stays visible; tabs use
 * backBehavior="history", so back returns to Settings.
 */
export default function SettingsLegalScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();
  return <LegalDocument type={type} onBack={() => router.back()} />;
}

import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LegalDocument } from '@/components/legal/LegalDocument';

/**
 * Root-level legal route for signed-out users (Register's Terms / Privacy
 * links). Signed-in users open `(main)/(tabs)/policies` from Settings instead,
 * which keeps the tab bar. A root route has no reliable back stack from
 * Register, so `from` says where to return.
 */
export default function LegalScreen() {
  const router = useRouter();
  const { type, from } = useLocalSearchParams<{ type: string; from?: string }>();

  const handleBack = () => {
    if (from === 'register') {
      router.replace('/(auth)/register');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/login');
    }
  };

  return <LegalDocument type={type} onBack={handleBack} />;
}

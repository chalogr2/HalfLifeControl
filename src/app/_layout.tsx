import { useEffect, useCallback } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { usePillStore } from '@/stores/usePillStore';
import { onAuthChanged, getUserProfile, getSession } from '@/services/supabase/auth';
import { clearUserCache } from '@/services/cache';
import {
  initSentry,
  setSentryUser,
  clearSentryUser,
  wrapRootComponent,
} from '@/services/sentry';
import { colors } from '@/theme';

// Initialize Sentry as early as possible
initSentry();

SplashScreen.preventAutoHideAsync();

function useSupabaseAuthListener() {
  const { setUser, setLoading } = useAuthStore();
  const initSubscriptions = useSubscriptionStore((s) => s.init);
  const resetSubscriptions = useSubscriptionStore((s) => s.reset);
  const initPills = usePillStore((s) => s.init);
  const resetPills = usePillStore((s) => s.reset);

  useEffect(() => {
    // Hydrate from persisted session on cold start
    (async () => {
      try {
        const session = await getSession();
        if (session) {
          const profile = await getUserProfile(session.userId);
          setUser(profile);
          setSentryUser(session.userId, profile.email);
          initSubscriptions(session.userId);
          initPills(session.userId);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    })();

    // Listen for future auth state changes (sign-in, sign-out, token refresh)
    const unsubscribe = onAuthChanged(async (userId) => {
      if (userId) {
        try {
          const profile = await getUserProfile(userId);
          setUser(profile);
          setSentryUser(userId, profile.email);
          initSubscriptions(userId);
          initPills(userId);
        } catch {
          setUser(null);
          clearSentryUser();
        }
      } else {
        setUser(null);
        resetPills();
        resetSubscriptions();
        clearSentryUser();
      }
    });
    return unsubscribe;
  }, []);
}

function AuthGate() {
  useSupabaseAuthListener();

  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inLegalScreen = segments[0] === 'legal';

    if (!isAuthenticated && !inAuthGroup && !inLegalScreen) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      if (user && !user.onboardingComplete) {
        router.replace('/(onboarding)/welcome');
      } else {
        router.replace('/(main)/(tabs)/dashboard');
      }
    } else if (isAuthenticated && inOnboardingGroup && user?.onboardingComplete) {
      // User completed onboarding (e.g. added first pill) — redirect to dashboard
      router.replace('/(main)/(tabs)/dashboard');
    }
  }, [isAuthenticated, isLoading, segments]);

  return <Slot />;
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Lexend: require('../../assets/fonts/Lexend-Regular.ttf'),
    'Lexend-Light': require('../../assets/fonts/Lexend-Light.ttf'),
    'Lexend-Medium': require('../../assets/fonts/Lexend-Medium.ttf'),
    'Lexend-SemiBold': require('../../assets/fonts/Lexend-SemiBold.ttf'),
    'Lexend-Bold': require('../../assets/fonts/Lexend-Bold.ttf'),
    PlusJakartaSans: require('../../assets/fonts/PlusJakartaSans-Regular.ttf'),
    'PlusJakartaSans-Light': require('../../assets/fonts/PlusJakartaSans-Light.ttf'),
    'PlusJakartaSans-Medium': require('../../assets/fonts/PlusJakartaSans-Medium.ttf'),
    'PlusJakartaSans-SemiBold': require('../../assets/fonts/PlusJakartaSans-SemiBold.ttf'),
    'PlusJakartaSans-Bold': require('../../assets/fonts/PlusJakartaSans-Bold.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="dark" />
      <AuthGate />
    </GestureHandlerRootView>
  );
}

export default wrapRootComponent(RootLayout);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});

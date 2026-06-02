import { useEffect, useCallback } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, StyleSheet } from 'react-native';
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
          const profile = await getUserProfile(session.userId, {
            email: session.email,
          });
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
          // No fallback here: signIn/signUp already self-heal with the
          // freshly-authenticated user data. By the time onAuthStateChange
          // fires, the profile row is guaranteed to exist.
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

  // Foreground sweep: any one-time tracking pill whose dose finished while
  // the app was backgrounded should disappear before the user sees it. Lives
  // here (root) instead of dashboard.tsx so it runs regardless of which tab
  // is mounted when the user comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const uid = useAuthStore.getState().user?.uid;
      if (!uid) return;
      usePillStore.getState().cleanupOrphanedRandomPills(uid).catch(() => {});
      usePillStore.getState().reconcileAutoAssumedDoses(uid).catch(() => {});
      // Re-pull subscription tier in case it changed (other device / webhook)
      // while we were backgrounded.
      useSubscriptionStore.getState().refreshTier().catch(() => {});
    });
    return () => sub.remove();
  }, []);

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
  const [fontsLoaded, fontError] = useFonts({
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

  useEffect(() => {
    if (fontError) {
      console.error('[Fonts] Failed to load custom fonts:', fontError);
    }
  }, [fontError]);

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

import { useEffect, useCallback } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { onAuthChanged, getUserProfile } from '@/services/firebase/auth';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

function useFirebaseAuthListener() {
  const { setUser, setLoading } = useAuthStore();
  const initSubscriptions = useSubscriptionStore((s) => s.init);

  useEffect(() => {
    const unsubscribe = onAuthChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          setUser(profile);
          // Initialize RevenueCat with the user's ID
          initSubscriptions(firebaseUser.uid);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);
}

function AuthGate() {
  useFirebaseAuthListener();

  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      if (user && !user.onboardingComplete) {
        router.replace('/(onboarding)/welcome');
      } else {
        router.replace('/(main)/(tabs)/dashboard');
      }
    }
  }, [isAuthenticated, isLoading, segments]);

  return <Slot />;
}

export default function RootLayout() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});

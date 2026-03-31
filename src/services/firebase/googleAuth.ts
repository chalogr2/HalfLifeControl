/**
 * Google Sign-In integration using @react-native-google-signin
 * with Firebase JS SDK credential exchange.
 */
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import { getUserProfile } from './auth';
import type { UserProfile } from '@/core/types';

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    console.warn('[GoogleAuth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not set — Google Sign-In disabled');
    return;
  }
  GoogleSignin.configure({ webClientId });
  configured = true;
}

/**
 * Sign in with Google. Creates a Firestore user profile if this is the
 * user's first sign-in.
 */
export async function signInWithGoogle(): Promise<UserProfile> {
  ensureConfigured();
  if (!configured) {
    throw new Error('Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env');
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  if (!response.data?.idToken) {
    throw new Error('Google Sign-In failed — no ID token received');
  }

  const credential = GoogleAuthProvider.credential(response.data.idToken);
  const { user } = await signInWithCredential(auth, credential);

  // Check if user profile already exists in Firestore
  const profileDoc = await getDoc(doc(db, 'users', user.uid));

  if (profileDoc.exists()) {
    return getUserProfile(user.uid);
  }

  // First-time Google sign-in: create Firestore profile
  const profile: Omit<UserProfile, 'uid'> = {
    email: user.email!,
    displayName: user.displayName ?? null,
    onboardingComplete: false,
    subscriptionTier: 'free',
    settings: {
      autoAssumeTaken: false,
      notificationsEnabled: true,
      reminderMode: 'auto_start',
    },
  };

  await setDoc(doc(db, 'users', user.uid), {
    ...profile,
    createdAt: serverTimestamp(),
  });

  return { uid: user.uid, ...profile };
}

/**
 * Check if the Google Sign-In error was a user cancellation.
 */
export function isGoogleCancellation(error: unknown): boolean {
  return isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED;
}

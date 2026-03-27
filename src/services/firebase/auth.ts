import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';
import type { UserProfile } from '@/core/types';

export async function signUp(email: string, password: string): Promise<UserProfile> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);

  const profile: Omit<UserProfile, 'uid'> = {
    email: user.email!,
    displayName: null,
    onboardingComplete: false,
    subscriptionTier: 'free',
    settings: {
      autoAssumeTaken: false,
      notificationsEnabled: true,
    },
  };

  await setDoc(doc(db, 'users', user.uid), {
    ...profile,
    createdAt: serverTimestamp(),
  });

  return { uid: user.uid, ...profile };
}

export async function signIn(email: string, password: string): Promise<UserProfile> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return getUserProfile(user.uid);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function getUserProfile(uid: string): Promise<UserProfile> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    throw new Error('User profile not found');
  }
  const data = snap.data();
  return {
    uid,
    email: data.email,
    displayName: data.displayName ?? null,
    onboardingComplete: data.onboardingComplete ?? false,
    subscriptionTier: data.subscriptionTier ?? 'free',
    settings: data.settings ?? {
      autoAssumeTaken: false,
      notificationsEnabled: true,
    },
  };
}

export function onAuthChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

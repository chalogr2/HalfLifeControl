export { auth, db } from './config';
export {
  signUp,
  signIn,
  signOut,
  resetPassword,
  getUserProfile,
  onAuthChanged,
  completeOnboarding,
  updateUserSettings,
  updateSubscriptionTier,
} from './auth';
export {
  loadDashboard,
  addPill,
  updatePill,
  deletePill,
  recordDose,
  updateDoseStatus,
  fetchDoseHistory,
  fetchDosesByDateRange,
  initializeDashboardIfNeeded,
} from './pills';
export { signInWithGoogle, isGoogleCancellation } from './googleAuth';

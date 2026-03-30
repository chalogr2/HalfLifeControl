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
} from './auth';
export {
  addPill,
  updatePill,
  deletePill,
  fetchPills,
  subscribePills,
  recordDose,
  updateDoseStatus,
  fetchActiveDoses,
  subscribeActiveDoses,
  fetchDoseHistory,
  fetchDosesByDateRange,
} from './pills';
export type { DoseHistoryPage } from './pills';

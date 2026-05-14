export { supabase } from './config';
export {
  signUp,
  signIn,
  signOut,
  resetPassword,
  getUserProfile,
  onAuthChanged,
  getSession,
  completeOnboarding,
  updateUserSettings,
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

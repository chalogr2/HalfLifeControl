-- Lock profiles.subscription_tier to service-role writes.
--
-- Until now, the row-level `profiles_own` policy let any authenticated
-- user UPDATE their own profile row including subscription_tier. That
-- meant a tampered client (or someone with a captured JWT) could
-- PostgREST themselves into 'pro' with a single SQL-equivalent UPDATE.
--
-- The revenuecat-webhook Edge Function (Stage 2) is now the only
-- legitimate writer to this column. It uses the service_role key, which
-- bypasses RLS entirely, so revoking authenticated's UPDATE privilege
-- here does NOT break the webhook path -- it only closes the bypass.
--
-- SELECT is left intact: the client still needs to read the column on
-- profile load (it's exposed in UserProfile.subscriptionTier). Server-
-- side gates added in Stage 3 (the pill limit trigger) also read this
-- column.

revoke update (subscription_tier) on public.profiles from authenticated;

comment on column public.profiles.subscription_tier is
  'Locked to service_role writes (migration 0005). Set by the revenuecat-webhook Edge Function. Client reads via RevenueCat customer-info as the in-app source of truth; this column is consulted by server-side gates.';

-- Reload PostgREST so the privilege change is picked up immediately.
notify pgrst, 'reload schema';

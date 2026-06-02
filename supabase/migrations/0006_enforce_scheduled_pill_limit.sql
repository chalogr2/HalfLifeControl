-- =========================================================================
-- 0006: Server-side enforcement of the free-tier scheduled-pill limit
-- =========================================================================
--
-- Free tier may have at most ONE active scheduled pill (GAMEPLAN: Free=1,
-- Pro=unlimited). The client gates this in useSubscriptionStore
-- (canAddScheduledPill), but a tampered client could bypass that. This trigger
-- is the authoritative backstop, now that subscription_tier is trustworthy:
-- migration 0005 revoked UPDATE(subscription_tier) from `authenticated`, so the
-- only writer is the revenuecat-webhook Edge Function (service_role).
--
-- Scope decision (see APPPROGRESS / REVENUECAT_SETUP):
--   * Only the SCHEDULED limit is enforced here. The "4 simultaneous random"
--     limit is dynamic (based on live dose elimination, not a row count) and
--     stays client-only by design -- gating the hot doses INSERT path server-
--     side would risk blocking legitimate dose recording for negligible gain.
--   * Only ACTIVE scheduled pills count. Scheduled pills are soft-deleted
--     (is_active=false) to preserve dose history; a soft-deleted pill must not
--     consume the user's single free slot.
--
-- Known race (acceptable): the client trusts RevenueCat's getCustomerInfo
-- (instant) while this trigger trusts profiles.subscription_tier (updated by
-- the webhook, seconds later). A user who just upgraded could briefly be
-- blocked here until the webhook lands. The limit is a monetization gate, not
-- a security boundary, so a client-side retry is the intended mitigation.

create or replace function public.enforce_scheduled_pill_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tier  text;
  v_count integer;
begin
  -- Only an active, scheduled row can consume a slot. Inactive (soft-deleted)
  -- or random rows are exempt and pass straight through.
  if new.is_active is not true or new.pill_type <> 'scheduled' then
    return new;
  end if;

  select subscription_tier into v_tier
  from public.profiles
  where id = new.user_id;

  -- Pro users are unlimited. (A missing/unknown tier fails closed to 'free'
  -- enforcement, but profiles always exist via the on_auth_user_created trigger.)
  if v_tier = 'pro' then
    return new;
  end if;

  -- Free tier: count this user's OTHER active scheduled pills. Excluding
  -- new.id makes the trigger safe on UPDATE (editing an existing active
  -- scheduled pill counts zero others and passes).
  select count(*) into v_count
  from public.pills
  where user_id = new.user_id
    and is_active = true
    and pill_type = 'scheduled'
    and id <> new.id;

  if v_count >= 1 then
    raise exception 'Free tier is limited to 1 scheduled pill. Upgrade to Pro for unlimited.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger pills_enforce_scheduled_limit
  before insert or update on public.pills
  for each row execute function public.enforce_scheduled_pill_limit();

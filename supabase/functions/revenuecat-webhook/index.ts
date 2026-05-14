/**
 * RevenueCat webhook receiver.
 *
 * RevenueCat fires HTTPS POSTs to this endpoint whenever a user's
 * subscription lifecycle changes. We map the event to a `profiles.subscription_tier`
 * value and write it back using the service-role key (which bypasses RLS,
 * including the column lock added in migration 0005).
 *
 * This function is the *only* writer to `profiles.subscription_tier`. The
 * client reads the user's effective tier via RevenueCat's `getCustomerInfo`,
 * not the DB row -- the DB row exists for server-side gates (e.g. the pill
 * limit trigger in Stage 3).
 *
 * Deploy:
 *   supabase functions deploy revenuecat-webhook
 *   supabase secrets set REVENUECAT_WEBHOOK_AUTH=<random_string>
 *
 * Configure RevenueCat dashboard:
 *   Project Settings -> Integrations -> Webhooks
 *     URL:  https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
 *     Auth: Bearer <random_string>   // same value as REVENUECAT_WEBHOOK_AUTH
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Supabase injects these into every Edge Function's env automatically.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// User-supplied via `supabase secrets set` — matches the Authorization
// header value configured in the RevenueCat dashboard.
const WEBHOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');

const PRO_ENTITLEMENT_ID = 'pro';

// Events that grant or refresh the entitlement -> tier = 'pro'.
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

// Events that revoke the entitlement -> tier = 'free'.
// CANCELLATION is intentionally NOT here: cancellation doesn't remove access
// immediately, the user keeps pro until the period expires (RevenueCat sends
// EXPIRATION at that point).
const REVOKE_EVENTS = new Set([
  'EXPIRATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_PAUSED',
  'REFUND',
]);

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  entitlement_ids?: string[] | null;
}

interface RevenueCatPayload {
  api_version?: string;
  event?: RevenueCatEvent;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !WEBHOOK_AUTH) {
    console.error('revenuecat-webhook: missing required env vars');
    return new Response('Server not configured', { status: 500 });
  }

  // Constant-time-ish comparison is not strictly required here -- the auth
  // value is a long random string and an attacker can only enumerate by
  // hitting Supabase's rate limits -- but doing a single equality check is
  // fine for the threat model.
  const auth = req.headers.get('Authorization');
  if (auth !== WEBHOOK_AUTH) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: RevenueCatPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = payload.event;
  if (!event?.type || !event.app_user_id) {
    return new Response('Missing event.type or event.app_user_id', { status: 400 });
  }

  // If the event lists specific entitlements, only react when 'pro' is one
  // of them. Some event types (e.g. NON_RENEWING_PURCHASE) may not include
  // the array; treat absence as "applies".
  const entitlementIds = event.entitlement_ids ?? [];
  const affectsPro =
    entitlementIds.length === 0 || entitlementIds.includes(PRO_ENTITLEMENT_ID);
  if (!affectsPro) {
    return new Response(JSON.stringify({ ok: true, reason: 'not_pro' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let nextTier: 'pro' | 'free' | null = null;
  if (GRANT_EVENTS.has(event.type)) nextTier = 'pro';
  else if (REVOKE_EVENTS.has(event.type)) nextTier = 'free';

  if (!nextTier) {
    // CANCELLATION, TRANSFER, and any unknown types fall through here.
    return new Response(
      JSON.stringify({ ok: true, reason: 'no_tier_change', event_type: event.type }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase
    .from('profiles')
    .update({ subscription_tier: nextTier })
    .eq('id', event.app_user_id);

  if (error) {
    console.error('revenuecat-webhook: db update failed', error.message);
    return new Response('DB error', { status: 500 });
  }

  return new Response(
    JSON.stringify({ ok: true, tier: nextTier, event_type: event.type }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});

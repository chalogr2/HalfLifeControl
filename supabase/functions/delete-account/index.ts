/**
 * Delete the calling user's account and all of their data.
 *
 * The client can't delete an auth user itself (that needs the service-role
 * key), so the app calls this function with the user's own session JWT. We
 * resolve the user from that token — never from the request body — so a
 * caller can only ever delete themselves.
 *
 * Deleting the `auth.users` row cascades to everything the user owns
 * (migration 0001: profiles, pills and doses all reference auth.users with
 * ON DELETE CASCADE), so no per-table cleanup is needed here.
 *
 * Not touched: the RevenueCat customer record (keyed by the now-deleted
 * user ID, holds purchase receipts) and any store subscription, which only the
 * user can cancel in Google Play / the App Store.
 *
 * Deploy (JWT verification stays ON — the gateway rejects unauthenticated
 * calls before this code runs):
 *   supabase functions deploy delete-account
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Supabase injects these into every Edge Function's env automatically.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('delete-account: missing required env vars');
    return json(500, { error: 'Server not configured' });
  }

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json(401, { error: 'Missing session' });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Validates the JWT signature/expiry and returns the token's owner.
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return json(401, { error: 'Invalid session' });
  }

  const userId = userData.user.id;
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error('delete-account: deleteUser failed', userId, deleteError.message);
    return json(500, { error: 'Could not delete account' });
  }

  return json(200, { deleted: true });
});

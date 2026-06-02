# RevenueCat Setup

This doc captures the configuration that links the HalfLifeControl client + Edge Function to the RevenueCat dashboard. Update it whenever you change identifiers, products, or webhooks.

---

## Project (RevenueCat dashboard)

| Item | Value |
|---|---|
| Project name | HalfLifeControl |
| Entitlement identifier | `HalfLifeControl Pro` (literal — with space, mixed case) |
| Entitlement display name | HalfLifeControl Pro |

**The entitlement identifier is immutable.** It cannot be changed in the RC dashboard once created — only the display name is editable. If we ever need to rename it (e.g., to migrate to a slug-style `pro`), the path is: create a new entitlement, re-associate every product with the new entitlement, switch `ENTITLEMENT_ID` constants in code, leave the old one dangling or delete it.

The literal string with a space and capitals works but causes minor friction (URL-encoding in logs as `HalfLifeControl%20Pro`, grep mismatches when debugging). Bake it carefully and don't typo it.

**Code references** (must match the dashboard exactly):

- `src/services/subscription/index.ts` — `ENTITLEMENT_ID`
- `supabase/functions/revenuecat-webhook/index.ts` — `PRO_ENTITLEMENT_ID`

---

## Products

Configured in **RevenueCat dashboard → Products**, mirrored in **Google Play Console → Monetize → Products → Subscriptions / In-app products** (and Apple equivalents in Phase 7).

| Package type | Name | Price | Renewal |
|---|---|---|---|
| `MONTHLY` | Monthly | $4.99 | Auto-renew |
| `ANNUAL` | Yearly | $39.99 | Auto-renew |
| `LIFETIME` | Lifetime | $99.99 | One-time |

The client paywall (`src/app/(main)/subscription/paywall.tsx`) selects by `packageType`. If you ever rename product slugs or add new tiers, update the package lookup in `paywall.tsx`.

---

## API keys

| Platform | Env var | Status |
|---|---|---|
| Android (Google Play) | `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Test key in local `.env` |
| iOS (Apple) | `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` | Blank — deferred to Phase 7 (no Mac yet) |

Both are public-by-design and exposed to the JS bundle via the `EXPO_PUBLIC_` prefix. RevenueCat validates the actual purchase server-side, so leaking the key from a client bundle is not a security issue.

**Test vs. production keys:** RC issues both. Test keys (prefix `test_…`) only work against sandbox purchases. Production keys are issued once you flip the app out of "sandbox" mode in the RC dashboard. Swap the env var value, rebuild, ship.

---

## Webhook

**Function:** `supabase/functions/revenuecat-webhook/index.ts`

**Deploy:**
```bash
supabase functions deploy revenuecat-webhook --no-verify-jwt
supabase secrets set REVENUECAT_WEBHOOK_AUTH=<random_string>
```

> **`--no-verify-jwt` is mandatory.** RevenueCat sends a custom `Authorization`
> header (our shared secret), not a Supabase JWT. Supabase's gateway verifies
> JWTs by default and will `401` every webhook call *before* the function runs.
> This is also pinned in `supabase/config.toml` (`verify_jwt = false`) so future
> deploys keep it disabled. The function still authenticates every request
> itself by comparing the header to `REVENUECAT_WEBHOOK_AUTH`.

Generate the auth value with any opaque random generator. PowerShell:
```powershell
-join ((48..57 + 65..90 + 97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
```

**Configure in RC dashboard:** Project Settings → Integrations → Webhooks → New

| Field | Value |
|---|---|
| URL | `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook` |
| Authorization header | Same exact string as `REVENUECAT_WEBHOOK_AUTH` |

**Event types the function handles:**

| Event | Action |
|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `UNCANCELLATION`, `NON_RENEWING_PURCHASE`, `SUBSCRIPTION_EXTENDED`, `TEMPORARY_ENTITLEMENT_GRANT` | Set `subscription_tier = 'pro'` |
| `EXPIRATION`, `BILLING_ISSUE`, `SUBSCRIPTION_PAUSED`, `REFUND` | Set `subscription_tier = 'free'` |
| `CANCELLATION` | No-op (user keeps access until period end; `EXPIRATION` fires then) |
| `TRANSFER` and unknown types | No-op (logged but not acted on) |

**Smoke test:**
```powershell
$auth = "<your secret>"
$body = @{
  event = @{
    type = "INITIAL_PURCHASE"
    app_user_id = "<test-user-uuid-from-auth.users>"
    entitlement_ids = @("HalfLifeControl Pro")
  }
} | ConvertTo-Json -Depth 3

Invoke-RestMethod `
  -Uri "https://<ref>.supabase.co/functions/v1/revenuecat-webhook" `
  -Method POST `
  -Headers @{ Authorization = $auth; "Content-Type" = "application/json" } `
  -Body $body
```

Expected: `{ ok: true, tier: 'pro', event_type: 'INITIAL_PURCHASE' }`. Verify the `profiles.subscription_tier` column flips in Supabase Studio.

---

## RLS lock on `subscription_tier`

Migration `0005_lock_subscription_tier.sql` revokes `UPDATE (subscription_tier) FROM authenticated`. After it runs, only the service-role key (used by this Edge Function) can mutate the column. The client reads it but no longer writes.

This is what makes the webhook authoritative. Without the lock, a tampered client could `UPDATE profiles SET subscription_tier='pro'` directly.

---

## Sandbox test purchase flow (Phase 7+ when Android dev build is ready)

1. Build the dev APK: `npx eas build --platform android --profile development`
2. Install on emulator or device.
3. On the device, sign in to the same Google account that's added as a "License Tester" in Google Play Console (Setup → License testing).
4. In the app, open Paywall → tap any plan. RevenueCat will trigger the Play Billing dialog; tester accounts see "This is a test purchase, you will not be charged."
5. After completing purchase, watch for:
   - In-app: tier flips to `pro` (via `getCustomerInfo` listener)
   - RC dashboard: Customers tab shows the new purchase event
   - Webhook: function logs (Supabase Dashboard → Functions → Logs) show the `INITIAL_PURCHASE` event processed
   - DB: `profiles.subscription_tier` column on the test user reads `'pro'`

If any link in the chain fails, that's where to start debugging — the four checkpoints above isolate the failure to one of (client SDK / RC platform integration / webhook auth / DB write).

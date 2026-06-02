# Developer Input Required

Everything in this document requires **your personal action** — creating accounts, entering secrets, reviewing content, or making decisions that code agents cannot do for you. Items are grouped by urgency.

> **Backend migration complete (2026-04)**: HalfLifeControl now runs on Supabase. The Firebase SDK, `functions/`, `firestore.rules`, and `firestore.indexes.json` have all been removed. **[`MIGRATIONTOSUPABASE.md`](./MIGRATIONTOSUPABASE.md)** is retained as a historical reference. Items 1–4 below have been rewritten around the new backend; everything else in this document (drug DB review, legal content, icons, EAS login, RevenueCat, Sentry, etc.) is unchanged.

> **Final polish queue (deferred to end of development)**: items **8** (drug database half-life values + pill search refinement) and **10** (Terms of Service / Privacy Policy copy + openFDA third-party transmission disclosure) are deliberately held until the final polish pass after Phases 4–7 land. They are user-facing correctness/legal items whose final shape depends on the full feature set being frozen — touching them mid-development would force re-validation after every feature shift. Do not start them until prompted.

---

## BLOCKING: Required Before the App Can Run

### 1. Complete Supabase setup and collect the two env values

Follow **[`MIGRATIONTOSUPABASE.md`](./MIGRATIONTOSUPABASE.md) Section 8** end-to-end. At the end of Section 8 you should have:

- A Supabase project created on the Free plan, in the region closest to your primary users
- The schema from Section 4 of that document applied via the SQL Editor
- RLS enabled and verified on `profiles`, `pills`, and `doses`
- Email/password auth enabled with email confirmation temporarily off (dev only)
- A throwaway test user created and deleted to verify the `handle_new_user` trigger works

Then copy these two values out of **Project Settings → API** in the Supabase dashboard:

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ... (the "anon public" key, NOT service_role)
```

These values are read by `src/services/supabase/config.ts` and must be present in `.env` for the app to start.

**File that reads these**: `src/services/supabase/config.ts`

**Status**: [ ] Supabase project created / [ ] Schema applied / [ ] RLS verified / [ ] Env values collected

---

### 2. (Removed) Firebase config files no longer required

Supabase does not use per-platform config files like Firebase's `google-services.json` or `GoogleService-Info.plist`. The Supabase JS SDK works on both Android and iOS with nothing but the URL and anon key from Section 1.

If `google-services.json` or `GoogleService-Info.plist` still exist in your project root as leftovers, the assistant will delete them during the code migration.

**Status**: [x] Not applicable after migration

---

### 3. Row-Level Security policies (replaces Firestore Rules)

Security is now enforced at the Postgres level via RLS policies that live in the schema migration file (`supabase/migrations/0001_initial.sql`). The policies are simple:

- `profiles_own`: `auth.uid() = id`
- `pills_own`: `auth.uid() = user_id`
- `doses_own`: `auth.uid() = user_id`

Each policy covers all operations (SELECT, INSERT, UPDATE, DELETE) for the row's owner.

**Pill limit enforcement** (free tier: 1 scheduled + 4 simultaneous random) lives client-side in `src/stores/useSubscriptionStore.ts`. The **scheduled** limit is now also enforced server-side by the `pills_enforce_scheduled_limit` trigger (migration 0006). The **random** limit stays client-only by design (it's dose-elimination-based, not a row count).

**Subscription tier syncing** (RevenueCat → `profiles.subscription_tier`) is handled by the `revenuecat-webhook` Supabase Edge Function (deployed). Migration 0005 locks the column to `service_role`, so the webhook is the **only** writer; the client never writes the tier and reads RevenueCat's `getCustomerInfo` as its in-app source of truth. See `docs/REVENUECAT_SETUP.md`.

**Status**: [x] RLS applied via schema migration (verified in Section 8.5 of the migration guide)

---

### 4. (Removed) Firestore index exemptions no longer required

Supabase/Postgres uses standard B-tree indexes, declared inline in the schema migration (see Section 4 of `MIGRATIONTOSUPABASE.md`). There is no equivalent of Firestore's array-field index exemptions because Postgres does not auto-index anything.

**Status**: [x] Not applicable after migration

---

### 5. Upgrade Node.js

React Native 0.83 wants Node.js v20.19.4+. You have v20.16.0. The app compiles but you may hit runtime issues.

**Status**: [ ] Updated to v20.19.4+

---

## BLOCKING FOR ANDROID BUILD

### 6. Google Play service account key

`eas.json` (line 32) references `./google-play-key.json` for automated Play Store submissions.

**How**: Google Play Console > Setup > API Access > Create service account > Download JSON > save as `google-play-key.json` in project root.

**Status**: [ ] `google-play-key.json` placed (waiting for Google Play account verification)

---

### 7. EAS login

Before building, you need to authenticate with Expo:

```bash
npx eas-cli login
```

**Status**: [ ] Logged in

---

## NEEDS HUMAN REVIEW

### 8. Drug database + pill search refinement — deferred to FINAL POLISH

> **Scheduling note**: This item is intentionally held until the final polish pass at the end of development, alongside item 10 (legal content). Half-life values and the drug-search experience are user-facing correctness/quality concerns that benefit from being tuned with the rest of the app stable around them, rather than mid-development when they would have to be re-validated after every feature shift.

**Pill data**: `src/data/drugDatabase.ts` contains 50 drugs with half-life data sourced from clinical pharmacology references. These values feed the countdown timers — the core feature of the app. Review for medical accuracy. Known cases to double-check:
- Aspirin: uses parent compound half-life (20min), not salicylate metabolite (2-4.5h)
- Fluoxetine: 5760min (4 days) — correct but the active metabolite norfluoxetine is 4-16 days
- Levothyroxine: 10080min (7 days) — very long, users may find the 5-half-life countdown (35 days) surprising
- Duration-of-action multipliers in `src/core/halflife.ts` use a fixed factor; per-drug values from PubMed/FDA are pending (see `duration-research.md`).

**Pill search**: The 3-tier search (curated DB → openFDA → manual) in `src/components/pills/DrugSearchBar.tsx` works end-to-end but has not been polished. Final-polish items include: typeahead latency tuning, deduplication of curated/openFDA hits with the same generic name, ranking the active ingredient ahead of brand suffixes, and copy on the manual-entry path. The openFDA third-party-transmission disclosure is owned by item 10 (Privacy Policy), not here.

**Status**: [ ] Deferred to final polish phase (do not start until feature work in Phases 4–7 is complete)

---

### 9. ~~Onboarding completion is never set to `true`~~ — FIXED (Phase 5)

**Fixed in**: `src/services/supabase/auth.ts` (added `completeOnboarding()`) and `src/app/(main)/pill/add.tsx` (calls it after first pill saved). Originally landed in the Firebase service module; carried over to Supabase during the April 2026 migration.

**Status**: [x] Fixed in Phase 5

---

### 10. Legal pages content + openFDA third-party disclosure — deferred to FINAL POLISH

> **Scheduling note**: Held intentionally until the final polish pass at the end of development. The Privacy Policy can only be finalized once the full set of network egress points and at-rest data flows is frozen, so writing it now would just create churn. Navigation is already wired up; only the copy and the openFDA gating remain.

**Legal copy**: Both Settings and Register screens open `src/app/legal.tsx` with the correct `type` param ("terms" or "privacy"). The screen lives at the root route level so it's accessible to both authenticated and unauthenticated users. The placeholder text in the `LEGAL_CONTENT` object must be replaced with real Terms of Service and Privacy Policy text (drafted by a lawyer, or templated from a generator and reviewed). Stitch mockups exist at:
- `docs/stitch_halflifecontrol_html/terms_of_service/`
- `docs/stitch_halflifecontrol_html/privacy_policy/`

**openFDA third-party transmission**: The drug search in `src/services/openfda/index.ts` sends the user's typed search term to `api.fda.gov` (a US Government endpoint) over HTTPS on every typeahead query of ≥3 chars. The Privacy Policy must disclose this third-party transmission, and the app must either (a) gate the openFDA tier behind a one-time consent prompt, or (b) move the lookups behind our own Supabase Edge Function proxy so only an opaque server-side identifier is exposed. Decision and implementation are part of this same final-polish item — they cannot be split because the Privacy Policy text depends on which path is chosen.

**Status**: [x] Screens wired up / [ ] Deferred to final polish phase (legal copy + openFDA disclosure decision pending)

---

### 11. ~~Settings reminder preference is not persisted~~ — FIXED (Phase 5)

**Fixed in**: `src/services/supabase/auth.ts` (added `updateUserSettings()`) and `src/app/(main)/(tabs)/settings.tsx` (calls it on reminder mode change). Originally landed in the Firebase service module; carried over to Supabase during the April 2026 migration.

**Status**: [x] Fixed in Phase 5

---

### 12. Welcome screen illustration is a placeholder

`src/app/(onboarding)/welcome.tsx:30-33` shows a pill emoji inside a colored circle instead of the proper illustration from the Stitch mockup.

**Action**: Either provide a proper illustration asset, or approve the emoji placeholder for v1.

**Status**: [ ] Illustration provided / [ ] Emoji approved for v1

---

### 13. ~~AsyncStorage stores medication data in plaintext~~ — FIXED

Three layers of at-rest encryption now cover every sensitive on-device value:

| What | Where it lives | How it's protected |
|---|---|---|
| Medication cache + write-ahead log (PHI) | AsyncStorage | AES-256-GCM via `src/services/secureStorage.ts`; key in expo-secure-store |
| Supabase access + refresh tokens, PKCE code-verifier | iOS Keychain / Android Keystore | Hardware-backed via expo-secure-store directly (no JS crypto layer in the path) |
| Supabase user metadata blob (email, auth metadata) | AsyncStorage | AES-256-GCM via the same `secureStorage.ts` helpers, plumbed through Supabase's `userStorage` adapter in `src/services/supabase/sessionStorage.ts` |

Only non-sensitive metadata (the `lastSync` timestamp) remains unencrypted.

**Migration**: Legacy unencrypted values are detected by checking if the stored string starts with `{` or `[` (valid JSON). On first read, they are transparently re-encrypted in place. No sign-out, no manual migration step.

**Known limitation — corruption-while-offline edge case**: if the encrypted user blob ever becomes unreadable (key drift, format change, file-system damage) **and** the user is offline at the same time, the proxy-recovery path in `auth.ts`'s `resolveSessionUser` cannot reach `/auth/v1/user` and returns null. The app behaves as if the session is missing and routes the user to the login screen, even though the access token in SecureStore is still valid. Tokens are not invalidated — the next launch with network restored will recover transparently, and the user's cached pills/history are preserved on disk. The proper fix is to fall back to a local JWT decode of the access token's `sub` claim as a last-resort source of truth for the user ID; deferred until production telemetry shows it actually firing.

**Status**: [x] Implemented (with the known offline-corruption limitation above)

---

### 14. Remaining notification/scheduling feature gaps — Phase 4 closeout COMPLETE (with one deferred piece)

| Feature | Status |
|---------|--------|
| `every_n_days` frequency in add-pill UI | [x] Done — `src/app/(main)/pill/add.tsx` interval input + scheduler/notifications support |
| Grouped notifications (multiple pills at same time) | [x] Done — `src/services/notifications/index.ts` groups by `(timeOfDay, weekday)` and lists all pill names in body |
| Notification action buttons ("Took it" / "Snooze") | [x] Done — `pill_reminder` category registered with both actions |
| Snooze flow (15-minute reschedule) | [x] Done — Snooze schedules a one-shot 15-min reminder with the same payload |
| `autoAssumeTaken` (foreground/local layer) | [x] Done — Settings toggle + `usePillStore.reconcileAutoAssumedDoses` writes auto doses on dashboard mount and `AppState` foreground transitions |
| Dose-elimination notification ("dose has cleared") | [x] Done — `scheduleAllEliminationNotifications` schedules a one-shot DATE banner at each active dose's `eliminationAt`. Settings switch `eliminationNotificationsEnabled` (default ON) gates whether banners fire. |
| `autoAssumeTaken` background cron (true app-closed coverage) | [x] **Dropped, not built** — the foreground reconcile (`reconcileAutoAssumedDoses` on cold-start + every `AppState` foreground, with `missedScheduledDoses` backfilling *all* missed occurrences since the user opted in) covers the real-world need. A server cron would only matter for a user who never opens the app for days yet still wants doses auto-recorded — a contradiction, since the tier/UI only update on open anyway. Revisit only if user feedback shows a concrete gap. |

**Status**: [x] Phase 4 closeout complete. The `autoAssumeTaken` server cron was evaluated during Phase 5 and intentionally dropped in favor of the foreground reconcile (see row above).

---

## NOT YET NEEDED (Future Phases)

### Phase 5: Subscription (RevenueCat) — Wired end-to-end (Android); Apple deferred

Code, webhook, RLS lock, and server-side limit are all done and **verified live** (webhook auth 200/401). Full reference: `docs/REVENUECAT_SETUP.md`.

| Item | Status |
|------|--------|
| RevenueCat account + project created | [x] Done |
| Android app added | [x] Done |
| Products created (monthly $4.99, yearly $39.99, lifetime $99.99) | [x] Done |
| Entitlement `HalfLifeControl Pro` (literal, immutable) created | [x] Done — code constants match in `subscription/index.ts` + webhook |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` in `.env` | [x] Done — test key |
| `revenuecat-webhook` Edge Function deployed (`--no-verify-jwt`) | [x] Done |
| `REVENUECAT_WEBHOOK_AUTH` secret set + matching RC dashboard webhook | [x] Done — smoke-tested |
| Migration 0005 (lock tier) + 0006 (scheduled-pill trigger) applied | [x] Done |
| Apple app + shared secret + `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` | [ ] **Deferred to Phase 7** (no Mac) |
| Production API key (swap test key) + real sandbox purchase test | [ ] **Gated on first EAS Android dev build** |

---

### Phase 6: Google Sign-In + Sentry + Android Build — partially complete

Sentry service code is built and gracefully degrades when DSN is not set. The original Firebase-based Google Sign-In was removed during the Supabase migration; a Supabase-OAuth replacement has not been built yet. Apple Sign-In is deferred to Phase 7 (no Mac).

#### 15. Google Sign-In via Supabase OAuth (not yet implemented)

The old Firebase Google Sign-In code (`src/services/firebase/googleAuth.ts`) was deleted during the April 2026 migration. Supabase supports Google OAuth natively, but the React Native flow is different from the old Firebase one — it requires deep-link configuration, redirect URI verification on physical devices, and session-restoration handling. This is tracked as a post-migration follow-up.

**Status**: [ ] Not yet implemented (post-migration follow-up)

---

#### 16. (Removed) `google-services.json` no longer required

Supabase does not require `google-services.json`. The old Firebase Android config file can be deleted if it still exists in the project root.

**Status**: [x] Not applicable after migration

---

#### 17. Create Sentry project

1. Create a free account at **sentry.io**
2. Create a **React Native** project
3. Copy the **DSN** string
4. Add to `.env`: `EXPO_PUBLIC_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz`
5. Update `app.json` — replace `"SENTRY_ORG"` and `"SENTRY_PROJECT"` in the `@sentry/react-native/expo` plugin config with your actual org slug and project slug

**File that reads DSN**: `src/services/sentry/index.ts` (line 7)

**Status**: [ ] Sentry account created / [ ] DSN in `.env` / [ ] app.json org/project updated

---

#### 18. App Icon Assets (REQUIRED for build)

The `app.json` references these icon files. The build will fail if they don't exist:

| File | Dimensions | Purpose |
|------|-----------|---------|
| `assets/icon.png` | 1024x1024 | App icon (iOS + fallback) |
| `assets/splash-icon.png` | Any (centered) | Splash screen logo |
| `assets/android-icon-foreground.png` | 1024x1024 | Android adaptive icon foreground |
| `assets/android-icon-background.png` | 1024x1024 | Android adaptive icon background |
| `assets/android-icon-monochrome.png` | 1024x1024 | Android themed icon (API 33+) |
| `assets/favicon.png` | 48x48 | Web favicon |

**Quick fix for testing**: Copy a single 1024x1024 placeholder PNG to all these names. You can replace them with final designs before store submission.

**Status**: [ ] All icon assets present in `assets/`

---

#### 19. Build and Run on Android Emulator

**Prerequisites** (complete the Supabase env setup, the Sentry DSN if you want crash reporting, and the App Icon Assets above first):

1. **Install Android Studio** + create an AVD (Android Virtual Device):
   - Recommended: Pixel 7 or similar, API 34+
   - Give the emulator at least 4GB RAM

2. **Log in to EAS**:
   ```bash
   npx eas-cli login
   ```

3. **Build the development APK**:
   ```bash
   npx eas build --platform android --profile development
   ```
   This builds in the cloud (takes ~10-15 minutes first time). Downloads an `.apk` file.

4. **Start the emulator** from Android Studio > Device Manager

5. **Install the APK**:
   ```bash
   adb install path/to/your-build.apk
   ```

6. **Start the dev server**:
   ```bash
   npx expo start --dev-client
   ```

7. Open the app on the emulator — it connects to the dev server for hot reload.

**Important**: This app uses native modules (`react-native-purchases`, `expo-notifications`, `@react-native-google-signin/google-signin`, `@sentry/react-native`) and **cannot run in Expo Go**. You must use an EAS development build.

**Status**: [ ] EAS logged in / [ ] APK built / [ ] Running on emulator

---

### Phase 7: iOS Build

| Item | Status |
|------|--------|
| Mac available for Xcode builds | [ ] (expected ~early April 2026) |
| Apple Developer account enrolled ($99/year) | [ ] |
| App ID created with push + Sign-In capabilities | [ ] |
| APNs key created (see Section 4.3 of SETUP_GUIDE.md — deferred) | [ ] |
| EAS submit iOS config added to `eas.json` | [ ] |

---

## Quick Reference: All Environment Variables

```bash
# BLOCKING — app won't start without these
EXPO_PUBLIC_SUPABASE_URL=              # Supabase Dashboard > Project Settings > API
EXPO_PUBLIC_SUPABASE_ANON_KEY=         # Supabase Dashboard > Project Settings > API (anon public key)

# Phase 5 — needed for subscriptions
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=       # RevenueCat > Project > API Keys
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=     # RevenueCat > Project > API Keys

# Phase 6 — needed for error reporting
EXPO_PUBLIC_SENTRY_DSN=                 # Sentry > Project > Client Keys
```

---

## Quick Reference: All Required Files (Gitignored)

| File | Source | When needed |
|------|--------|-------------|
| `.env` | Copy from `.env.example`, fill values | Now |
| `google-play-key.json` | Google Play Console > API Access | Play Store submission |

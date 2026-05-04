# Developer Input Required

Everything in this document requires **your personal action** — creating accounts, entering secrets, reviewing content, or making decisions that code agents cannot do for you. Items are grouped by urgency.

> **Backend migration complete (2026-04)**: HalfLifeControl now runs on Supabase. The Firebase SDK, `functions/`, `firestore.rules`, and `firestore.indexes.json` have all been removed. **[`MIGRATIONTOSUPABASE.md`](./MIGRATIONTOSUPABASE.md)** is retained as a historical reference. Items 1–4 below have been rewritten around the new backend; everything else in this document (drug DB review, legal content, icons, EAS login, RevenueCat, Sentry, etc.) is unchanged.

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

**Pill limit enforcement** (free tier: 1 scheduled + 4 simultaneous random) lives in `src/core/subscription.ts` client-side for now. A Postgres `BEFORE INSERT` trigger for server-side enforcement is documented as a follow-up in `MIGRATIONTOSUPABASE.md` and will be added only if client-side bypass becomes a real concern.

**Subscription tier syncing** (RevenueCat → `profiles.subscription_tier`) will be handled by a Supabase Edge Function in Phase 5. Until then, the client writes the tier directly — which works because the client is trusted at this stage. No webhook deployment is required for the initial migration.

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

### 8. Drug database half-life values

`src/data/drugDatabase.ts` contains 50 drugs with half-life data sourced from clinical pharmacology references. These values are used to calculate countdown timers — the core feature of the app.

**Action**: Review the half-life values for medical accuracy. Key drugs to double-check:
- Aspirin: uses parent compound half-life (20min), not salicylate metabolite (2-4.5h)
- Fluoxetine: 5760min (4 days) — correct but the active metabolite norfluoxetine is 4-16 days
- Levothyroxine: 10080min (7 days) — very long, users may find the 5-half-life countdown (35 days) surprising

**Status**: [ ] Reviewed and approved

---

### 9. ~~Onboarding completion is never set to `true`~~ — FIXED (Phase 5)

**Fixed in**: `src/services/supabase/auth.ts` (added `completeOnboarding()`) and `src/app/(main)/pill/add.tsx` (calls it after first pill saved). Originally landed in the Firebase service module; carried over to Supabase during the April 2026 migration.

**Status**: [x] Fixed in Phase 5

---

### 10. Legal pages need content

Navigation is wired up — both Settings and Register screens now open `src/app/legal.tsx` with the correct `type` param ("terms" or "privacy"). The screen lives at the root route level so it's accessible to both authenticated and unauthenticated users. Placeholder text is shown.

**Action**: You need to write (or have a lawyer draft) your actual Terms of Service and Privacy Policy. Replace the placeholder text in `src/app/legal.tsx` (the `LEGAL_CONTENT` object).

**Stitch mockups exist** at:
- `docs/stitch_halflifecontrol_html/terms_of_service/`
- `docs/stitch_halflifecontrol_html/privacy_policy/`

**Status**: [x] Screens wired up / [ ] Legal content drafted

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

### 14. Remaining notification/scheduling feature gaps

The following features from the GAMEPLAN spec are not yet implemented. These are **feature additions**, not bugs in existing functionality:

| Feature | Spec Reference | Effort |
|---------|---------------|--------|
| `every_n_days` frequency in add-pill UI | `GAMEPLAN.md` schedule section | Low — type exists, UI option missing |
| Grouped notifications (multiple pills at same time) | `GAMEPLAN.md:267` | Medium — requires notification batching logic |
| Notification action buttons ("Took it" / "Snooze") | `GAMEPLAN.md:268` | Medium — expo-notifications category actions |
| Snooze flow (15-minute reschedule) | `GAMEPLAN.md:268` | Medium — ties into action buttons |
| `autoAssumeTaken` behavior | `GAMEPLAN.md:269` | High — needs Cloud Function for background execution |

**Status**: [ ] Prioritized for future phase

---

## NOT YET NEEDED (Future Phases)

### Phase 5: Subscription (RevenueCat) — Code complete, needs account setup

Code is built and gracefully degrades without API keys. You need to set up RevenueCat to enable real purchases:

| Item | Status |
|------|--------|
| RevenueCat account created | [ ] |
| Apple app added with shared secret | [ ] |
| Android app added with service account | [ ] |
| Products created (monthly $4.99, yearly $39.99) | [ ] |
| Entitlement "pro" created in RevenueCat dashboard | [ ] |
| `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` in `.env` | [ ] |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` in `.env` | [ ] |

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

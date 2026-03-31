# Developer Input Required

Everything in this document requires **your personal action** — creating accounts, entering secrets, reviewing content, or making decisions that code agents cannot do for you. Items are grouped by urgency.

---

## BLOCKING: Required Before the App Can Run

### 1. Create `.env` file with Firebase config

Copy `.env.example` to `.env` and fill in all 6 Firebase values from your Firebase Console (Project Settings > General > Web app):

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=halflifecontrol.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=halflifecontrol
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=halflifecontrol.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Where**: Firebase Console > Project Settings > General > Your apps > Web app (</>) > `firebaseConfig` object.

**File that reads these**: `src/services/firebase/config.ts` (lines 6-11)

**Status**: [ ] Not done

---

### 2. Place Firebase config files in project root

These are gitignored and must exist locally:

| File | Source | Needed for |
|------|--------|------------|
| `google-services.json` | Firebase Console > Project Settings > Android app > Download | Android builds |
| `GoogleService-Info.plist` | Firebase Console > Project Settings > iOS app > Download | iOS builds (Phase 7) |

**Status**: [ ] `google-services.json` placed / [ ] `GoogleService-Info.plist` placed

---

### 3. Firestore Security Rules (Updated for optimized schema)

There is **no `firestore.rules` file** in the project. Your Firestore database currently uses whatever rules you set during setup (likely test mode which expires, or locked mode which blocks everything).

**Action required**: Deploy these rules via Firebase Console > Firestore > Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Dashboard document (single-doc vault: pills + active doses)
      match /data/{docId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        // Enforce free tier pill limit at database level
        allow write: if request.auth != null && request.auth.uid == userId
          && (
            // Pro users: no limit
            get(/databases/$(database)/documents/users/$(userId)).data.subscriptionTier == 'pro'
            // Free users: max 1 scheduled pill
            || request.resource.data.pills.size() <= 1
            // Allow writes that don't add scheduled pills (e.g. recording doses)
            || request.resource.data.pills.size() <= resource.data.pills.size()
          );
      }

      // Monthly history buckets
      match /history/{monthId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

**Note**: The pill limit rule counts ALL pills in the array. Free users can have at most 1 pill total in their dashboard. Pro status is checked from the user profile document. The third condition allows writes that don't add new pills (e.g., recording a dose or removing a pill).

**Status**: [ ] Rules deployed

---

### 4. Deploy Firestore Index Exemptions

The project includes `firestore.indexes.json` in the repo root. This file disables auto-indexing on array fields (`pills`, `activeDoses`, `doses`) that are never queried individually — saving storage and write costs.

**Action**: Deploy the index config to your Firebase project:
```bash
firebase deploy --only firestore:indexes
```

**Prerequisite**: You need the Firebase CLI installed (`npm install -g firebase-tools`) and logged in (`firebase login`). If you haven't initialized Firebase in this project yet, run `firebase init firestore` and select your project — but **do not** overwrite `firestore.indexes.json` when prompted.

**Status**: [ ] Index exemptions deployed

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

**Fixed in**: `src/services/firebase/auth.ts` (added `completeOnboarding()`) and `src/app/(main)/pill/add.tsx` (calls it after first pill saved).

**Status**: [x] Fixed in Phase 5

---

### 10. Legal pages are non-functional

Two places reference Terms of Service and Privacy Policy with no actual content or navigation:

| Location | File | Issue |
|----------|------|-------|
| Settings screen | `src/app/(main)/(tabs)/settings.tsx:85-93` | `<Pressable>` buttons with no `onPress` handler |
| Register screen | `src/app/(auth)/register.tsx:132-140` | Text links with no navigation |

**Stitch mockups exist** at:
- `docs/stitch_halflifecontrol_html/terms_of_service/`
- `docs/stitch_halflifecontrol_html/privacy_policy/`

**Action**: You need to write (or have a lawyer draft) your actual Terms of Service and Privacy Policy. The code to display them can be built by agents, but the legal content must come from you.

**Status**: [ ] Legal content drafted / [ ] Screens wired up

---

### 11. ~~Settings reminder preference is not persisted~~ — FIXED (Phase 5)

**Fixed in**: `src/services/firebase/auth.ts` (added `updateUserSettings()`) and `src/app/(main)/(tabs)/settings.tsx` (calls it on reminder mode change).

**Status**: [x] Fixed in Phase 5

---

### 12. Welcome screen illustration is a placeholder

`src/app/(onboarding)/welcome.tsx:30-33` shows a pill emoji inside a colored circle instead of the proper illustration from the Stitch mockup.

**Action**: Either provide a proper illustration asset, or approve the emoji placeholder for v1.

**Status**: [ ] Illustration provided / [ ] Emoji approved for v1

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

### Phase 6: Google Sign-In + Sentry + Android Build — Code complete, needs account setup

Google Sign-In code is built. Apple Sign-In is deferred to Phase 7 (no Mac). Sentry service gracefully degrades when DSN not set.

#### 13. Enable Google Sign-In in Firebase Console

1. Go to **Firebase Console > Authentication > Sign-in method**
2. Click **Google** > Enable it
3. Note the **Web client ID** — this is shown in the Google provider config

**Action**: Paste the Web client ID into `.env` as:
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

**File that reads this**: `src/services/firebase/googleAuth.ts` (line 18)

**Status**: [ ] Google Sign-In enabled in Firebase / [ ] Web client ID in `.env`

---

#### 14. Download `google-services.json` (REQUIRED for Android build)

The Google Sign-In native module requires `google-services.json` in the project root.

1. Go to **Firebase Console > Project Settings > General > Your apps**
2. If no Android app exists, click **Add app** > Android
   - Package name: `com.halflifecontrol.app`
   - Debug signing certificate SHA-1: get it from EAS with `eas credentials` or from your local debug keystore
3. Download `google-services.json` and place it in the **project root** (next to `package.json`)

**Important**: You MUST add the SHA-1 fingerprint for Google Sign-In to work on Android. Without it, the sign-in will fail silently.

To get your debug SHA-1 from Android Studio:
```bash
# Windows (default debug keystore)
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

Or from EAS:
```bash
eas credentials --platform android
```

**Status**: [ ] `google-services.json` placed / [ ] SHA-1 fingerprint added to Firebase

---

#### 15. Create Sentry project

1. Create a free account at **sentry.io**
2. Create a **React Native** project
3. Copy the **DSN** string
4. Add to `.env`: `EXPO_PUBLIC_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz`
5. Update `app.json` — replace `"SENTRY_ORG"` and `"SENTRY_PROJECT"` in the `@sentry/react-native/expo` plugin config with your actual org slug and project slug

**File that reads DSN**: `src/services/sentry/index.ts` (line 7)

**Status**: [ ] Sentry account created / [ ] DSN in `.env` / [ ] app.json org/project updated

---

#### 16. App Icon Assets (REQUIRED for build)

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

#### 17. Build and Run on Android Emulator

**Prerequisites** (complete items 1, 13, 14, 16 above first):

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
| APNs key created and uploaded to Firebase | [ ] |
| `GoogleService-Info.plist` placed in root | [ ] |
| EAS submit iOS config added to `eas.json` | [ ] |

---

## Quick Reference: All Environment Variables

```bash
# BLOCKING — app won't start without these
EXPO_PUBLIC_FIREBASE_API_KEY=           # Firebase Console > Web app config
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=       # Firebase Console > Web app config
EXPO_PUBLIC_FIREBASE_PROJECT_ID=        # Firebase Console > Web app config
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=    # Firebase Console > Web app config
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID= # Firebase Console > Web app config
EXPO_PUBLIC_FIREBASE_APP_ID=            # Firebase Console > Web app config

# Phase 6 — needed for Google Sign-In
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=       # Firebase Console > Auth > Google provider > Web client ID

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
| `google-services.json` | Firebase Console > Android app | Android builds |
| `GoogleService-Info.plist` | Firebase Console > iOS app | iOS builds (Phase 7) |
| `google-play-key.json` | Google Play Console > API Access | Play Store submission |

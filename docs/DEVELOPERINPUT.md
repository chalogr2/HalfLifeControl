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

### 3. Firestore Security Rules

There is **no `firestore.rules` file** in the project. Your Firestore database currently uses whatever rules you set during setup (likely test mode which expires, or locked mode which blocks everything).

**Action required**: Deploy these rules via Firebase Console > Firestore > Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Users can only access their own pills
      match /pills/{pillId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // Users can only access their own doses
      match /doses/{doseId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

**Status**: [ ] Rules deployed

---

### 4. Firestore Composite Indexes

The history queries use compound `where` + `orderBy` which require composite indexes. Firestore will throw an error on first query with a direct link to create the index. You need to click those links or create manually:

| Collection | Fields | Query |
|------------|--------|-------|
| `users/{uid}/doses` | `status` ASC, `takenAt` DESC | Active doses on dashboard |
| `users/{uid}/doses` | `takenAt` ASC | Date range query for day detail |

**How**: Run the app, trigger the queries, check the console error for a Firebase link, click it.

**Status**: [ ] Indexes created

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

### Phase 6: Social Auth + Sentry

| Item | Status |
|------|--------|
| Google OAuth client ID configured in Firebase | [ ] |
| Apple Sign-In enabled in Firebase + Apple Developer portal | [ ] |
| Sentry account + project created | [ ] |
| `EXPO_PUBLIC_SENTRY_DSN` in `.env` | [ ] |
| Social login buttons enabled in `login.tsx` and `register.tsx` | [ ] |

Currently disabled at:
- `src/app/(auth)/login.tsx:128-136` (Google + Apple buttons, `disabled` prop)
- `src/app/(auth)/register.tsx:165-173` (Google + Apple buttons, `disabled` prop)

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

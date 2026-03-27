# HalfLifeControl — App Progress Log

This document records every step taken to build the app, in exact detail, so that any AI agent (Codex, Sonnet, Opus) or developer can understand what was done, why, and how to continue.

---

## Phase 1: Foundation — COMPLETED

### Step 1: Initialize Expo Project

**What**: Created a new Expo project with the TypeScript blank template.

**How**:
1. `create-expo-app` refused to run in the repo root because `.claude/` and other files existed. Workaround: created a temp project in a sibling directory, then copied files over.
   ```bash
   npx create-expo-app@latest ../HalfLifeControlTemp --template blank-typescript
   ```
2. Copied these files from temp to the repo root: `App.tsx`, `app.json`, `index.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `assets/`
3. Ran `npm install` in the repo root.
4. Deleted the temp directory.

**Why the workaround**: `create-expo-app` refuses to run in a directory that has any non-dot files it doesn't recognize. Since our repo already had `docs/` and `.claude/`, we had to init elsewhere and copy.

### Step 2: Install Dependencies

**What**: Installed all Phase 1 dependencies via `npx expo install` (for Expo-compatible versions) and `npm install` (for non-Expo packages).

**Commands run**:
```bash
# Expo/navigation packages (use expo install for version compatibility)
npx expo install expo-router expo-linking expo-constants expo-status-bar expo-splash-screen react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated

# Had to fix react version mismatch first:
npm install react@19.2.4 --legacy-peer-deps

# Expo-specific packages
npx expo install @react-native-async-storage/async-storage expo-font

# Non-Expo packages
npm install zustand date-fns zod react-native-svg

# Firebase JS SDK (NOT @react-native-firebase — see note below)
npm install firebase
```

**Important note on Firebase SDK choice**:
We use the **Firebase JS SDK** (`firebase` package, v12.x) instead of `@react-native-firebase`. Reasons:
- No native build required during development (works with Expo Go / dev client)
- No `google-services.json` or `GoogleService-Info.plist` needed to start coding
- All auth, Firestore, and basic functionality works identically
- We will migrate to `@react-native-firebase` in **Phase 4** when we need FCM push notifications (which require native integration)

**Firebase auth persistence note**:
Firebase JS SDK v12 removed `getReactNativePersistence()`. The current `config.ts` uses `initializeAuth(app)` without explicit persistence. Firebase handles token caching internally. Full native persistence will come with the `@react-native-firebase` migration in Phase 4.

**Node.js version warning**:
The project was built on Node.js v20.16.0. React Native 0.83 and Metro 0.83 require v20.19.4+. The project builds and type-checks fine, but upgrading Node.js is recommended. Just download the latest LTS from https://nodejs.org.

### Step 3: Configure Project Files

**What**: Set up `app.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `eas.json`, and `package.json`.

**Key decisions**:

**`app.json`**:
- `slug`: `halflifecontrol`
- `scheme`: `halflifecontrol` (for deep linking)
- Bundle ID (both platforms): `com.halflifecontrol.app`
- Splash background: `#004d64` (primary brand color)
- Expo Router plugin configured with `root: ./src/app`
- Plugins: `expo-router`, `expo-font`

**`tsconfig.json`**:
- Extends `expo/tsconfig.base`
- `strict: true`
- Path alias: `@/*` maps to `src/*`
  - Usage: `import { colors } from '@/theme'` instead of `../../theme`

**`package.json`**:
- `main`: `"expo-router/entry"` (NOT `index.ts` — Expo Router requires this)
- The old `index.ts` was deleted (it was the default `registerRootComponent(App)` pattern, which Expo Router replaces)
- The old `App.tsx` was also deleted (Expo Router uses `src/app/_layout.tsx` as the root component)

**`eas.json`**:
- Three build profiles: `development` (APK for testing), `preview` (internal), `production` (auto-increment)
- Submit configured for Android only (Google Play service account key)
- iOS submit config will be added in Phase 7 when Mac is available

**`.gitignore`**:
- Standard Expo ignores: `node_modules/`, `.expo/`, `dist/`, `ios/`, `android/`
- Sensitive files: `.env`, `google-services.json`, `GoogleService-Info.plist`, `google-play-key.json`
- OS files: `.DS_Store`, `Thumbs.db`, `*.stackdump`

**`.env.example`**:
- Template showing all required environment variables with `EXPO_PUBLIC_` prefix
- Firebase config, RevenueCat keys, Sentry DSN

### Step 4: Download Custom Fonts

**What**: Downloaded 10 `.ttf` font files into `assets/fonts/`.

**Fonts** (from the Stitch design system):
- **Lexend**: Light, Regular, Medium, SemiBold, Bold — used for headlines/display text
- **Plus Jakarta Sans**: Light, Regular, Medium, SemiBold, Bold — used for body/labels

**Source URLs**:
```
Lexend:           https://github.com/googlefonts/lexend/raw/main/fonts/ttf/
Plus Jakarta Sans: https://github.com/tokotype/PlusJakartaSans/raw/main/fonts/ttf/
```

**How they're loaded**: Via `useFonts()` hook from `expo-font` in `src/app/_layout.tsx`. The splash screen stays visible until fonts are loaded via `SplashScreen.preventAutoHideAsync()`.

### Step 5: Build Theme System

**What**: Created `src/theme/` with three files extracting all design tokens from the Stitch design system.

**Files created**:

**`src/theme/colors.ts`**:
- All 40+ color tokens from the Stitch Tailwind config (extracted from `docs/stitch_halflifecontrol_html/login_screen/code.html` lines 18-65)
- Organized by: Primary, Secondary, Tertiary, Error, Surface hierarchy, On-surface, Outline, Inverse
- Key colors: `primary: '#004d64'`, `secondary: '#016a60'`, `error: '#ba1a1a'`, `surface: '#faf9fc'`
- Exported as `const` object + `ColorToken` type

**`src/theme/typography.ts`**:
- Full typography scale from DESIGN.md: Display (LG/MD/SM), Headline (LG/MD/SM), Title (LG/MD/SM), Body (LG/MD/SM), Label (LG/MD/SM)
- Each variant specifies: `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`
- Font families mapped to the custom font names loaded in `_layout.tsx`:
  - `Lexend` → headlines/display
  - `PlusJakartaSans` → body/labels

**`src/theme/spacing.ts`**:
- Spacing scale: 0, 1(4px), 2(8px), 3(12px), 4(16px), 5(20px), 6(24px), 8(32px), 10(40px), 12(48px), 16(64px), 20(80px), 24(96px)
- Border radius: sm(4), md(8), lg(12), xl(24), full(9999)
- Constants: `MIN_TOUCH_TARGET = 48`, `PRIMARY_BUTTON_HEIGHT = 64`

**`src/theme/index.ts`**: Barrel export for all theme modules.

### Step 6: Create UI Components

**What**: Built 4 reusable UI components in `src/components/ui/`, all matching the Stitch design language.

**`Typography.tsx`**:
- Props: `variant` (any typography scale key), `color` (any color token), `align`
- Applies the correct font family, size, weight, line height, and color from theme
- Default: `bodyLg` variant, `onSurface` color

**`Button.tsx`**:
- Variants: `primary` (solid primary bg), `secondary` (surface high bg), `outline` (border only), `ghost` (transparent)
- Props: `title`, `variant`, `loading` (shows ActivityIndicator), `disabled`
- 64px height, rounded-xl, gradient feel via solid primary color (gradient will be added later)
- Accessibility: `accessibilityRole="button"`, `accessibilityState`

**`Card.tsx`**:
- Variants: `elevated` (default), `outlined`, `scheduled` (6px solid left accent border), `random` (1.5px dashed border at 40% opacity)
- `scheduled` and `random` match the Stitch design for pill stack vs one-time pills
- `accentColor` prop for the left border of scheduled cards

**`Input.tsx`**:
- Filled style with `surfaceContainerHigh` background (per Stitch design)
- 2px bottom-bar that turns `primary` on focus
- Error state: `errorContainer` background + `error` border + error text below
- `label` and `error` props
- 56px min height for touch target accessibility

**`src/components/ui/index.ts`**: Barrel export.

### Step 7: Set Up Expo Router Structure

**What**: Created file-based routing with 3 route groups and auth gating.

**Directory structure**:
```
src/app/
├── _layout.tsx           # Root layout — providers, fonts, auth gate
├── index.tsx             # Redirects to /(auth)/login
├── (auth)/
│   ├── _layout.tsx       # Stack navigator, no header
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (onboarding)/
│   ├── _layout.tsx       # Stack navigator, no header
│   └── welcome.tsx
└── (main)/
    ├── _layout.tsx       # Stack navigator, no header
    └── dashboard.tsx
```

**Root `_layout.tsx` responsibilities**:
1. Loads custom fonts via `useFonts()`, keeps splash screen until loaded
2. Wraps app in `GestureHandlerRootView` (required by react-native-gesture-handler)
3. Runs `useFirebaseAuthListener()` which subscribes to `onAuthStateChanged`
4. Auth gate logic:
   - Not authenticated + not in `(auth)` group → redirect to `/(auth)/login`
   - Authenticated + in `(auth)` group → redirect to `/(onboarding)/welcome` or `/(main)/dashboard` based on `onboardingComplete` flag

**Each route group `_layout.tsx`**: Renders a `Stack` navigator with `headerShown: false` and `backgroundColor: colors.surface`.

### Step 8: Build Firebase Service

**What**: Created `src/services/firebase/` with config, auth helpers, and Firestore integration.

**`config.ts`**:
- Reads Firebase config from `EXPO_PUBLIC_*` environment variables
- Initializes Firebase app (with guard for hot reload re-initialization)
- Initializes Auth and Firestore
- Exports `auth` and `db` instances

**`auth.ts`**:
- `signUp(email, password)` → Creates Firebase user + Firestore user profile document
- `signIn(email, password)` → Signs in + fetches user profile from Firestore
- `signOut()` → Firebase sign out
- `resetPassword(email)` → Sends password reset email
- `getUserProfile(uid)` → Reads user doc from `users/{uid}` in Firestore
- `onAuthChanged(callback)` → Wraps `onAuthStateChanged` for the auth state listener

**Firestore user document created on signup**:
```typescript
{
  email: string,
  displayName: null,
  onboardingComplete: false,
  subscriptionTier: 'free',
  settings: {
    autoAssumeTaken: false,
    notificationsEnabled: true,
  },
  createdAt: serverTimestamp(),
}
```

### Step 9: Build Auth Store (Zustand)

**What**: Created `src/stores/useAuthStore.ts` — the global auth state.

**State shape**:
```typescript
{
  user: UserProfile | null,
  isLoading: boolean,       // true until first auth check completes
  isAuthenticated: boolean,  // derived from user !== null
}
```

**Actions**: `setUser(user)`, `setLoading(loading)`, `signOut()`

**How it connects**: The root `_layout.tsx` calls `onAuthChanged()` on mount, which updates the store. All screens read from this store to determine auth state.

### Step 10: Build Core Types

**What**: Created `src/core/types.ts` with all domain types.

**Types defined**:
- `PillType`: `'scheduled' | 'random'`
- `ScheduleFrequency`: `'daily' | 'specific_days' | 'every_n_days'`
- `DoseStatus`: `'active' | 'dismissed' | 'completed'`
- `DoseSource`: `'manual' | 'notification' | 'auto' | 'retroactive'`
- `SubscriptionTier`: `'free' | 'pro'`
- `PillSchedule`: timeOfDay, frequency, daysOfWeek?, intervalDays?
- `Pill`: full pill model (id, drugName, halfLifeMinutes, dosageMg, schedule, color, etc.)
- `Dose`: dose record (pillId, takenAt, eliminationAt, status, source, etc.)
- `UserSettings`: autoAssumeTaken, notificationsEnabled
- `UserProfile`: uid, email, displayName, onboardingComplete, subscriptionTier, settings

### Step 11: Build Auth Screens

**What**: Built 3 auth screens matching the Stitch HTML mockups.

**`login.tsx`** (matches `docs/stitch_halflifecontrol_html/login_screen/`):
- Header: "Login" (displaySm) + "Welcome back to HalfLifeControl" subtitle
- Form card with rounded-[2rem] corners, shadow, surfaceContainerLowest background
- Email input + Password input with "Forgot Password?" link
- Primary CTA button
- "OR CONTINUE WITH" divider + Google/Apple buttons (disabled, opacity 0.5 — enabled in Phase 6)
- Footer: "Don't have an account? Register" link
- Form validation: required fields, email format check
- Error handling: wrong credentials, too many attempts, generic errors via `Alert.alert()`
- Calls `signIn()` → `setUser()` on success → auth gate auto-redirects

**`register.tsx`** (matches `docs/stitch_halflifecontrol_html/register_screen/`):
- Same card layout as login
- Fields: Email, Password (8+ chars), Confirm Password
- Terms checkbox: "I agree to Terms of Service and Privacy Policy"
- Validation: all fields required, password length, password match, terms accepted
- Error handling: email in use, weak password
- Calls `signUp()` → `setUser()` → auto-redirect to onboarding (since `onboardingComplete: false`)

**`forgot-password.tsx`**:
- Simple card with email input + "Send Reset Link" button
- After sending: shows "Check your email" message + "Back to Login" button
- Security: doesn't reveal whether email exists (silently succeeds for unknown emails)

### Step 12: Build Placeholder Screens

**`welcome.tsx`** (onboarding):
- "Welcome to HalfLifeControl" headline
- Two CTAs: "I take pills on a schedule" and "Just track a pill I took"
- Both currently redirect to dashboard (full onboarding flow built in Phase 3)

**`dashboard.tsx`** (main):
- Greeting with user's display name
- "My Daily Stack" section (empty state)
- "One-Time Tracking" section (empty state)
- Will be fully built in Phase 2

---

## What Needs To Happen Next

### Phase 2: Core Pill Tracking
Build in this order:

1. **`src/core/halflife.ts`** — Pure math functions:
   - `calculateConcentration(takenAt, halfLifeMinutes, now)` → percentage remaining
   - `getEliminationTime(takenAt, halfLifeMinutes)` → Date when ~97% eliminated (5 half-lives)
   - Add unit tests

2. **`src/core/scheduling.ts`** — Schedule logic:
   - `getNextDoseTime(schedule, now)` → next Date based on frequency/days
   - Add unit tests

3. **`src/stores/usePillStore.ts`** — Zustand store:
   - Pill CRUD (add, update, remove)
   - Dose CRUD (record dose, dismiss, complete)
   - Firestore sync (read/write to `users/{uid}/pills` and `users/{uid}/doses`)

4. **`src/hooks/useCountdown.ts`** — Real-time countdown hook:
   - 1-second setInterval while foregrounded
   - Uses `calculateConcentration()` on each tick
   - Returns `{ concentration, timeRemaining, isEliminated }`

5. **`src/components/pills/ProgressRing.tsx`** — SVG countdown ring:
   - 12px stroke, circular arc depletes based on concentration %
   - Center text shows remaining time

6. **`src/components/pills/PillCard.tsx`** — Pill display card:
   - Uses `Card` variant `scheduled` or `random`
   - Shows pill name, dosage, countdown ring or next dose time

7. **Dashboard screen** — Replace placeholder with real pill lists

8. **Add medication flow** — Match `docs/stitch_halflifecontrol_html/fixed_add_medication_flow/`

### Design Reference Reminder
All screens must match the Stitch HTML mockups in `docs/stitch_halflifecontrol_html/`. Each folder contains:
- `code.html` — The HTML/CSS markup (Tailwind classes define the styling)
- `screen.png` — Visual screenshot of the rendered design

The design system documentation is in `docs/stitch_halflifecontrol_html/vitality_clear/DESIGN.md`.

### Key Patterns Established in Phase 1
- **Import paths**: Always use `@/` alias (e.g., `import { colors } from '@/theme'`)
- **Styling**: Use `StyleSheet.create()` with theme tokens, never hardcode colors/sizes
- **Components**: Use `Typography`, `Button`, `Card`, `Input` from `@/components/ui`
- **State**: Use Zustand stores in `src/stores/`
- **Firebase**: Use service functions from `src/services/firebase/`, never import Firebase directly in screens
- **Navigation**: Expo Router file-based routing — create a file in the right directory, it becomes a route
- **Auth gating**: Handled automatically by root `_layout.tsx` — no need to check auth in individual screens

---

## File Inventory (Phase 1 Complete)

```
src/
├── app/
│   ├── _layout.tsx                    # Root layout: fonts, auth listener, auth gate
│   ├── index.tsx                      # Redirect → /(auth)/login
│   ├── (auth)/
│   │   ├── _layout.tsx                # Stack nav, no header
│   │   ├── login.tsx                  # Login screen (email/password + social placeholders)
│   │   ├── register.tsx               # Registration screen (email/password + terms)
│   │   └── forgot-password.tsx        # Password reset screen
│   ├── (onboarding)/
│   │   ├── _layout.tsx                # Stack nav, no header
│   │   └── welcome.tsx                # "Do you take pills?" screen (placeholder)
│   └── (main)/
│       ├── _layout.tsx                # Stack nav, no header
│       └── dashboard.tsx              # Dashboard (placeholder — built in Phase 2)
├── components/
│   └── ui/
│       ├── index.ts                   # Barrel export
│       ├── Typography.tsx             # Text with variant/color props
│       ├── Button.tsx                 # Primary/secondary/outline/ghost button
│       ├── Card.tsx                   # Elevated/outlined/scheduled/random card
│       └── Input.tsx                  # Filled input with focus/error states
├── core/
│   └── types.ts                       # Domain types (Pill, Dose, UserProfile, etc.)
├── services/
│   └── firebase/
│       ├── index.ts                   # Barrel export
│       ├── config.ts                  # Firebase app/auth/db initialization
│       └── auth.ts                    # signUp, signIn, signOut, resetPassword, getUserProfile
├── stores/
│   └── useAuthStore.ts                # Global auth state (Zustand)
└── theme/
    ├── index.ts                       # Barrel export
    ├── colors.ts                      # 40+ Material Design 3 color tokens
    ├── typography.ts                  # Full type scale (Display → Label)
    └── spacing.ts                     # Spacing scale, border radius, constants

assets/
└── fonts/
    ├── Lexend-Light.ttf
    ├── Lexend-Regular.ttf
    ├── Lexend-Medium.ttf
    ├── Lexend-SemiBold.ttf
    ├── Lexend-Bold.ttf
    ├── PlusJakartaSans-Light.ttf
    ├── PlusJakartaSans-Regular.ttf
    ├── PlusJakartaSans-Medium.ttf
    ├── PlusJakartaSans-SemiBold.ttf
    └── PlusJakartaSans-Bold.ttf

Root config files:
├── app.json                           # Expo config (bundle ID, plugins, splash)
├── eas.json                           # EAS Build profiles (dev/preview/prod, Android-first)
├── package.json                       # Dependencies, main: "expo-router/entry"
├── tsconfig.json                      # TypeScript strict + @/* path alias
├── .gitignore                         # Comprehensive ignores
└── .env.example                       # Template for required env vars
```

## Dependencies Installed (Phase 1)

```json
{
  "dependencies": {
    "@react-native-async-storage/async-storage": "2.2.0",
    "date-fns": "^4.1.0",
    "expo": "~55.0.8",
    "expo-constants": "~55.0.9",
    "expo-font": "~55.0.4",
    "expo-linking": "~55.0.8",
    "expo-router": "~55.0.7",
    "expo-splash-screen": "~55.0.12",
    "expo-status-bar": "~55.0.4",
    "firebase": "^12.11.0",
    "react": "^19.2.4",
    "react-native": "0.83.2",
    "react-native-gesture-handler": "~2.30.0",
    "react-native-reanimated": "4.2.1",
    "react-native-safe-area-context": "~5.6.2",
    "react-native-screens": "~4.23.0",
    "react-native-svg": "^15.15.4",
    "zod": "^4.3.6",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@types/react": "~19.2.2",
    "typescript": "~5.9.2"
  }
}
```

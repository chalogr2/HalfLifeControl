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

## Phase 2: Core Pill Tracking — COMPLETED

### Step 1: Core Half-Life Math (`src/core/halflife.ts`)

**What**: Pure TypeScript functions for all decay math — no React, no Firebase. Extractable for watch apps.

**Functions**:
- `concentration(elapsedMinutes, halfLifeMinutes)` → percentage remaining (0–100)
- `eliminationMinutes(halfLifeMinutes)` → 5 × halfLife (time to ~97% elimination)
- `eliminationDate(takenAt, halfLifeMinutes)` → absolute Date of elimination
- `minutesRemaining(takenAt, halfLifeMinutes, now)` → minutes until elimination, clamped ≥ 0
- `eliminationProgress(takenAt, halfLifeMinutes, now)` → 0→1 progress (0 = just taken, 1 = eliminated)
- `formatTimeRemaining(minutes)` → human string like "4h 23m" or "Eliminated"

### Step 2: Scheduling Logic (`src/core/scheduling.ts`)

**What**: Pure scheduling functions for computing next dose times.

**Functions**:
- `nextScheduledDose(schedule, now)` → next Date for a PillSchedule (handles daily, specific_days, every_n_days)
- `describeSchedule(schedule)` → human-readable string like "Daily at 08:00" or "Mon, Wed, Fri at 09:00"

### Step 3: Firestore CRUD for Pills & Doses (`src/services/firebase/pills.ts`)

**What**: Full Firestore subcollection CRUD under `users/{userId}/pills` and `users/{userId}/doses`.

**Pills**: `addPill`, `updatePill`, `deletePill`, `fetchPills`, `subscribePills` (real-time listener)
**Doses**: `recordDose` (precomputes `eliminationAt`), `updateDoseStatus`, `fetchActiveDoses`, `subscribeActiveDoses` (real-time, filtered by `status == 'active'`)

- All functions use `serverTimestamp()` for `createdAt`/`updatedAt`
- `toPill()` and `toDose()` helpers handle Firestore Timestamp → Date conversion
- `subscribePills` and `subscribeActiveDoses` return Firestore `Unsubscribe` functions

### Step 4: Pill Store (`src/stores/usePillStore.ts`)

**What**: Zustand store wrapping Firestore CRUD with real-time subscriptions.

**State**: `pills`, `activeDoses`, `isLoading`
**Actions**: `subscribe(userId)`, `unsubscribe()`, `addPill`, `updatePill`, `deletePill`, `recordDose`, `dismissDose`

- `subscribe()` sets up both `subscribePills` and `subscribeActiveDoses` listeners
- `unsubscribe()` cleans up listeners and resets state
- Store keeps module-level `unsubs` array for cleanup

### Step 5: Countdown Hook (`src/hooks/useCountdown.ts`)

**What**: React hook that recomputes half-life countdown every second.

**Returns**: `{ concentration, minutesRemaining, progress, timeLabel, isEliminated }`

- Uses 1-second `setInterval` while foregrounded
- Listens to `AppState` changes — recomputes instantly on foreground resume (no drift)
- All state derived from pure `halflife.ts` math functions on each tick

### Step 6: Pill Components

**`ProgressRing.tsx`**: SVG circular progress ring using `react-native-svg`.
- Shows depleting arc (progress 0→1 maps from full ring to empty)
- Center label shows time remaining
- Customizable size, stroke width, and color

**`CountdownTimer.tsx`**: Combines `useCountdown` hook + `ProgressRing` + concentration % text.
- Shows "Eliminated" label when countdown completes

**`PillCard.tsx`**: Card for displaying a pill in the dashboard.
- Uses `Card` variant `scheduled` (solid left accent) or `random` (dashed border)
- Shows pill name, dosage, schedule description
- Shows `CountdownTimer` if there's an active dose, or "Next: 8:30 AM" label if not

**Barrel export**: `src/components/pills/index.ts`

### Step 7: Pill Color Palette (`src/core/pillColors.ts`)

**What**: 10 predefined accent colors for pill visual identification.
- `PILL_COLORS` array from the M3 tonal palette
- `getDefaultPillColor(index)` cycles through colors

### Step 8: Add Medication Screen (`src/app/(main)/pill/add.tsx`)

**What**: Full add-pill form with:
- Pill type toggle: "Scheduled" vs "One-time"
- Drug name input (manual for Phase 2; drug search added in Phase 3)
- Dosage + unit inputs
- Half-life input with hours/minutes toggle
- Schedule section (visible only for scheduled pills): time of day, frequency selector (daily / specific days / every N days), day-of-week picker, interval input
- Color picker: 10 predefined colors
- Save button: creates pill via `usePillStore.addPill()`, navigates back

**Route**: `/(main)/pill/add` with its own `_layout.tsx` (Stack, no header)

### Step 9: Dashboard Rebuild (`src/app/(main)/dashboard.tsx`)

**What**: Replaced placeholder with fully functional dashboard.

**Features**:
- Subscribes to pills + active doses via `usePillStore.subscribe(userId)` with cleanup
- Splits pills into `scheduledPills` and `randomPills` using `useMemo`
- `FlatList` renders `PillCard` for each pill with active dose and next-dose label
- Tapping a pill with no active dose → Alert "Took it?" → calls `recordDose()`
- Floating Action Button (64px, bottom-right) → navigates to `/(main)/pill/add`
- Empty state: "No medications yet" with instructions

### Step 10: Dependency Added

- `react-native-svg` — installed via `npx expo install react-native-svg` for the ProgressRing SVG component

### TypeScript Verification

Ran `npx tsc --noEmit` — **0 errors**. One fix applied: `selectedColor` state needed explicit `string` type annotation to avoid narrowing to a union literal from `PILL_COLORS[0]`.

---

## What Needs To Happen Next

### Phase 3: Drug Search + Onboarding
Build in this order:

1. **openFDA client** (`src/services/openfda/`) — API client with caching, type-safe response parsing
2. **Curated half-life JSON** — Start with top 50 drugs, expand to 200. Shipped with the app.
3. **`DrugSearchBar` component** — Typeahead search across openFDA + curated DB + manual fallback
4. **Full onboarding flow**:
   - `welcome.tsx` → rebuilt with proper routing
   - Drug search screen → add pills during onboarding
   - Schedule editor screen
   - Paywall gate (adding 2nd scheduled pill)
5. **Navigation guards** — auth → onboarding → main flow fully wired

### Design Reference Reminder
All screens must match the Stitch HTML mockups in `docs/stitch_halflifecontrol_html/`. Each folder contains:
- `code.html` — The HTML/CSS markup (Tailwind classes define the styling)
- `screen.png` — Visual screenshot of the rendered design

The design system documentation is in `docs/stitch_halflifecontrol_html/vitality_clear/DESIGN.md`.

### Key Patterns Established in Phase 1 & 2
- **Import paths**: Always use `@/` alias (e.g., `import { colors } from '@/theme'`)
- **Styling**: Use `StyleSheet.create()` with theme tokens, never hardcode colors/sizes
- **Components**: Use `Typography`, `Button`, `Card`, `Input` from `@/components/ui`; pill components from `@/components/pills`
- **State**: Use Zustand stores in `src/stores/`
- **Firebase**: Use service functions from `src/services/firebase/`, never import Firebase directly in screens
- **Navigation**: Expo Router file-based routing — create a file in the right directory, it becomes a route
- **Auth gating**: Handled automatically by root `_layout.tsx` — no need to check auth in individual screens
- **Pure core logic**: `src/core/` has zero React/Firebase imports — pure TypeScript math and scheduling
- **Real-time subscriptions**: Use Firestore `onSnapshot` listeners in stores, clean up on unmount
- **Countdown pattern**: Calculate from absolute timestamps on each tick — no drift, instant catch-up on foreground

---

## File Inventory (Phase 2 Complete)

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
│       ├── dashboard.tsx              # Dashboard with pill list, FAB, dose tracking
│       └── pill/
│           ├── _layout.tsx            # Stack nav, no header
│           └── add.tsx                # Add medication form (manual entry)
├── components/
│   ├── ui/
│   │   ├── index.ts                   # Barrel export
│   │   ├── Typography.tsx             # Text with variant/color props
│   │   ├── Button.tsx                 # Primary/secondary/outline/ghost button
│   │   ├── Card.tsx                   # Elevated/outlined/scheduled/random card
│   │   └── Input.tsx                  # Filled input with focus/error states
│   └── pills/
│       ├── index.ts                   # Barrel export
│       ├── ProgressRing.tsx           # SVG circular countdown ring
│       ├── CountdownTimer.tsx         # Ring + concentration % + time label
│       └── PillCard.tsx               # Full pill card with countdown/next-dose
├── core/
│   ├── types.ts                       # Domain types (Pill, Dose, UserProfile, etc.)
│   ├── halflife.ts                    # Pure decay math (concentration, elimination, formatting)
│   ├── scheduling.ts                  # Next dose calculation, schedule description
│   └── pillColors.ts                  # 10 predefined accent colors for pills
├── hooks/
│   └── useCountdown.ts                # Real-time countdown hook (1s interval, AppState aware)
├── services/
│   └── firebase/
│       ├── index.ts                   # Barrel export (auth + pills)
│       ├── config.ts                  # Firebase app/auth/db initialization
│       ├── auth.ts                    # signUp, signIn, signOut, resetPassword, getUserProfile
│       └── pills.ts                   # Pill/dose Firestore CRUD + real-time subscriptions
├── stores/
│   ├── useAuthStore.ts                # Global auth state (Zustand)
│   └── usePillStore.ts               # Pills + doses state with Firestore sync (Zustand)
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

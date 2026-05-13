# HalfLifeControl — App Progress Log

> **Backend migration in progress (2026-04)**: HalfLifeControl is moving from Firebase to Supabase. All entries below this banner were written during the Firebase era and remain as a historical record. The migration plan is documented in **[`MIGRATIONTOSUPABASE.md`](./MIGRATIONTOSUPABASE.md)**. New progress entries after the migration will note "Supabase" where relevant.

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

## Phase 3: Drug Search + Onboarding — COMPLETED

### Step 1: Curated Drug Database (`src/data/drugDatabase.ts`)

**What**: 50 common drugs with half-life data, brand names, categories, and common dosages. Shipped with the app for instant offline typeahead.

- Each entry: `{ id, name, brands[], halfLifeMinutes, halfLifeLabel, commonDosageMg, category }`
- Categories: NSAID, Analgesic, ACE Inhibitor, Statin, SSRI, SNRI, Benzodiazepine, Antibiotic, PPI, Antihistamine, etc.
- `searchDrugs(query)` function: case-insensitive search across name, brands, and id. Minimum 2 chars.

### Step 2: openFDA API Client (`src/services/openfda/index.ts`)

**What**: Fallback drug search via the openFDA Drug Label API.

- Searches `openfda.generic_name` and `openfda.brand_name` fields
- In-memory cache to avoid re-fetching the same query
- 5-second timeout via AbortController
- De-duplicates results by generic name
- Returns `{ genericName, brandName }[]`
- Silently returns empty on errors (no user-facing error for search fallback)

### Step 3: DrugSearchBar Component (`src/components/pills/DrugSearchBar.tsx`)

**What**: Typeahead search dropdown with 3-tier search strategy.

**Search flow**:
1. Curated DB searched instantly (≥2 chars) — results show "HL" badge
2. openFDA searched asynchronously (≥3 chars, only if <3 curated results) — results show "(FDA)" label
3. Manual entry always shown as last option — "Enter details manually"

**UX**: 200ms debounce, dropdown with results, loading spinner during FDA search, select auto-fills drug name (and half-life/dosage from curated entries).

### Step 4: Welcome Screen Rebuild (`src/app/(onboarding)/welcome.tsx`)

**What**: Rebuilt to match `final_clean_welcome_screen/` Stitch mockup.

- Brand name "HalfLifeControl" at top
- Illustration placeholder (primaryContainer circle with pill emoji)
- "Let's manage your medications together." headline
- Subtitle: "Start by setting up your daily pill stack or tracking a single pill."
- Two CTA cards with chevron arrows:
  - "Yes, I take pills on a schedule" → navigates to `/(main)/pill/add?type=scheduled`
  - "No, I just want to track a pill now" → navigates to `/(main)/pill/add?type=random`
- "Already have an account? Log in" link at bottom

### Step 5: Add Medication Flow Rebuild (`src/app/(main)/pill/add.tsx`)

**What**: Rebuilt to match `fixed_add_medication_flow/` Stitch mockup.

**Sections with numbered icons**:
1. Drug Search — `DrugSearchBar` at top; selecting curated drug auto-fills half-life + dosage
2. Dosage — amount + unit inputs
3. Half-Life — shown only when `halfLifeSource === 'manual'` (hidden for curated drugs)
4. Schedule — frequency toggles (Every day / Specific days / As needed), day picker, reminder time
5. Pill Color — 10 accent color dots

**Key changes from Phase 2**:
- Replaced manual drug name input with `DrugSearchBar`
- Added `?type=` query param support (from welcome screen)
- "As needed" frequency maps to `pillType: 'random'`
- Success modal on save: "Medication Added!" with checkmark icon + "Back to Dashboard" button
- Fixed bottom CTA bar (sticky save button)

### Step 6: Bottom Tab Navigation

**What**: Restructured `(main)` from a flat Stack to Tabs + Stack.

**New structure**: `(main)/_layout.tsx` is a Stack with:
- `(tabs)` — Tab navigator (default screen)
- `pill/` — Modal stack (add medication presented as modal overlay)

**`(tabs)/_layout.tsx`**: Three tabs:
- **Dashboard** — pill list, countdown timers, FAB
- **History** — placeholder (dose history, Phase 4)
- **Settings** — account info, legal links, sign out

Tab bar: `surfaceContainerLow` background, no border (tonal separation), 64px height.

### Step 7: Dashboard Rebuild (`src/app/(main)/(tabs)/dashboard.tsx`)

**What**: Rebuilt to match `dashboard_with_balanced_timer_thickness/` Stitch mockup.

**Changes**:
- Switched from `FlatList` to `SectionList` with "My Daily Stack" and "One-Time Tracking" sections
- Profile avatar circle (top-right, primary color, shows first initial)
- "Add pill to stack" / "Track another pill" dashed-border links after each section
- Section headers as sticky titles
- FAB repositioned above tab bar

### Step 8: Settings Screen (`src/app/(main)/(tabs)/settings.tsx`)

**What**: Basic settings with account info, legal links, and sign out.

- Shows current user email
- Terms of Service and Privacy Policy links (navigation TBD)
- Sign out button with confirmation alert (errorContainer background)

### Step 9: History Screen (`src/app/(main)/(tabs)/history.tsx`)

**What**: Placeholder screen — "Your dose history will appear here."

### Step 10: Auth Gate Update

Updated `_layout.tsx` auth gate redirect from `/(main)/dashboard` to `/(main)/(tabs)/dashboard` for the new tabs structure.

### TypeScript Verification

Ran `npx tsc --noEmit` — **0 errors**.

---

## Phase 4: Notifications + History — COMPLETED

### Step 1: Dose History Queries (`src/services/firebase/pills.ts`)

**What**: Added paginated history and date-range queries.

- `fetchDoseHistory(userId, pageSize, afterDoc)` — paginated, all statuses, newest first. Returns `{ doses, lastDoc, hasMore }` for infinite scroll.
- `fetchDosesByDateRange(userId, startDate, endDate)` — all doses within a date range, ordered by `takenAt` ascending.
- Uses `startAfter` cursor for Firestore pagination, fetches `pageSize + 1` to detect if there are more pages.

### Step 2: History List Screen (`src/app/(main)/(tabs)/history.tsx`)

**What**: Rebuilt to match `refined_history_list_screen/` Stitch mockup.

- **Overall adherence card** at top: calculates days-with-doses / total-tracked-days as percentage
- **Day cards**: each card shows date, pills taken count, unique medications count
- **SectionList** grouped by day, newest first
- "Today" label for the current date
- Tapping a day navigates to `/(main)/history/[date]` (day detail)
- Empty state: "No history yet"
- Loads last 200 doses on mount

### Step 3: Day Detail Screen (`src/app/(main)/history/[date].tsx`)

**What**: Rebuilt to match `refined_day_detail_view_screen/` Stitch mockup.

- **Daily Completion ring**: percentage of scheduled pills taken that day
- **Time-of-day grouping**: Morning (<12), Afternoon (12–17), Evening (≥17)
- Each dose shows colored dot (pill accent color), drug name, time taken
- **Consistency badge**: "Great Consistency!" when 100% completion
- Back button to return to history list
- Dynamic route: `[date].tsx` receives `YYYY-MM-DD` param

### Step 4: Settings Screen Rebuild (`src/app/(main)/(tabs)/settings.tsx`)

**What**: Rebuilt to match `final_settings_screen_with_large_legal_buttons/` Stitch mockup.

- **Reminder preferences**: 3 radio-style cards:
  1. "Automatically start countdown at scheduled time"
  2. "Prompt to answer if pill was taken"
  3. "Simple notification only"
- Radio buttons with primary-colored inner dot when selected
- Active card gets 2px primary border
- **Legal links**: Terms of Service, Privacy Policy (tonal background buttons)
- **Account info**: shows signed-in email
- **Sign out**: error-container button with confirmation alert

### Step 5: Local Notifications (`src/services/notifications/index.ts`)

**What**: expo-notifications integration for pill reminders.

- `requestNotificationPermissions()` — requests permission, returns boolean
- `schedulePillReminder(pill)` — schedules daily or weekly notifications based on `PillSchedule`
  - Daily: `DAILY` trigger at `timeOfDay`
  - Specific days: one `WEEKLY` trigger per day of the week
  - Cancels existing reminders for the pill first (prevents duplicates)
- `cancelPillReminders(pillId)` — cancels all scheduled notifications for a specific pill
- `cancelAllReminders()` — nuclear option
- `scheduleAllPillReminders(pills)` — batch schedule for all active scheduled pills
- `setNotificationResponseHandler(handler)` — registers listener for notification taps, returns cleanup function

**Notification content**: "Time for your medication" title, drug name + dosage body, pillId in data.

### Step 6: Dashboard Notification Integration

- Added `scheduleAllPillReminders(pills)` effect — re-schedules when pills list changes
- Added `setNotificationResponseHandler` — tapping a notification triggers "took pill" flow for that pill
- Both effects clean up on unmount

### Step 7: App Config Update

Added `expo-notifications` plugin to `app.json` with icon and primary color for Android notification channel.

### TypeScript Verification

Ran `npx tsc --noEmit` — **0 errors**.

---

## Phase 5: Subscription + Paywall + Bug Fixes

**Completed**: 2026-03-31

### What Was Built

1. **RevenueCat subscription service** (`src/services/subscription/index.ts`)
   - `initSubscriptions(userId)` — configures RevenueCat with platform-appropriate API key
   - `getSubscriptionTier()` — checks active entitlements, returns `'free'` or `'pro'`
   - `getOfferings()` — fetches available packages (monthly/annual)
   - `purchasePackage(pkg)` — executes purchase, returns new tier
   - `restorePurchases()` — restores previous purchases
   - `onSubscriptionChange(callback)` — listener for tier changes
   - **Graceful degradation**: When RevenueCat API keys aren't configured, all functions return `'free'` tier with no errors — app works fully in development without RevenueCat setup

2. **Subscription Zustand store** (`src/stores/useSubscriptionStore.ts`)
   - `FREE_SCHEDULED_LIMIT = 1` — the free tier pill cap
   - Manages `tier`, `packages`, `isLoading` state
   - `canAddScheduledPill(currentCount)` — pure check used by add-pill flow
   - `init(userId)` — called from root auth listener on login
   - `purchase(pkg)` / `restore()` — delegates to service, updates store

3. **Paywall screen** (`src/app/(main)/subscription/paywall.tsx`)
   - Matches Stitch mockup `finalized_go_pro_screen/`
   - Feature list: unlimited scheduled pills, unlimited random tracking, future features
   - Annual/Monthly plan cards with radio selection
   - "BEST VALUE" badge on annual plan
   - Displays RevenueCat pricing when available, fallback hardcoded prices ($3.33/mo annual, $4.99/mo)
   - Purchase, Restore, and "Continue with Free" CTAs
   - Loading states and error alerts

4. **Free tier gate in add-pill flow** (`src/app/(main)/pill/add.tsx`)
   - Checks `canAddScheduledPill(scheduledCount)` at save time (not form load)
   - If limit reached, redirects to paywall instead of saving
   - Users can explore the full add-pill UX before seeing the paywall

5. **Subscription route group** (`src/app/(main)/subscription/`)
   - `_layout.tsx` — Stack navigator, no header
   - `paywall.tsx` — the Go Pro screen
   - Registered as modal presentation in `(main)/_layout.tsx`

6. **Root layout subscription init** (`src/app/_layout.tsx`)
   - Auth listener now calls `initSubscriptions(firebaseUser.uid)` after profile fetch
   - Subscription tier is available app-wide from first login

### Bug Fixes (from DEVELOPERINPUT.md audit)

7. **Fixed: `onboardingComplete` never set to `true`** (DEVELOPERINPUT #9)
   - Added `completeOnboarding(uid)` to `src/services/firebase/auth.ts`
   - Called after first pill is saved in `pill/add.tsx`
   - Also updates local Zustand state so auth gate doesn't redirect

8. **Fixed: Settings reminder preference not persisted** (DEVELOPERINPUT #11)
   - Added `updateUserSettings(uid, settings)` to `src/services/firebase/auth.ts`
   - Settings screen now calls this on reminder mode change
   - `ReminderMode` type moved from local definition to canonical `src/core/types.ts`

### Settings Screen Updates (`src/app/(main)/(tabs)/settings.tsx`)
   - Subscription status display: "Upgrade to Pro" card (free tier) or "Pro Plan Active" badge (pro tier)
   - Upgrade card navigates to paywall
   - Reminder mode persisted to Firestore via `updateUserSettings`

### TypeScript Verification

Ran `npx tsc --noEmit` — **0 errors**.

---

## Phase 6: Google Sign-In + Sentry + Accessibility + Android Build

**Completed**: 2026-03-31

### What Was Built

1. **Google Sign-In** (`src/services/firebase/googleAuth.ts`)
   - `signInWithGoogle()` — native Google Sign-In via `@react-native-google-signin/google-signin`
   - Exchanges Google ID token for Firebase credential via `signInWithCredential` + `GoogleAuthProvider`
   - Creates Firestore user profile on first Google sign-in (same flow as email registration)
   - `isGoogleCancellation()` — helper to distinguish user cancel from real errors
   - Graceful degradation: warns and disables when `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` not set

2. **Auth screens updated** (`login.tsx`, `register.tsx`)
   - Google button now functional with loading state
   - Apple button marked "iOS only" with disabled state (deferred to Phase 7)

3. **Sentry crash reporting** (`src/services/sentry/index.ts`)
   - `initSentry()` — initializes with DSN from env var, skips if not configured
   - `setSentryUser()` / `clearSentryUser()` — tracks authenticated user
   - `captureException()` / `captureMessage()` / `addBreadcrumb()` — error reporting utilities
   - `wrapRootComponent()` — wraps root layout when Sentry is active
   - Integrated into root `_layout.tsx` (init + user tracking)
   - Error capture added to `pills.ts` (Firestore writes) and `notifications/index.ts` (scheduling)

4. **Accessibility pass** — all screens
   - `accessibilityRole` on every `Pressable` (button, radio, checkbox, link, progressbar)
   - `accessibilityState` for selected/checked states on radio buttons, checkboxes, toggles
   - `accessibilityLabel` with descriptive text on all interactive elements
   - `accessibilityHint` on PillCard for action guidance
   - `accessibilityValue` on ProgressRing for screen readers
   - Screens covered: login, register, forgot-password, welcome, dashboard, history, day detail, settings, paywall, add pill

5. **Build configuration**
   - `app.json`: Added `googleServicesFile` for Android, Google Sign-In + Sentry plugins
   - `eas.json`: Added `emulator` build profile for Android emulator testing
   - `.env.example`: Added `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

### Architectural Decision: @react-native-firebase Deferred

The `@react-native-firebase` migration was **intentionally deferred**. Rationale:
- Firebase JS SDK v12 handles all current needs (Auth, Firestore, real-time listeners)
- Local notifications via `expo-notifications` cover the pill reminder use case
- The migration would touch virtually every file and risk regressions across all features
- Google Sign-In works without native Firebase (uses `signInWithCredential` from JS SDK)
- FCM push notifications are only needed when Cloud Functions are built (future phase)

### TypeScript Verification

Ran `npx tsc --noEmit` — **0 errors**.

---

## Data Optimization: Local-First + Single-Document Schema

**Completed**: 2026-03-31

### Problem

The original schema used individual Firestore documents per pill and dose, with real-time `onSnapshot` listeners running continuously. This caused:
- Hundreds of document reads per user per day (each app open re-read all pills + all doses)
- Unnecessary real-time listeners for data that only changes on user action
- Linear cost scaling with user count

### Solution: Single-Document Vault + Monthly Bucketing + Cache-First

**New Firestore Schema:**
- `users/{uid}/data/dashboard` — single document containing all pills + active doses
- `users/{uid}/history/{YYYY-MM}` — one document per month containing all doses for that month

**Cache-First Strategy:**
- `src/services/cache/index.ts` — AsyncStorage-based local cache
- On app open: load from cache instantly (0 Firestore reads), sync from Firestore in background (1 read)
- On write: update cache immediately, push to Firestore (SDK queues if offline)
- On sign-out: clear local cache

**Cost Impact:**
| Metric | Before | After |
|--------|--------|-------|
| App open reads | 10-20+ (N pills + N doses) | 1 (single dashboard doc) |
| Real-time listeners | 2 continuous | 0 |
| Record dose | 1 write | 2 writes (dashboard + monthly bucket) |
| View month history | N reads (individual dose docs) | 1 read (monthly bucket doc) |
| Cost at 10K DAU | ~$50-100/mo | ~$5/mo |

**Files Changed:**
- `src/services/firebase/pills.ts` — complete rewrite for single-doc + monthly buckets
- `src/stores/usePillStore.ts` — replaced subscription model with cache-first init
- `src/services/cache/index.ts` — new AsyncStorage cache layer
- `src/core/types.ts` — added `DashboardDocument`, `MonthlyHistoryDocument`, `generateId()`
- `src/services/firebase/auth.ts` — clears cache on sign-out
- `src/services/firebase/index.ts` — updated exports
- `src/app/_layout.tsx` — initializes pill store on auth
- `src/app/(main)/(tabs)/dashboard.tsx` — removed subscribe/unsubscribe
- `src/app/(main)/(tabs)/history.tsx` — adapted to new fetchDoseHistory API
- `docs/DEVELOPERINPUT.md` — updated Firestore security rules with pill limit enforcement

**Security: Pill limit enforced at database level** — Firestore rules now check `subscriptionTier` and reject writes that add pills beyond the free limit, preventing client-side bypass.

### Write-Ahead Log (WAL) — Multi-Device Safe, Guaranteed Reliability

**Problem**: The Firebase JS SDK does not guarantee writes survive app kills. Additionally, the original WAL stored full document snapshots, which would overwrite concurrent writes from other devices (phone + watch).

**Solution**: Operation-based WAL with a hybrid write strategy:

**Append operations** (most frequent — recording doses, adding pills) use Firestore `arrayUnion`:
- 0 Firestore reads, 1 write per operation
- Commutative: Phone adds Aspirin + Watch adds Metformin → both survive
- `setDoc({ merge: true })` for history creates the month doc if it doesn't exist

**Mutation operations** (rare — editing/deleting pills, dismissing doses) use `runTransaction`:
- 1 Firestore read, 1 write per operation
- Read-then-merge: concurrent edits don't overwrite each other

**WAL entry format** — operations, not state snapshots:
| Operation | Trigger | Firestore Method | Cost |
|-----------|---------|-----------------|------|
| `addPill` | User adds pill | `arrayUnion` | 0R 1W |
| `addDose` | User takes pill | `arrayUnion` | 0R 1W |
| `addHistoryDose` | Dose recorded | `arrayUnion` + merge | 0R 1W |
| `updatePill` | User edits pill | `runTransaction` | 1R 1W |
| `deletePill` | User removes pill | `runTransaction` | 1R 1W |
| `removeDose` | User dismisses dose | `runTransaction` | 1R 1W |

**Flow** (same for all operations):
1. Update local cache (AsyncStorage) — instant
2. Enqueue operation to WAL (AsyncStorage) — persists across app kills
3. Attempt Firestore write (arrayUnion or transaction)
4. On success → dequeue; on failure → stays in WAL, retried on next app open

**Conflict resolution**: If pending WAL entries exist when syncing from Firestore, local cache wins — remote data is not applied until all pending operations flush.

**Multi-device edge cases**:
- Same pill taken on phone + watch offline → both doses have unique IDs, both survive via `arrayUnion`
- Pill edited on phone + dose recorded on watch → transaction edits pill, arrayUnion adds dose, no conflict
- Pill deleted on phone while watch records dose → soft delete (isActive=false), dose still has denormalized data

**Files:**
- `src/services/cache/index.ts` — WAL types (`WriteOperation` discriminated union), `enqueueWrite`, `dequeueWrite`, `getWriteQueue`, `hasPendingWrites`
- `src/services/firebase/pills.ts` — `executeOperation()` dispatches by op type, `enqueueAndAttempt()` is the common WAL wrapper, `flushWriteQueue()` retries on app open

### Code Review Fixes (2026-03-31)

Addressed findings from automated code review pass:

**Critical/High:**
- **WAL ordering**: All write paths now enqueue to WAL *before* updating local cache, preventing orphaned optimistic state on app kill
- **Subscription tier Firestore sync**: `useSubscriptionStore` writes `subscriptionTier` to Firestore as a temporary fallback. The secure path is the Cloud Function in `functions/src/index.ts` (RevenueCat webhook) — see Code Review Fixes Round 3 for the full enforcement rework
- **RevenueCat state leak**: Subscription service uses `Purchases.logIn()` on user switch and `Purchases.logOut()` on sign-out. Store cleans up listener on reset
- **Onboarding "No" branch**: Now marks onboarding complete and routes to dashboard instead of entering add-pill flow. AuthGate also handles `(onboarding)` group redirect
- **"Start Tracking" records dose**: Random pills now call `recordDose()` after creation so countdown starts immediately
- **Add pill success routing**: After first pill during onboarding, navigates to dashboard instead of `router.back()`

**Medium:**
- **Notification cleanup**: `deletePill` cancels scheduled reminders. `signOut` cancels all reminders
- **History adherence**: Calculates against actual date range span (earliest dose to today), not just days with entries
- **Day detail completion**: Only counts scheduled pills due on that specific day of week
- **Extra reads eliminated**: `initializeDashboardIfNeeded` checks cache before Firestore (0 reads on repeat opens). `appendToHistory` uses cache-only read since `arrayUnion` handles the remote append

### Defensive Bloat Prevention (2026-03-31)

**Problem**: The single-document vault pattern stores all pills + active doses in one Firestore doc (1 MiB limit). Without guardrails, the document could grow unbounded over years.

**Size budget** (documented in `pills.ts` header):
- Typical dashboard: 5–15 KB (5–10 pills + 5–10 active doses)
- Monthly history doc: 45–270 KB (5 pills × 1–3 doses/day × 30 days)
- 1 MiB limit allows ~3,300 pills or ~3,300 active doses — far beyond real usage

**Measures implemented**:

1. **Background sync pruning** (`loadDashboard` in `pills.ts`):
   - Expired active doses (`eliminationAt` in the past or status !== 'active') are removed from both cache and Firestore
   - Pills inactive for 6+ months (`isActive === false` and `updatedAt` older than 6 months) are pruned from Firestore
   - Pruned data is written back to Firestore on each app open via `setDoc`

2. **Firestore index exemptions** (`firestore.indexes.json`):
   - Disabled auto-indexing on `pills`, `activeDoses` (in `data` collection), and `doses` (in `history` collection)
   - These array fields are never queried individually — the entire document is always read
   - Saves storage and write costs

3. **Minimal object shapes**: Dose and pill objects carry only essential fields (~300 bytes each)

**Files changed**:
- `src/services/firebase/pills.ts` — pruning logic in `loadDashboard`, size budget comment
- `firestore.indexes.json` — index exemptions for array fields

### Code Review Fixes — Round 2 (2026-04-01)

Addressed second round of automated code review + manual findings:

**Critical:**
- **Firestore authorization hardened**: Added `activePillCount` denormalized counter to dashboard document. Firestore rules now check this counter (only counts active pills) instead of `pills.size()` (which included soft-deleted pills, locking free users out of adding replacement pills). Security rules also block client-side writes to `subscriptionTier` — requires Cloud Function webhook from RevenueCat. Documented Cloud Function code in `DEVELOPERINPUT.md`.

**High:**
- **Atomic dose recording**: `recordDose()` now enqueues BOTH dashboard and history WAL entries before attempting either Firestore write. Previously, a crash between the two writes would leave dashboard and history out of sync. New `enqueueMultiple()` + `attemptEnqueued()` helpers handle the atomic pattern.
- **Cross-device history sync fixed**: `getMonthHistory()` no longer blindly returns non-empty cache. It fetches from Firestore first, then merges with any locally-pending doses from cache that haven't synced yet. Falls back to cache-only when offline.
- **Dismiss/completion status persisted to history**: `updateDoseStatus()` now also writes the status change to the monthly history document via a new `updateHistoryDoseStatus` WAL operation. Previously, dismissing or completing a dose only removed it from the dashboard — the history entry stayed as "active" forever.
- **addPill uses transaction**: `addPill` WAL replay now uses `runTransaction` (not `arrayUnion`) so `activePillCount` stays in sync with the pills array. This is critical for the free-tier enforcement in Firestore rules.

**Medium:**
- **Day detail completion fixed**: `[date].tsx` now counts unique scheduled pills taken (via `Set` of `pillId`), not raw dose count. Taking the same pill twice no longer inflates the completion percentage.
- **Legal links wired up**: Settings and Register screens now navigate to `src/app/(main)/legal.tsx` with the correct `type` param. Placeholder text is shown — actual legal content must be drafted by the developer.
- **WAL migration logging**: Legacy WAL entries (old snapshot format without `operation` field) are now reported to Sentry with timestamps before being dropped, instead of silently discarded. This makes data loss from the migration visible.
- **Remaining feature gaps documented**: `every_n_days` UI, grouped notifications, action buttons, snooze, `autoAssumeTaken` tracked as future feature work in `DEVELOPERINPUT.md`. AsyncStorage plaintext limitation documented with options.

**Files changed:**
- `src/core/types.ts` — added `activePillCount` to `DashboardDocument`
- `src/services/cache/index.ts` — added `updateHistoryDoseStatus` WAL operation type
- `src/services/firebase/pills.ts` — atomic dose recording, cross-device history sync, history status updates, activePillCount tracking, WAL migration logging, addPill transaction
- `src/app/(main)/history/[date].tsx` — unique pill count in completion
- `src/app/(main)/(tabs)/settings.tsx` — legal link navigation
- `src/app/(auth)/register.tsx` — legal link navigation
- `src/app/(main)/legal.tsx` — new legal placeholder screen
- `docs/DEVELOPERINPUT.md` — updated Firestore rules, Cloud Function code, legal status, feature gaps, AsyncStorage limitation
- `docs/APPPROGRESS.md` — this section

### HIPAA-Compliant Local Encryption (2026-04-01)

**Problem**: AsyncStorage stores medication data (drug names, dosages, schedules) as plaintext JSON. While iOS and Android encrypt app sandboxes at rest by default, this is insufficient for HIPAA compliance — data is accessible on rooted/jailbroken devices.

**Solution**: AES-256-GCM encryption layer inside `src/services/cache/index.ts`:

- **Key generation**: A 256-bit AES key is generated once per device via `expo-crypto` (`AESEncryptionKey.generate(256)`)
- **Key storage**: The key is stored in `expo-secure-store` (hardware-backed iOS Keychain / Android Keystore) — never in AsyncStorage
- **Encryption**: All PHI data (dashboard cache, history cache, WAL entries) is encrypted with AES-256-GCM before writing to AsyncStorage. Each write gets a unique 12-byte IV.
- **Storage format**: `base64(IV + ciphertext + GCM_tag)` — a single opaque string per AsyncStorage key
- **Non-PHI**: `lastSync` timestamp is stored in plaintext (not health data)
- **Migration**: Legacy unencrypted JSON values (starting with `{` or `[`) are detected on first read, transparently re-encrypted in place, and returned as plaintext to the caller. No manual migration needed.

**Overhead**:
- Size: ~33% increase in local storage (base64 encoding). On a 15 KB dashboard, that's ~20 KB encrypted. AsyncStorage handles up to 6 MB — headroom is still massive.
- Performance: ~1-2ms per encrypt/decrypt operation. The AES key is cached in memory after first load, so SecureStore is only hit once per app session.
- Firebase: Zero impact. Encryption is local-only — Firestore data format is unchanged.

**Packages added**: `expo-crypto`, `expo-secure-store`

**Files changed**:
- `src/services/cache/index.ts` — `secureGet`/`secureSet` wrappers, encryption key management, migration detection
- `docs/DEVELOPERINPUT.md` — updated item 13 status

### Code Review Fixes — Round 3 (2026-04-01)

Addressed third round of code review findings:

**Critical:**
- **Subscription enforcement reworked end-to-end**:
  - Created `functions/` directory with actual deployable Cloud Function (`functions/src/index.ts`) — RevenueCat webhook that securely sets `subscriptionTier` via Admin SDK. Includes shared-secret auth, handles all RevenueCat event types (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, etc.)
  - Free tier limits now match GAMEPLAN spec: **1 scheduled + 4 random** (was incorrectly just "activePillCount <= 1")
  - Added `activeScheduledCount` and `activeRandomCount` denormalized counters to `DashboardDocument` alongside `activePillCount`
  - Firestore rules updated to check per-type limits separately
  - `useSubscriptionStore` now exports both `canAddScheduledPill()` and `canAddRandomPill()`
  - Add-pill screen enforces random pill limit in addition to scheduled limit
  - Client-side `updateSubscriptionTier()` kept as documented temporary fallback (will be rejected by Firestore rules once deployed)

**High:**
- **enqueueMultiple is now truly atomic**: New `enqueueWriteBatch()` in `cache/index.ts` reads the WAL queue once and writes all entries in a single `AsyncStorage.setItem` call. A kill between entries is impossible because it's one write operation.
- **addPill replay is now idempotent**: Transaction checks `current.pills.some((p) => p.id === pillId)` before pushing. If Firestore succeeds but dequeue fails, the next WAL replay harmlessly skips the duplicate.

**Medium:**
- **History merge prefers local status over stale remote**: `getMonthHistory()` now compares status priority when merging. If a dose exists in both remote and local cache, local dismissed/completed status wins over remote active status, preventing temporary reverts while WAL flushes.
- **Random pills auto-archive on countdown completion**: Dashboard now filters out random pills whose dose has reached elimination. `getActiveDose()` skips eliminated doses so the pill becomes re-trackable. Matches GAMEPLAN spec: "auto-archive when countdown completes."
- **Legal screen accessible to unauthenticated users**: Moved `legal.tsx` from `(main)/` to root `app/` route. The AuthGate doesn't interfere with root-level routes, so register-screen legal links now work for logged-out users. Settings-side navigation updated too.

**Files changed:**
- `functions/` — new directory: `package.json`, `tsconfig.json`, `src/index.ts` (Cloud Function)
- `src/core/types.ts` — added `activeScheduledCount`, `activeRandomCount` to `DashboardDocument`
- `src/services/cache/index.ts` — added `enqueueWriteBatch()` for atomic multi-entry WAL writes
- `src/services/firebase/pills.ts` — `recomputeCounts()` helper, idempotent addPill, atomic enqueueMultiple, history merge with status priority, per-type counters
- `src/stores/useSubscriptionStore.ts` — added `FREE_RANDOM_LIMIT`, `canAddRandomPill()`
- `src/app/(main)/pill/add.tsx` — random pill limit gate
- `src/app/(main)/(tabs)/dashboard.tsx` — auto-archive random pills, skip eliminated doses
- `src/app/legal.tsx` — moved from `(main)/` to root route
- `src/app/(main)/(tabs)/settings.tsx` — updated legal navigation path
- `src/app/(auth)/register.tsx` — updated legal navigation path
- `tsconfig.json` — excluded `functions/` from main compilation
- `docs/DEVELOPERINPUT.md` — updated Firestore rules, Cloud Function deployment steps, legal screen path
- `docs/APPPROGRESS.md` — this section

### TypeScript Verification

Ran `npx tsc --noEmit` — **0 errors**.

---

## Duration-of-Action Timer Rework (2026-04-16)

### Problem
The third timer on the detail screen was computed as `2 × halfLife` for every drug. That multiplier is wrong for most drugs: BZDs (clonazepam) showed ~70 h when the clinical dosing interval is 12 h; ER opioids, PPIs, and methotrexate (weekly) were all misrepresented in ways that ranged from confusing to genuinely unsafe.

### Evidence pipeline
- `scripts/build-duration-db.mjs` pulls per-drug evidence from DailyMed (LOINC 34068-7 §2 Dosage, 43681-6 §12.2 Pharmacodynamics, 34090-1 §14 Clinical Studies) and PubChem PUGView into `docs/duration-research.md`.
- All 147 curated drugs were classified into three buckets in `docs/DRUGS.md` with citable sources:
  - **Category A — Duration of Action** (30 drugs): true pharmacodynamic duration exists (ibuprofen, insulin, triptans, IR opioids).
  - **Category B — Dosing Interval / Maintenance** (110 drugs): no distinct PD duration; use the labelled dosing interval (BID/TID/QD/weekly).
  - **Category C — Hide third timer** (7 drugs): no citable interval — PRN / OTC / supplements (sildenafil, caffeine, melatonin, vitamin D3, loperamide).
- Safety-first rules applied to 12 edge cases: err toward **shorter** duration (don't imply drug protection has outlived clinical effect) and **conservative** intervals (don't invite premature redose). Opioid ER brands with diverging BID vs QD schedules were split into separate rows (Zohydro ER / Hysingla ER, MS Contin / Kadian) so an overdose can't be masked by a one-size-fits-all 12 h timer.

### Schema + types
- `src/core/types.ts` — added `DurationType = 'action' | 'interval' | 'none'` plus `durationType`, optional `isMaintenanceInterval`, and `requiresWeeklyWarning` fields on both `Pill` and `Dose` (snapshotted so future DB edits can't retroactively shift history).
- `supabase/migrations/0002_duration_of_action.sql` — adds `duration_of_action_minutes` to `pills` + `doses`.
- `supabase/migrations/0003_duration_type.sql` — adds `duration_type`, `is_maintenance_interval`, `requires_weekly_warning` to both tables with `notify pgrst, 'reload schema'`.
- `src/data/drugDatabase.ts` — rewritten with extended `DrugEntry` interface covering all three classification fields across 149 entries (147 source + 2 opioid brand splits). `searchDrugs(query, limit)` typeahead helper retained.

### Wiring
- `src/services/supabase/pills.ts` — mapped new columns in `deserializePill`/`deserializeDose`/`pillToRow`/`doseToRow` and the `updatePill` WAL executor. Extended `recordDose`'s `Pick<Pill,...>` signature.
- `src/stores/usePillStore.ts` — extended `recordDose` Pick signature so callers must pass the full snapshot.
- `src/app/(main)/pill/add.tsx` — snapshots `durationType`, `isMaintenanceInterval`, `requiresWeeklyWarning` from the chosen curated `DrugEntry` onto the new pill; manual-entry path defaults to `durationType: 'action'` with null duration (2×HL fallback).
- `src/app/(main)/pill/[id].tsx` — `getTimerConfigs(durationType, isMaintenanceInterval)` builds the timer list dynamically:
  - `'action'` → "Duration of Action" label
  - `'interval'` → "Dosing Interval" (or "Maintenance Interval" when `isMaintenanceInterval`)
  - `'none'` → third row omitted entirely
  - `useEffect` falls back `preferredTimer → 'clearance'` when the saved choice is no longer rendered.
  - Red safety banner renders above the title section when `requiresWeeklyWarning` (methotrexate).
- `src/components/pills/PillCard.tsx` — guards dashboard rendering: if a legacy pill has `preferredTimer: 'action'` but `durationType: 'none'`, falls back to `'clearance'`.

### Verification
- `npx tsc --noEmit` passes clean.
- Database counts confirmed via grep: 149 entries (30 A / 110 B / 7 C + 2 opioid splits).

### Known follow-ups
- Migrate existing rows once: curated pills created before 2026-04-16 will read `duration_type = 'action'` from the default column value; if that's wrong for a given drug (e.g. clonazepam now belongs in category B), users will need to delete + re-add to pick up the corrected snapshot. No retro-migration script ships since the DB values are snapshots by design.

---

## Dashboard Status + Timer Rollover Polish (2026-04-22)

### Context
A Sonnet-driven Stitch design pass (commit `ebe1fc3`) refined fonts/spacing but introduced two regressions and exposed an older UX gap. This session fixed both regressions and added per-timer rollover / lock semantics.

### Regressions fixed
- **One-time pills lingered on the dashboard after their timer completed** and reappeared as ghosts on cold start. Root cause: `applyDashboard` wrote all cached active doses into the store without filtering by `eliminationAt`, and the dashboard's `useMemo`-gated list never recomputed on time passage.
  - `src/stores/usePillStore.ts` — `applyDashboard` now filters `activeDoses` to `status === 'active' && eliminationAt > now`. Added `pruneExpiredDoses()` action that trims expired doses in place.
  - `src/app/(main)/(tabs)/dashboard.tsx` — added a `useEffect` that schedules one-shot `setTimeout`s at each active dose's `eliminationAt` so the prune fires at the exact expiry moment. Clamped to 24 h horizon; a re-render covers anything longer.
- **Play button on `PillCard` stopped firing** after the Stitch pass nested the play Pressable inside the card Pressable and relied on `e.stopPropagation()`. That's a no-op on RN synthetic events and nested Pressables don't reliably isolate under the New Architecture + React 19.
  - `src/components/pills/PillCard.tsx` — restructured so the card Pressable and play-button Pressable are **siblings** inside a parent `View`. The play button is absolutely positioned over the card's right edge; visual layout is unchanged, each Pressable owns its own responder.

### Dynamic dashboard status text
The pill card status row used to read `"In blood stream"` for any active dose. Now it reflects the specific timer being displayed — `"In blood stream"` is reserved for the clearance timer.
- `src/core/halflife.ts` — new pure helper `timerLabel(timerType, durationType, isMaintenanceInterval)`:
  - `halfLife` → `"Half-Life"`
  - `clearance` → `"In blood stream"`
  - `action` + `durationType: 'action'` → `"Duration of Action"`
  - `action` + `durationType: 'interval'` → `"Dosing Interval"` (or `"Maintenance Interval"` for weekly drugs)
- `src/components/pills/PillCard.tsx` — `statusText` derived from `timerLabel(effectiveTimer, activeDose.durationType, activeDose.isMaintenanceInterval)`; `"Inactive"` when no active dose.

### Auto-switching display timer (dashboard)
To avoid ever showing a timer at 0 on the dashboard, the displayed timer rolls over to the next-closest-to-zero as each one finishes. The user's explicit `preferredTimer` is untouched.
- `src/core/halflife.ts` — new pure helpers:
  - `availableTimerTypes(durationType)` — returns the timer types that exist for the pill (Category C drops `action`).
  - `pickEffectiveTimer(preferred, takenAt, halfLifeMinutes, durationOfActionMinutes, available, now?)` — returns `preferred` if still active, else the active timer with smallest remaining, else `null`.
- `src/components/pills/PillCard.tsx` — computes `effectiveTimer` via `pickEffectiveTimer` on every render and passes it to `CountdownTimer`. Schedules one-shot `setTimeout`s at each timer's zero-crossing (capped at 24 h) to force a rollover re-render the instant a timer finishes — cheaper than a 1 s poll. Replaces the old Category C-only `'action' → 'clearance'` patch since the new helper covers all rollover paths uniformly.

### Pill detail screen: grey out finished timers + auto-switch visual
- `DetailTimerRing` greys out + clears `onPress` + sets `accessibilityState.disabled` when `minutesRemaining <= 0`. Check badge only shows on an active selected timer; ring colour and labels use `outline` when done.
- `PillDetailScreen` decouples persistence from visual state:
  - `selectedTimer` (state) — drives the check badge / display.
  - `persistTimerRef` (ref) — only updated on **explicit user taps**; this is what gets written to Supabase on unmount.
  - `initialTimerRef` (ref) — baseline captured at mount for the "did it change?" comparison.
  - When the user's selected timer hits zero, an effect moves `selectedTimer` to the still-active timer with smallest remaining. `persistTimerRef` is untouched, so a transient rollover doesn't become the new persisted pick.
  - `doneMap` is derived every render (driven by a 1 s `setInterval` that only runs while `activeDose` exists) and passed into the auto-switch effect and the handler guard. `handleSelectTimer` now refuses picks against finished timers (belt-and-suspenders on top of the cleared `onPress`).

### Edit Dosage locked while a pill is active
Changing `dosageMg` mid-countdown is suppressed to avoid confusing the user about whether it reshapes historical dose math (it doesn't — snapshots are immutable — but the edit still shouldn't be offered while the user is watching an in-progress timer).
- `src/app/(main)/pill/[id].tsx` — when `activeDose` exists, the Edit Dosage Pressable is `disabled`, its accent bar and numbers render in muted tones, the row opacity drops to 0.5, and a "Locked while a timer is active." caption appears. Accessibility label switches to reflect the locked state.

### Verification
- `npx tsc --noEmit` passes clean.
- Manual: take a scheduled pill on the dashboard — play button fires cleanly, card shows the selected timer's label (not "In blood stream" unless Clearance is the effective timer). Let a Half-Life or Duration-of-Action timer complete while Clearance is still running — card status and ring roll over to the next without any 0-state visible. One-time random pills prune at `eliminationAt` with no interaction, including on cold start.

---

## Marquee Pill Names + Legal Back Nav + One-Time Pill Hard-Delete (2026-04-28)

### Context
Three follow-up issues from the previous session: long pill names were truncated on the dashboard (no marquee), Privacy Policy / Terms back buttons fell through to the dashboard instead of returning to Settings/Register, and one-time tracking pills lingered after their dose finished — including reappearing on cold start.

### Marquee pill names
Long drug names now scroll horizontally on the dashboard with industry-standard timing (1500 ms head pause → 50 px/s linear scroll → 1000 ms tail pause → ping-pong back). Short names that fit do nothing.

- `src/components/ui/MarqueeText.tsx` (new) — generic single-line `<MarqueeText>` component that wraps a `Typography`. Pattern is the well-worn "wide track" trick:
  - The container has `overflow: 'hidden'` and reports its width via `onLayout`.
  - The inner `Animated.View` track has `flexDirection: 'row'` + `width: 10000`. Row direction is critical — it makes the inner Text size to its natural one-line content width on the main axis, instead of stretching to the 10000 cross-axis width (which had us reading 10000 for every label and "scrolling" everything).
  - `numberOfLines={1}` on the inner Text guarantees a single line; the loose 10000-wide parent ensures the text shaper doesn't truncate, so `onLayout` reports the true natural width.
  - Animation runs only when `textWidth > containerWidth + 1`. `Animated.sequence` with `useNativeDriver: true` keeps the scroll off the JS thread.
- `src/components/ui/index.ts` — exports `MarqueeText`.
- `src/components/pills/PillCard.tsx` — `pill.drugName` now renders inside `<MarqueeText variant="titleLg" color="onSurface">` instead of a static `<Typography numberOfLines={1}>`.

**Why prior approaches failed (in case anyone revisits):** `flexShrink: 0` + `alignSelf: 'flex-start'` doesn't work because Yoga still propagates the parent's measured width into the text shaper as a max constraint — the line gets truncated and `onLayout` reports the truncated width. `position: 'absolute'` was unreliable on the New Architecture. The 10000-wide row container is the simplest constraint-loosener that survives Fabric.

### Legal back navigation
Privacy Policy and Terms of Service back buttons used to fall through to the dashboard because `src/app/legal.tsx` lives at the root route (parallel to `(main)` and `(auth)` so unauthenticated Register-screen users can reach it), and `router.back()` at that depth doesn't reliably pop back into a nested stack.

- `src/app/legal.tsx` — accepts a `from` query param (`'settings' | 'register'`) and dispatches back via `router.replace('/(main)/(tabs)/settings')` or `'/(auth)/register'` accordingly. Falls back to `router.back()` / settings as a safety net.
- `src/app/(main)/(tabs)/settings.tsx` — both legal links now pass `from: 'settings'`.
- `src/app/(auth)/register.tsx` — both legal links now pass `from: 'register'`.

### One-time tracking pill hard-delete
Random ("one-time tracking") pills now disappear from the dashboard *and* from Supabase the moment their tracking ends, instead of lingering as ghosts. Two paths:

**Real-time (in-session):** when an active dose's `eliminationAt` setTimeout fires on the dashboard, if the dose's pill is `pillType === 'random'`, the pill is hard-deleted (pill row + every dose row).

**Cold-start + foreground sweep:** every random pill without a live active dose is treated as abandoned — either it finished while the app was closed, or the user added it but never tapped play. Sweep wipes it.

- `src/services/cache/index.ts` — new WAL `WriteOperation` variant `{ op: 'hardDeletePill'; pillId }`.
- `src/services/supabase/pills.ts`:
  - New WAL executor case: `DELETE FROM doses WHERE pill_id = ? AND user_id = ?` then `DELETE FROM pills WHERE id = ? AND user_id = ?`. Idempotent (zero-row delete is success).
  - New `hardDeletePill(uid, pillId)` exported function — fully removes the pill from the local cache (not just `isActive: false`) and enqueues the WAL op.
- `src/stores/usePillStore.ts`:
  - New `hardDeletePill` action (cancels notifications first, then calls the service).
  - New `cleanupOrphanedRandomPills(userId)` action — filters in-memory state for `random + isActive + no live active dose`, sequentially `hardDeletePill`s each (sequential to prevent the cache rewrite race where parallel writes resurrect deleted pills).
  - `init` now calls `cleanupOrphanedRandomPills` twice: once after applying cached data (instant), and again from the Supabase sync callback (catches anything missing from the cache but present server-side).
- `src/app/_layout.tsx` — global `AppState.addEventListener('change', …)` in `AuthGate` calls `cleanupOrphanedRandomPills` on every `'active'` transition. Lives at the root so it runs regardless of which tab is mounted when the user resumes.
- `src/app/(main)/(tabs)/dashboard.tsx`:
  - Real-time prune effect now calls `hardDeletePill` for random pills on dose expiry.
  - Removed the previous dashboard-local cold-sweep effect and AppState listener — moving cleanup into the data layer eliminated a bug where the sweep `useRef` flipped before `user` was set, blocking the sweep for the rest of the session.

### Verification
- `npx tsc --noEmit` passes clean.
- Manual: long pill names scroll smoothly with the expected pause-scroll-pause-scroll-back rhythm; short names sit static. Privacy Policy / Terms back buttons return to the originating screen. One-time tracking pills disappear the instant their clearance timer hits zero in-session, and on cold start any orphaned random pill is wiped from cache + Supabase before the user sees the dashboard. No cache clear required.

---

## Phase 4 Closeout + History Revamp + Orphan Dose Preservation (2026-05-13)

### Context
Phase 4 (notifications) had five spec lines from GAMEPLAN still open. This block closed all of them except the cron-driven background piece of `autoAssumeTaken` (deferred to Phase 5 so the Edge Function infrastructure ships once, alongside the RevenueCat webhook). The History page was also rebuilt around a self-contained day card, the daily detail page was removed, and the `doses` schema was migrated so one-off pill history survives the hard-delete that ends a one-time-tracking pill's lifecycle.

### Phase 4 closeout — `src/services/notifications/index.ts`, `src/app/(main)/pill/add.tsx`
- `every_n_days` frequency in add-pill: numeric "Take every N days" input with validation, plumbed through the existing scheduler.
- Grouped notifications: `scheduleAllPillReminders` coalesces same-time pills by `(timeOfDay, weekday)` and the body lists every pill name in the group. `data.pillIds: string[]` replaces the prior single-pill payload; legacy `data.pillId` is still read by the response handler for back-compat.
- Action handlers: a single `pill_reminder` category is registered at module load with **"Took it"** and **"Snooze 15min"** actions, both `opensAppToForeground: true` so the JS handler runs without needing a TaskManager background task.
- Snooze: schedules a one-shot 15-minute `TIME_INTERVAL` reminder with the same payload + category.
- `autoAssumeTaken` (foreground layer): Settings exposes the switch; `usePillStore.reconcileAutoAssumedDoses` walks active scheduled pills on cold-start `init` and on `AppState` foreground transitions, writes an `auto`-source dose at the previous scheduled time if one isn't already on record (`alreadyCovered` check via `takenAt >= prev`). `previousScheduledDose` returns null for `every_n_days` (no cycle anchor); reconcile skips those by design.
- Dose-elimination notification (closes the last open Phase 4 spec line): `scheduleAllEliminationNotifications` schedules a one-shot DATE banner at each active dose's `eliminationAt`. Gated by `eliminationNotificationsEnabled` (default ON) with its own Settings switch.

### Settings rework — `src/app/(main)/(tabs)/settings.tsx`
- `ReminderMode` union narrowed from `'auto_start' | 'prompt' | 'simple'` to `'prompt' | 'simple' | 'off'`. The old `auto_start` option was redundant with the new `autoAssumeTaken` switch.
- Options reordered (prompt, simple, off) and `prompt` is now the default. Legacy `auto_start` rows are normalized to `prompt` on read by `normalizeSettings` in `auth.ts` — no sign-out needed.
- `autoAssumeTaken` locks the `prompt` row when on (greyed at 0.5 opacity, `accessibilityState.disabled`). Toggling on while `prompt` is selected drops the user to `simple`.
- Scheduler decoupled from `autoAssumeTaken`: it now gates on `reminderMode`. `'off'` schedules nothing, `'simple'` schedules without a category (banner only; default tap doesn't double-record under autoAssume thanks to a `reminderMode` stamp on `data`), `'prompt'` attaches the `pill_reminder` category.
- Renamed "Notifications off" → **"No reminder"**: the old label promised more than it delivered (it only silences scheduled-time reminders, not the independent dose-elimination toggle below).
- Type sizes aligned: "Reminders" heading bumped `titleMd → titleLg` (matches Dashboard section headers), description `bodyMd → bodyLg` (matches the rest of Settings copy).

### History revamp — `src/app/(main)/(tabs)/history.tsx`
- Deleted `src/app/(main)/history/[date].tsx` and its `_layout.tsx`. The detail page carried a daily-completion ring that compared the day's doses against the *current* pill stack (wrong for past days) and a "Great Consistency!" achievement badge — neither survives.
- Day cards are now self-contained: three colored circles for **pills taken** (primary), **medications** (secondary), and **one-offs** (tertiary amber), with white numbers inside. Underneath, the per-medication breakdown: color dot + drug name + either a single inline time or a collapsible row (count → expandable per-dose times) when 2+ doses for the same medication. `LayoutAnimation` smooths the expand/collapse on both platforms.
- One-off classification: a dose is one-off if its `pillId` is null (orphan after migration 0004) or its current pill has `pillType === 'random'`. Scheduled pills only soft-delete, so an unresolvable lookup is by construction a past one-off.
- Removed the Overall-Adherence summary card from the list header (it was a tracked-days percentage that read as consistency).
- Stack registration removed from `src/app/(main)/_layout.tsx`; the `history/` folder is gone.
- Title-to-content spacing matches Dashboard (24px below "History").

### Orphan dose preservation — `supabase/migrations/0004_orphan_doses_on_pill_delete.sql`
- `doses.pill_id` FK was `ON DELETE CASCADE`. Hard-deleting a one-off pill (`cleanupOrphanedRandomPills` → `hardDeletePill`) wiped its dose history server-side; only the local monthly cache (which `hardDeletePill` never pruned) was keeping it visible on the original device. A reinstall or second-device sign-in surfaced the loss.
- Migration 0004 drops the cascade, makes `pill_id` nullable, and re-adds the FK with `ON DELETE SET NULL`. Postgres now orphans the dose rows in place when a pill is deleted.
- WAL `hardDeletePill` handler no longer issues the explicit `DELETE FROM doses` — `SET NULL` covers it.
- `Dose.pillId` is now `string | null`. `deserializeDose` coalesces missing values to null. The notifications scheduler guards against null before stamping payloads (unreachable in practice, since active doses always belong to a live pill). History groups orphans under `orphan:<drugName>` so multiple distinct deleted one-off pills don't collapse into one bucket; `lookupPillColor` falls back to the primary accent for missing pills.

### Verification
- `npx tsc --noEmit` clean after every block.
- Migration 0004 applied manually in the Supabase SQL editor before the corresponding code was pushed (FK change had to land first or the new code would silently lose data through the still-cascading FK).
- On-device test plan for the notification work is gated on EAS login + the first Android dev build (Phase 7); the wiring is correct per the response-handler traces but hasn't been confirmed in hardware.

---

## What Needs To Happen Next

### Phase 7: iOS Build + Store Submission

### Design Reference Reminder
All screens must match the Stitch HTML mockups in `docs/stitch_halflifecontrol_html/`. Each folder contains:
- `code.html` — The HTML/CSS markup (Tailwind classes define the styling)
- `screen.png` — Visual screenshot of the rendered design

The design system documentation is in `docs/stitch_halflifecontrol_html/vitality_clear/DESIGN.md`.

### Key Patterns Established in Phase 1–6
- **Import paths**: Always use `@/` alias (e.g., `import { colors } from '@/theme'`)
- **Styling**: Use `StyleSheet.create()` with theme tokens, never hardcode colors/sizes
- **Components**: Use `Typography`, `Button`, `Card`, `Input` from `@/components/ui`; pill components from `@/components/pills`
- **State**: Use Zustand stores in `src/stores/`
- **Firebase**: Use service functions from `src/services/firebase/`, never import Firebase directly in screens
- **Navigation**: Expo Router file-based routing — `(tabs)` for tab screens, `pill/` and `history/` as Stack overlays
- **Auth gating**: Handled automatically by root `_layout.tsx` — no need to check auth in individual screens
- **Pure core logic**: `src/core/` has zero React/Firebase imports — pure TypeScript math and scheduling
- **Cache-first data**: Load from AsyncStorage instantly, sync from Firestore in background. No real-time listeners.
- **Single-document vault**: All pills + active doses in one Firestore doc. Monthly history bucketed per month.
- **Countdown pattern**: Calculate from absolute timestamps on each tick — no drift, instant catch-up on foreground
- **Drug search**: 3-tier: curated DB (instant) → openFDA (async fallback) → manual entry (always available)
- **Modal screens**: Use `presentation: 'modal'` in Stack.Screen options for overlay screens like add pill
- **Dynamic routes**: Use `[param].tsx` for dynamic segments (e.g., `[date].tsx` for day detail)
- **Notifications**: Use `src/services/notifications/` — schedule in dashboard effect, handle taps via response handler
- **Subscription gating**: Check `canAddScheduledPill()` at action time, redirect to paywall if blocked
- **Service degradation**: RevenueCat, Google Sign-In, and Sentry all gracefully degrade when API keys aren't configured
- **Accessibility**: Every Pressable has `accessibilityRole` + `accessibilityLabel`; radio/checkbox elements include `accessibilityState`
- **Error capture**: `captureException()` from `@/services/sentry` wraps critical service operations

---

## File Inventory (Phase 6 Complete)

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
│   │   └── welcome.tsx                # Welcome screen (two CTAs, login link)
│   └── (main)/
│       ├── _layout.tsx                # Stack: (tabs) + pill/ modal + history/ + subscription/
│       ├── (tabs)/
│       │   ├── _layout.tsx            # Tab navigator (Dashboard, History, Settings)
│       │   ├── dashboard.tsx          # SectionList dashboard, FAB, avatar, notifications
│       │   ├── history.tsx            # Dose history list with adherence %
│       │   └── settings.tsx           # Reminder prefs, subscription status, legal, sign out
│       ├── history/
│       │   ├── _layout.tsx            # Stack nav, no header
│       │   └── [date].tsx             # Day detail: completion ring, time groups, badge
│       ├── pill/
│       │   ├── _layout.tsx            # Stack nav, no header
│       │   └── add.tsx                # Add medication: search + dosage + schedule + color + sub gate
│       └── subscription/
│           ├── _layout.tsx            # Stack nav, no header
│           └── paywall.tsx            # Go Pro screen: features, plan cards, purchase/restore
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
│       ├── PillCard.tsx               # Full pill card with countdown/next-dose
│       └── DrugSearchBar.tsx          # 3-tier typeahead (curated + openFDA + manual)
├── core/
│   ├── types.ts                       # Domain types (Pill, Dose, UserProfile, etc.)
│   ├── halflife.ts                    # Pure decay math (concentration, elimination, formatting)
│   ├── scheduling.ts                  # Next dose calculation, schedule description
│   └── pillColors.ts                  # 10 predefined accent colors for pills
├── data/
│   └── drugDatabase.ts                # 50 curated drugs with half-life data + search function
├── hooks/
│   └── useCountdown.ts                # Real-time countdown hook (1s interval, AppState aware)
├── services/
│   ├── firebase/
│   │   ├── index.ts                   # Barrel export (auth + pills + history)
│   │   ├── config.ts                  # Firebase app/auth/db initialization
│   │   ├── auth.ts                    # Auth + completeOnboarding + updateUserSettings
│   │   ├── googleAuth.ts             # Google Sign-In via @react-native-google-signin + Firebase credential
│   │   └── pills.ts                   # Single-doc CRUD + monthly history + hybrid WAL (arrayUnion + transactions)
│   ├── cache/
│   │   └── index.ts                   # AsyncStorage local cache + write-ahead log (WAL)
│   ├── notifications/
│   │   └── index.ts                   # expo-notifications: schedule, cancel, handle responses
│   ├── openfda/
│   │   └── index.ts                   # openFDA Drug Label API client with caching
│   ├── sentry/
│   │   └── index.ts                   # Sentry init, captureException, user tracking, wrapRootComponent
│   └── subscription/
│       └── index.ts                   # RevenueCat wrapper: init, purchase, restore, tier check
├── stores/
│   ├── useAuthStore.ts                # Global auth state (Zustand)
│   ├── usePillStore.ts               # Pills + doses state with Firestore sync (Zustand)
│   └── useSubscriptionStore.ts        # Subscription tier + paywall logic (Zustand)
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

## Dependencies Installed (through Phase 6)

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
    "expo-notifications": "~55.0.14",
    "@react-native-google-signin/google-signin": "^16.1.2",
    "@sentry/react-native": "~7.11.0",
    "react-native-purchases": "^9.15.0",
    "zod": "^4.3.6",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@types/react": "~19.2.2",
    "typescript": "~5.9.2"
  }
}
```

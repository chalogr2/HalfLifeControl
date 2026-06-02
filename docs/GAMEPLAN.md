# HalfLifeControl — Full Game Plan

## Context
Building a cross-platform (iOS + Android) medication half-life tracking app from scratch. The app lets users build a pill stack, track countdowns showing how long drugs remain active in their body, set notification reminders, and manage scheduled + one-off pill tracking. Monetized via freemium subscription. Must be elderly-friendly. Future: smartwatch support.

---

## User's Detailed Prompt

I want to create an app for Android and iPhone. It will store information on many FDA-approved drugs and measure their half-life. Most importantly, it will track how long the medicine is actually affecting you in the form of a countdown.

You will be able to select your pill stack and save it. You will also be able to manually tell the app that you just took a pill, and it will start tracking how long that pill will continue affecting you. You will also be able to set up alarms (notifications) for when it is time to take a pill. The app will ask you if you took it, and if you did, it will start counting down. If it is more than one pill, it will send all the pills in a single message when you have to take more than one pill at the same time.

You can also change it so that it does not notify you and instead just assumes you will always take your pills at the scheduled time. Users will be able to cancel the countdown, letting the app know that they either do not want that pill tracked for today if it is in their stack, or that they simply do not want to track a particular pill they consumed. You will also be able to track pills without adding them to your stack and schedule.

The app will show this in an easy-to-use format. People, especially older non-tech-savvy people, need to be able to simply open it, create an account or log in, and then create their pill stack or track a random pill they just took.

There will be a quick introductory process in the app where, after creating an account, it will ask you if you take any medicines on a schedule and let you create a pill stack, giving you a search bar with easy-to-navigate pill options. Then, each time you choose one, it appears as added and you will be prompted to say when you take it (hour), whether it is every day, on certain days of the week, or after a certain number of days. Please also help me make this onboarding clean, easy, as simple as possible, and with the least friction while still having all these features.

You will also be prompted to assign the dose you take of each pill. After doing this initial setup/onboarding, you will be taken to a simplistic but nice-looking menu where you can see your pill stack and also have buttons to add a new pill. You will see next to each pill how long it has been in your body, and if it is not active, the time you need to take the next one according to your schedule.

You can also add pills without a schedule, as I said, and they will appear as “not part of your stack” in a simple-to-identify way. You will also suggest simple ways of showing this. If you take no pills on a schedule, you are simply taken to the same menu where you can add pills to take at any random moment or add pills to your stack (scheduled).

If added to the stack, you will be prompted to say when you will take them, using the same process as when you say you take scheduled pills in onboarding. In both cases, whether it is a random pill you took or a pill in your stack, you will be prompted to enter the dose. For the random pill, you need to press a button that lets the app know you just took it. You can also do it retroactively, meaning you can tell the app you took it two hours ago, for example, and start tracking from there.

I plan to monetize it by allowing non-subscribed users to track only one scheduled pill and up to four random pills at the same time, while pro users will be able to have more than one pill in their stack. This should be made clear to users during onboarding, before they try to make a pill stack with more than one pill, of course.

---

## Deployment Strategy: Android First, iOS When Ready

**Android is the primary deployment target.** We build and test on Android first because the developer has immediate access to an Android environment. Google Play developer account approval is pending but expected shortly.

**iOS will be deployed later** once the developer has access to a Mac (expected ~early April 2026). Xcode is required only for the final build, signing, and App Store submission — NOT for writing code. All React Native / Expo code is cross-platform TypeScript, so **100% of the codebase (components, screens, services, business logic) is written once and works on both platforms.** When the Mac arrives, the workflow is simply:
1. `git pull` the repo
2. Install dependencies (`npm install`)
3. Run `eas build --platform ios`
4. Submit to App Store via `eas submit --platform ios`

No code changes needed for iOS. The app is fully cross-platform by design.

---

## Frontend Design Reference: Stitch Assets

Two folders in the repo contain pre-built frontend designs created in Stitch. These are the visual reference for all UI implementation.

### `docs/stitch_halflifecontrol_html/` (PRIMARY REFERENCE)

This is the **source of truth for the app's visual design**. Located at `docs/stitch_halflifecontrol_html/`. Contains 13 HTML/CSS screen mockups that define the look and feel of every screen. Each screen folder contains a `code.html` (the markup) and a `screen.png` (visual preview). All components, screens, and styling in the React Native app should match these designs as closely as possible, adapted for React Native primitives.

**Screens included:**
| Screen | Description |
|--------|-------------|
| `login_screen/` | Login with email/password, Google/Apple OAuth, link to Register |
| `register_screen/` | Registration with email, password confirmation, terms acceptance, social login |
| `final_clean_welcome_screen/` | Onboarding: "Do you take pills on a schedule?" with two CTAs |
| `dashboard_with_balanced_timer_thickness/` | Main dashboard: "My Daily Stack" with countdown timers + "One-Time Tracking" section |
| `refined_history_list_screen/` | Medication history with past doses and summary stats |
| `refined_day_detail_view_screen/` | Detailed view of a specific day's medication activity |
| `fixed_add_medication_flow/` | Multi-step form for adding a new medication |
| `add_medication_success_popup/` | Success confirmation popup after adding a medication |
| `final_settings_screen_with_large_legal_buttons/` | Settings page with large legal/account buttons |
| `finalized_go_pro_screen/` | Pro subscription upgrade/paywall screen |
| `privacy_policy/` | Privacy policy page |
| `terms_of_service/` | Terms of service page |
| `vitality_clear/` | Contains `DESIGN.md` — the design system documentation |

**Design system highlights:**
- **CSS framework**: Tailwind CSS with 60+ custom Material Design 3 color tokens
- **Fonts**: `Lexend` (headlines), `Plus Jakarta Sans` (body/labels), `Material Symbols Outlined` (icons)
- **Key colors**: Primary `#004d64` (deep teal), Secondary `#016a60`, Error `#ba1a1a`
- **Design rules**: "No-Line Rule" (color shifts instead of borders), tonal layering for depth, glassmorphism for floating elements
- **Accessibility**: 48px minimum touch targets, large typography scale, high contrast
- **Card patterns**: 6px solid left-accent border for scheduled meds; 1.5px dashed borders for one-time meds
- **Progress rings**: 12px stroke SVG circles for countdown timers

**Note**: Some screens have minor inconsistencies, some may need tweaks, and there may be some duplication. The React Native implementation should treat these as the design intent and fix/normalize any inconsistencies during build.

### `docs/stitch_halflifecontrol_react/` (FLOW REFERENCE ONLY — WILL BE DISCARDED)

Located at `docs/stitch_halflifecontrol_react/`. A single-file React SPA (`code.html`) built from the same HTML/CSS screens. It demonstrates the app's navigation flow and screen transitions. However, it is **glitchy on several screens** (e.g., history page missing interactive buttons) and should NOT be used as a code reference. Use it only to understand the general flow between screens. This folder will be removed from the repo once the real app is built.

---

## Tech Stack

> **Backend migration (2026-04)**: HalfLifeControl has migrated from Firebase to Supabase. See [`MIGRATIONTOSUPABASE.md`](./MIGRATIONTOSUPABASE.md) for the full migration plan.

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **React Native + Expo (SDK 52)** | Cross-platform, large ecosystem, user's preference |
| Routing | **Expo Router v4** | File-based, deep linking, type-safe |
| State | **Zustand** | Minimal boilerplate, persistence support, testable |
| Backend | **Supabase** (Postgres, Auth, RLS, Edge Functions) | Predictable pricing, row-level updates, RLS security, no per-read/write billing |
| Drug Data | **openFDA API** + curated half-life JSON + manual fallback | openFDA alone lacks reliable half-life data |
| Subscriptions | **RevenueCat** | Handles both App Store + Google Play, webhook sync |
| Notifications | **expo-notifications** (local) | Local works offline; server push deferred to follow-up |
| Testing | **Jest** + **React Native Testing Library** + **Maestro** (E2E) | |
| CI/CD | **GitHub Actions** + **EAS Build/Submit** | |

---

## Project Structure

```
HalfLifeControl/                    # Repository root
├── .gitignore                      # Git ignore rules
├── .env                            # Environment variables — Supabase URL/key, RevenueCat keys, etc. (gitignored)
├── .env.example                    # Template showing required env vars (committed, no real values)
├── app.json                        # Expo app configuration (app name, bundle ID, plugins, splash screen)
├── eas.json                        # EAS Build profiles (development, preview, production)
├── package.json                    # Node dependencies and scripts
├── tsconfig.json                   # TypeScript configuration with path aliases
├── babel.config.js                 # Babel config for Expo/React Native
├── metro.config.js                 # Metro bundler config
├── README.md                       # Brief project overview + links to docs/
│
├── docs/                           # All documentation and design references
│   ├── GAMEPLAN.md                 # This file — full implementation plan
│   ├── SETUP_GUIDE.md             # Step-by-step external service setup instructions
│   ├── stitch_halflifecontrol_html/   # PRIMARY design reference — 13 HTML/CSS screen mockups
│   │   ├── login_screen/
│   │   ├── register_screen/
│   │   ├── final_clean_welcome_screen/
│   │   ├── dashboard_with_balanced_timer_thickness/
│   │   ├── refined_history_list_screen/
│   │   ├── refined_day_detail_view_screen/
│   │   ├── fixed_add_medication_flow/
│   │   ├── add_medication_success_popup/
│   │   ├── final_settings_screen_with_large_legal_buttons/
│   │   ├── finalized_go_pro_screen/
│   │   ├── privacy_policy/
│   │   ├── terms_of_service/
│   │   └── vitality_clear/        # Contains DESIGN.md (design system tokens)
│   └── stitch_halflifecontrol_react/  # Flow reference only — will be removed after build
│       └── code.html
│
├── src/                            # All application source code
│   ├── app/                        # Expo Router file-based routing (screens/pages)
│   │   ├── _layout.tsx             # Root layout: providers, auth gate
│   │   ├── (auth)/                 # Login, register, forgot-password
│   │   ├── (onboarding)/           # Welcome, drug-search, pill-schedule, paywall
│   │   └── (main)/                 # Dashboard, history, settings, pill/[id], pill/add
│   ├── components/                 # Reusable UI components
│   │   ├── ui/                     # Generic: Button, Card, Input, Typography, ProgressRing, Modal
│   │   ├── pills/                  # Domain: PillCard, PillStack, RandomPillList, CountdownTimer, DrugSearchBar, ScheduleEditor
│   │   ├── notifications/
│   │   └── subscription/
│   ├── core/                       # PURE business logic (no React, no Firebase — extractable for Watch apps)
│   │   ├── halflife.ts             # Decay math, concentration %, elimination time
│   │   ├── scheduling.ts           # Next dose calculation, recurrence logic
│   │   ├── subscription.ts         # Tier checks, entitlement helpers
│   │   └── types.ts                # Domain types: Pill, Dose, Schedule
│   ├── services/                   # External service integrations
│   │   ├── supabase/               # config, auth, database CRUD
│   │   ├── openfda/                # API client, types, halflife-supplement.ts (curated JSON)
│   │   ├── notifications/          # scheduler, response handlers
│   │   └── revenue-cat/            # config, purchase/restore/check
│   ├── stores/                     # Zustand state stores: useAuthStore, usePillStore, useSubscriptionStore, useOnboardingStore
│   ├── hooks/                      # React hooks: useCountdown, useDrugSearch, useNotifications, useSubscription
│   ├── utils/                      # Helpers: time formatting, cache, constants
│   └── theme/                      # Design system: colors, spacing, fonts, accessibility settings
│
├── assets/                         # Static assets: images, fonts, Lottie animations
│
├── supabase/                       # Supabase project config and migrations
│   └── migrations/
│       └── 0001_initial.sql        # Schema: profiles, pills, doses, RLS, triggers, indexes
│
└── __tests__/                      # Test files (unit, component, integration)
```

---

## Supabase Schema (Postgres)

> Full SQL migration lives in `supabase/migrations/0001_initial.sql`. See [`MIGRATIONTOSUPABASE.md`](./MIGRATIONTOSUPABASE.md) Section 4 for the complete DDL.

```
profiles
  ├── id (uuid, PK, references auth.users)
  ├── email, display_name, created_at
  ├── onboarding_complete: boolean
  ├── subscription_tier: "free" | "pro"
  ├── settings: jsonb { autoAssumeTaken, notificationsEnabled }

pills
  ├── id (uuid, PK)
  ├── user_id (uuid, FK → profiles.id)
  ├── drug_name, drug_id, half_life_minutes, dosage_mg, dosage_unit
  ├── pill_type: "scheduled" | "random"
  ├── schedule: jsonb { timeOfDay, frequency, daysOfWeek?, intervalDays? }
  ├── color, is_active, preferred_timer
  ├── created_at, updated_at

doses
  ├── id (uuid, PK)
  ├── user_id (uuid, FK → profiles.id)
  ├── pill_id (uuid, FK → pills.id)
  ├── drug_name (denormalized)
  ├── taken_at, scheduled_for, elimination_at
  ├── half_life_minutes
  ├── status: "active" | "dismissed" | "completed"
  ├── source: "manual" | "notification" | "auto" | "retroactive"
```

**RLS**: Every table has `auth.uid() = user_id` (or `= id` for profiles) policies covering all operations. No cross-user access is possible.

---

## Half-Life Countdown — Technical Design

**Countdowns are calculated on render, not with background timers.**

- `concentration = 100 × 0.5^(elapsedMinutes / halfLifeMinutes)` — pure math, no timer drift
- `eliminationAt = takenAt + 5 × halfLifeMinutes` — drug is ~97% eliminated after 5 half-lives
- A `useCountdown` hook runs a 1-second `setInterval` while foregrounded; on background→foreground, the math catches up instantly
- `ProgressRing` component shows a depleting circular arc + "4h 23m left" text
- `elimination_at` is stored in the `doses` table so the dashboard queries `status = 'active'` efficiently

**Drug half-life data** — 3-tier fallback:
1. **Curated JSON** shipped with the app (top 200 drugs with verified half-lives)
2. **openFDA parsing** of `clinical_pharmacology` text for unlisted drugs
3. **Manual entry** — user prompted to enter if neither source has data

---

## UX: Onboarding Flow

1. **Register** → email/password (social login added in Phase 6)
2. **Welcome screen** — "Do you take any medicines on a schedule?" → Yes / No
3. **If Yes → Drug search screen**
   - Search bar with typeahead from openFDA + curated DB
   - Each selected drug appears as a chip/card below the search bar
   - For each drug: set time of day, frequency (daily / specific days / every N days), dosage
   - **After adding 1st pill**: if user tries to add a 2nd → paywall screen explaining Pro
4. **If No** → skip to dashboard
5. **Dashboard** — main app screen

Key UX principles for elderly users:
- Large enough text
- High contrast colors
- Minimal screens in onboarding
- Simple language, no jargon
- Bottom sheet modals instead of navigating to new screens where possible

---

## UX: Dashboard — Showing Stack vs Random Pills

**Recommended approach: two clear sections with visual differentiation**

### Section 1: "My Daily Stack" (top)
- Cards with a **colored left border** (user picks pill color)
- Shows: pill name, dosage, countdown ring (if active), or "Next dose: 8:30 AM"
- Tap → detail screen

### Section 2: "One-Time Tracking" (below, with a subtle divider)
- Cards with a **dashed border** or slightly different background tint
- Small label: "Not on schedule"
- Shows: pill name, countdown ring, "Tracked 2h ago"
- These auto-archive when countdown completes

### Adding pills — in-list buttons
- Each section has an "Add pill to stack" or "Track another pill" button at the bottom of its list
- **"Track a pill I just took"**: search drug → set dose → optionally "I took it X hours ago" → countdown starts
- **"Add to my stack"**: search drug → set schedule + dose → appears in stack section

---

## Notifications

- **Local notifications** (expo-notifications) are primary — scheduled at pill creation time and re-scheduled whenever the pill list or relevant settings change.
- Multiple pills at the same time are coalesced into one banner: "Time to take Aspirin, Metformin". `every_n_days` schedules don't coalesce (each pill gets its own one-shot DATE trigger for the next occurrence; re-scheduled on every pill-list change).
- **Reminder mode** (Settings) governs the scheduled-time banner shape:
  - `prompt` (default): banner carries the `pill_reminder` category — **"Took it"** (records the dose for every pill in the group) and **"Snooze 15min"** (one-shot reminder with the same payload).
  - `simple`: banner without action buttons; tap-to-open is a no-op (informational only).
  - `off`: no scheduled-time banner.
- **Dose-elimination banner**: a separate one-shot DATE notification fires at each dose's `eliminationAt` ("{drug} has cleared from your system"). Independent setting (`eliminationNotificationsEnabled`, default ON), independent of `reminderMode`.
- **Auto-assume mode** (`autoAssumeTaken` setting): records doses on the user's behalf at each scheduled time and disables the `prompt` mode (the prompt would never fire if we're already auto-recording). The foreground layer ships: `reconcileAutoAssumedDoses` writes auto-source doses on cold-start init and AppState foreground transitions. True background coverage (dose recorded when the app is fully closed) requires a Supabase Edge Function cron and is bundled with Phase 5 so the Edge Function infra deploys once.
- **Server push**: Deferred. The app currently uses local notifications only. Server-initiated push (via Supabase Edge Functions + APNs/FCM) will be added in a future phase when there are backend events to push.

---

## Subscription Model

| | Free | Pro |
|--|------|-----|
| Scheduled pills | 1 | Unlimited |
| Simultaneous random pill tracking | 4 | Unlimited |
| All other features | Full access | Full access |

- Enforced client-side in `src/stores/useSubscriptionStore.ts` (`canAddScheduledPill` / `canAddRandomPill`). The scheduled limit is additionally enforced server-side by the `pills_enforce_scheduled_limit` trigger (migration 0006) as an authoritative backstop; the random limit stays client-only (dose-elimination-based, not a row count).
- Paywall shown during onboarding (adding 2nd scheduled pill) and on dashboard (hitting limits)
- RevenueCat manages cross-platform purchases. The `revenuecat-webhook` Edge Function is the **only** writer of `profiles.subscription_tier` (migration 0005 locks the column to `service_role`); the client reads RevenueCat's `getCustomerInfo` as its in-app source of truth.
- Suggested pricing: $4.99/month, $39.99/year, or $99.99 lifetime (one-time)

---

## Implementation Phases

### Phase 1: Foundation (Android-first)
- Init Expo project, configure TypeScript, path aliases, Expo Router
- Theme system extracted from Stitch design tokens (colors, fonts, spacing from `stitch_halflifecontrol_html/`)
- Generic UI components (Button, Card, Input, Typography) — styled to match Stitch HTML mockups
- Supabase setup (project, schema, RLS, auth)
- Auth screens (login, register, forgot-password) — built to match `login_screen/` and `register_screen/` from Stitch
- `useAuthStore` with Zustand
- EAS Build profiles (dev, preview, production) — **Android builds only** initially
- `.gitignore`, environment config
- First Android dev build via `eas build --platform android --profile development`

### Phase 2: Core Pill Tracking
- `src/core/halflife.ts` + unit tests
- `src/core/scheduling.ts` + unit tests
- `usePillStore` + Supabase CRUD
- Dashboard screen — match `dashboard_with_balanced_timer_thickness/` from Stitch (daily stack + one-time tracking sections)
- `CountdownTimer`, `ProgressRing` (12px stroke SVG circles per Stitch design), `useCountdown` hook
- Add medication flow — match `fixed_add_medication_flow/` + `add_medication_success_popup/` from Stitch
- "I just took this" + retroactive entry
- Dismiss/cancel countdown

### Phase 3: Drug Search + Onboarding
- openFDA client with caching
- Curated half-life JSON (start with top 50 drugs, expand to 200)
- `DrugSearchBar` with typeahead
- Onboarding welcome screen — match `final_clean_welcome_screen/` from Stitch
- Full onboarding flow (welcome → search → schedule → paywall gate)
- Navigation guards (auth → onboarding → main)

### Phase 4: Notifications 
- Notify user when their pills from stack are scheduled to be taken
- Notify user when any active pill's effect duration countdown ends
- expo-notifications setup + permissions
- Local notification scheduling
- Notification action handlers ("Took it" / "Snooze")
- Pill grouping for same-time notifications
- Server-side push notifications deferred to follow-up (local notifications cover core use case)
- Test on physical devices (both platforms)

### Phase 5: Subscription
- RevenueCat dashboard + Google Play products (App Store products added when Mac is available)
- `react-native-purchases` integration
- Paywall screen — match `finalized_go_pro_screen/` from Stitch
- Enforcement in onboarding + dashboard add-pill flow
- Supabase Edge Function for RevenueCat webhook tier sync
- Sandbox purchase testing on Android

### Phase 6: Polish + Android Launch
- Social login (Google, Apple)
- History/log screen — match `refined_history_list_screen/` from Stitch. (The Stitch `refined_day_detail_view_screen/` flow was dropped: day cards are self-contained — three colored stat circles for pills taken / medications / one-offs and an inline per-medication breakdown — so a separate detail route is unnecessary.)
- Settings screen — match `final_settings_screen_with_large_legal_buttons/` from Stitch
- Privacy policy + Terms of Service screens — match `privacy_policy/` + `terms_of_service/` from Stitch
- Accessibility audit (TalkBack on Android first, VoiceOver when Mac available)
- Lottie onboarding animations
- Crash reporting (Sentry)
- Google Play Store assets, privacy policy
- Google Play internal testing → production release
- Remove `stitch_halflifecontrol_react/` from repo (no longer needed)

### Phase 7: iOS Launch (when Mac is available)
- `git pull` repo on Mac, install dependencies
- Configure iOS signing via EAS (Apple Team ID, provisioning profiles)
- `eas build --platform ios --profile production`
- TestFlight internal testing
- Add App Store subscription products in App Store Connect
- Configure RevenueCat Apple app with shared secret
- App Store assets + submission via `eas submit --platform ios`

---

## Watch App Preparedness

`src/core/` is pure TypeScript with zero React or Supabase imports — only `date-fns`. This module can be:
- Directly imported for a **WearOS** React Native companion
- Transpiled/ported for a **watchOS** SwiftUI companion

The `useCountdown` pattern (calculate from absolute timestamps) translates directly to watch complications.

---

## Verification / Testing Plan

1. **Unit tests**: `halflife.ts`, `scheduling.ts`, `subscription.ts` — run with `npx jest`
2. **Component tests**: CountdownTimer, DrugSearchBar, PillCard — run with Jest + RNTL
3. **Integration**: Full onboarding flow, add-pill flow, notification→dose creation
4. **E2E** (Maestro): Onboarding happy path, take pill → countdown → completion, paywall flow
5. **Manual (Android first)**: Test notifications on physical Android device, test offline behavior, test subscription sandbox purchases on Google Play
6. **Manual (iOS later)**: Repeat manual testing on iOS physical device once Mac is available
7. **Accessibility**: TalkBack (Android) first, VoiceOver (iOS) when Mac is available
8. **Visual QA**: Compare each screen against corresponding Stitch HTML mockup to ensure design fidelity

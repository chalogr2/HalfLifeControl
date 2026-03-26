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

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **React Native + Expo (SDK 52)** | Cross-platform, large ecosystem, user's preference |
| Routing | **Expo Router v4** | File-based, deep linking, type-safe |
| State | **Zustand** | Minimal boilerplate, persistence support, testable |
| Backend | **Firebase** (Auth, Firestore, Cloud Functions, FCM) | Fast to build, built-in offline, push notifications |
| Drug Data | **openFDA API** + curated half-life JSON + manual fallback | openFDA alone lacks reliable half-life data |
| Subscriptions | **RevenueCat** | Handles both App Store + Google Play, webhook sync |
| Notifications | **expo-notifications** (local, primary) + **FCM** (push, backup) | Local works offline; FCM covers app-killed scenarios |
| Testing | **Jest** + **React Native Testing Library** + **Maestro** (E2E) | |
| CI/CD | **GitHub Actions** + **EAS Build/Submit** | |

---

## Project Structure

```
HalfLifeControl/
├── app.json, eas.json, package.json, tsconfig.json
├── .env / .env.example
├── src/
│   ├── app/                    # Expo Router file-based routing
│   │   ├── _layout.tsx         # Root: providers, auth gate
│   │   ├── (auth)/             # Login, register, forgot-password
│   │   ├── (onboarding)/       # Welcome, drug-search, pill-schedule, paywall
│   │   └── (main)/             # Dashboard, history, settings, pill/[id], pill/add
│   ├── components/
│   │   ├── ui/                 # Button, Card, Input, Typography, ProgressRing, Modal
│   │   ├── pills/              # PillCard, PillStack, RandomPillList, CountdownTimer, DrugSearchBar, ScheduleEditor
│   │   ├── notifications/
│   │   └── subscription/
│   ├── core/                   # PURE business logic (no React, no Firebase — extractable for Watch apps)
│   │   ├── halflife.ts         # Decay math, concentration %, elimination time
│   │   ├── scheduling.ts       # Next dose calculation, recurrence logic
│   │   ├── subscription.ts     # Tier checks, entitlement helpers
│   │   └── types.ts            # Domain types: Pill, Dose, Schedule
│   ├── services/
│   │   ├── firebase/           # config, auth, firestore CRUD
│   │   ├── openfda/            # API client, types, halflife-supplement.ts (curated JSON)
│   │   ├── notifications/      # scheduler, response handlers
│   │   └── revenue-cat/        # config, purchase/restore/check
│   ├── stores/                 # useAuthStore, usePillStore, useSubscriptionStore, useOnboardingStore
│   ├── hooks/                  # useCountdown, useDrugSearch, useNotifications, useSubscription
│   ├── utils/                  # time helpers, cache, constants
│   └── theme/                  # Colors, spacing, fonts (16px+ body), accessibility (48px+ touch targets)
├── assets/                     # Images, fonts, Lottie animations
├── functions/                  # Firebase Cloud Functions (notifications, subscription webhooks)
└── __tests__/
```

---

## Firestore Schema

```
users/{userId}
  ├── email, displayName, createdAt
  ├── onboardingComplete: boolean
  ├── subscriptionTier: "free" | "pro"
  ├── notificationToken: string (FCM)
  ├── settings: { autoAssumeTaken, notificationsEnabled }
  │
  ├── pills/{pillId}  (subcollection)
  │   ├── drugName, drugId, halfLifeMinutes, dosageMg, dosageUnit
  │   ├── pillType: "scheduled" | "random"
  │   ├── schedule: { timeOfDay, frequency, daysOfWeek?, intervalDays? }  // null for random
  │   ├── color (visual ID), isActive
  │
  └── doses/{doseId}  (subcollection)
      ├── pillId, drugName (denormalized)
      ├── takenAt, scheduledFor, eliminationAt (precomputed: takenAt + 5×halfLife)
      ├── halfLifeMinutes (snapshot at dose time)
      ├── status: "active" | "dismissed" | "completed"
      ├── source: "manual" | "notification" | "auto" | "retroactive"
```

---

## Half-Life Countdown — Technical Design

**Countdowns are calculated on render, not with background timers.**

- `concentration = 100 × 0.5^(elapsedMinutes / halfLifeMinutes)` — pure math, no timer drift
- `eliminationAt = takenAt + 5 × halfLifeMinutes` — drug is ~97% eliminated after 5 half-lives
- A `useCountdown` hook runs a 1-second `setInterval` while foregrounded; on background→foreground, the math catches up instantly
- `ProgressRing` component shows a depleting circular arc + "4h 23m left" text
- `eliminationAt` is stored in Firestore so the dashboard queries `where("status", "==", "active")` efficiently

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

### "Add Pill" — Floating Action Button (bottom-right)
- Tapping opens a bottom sheet: "Add to my stack" vs "Track a pill I just took"
- **"Track a pill I just took"**: search drug → set dose → optionally "I took it X hours ago" → countdown starts
- **"Add to my stack"**: search drug → set schedule + dose → appears in stack section

---

## Notifications

- **Local notifications** (expo-notifications) are primary — scheduled at pill creation time
- Multiple pills at same time → grouped into one notification: "Time to take Aspirin, Metformin"
- Action buttons on notification: **"Took it"** (starts countdown) and **"Snooze 15min"**
- **Auto-assume mode**: user setting that skips notifications and auto-creates dose records at scheduled times (via Cloud Function)
- **FCM backup**: Cloud Function runs every 5 minutes, sends push for due pills when app is killed

---

## Subscription Model

| | Free | Pro |
|--|------|-----|
| Scheduled pills | 1 | Unlimited |
| Simultaneous random pill tracking | 4 | Unlimited |
| All other features | Full access | Full access |

- Enforced in `src/core/subscription.ts` (pure functions)
- Paywall shown during onboarding (adding 2nd scheduled pill) and on dashboard (hitting limits)
- RevenueCat manages cross-platform purchases, webhook syncs tier to Firestore
- Suggested pricing: $4.99/month or $39.99/year

---

## Implementation Phases

### Phase 1: Foundation 
- Init Expo project, configure TypeScript, path aliases, Expo Router
- Theme system with elderly-friendly defaults
- Generic UI components (Button, Card, Input, Typography)
- Firebase setup (project, config, auth)
- Auth screens (login, register, forgot-password)
- `useAuthStore` with Zustand
- EAS Build profiles (dev, preview, production)
- `.gitignore`, environment config

### Phase 2: Core Pill Tracking 
- `src/core/halflife.ts` + unit tests
- `src/core/scheduling.ts` + unit tests
- `usePillStore` + Firestore CRUD
- Dashboard screen with pill stack + random pills sections
- `CountdownTimer`, `ProgressRing`, `useCountdown` hook
- Add pill screen (manual entry, no FDA search yet)
- "I just took this" + retroactive entry
- Dismiss/cancel countdown

### Phase 3: Drug Search + Onboarding 
- openFDA client with caching
- Curated half-life JSON (start with top 50 drugs, expand to 200)
- `DrugSearchBar` with typeahead
- Full onboarding flow (welcome → search → schedule → paywall gate)
- Navigation guards (auth → onboarding → main)

### Phase 4: Notifications 
- Notify user when their pills from stack are scheduled to be taken
- Notify user when any active pill's effect duration countdown ends
- expo-notifications setup + permissions
- Local notification scheduling
- Notification action handlers ("Took it" / "Snooze")
- Pill grouping for same-time notifications
- Firebase Cloud Functions: backup push, auto-assume, dose cleanup
- Test on physical devices (both platforms)

### Phase 5: Subscription 
- RevenueCat dashboard + App Store / Google Play products
- `react-native-purchases` integration
- Paywall screen
- Enforcement in onboarding + dashboard add-pill flow
- Webhook Cloud Function for tier sync
- Sandbox purchase testing

### Phase 6: Polish + Launch 
- Social login (Google, Apple)
- History/log screen
- Settings screen (notifications, account, subscription)
- Accessibility audit (VoiceOver/TalkBack, contrast, touch targets)
- Lottie onboarding animations
- Crash reporting (Sentry)
- App Store assets, privacy policy
- TestFlight + Google Play internal testing → production release

---

## Watch App Preparedness

`src/core/` is pure TypeScript with zero React or Firebase imports — only `date-fns`. This module can be:
- Directly imported for a **WearOS** React Native companion
- Transpiled/ported for a **watchOS** SwiftUI companion

The `useCountdown` pattern (calculate from absolute timestamps) translates directly to watch complications.

---

## Verification / Testing Plan

1. **Unit tests**: `halflife.ts`, `scheduling.ts`, `subscription.ts` — run with `npx jest`
2. **Component tests**: CountdownTimer, DrugSearchBar, PillCard — run with Jest + RNTL
3. **Integration**: Full onboarding flow, add-pill flow, notification→dose creation
4. **E2E** (Maestro): Onboarding happy path, take pill → countdown → completion, paywall flow
5. **Manual**: Test notifications on physical iOS + Android devices, test offline behavior, test subscription sandbox purchases
6. **Accessibility**: VoiceOver (iOS) and TalkBack (Android) walkthroughs

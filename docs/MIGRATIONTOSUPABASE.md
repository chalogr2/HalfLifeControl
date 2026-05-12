# HalfLifeControl — Firebase → Supabase Migration

This document is the authoritative plan for moving HalfLifeControl's backend from Firebase (Auth + Firestore + Cloud Functions + FCM) to Supabase (Postgres + Auth + RLS). It covers the *why*, the *what*, everything the developer has to do manually, and a step-by-step Supabase setup that anyone can follow without prior experience.

**Status**: Migration completed in April 2026. The Firebase code, `functions/`, `firestore.rules`, and `firestore.indexes.json` have all been removed; the app now runs end-to-end against Supabase. This document is retained as a historical reference for *why* the move happened and *what* the resulting schema/architecture looks like. The remaining future-tense wording below ("the assistant will…", "will land in…") describes the original plan and was left intact intentionally — every action it describes has since been carried out.

---

## Table of Contents

1. [Why we are migrating](#1-why-we-are-migrating)
2. [Decisions confirmed before starting](#2-decisions-confirmed-before-starting)
3. [Architectural changes](#3-architectural-changes)
4. [New Postgres schema](#4-new-postgres-schema)
5. [Read / write profile after migration](#5-read--write-profile-after-migration)
6. [Code changes the assistant will make](#6-code-changes-the-assistant-will-make)
7. [Scope and risk](#7-scope-and-risk)
8. [Step-by-step Supabase setup (developer actions)](#8-step-by-step-supabase-setup-developer-actions)
9. [Post-migration checklist](#9-post-migration-checklist)
10. [Rollback plan](#10-rollback-plan)

---

## 1. Why we are migrating

Firestore has served the project well for rapid prototyping, but its cost and concurrency model are a poor fit for HalfLifeControl's usage pattern.

**Specific pain points observed in production-style testing:**

- **Firestore bills per read and per write per document.** This pushed the app toward a "single-document vault" pattern (`users/{uid}/data/dashboard`) where all pills and active doses live in one document, so we pay 1 read / 1 write per app open instead of N.
- **Single-document writes require transactions for multi-device safety.** Because the doc contains arrays (`pills`, `activeDoses`), Firestore cannot update a single element in place — every edit becomes `tx.get → merge → tx.set`, i.e. 1 read + 1 write even for trivial changes like "change `preferred_timer` on one pill".
- **Concurrent transactions race.** Tapping the three timer options rapidly on the pill detail screen produced `failed-precondition` errors because two transactions read the same base version and only one could commit. We fixed the UX with optimistic local state + deferred writes on unmount, but the underlying cost and fragility remain.
- **Monthly history bucketing adds reads.** History is stored as `users/{uid}/history/{YYYY-MM}`, one document per month, so opening the history screen costs N reads (one per displayed month). There is no way to query "all doses in this date range" cheaply.
- **Security rules are tied to denormalized counters.** Free-tier enforcement (max 1 scheduled pill, max 4 concurrent random pills) requires `activePillCount` / `activeScheduledCount` / `activeRandomCount` fields that must be recomputed and kept in sync on every write, which is fragile.
- **Cloud Functions require the Blaze (pay-as-you-go) plan** and add another moving part to deploy and monitor just for the RevenueCat webhook and future notification fan-out.

**What Postgres (via Supabase) gives us:**

- **Row-level updates.** Changing `preferred_timer` on one pill is `UPDATE pills SET preferred_timer = $1 WHERE id = $2` — zero reads, zero transactions, multi-device safe because Postgres handles concurrent row writes natively.
- **Real indexed queries.** History becomes `SELECT * FROM doses WHERE user_id = $1 AND taken_at BETWEEN $2 AND $3` — one query, one round-trip, regardless of date range. No monthly buckets.
- **Row-Level Security (RLS)** is simpler than Firestore rules: `auth.uid() = user_id` on each table, verified by Postgres on every query.
- **Different pricing model.** Supabase free tier covers 500 MB database, 5 GB egress, 50k monthly active users. No per-read/per-write billing — so we are not incentivized to bundle unrelated data to reduce document counts.
- **No Cloud Functions needed for our current use case.** Supabase has Edge Functions for the webhook path later, but they are not required day-one because the RevenueCat → subscription_tier sync can be handled by a simple server-to-server POST with a service-role key when we reach Phase 5.

**What we are not expecting to gain (honest list):**

- **Offline support.** Firestore's offline cache is better than Supabase's. That is exactly why we keep the existing WAL (Write-Ahead Log) layer — it is backend-agnostic and already handles queued writes, retry on app open, and conflict resolution. The migration just changes what backend the WAL operations talk to.
- **Built-in push notifications.** FCM is replaced by whatever we already use for local notifications (`expo-notifications`). Push is not part of this migration and will be revisited if and when we need server-initiated notifications.

---

## 2. Decisions confirmed before starting

These three decisions were made up front to keep the initial migration surface small. Each can be revisited in a follow-up change.

| Decision | Choice | Rationale |
|---|---|---|
| Realtime cross-device sync via Supabase Postgres changes | **Defer** | The existing cache-first-then-sync pattern already works on app open. Realtime adds a persistent websocket connection, a subscription lifecycle, and more surface area to debug. We can add it later once the basic migration is stable. |
| Keep the WAL (Write-Ahead Log) offline layer | **Keep** | Already written, already tested, and target users are elderly folks on flaky connections. Supabase's offline story is weaker than Firestore's, so dropping the WAL would be a regression. The WAL itself is backend-agnostic — only the `executeOperation` switch needs repointing at Supabase queries. |
| Google Sign-In on day one of the migration | **Defer** | Google OAuth on React Native through Supabase requires deep-link configuration, redirect URI verification on physical devices, and edge cases around session restoration. Landing email/password first isolates risk. Google Sign-In becomes a separate, smaller follow-up PR. |

---

## 3. Architectural changes

### Schema: three documents → three tables

| Firestore (current) | Supabase (after) |
|---|---|
| `users/{uid}` (profile document) | `public.profiles` (one row, `id = auth.users.id`) |
| `users/{uid}/data/dashboard` (pills array + activeDoses array + counters) | `public.pills` (one row per pill) + `public.doses` (one row per dose) |
| `users/{uid}/history/{YYYY-MM}` (monthly dose buckets) | Same `public.doses` table, queried with `WHERE taken_at BETWEEN ...` |

- Each domain table has a `user_id uuid references auth.users(id)` column with an index and an RLS policy: `user_id = auth.uid()`.
- The in-memory counters (`activePillCount`, `activeScheduledCount`, `activeRandomCount`) disappear. They were only needed to make Firestore security rules tractable. With RLS we either enforce limits at write time with a `BEFORE INSERT` trigger, or we check them client-side (and re-check via a trusted server path before granting `pro`) — see Phase 5 section.
- Schedules stay as JSONB on the pills row (same serialized shape as the current `pill.schedule` object).
- Dose `status` moves from a string stored inside an array element to a proper indexed column.
- Monthly history bucketing is removed. History queries become standard indexed range scans.

### Session and auth

- Firebase Auth's `onAuthStateChanged` listener is replaced by Supabase's `supabase.auth.onAuthStateChange(...)`.
- Sessions persist via the Supabase SDK's AsyncStorage adapter (we configure it once in `config.ts`). Tokens refresh automatically.
- The app's `useAuthStore` keeps the same public shape (`user`, `isLoading`, `signIn`, `signUp`, `signOut`) so no UI screen changes.
- The profile row in `public.profiles` is created automatically via a Postgres trigger on `auth.users` insert, so we do not need a separate "create profile" call from the client.

### Security

- Postgres RLS policies replace Firestore rules. Policies are SQL, live in a migration file, and can be unit-tested via `supabase db test` (optional).
- Free-tier limit enforcement moves from Firestore rules to either:
  - A `BEFORE INSERT` trigger that counts the user's existing active pills and raises an error (strict, server-enforced), OR
  - Client-side enforcement in `src/core/subscription.ts` (soft, can be bypassed by a technical user but acceptable for an elderly-user target audience while Phase 5 billing is not yet live).
- We will start with client-side enforcement because that is the current behavior, and add the trigger later if abuse becomes a real concern.

### WAL (Write-Ahead Log)

- The WAL format stays identical — same operation enum, same AsyncStorage persistence, same flush-on-open.
- Only `executeOperation` is rewritten to call Supabase queries instead of Firestore transactions.
- Because Postgres mutations are row-level, most WAL operations become simpler:
  - `addPill` → `INSERT INTO pills (...) VALUES (...)` — no read, no transaction
  - `updatePill` → `UPDATE pills SET ... WHERE id = $1 AND user_id = $2` — no read
  - `deletePill` → `UPDATE pills SET is_active = false, updated_at = now() WHERE id = $1 AND user_id = $2`
  - `addDose` → `INSERT INTO doses (...) VALUES (...)`
  - `removeDose` / `updateHistoryDoseStatus` → `UPDATE doses SET status = $1 WHERE id = $2 AND user_id = $3`
- `enqueueAndAttempt` and `attemptEnqueued` keep their current fire-and-forget pattern — the WAL entry is the durable record, the Supabase call runs in the background, and failures leave the entry in the WAL for the next app open to retry.

### What is explicitly unchanged

- `src/core/` (halflife math, scheduling logic, pure types) — zero changes. It was designed to be backend-agnostic.
- All UI components (`src/components/`, `src/app/`) — zero structural changes. They read from Zustand stores, which hide the backend.
- Theme, routing, curated drug database JSON, the PubChem build script — zero changes.
- `expo-notifications` local notifications — zero changes.
- RevenueCat integration — zero functional changes (the webhook path will change in Phase 5).

---

## 4. New Postgres schema

The exact SQL below will land in `supabase/migrations/0001_initial.sql` in the repo once code changes begin. It is printed here so the developer can preview it, and so this document is self-contained for future reference.

```sql
-- =========================================================================
-- HalfLifeControl initial schema
-- =========================================================================

-- Extensions
create extension if not exists "pgcrypto";   -- for gen_random_uuid()

-- -------------------------------------------------------------------------
-- profiles: 1:1 with auth.users, created by trigger on signup
-- -------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  display_name        text,
  onboarding_complete boolean not null default false,
  subscription_tier   text not null default 'free'
                      check (subscription_tier in ('free','pro')),
  notification_token  text,
  settings            jsonb not null default
                      '{"notificationsEnabled":true,"autoAssumeTaken":false}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- pills
-- -------------------------------------------------------------------------
create table public.pills (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  drug_name          text not null,
  drug_id            text,
  half_life_minutes  integer not null check (half_life_minutes > 0),
  half_life_source   text not null default 'manual'
                     check (half_life_source in ('curated','openfda','manual','pubchem')),
  dosage_mg          numeric not null check (dosage_mg > 0),
  dosage_unit        text not null default 'mg',
  pill_type          text not null check (pill_type in ('scheduled','random')),
  schedule           jsonb,                -- null for random pills
  color              text not null default '#004d64',
  preferred_timer    text not null default 'clearance'
                     check (preferred_timer in ('action','halfLife','clearance')),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index pills_user_active_idx on public.pills (user_id, is_active);

-- -------------------------------------------------------------------------
-- doses (one row per recorded dose, active + history combined)
-- -------------------------------------------------------------------------
create table public.doses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  pill_id            uuid references public.pills(id) on delete set null,  -- nullable + SET NULL since migration 0004 so one-off pill history survives hard-delete
  drug_name          text not null,        -- denormalized for history display
  taken_at           timestamptz not null,
  scheduled_for      timestamptz,
  half_life_minutes  integer not null,     -- snapshotted at dose time
  elimination_at     timestamptz not null, -- precomputed: taken_at + 5 * half_life
  status             text not null default 'active'
                     check (status in ('active','dismissed','completed')),
  source             text not null default 'manual'
                     check (source in ('manual','notification','auto','retroactive')),
  created_at         timestamptz not null default now()
);

create index doses_user_status_idx on public.doses (user_id, status);
create index doses_user_taken_idx  on public.doses (user_id, taken_at desc);
create index doses_pill_idx        on public.doses (pill_id);

-- -------------------------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.pills    enable row level security;
alter table public.doses    enable row level security;

create policy "profiles_own" on public.profiles
  for all
  using      (auth.uid() = id)
  with check (auth.uid() = id);

create policy "pills_own" on public.pills
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "doses_own" on public.doses
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- Auto-create profile row on signup
-- -------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- updated_at maintenance
-- -------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger pills_touch
  before update on public.pills
  for each row execute function public.touch_updated_at();
```

This schema is intentionally minimal. Free-tier enforcement via trigger, edge functions for subscription webhooks, and realtime publication configuration will be added in follow-up migrations when those features land.

---

## 5. Read / write profile after migration

| Action | Firestore (current) | Supabase (after) |
|---|---|---|
| App open (warm cache) | 1 read | 2 lightweight SELECTs (pills + active doses) — not billed per-row at this scale |
| Record a dose | 0 r + 2 w (arrayUnion × 2) | 1 INSERT |
| Dismiss / complete a dose | 2 r + 2 w | 1 UPDATE |
| Add pill | 1 r + 1 w (transaction) | 1 INSERT |
| Edit pill (dosage, timer, etc.) | 1 r + 1 w (transaction) | 1 UPDATE |
| Delete pill (soft delete) | 1 r + 1 w | 1 UPDATE |
| Open history screen (3 months) | 3 reads | 1 SELECT with date range |
| Sign in | 1 read | 0 (session restored from AsyncStorage) or 1 (first sign-in) |

At HalfLifeControl's expected scale (hundreds to low thousands of users), everything except very hot write paths falls well inside Supabase's free tier.

---

## 6. Code changes the assistant will make

**Add:**

- `src/services/supabase/config.ts` — Supabase client with AsyncStorage adapter + `react-native-url-polyfill/auto`
- `src/services/supabase/auth.ts` — `signUp`, `signIn`, `signOut`, `getSession`, `getProfile`, `updateProfile`, `completeOnboarding`, `updateSettings`
- `src/services/supabase/pills.ts` — pill CRUD + dose CRUD + history queries, all wired through the WAL
- `supabase/migrations/0001_initial.sql` — exactly the SQL in Section 4
- `.env.example` entries for `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Rewrite (public API preserved, internals swapped):**

- `src/stores/useAuthStore.ts` — swap Firebase for Supabase session management. UI unaffected.
- `src/stores/usePillStore.ts` — swap service imports. The Zustand actions (`addPill`, `updatePill`, `deletePill`, `recordDose`, `dismissDose`, `setPillPreferredTimerLocal`) keep their current signatures.
- The WAL helpers (`enqueueAndAttempt`, `attemptEnqueued`, `executeOperation`) move into the new `src/services/supabase/pills.ts` with each `case` rewritten to call Supabase queries instead of Firestore transactions. Entry format is unchanged.

**Delete:**

- `src/services/firebase/` (entire directory: `config.ts`, `auth.ts`, `googleAuth.ts`, `pills.ts`, `index.ts`)
- `firestore.rules` (if present)
- `firestore.indexes.json`
- `functions/` directory (Cloud Functions)
- `google-services.json`, `GoogleService-Info.plist` if checked in (they should be gitignored)
- `firebase` from `package.json` (and `firebase-functions`, `firebase-admin` from `functions/package.json` via removal of the whole directory)

**Minimal touch (import repointing or small wiring changes):**

- `src/app/_layout.tsx` — replace the Firebase auth listener with `supabase.auth.onAuthStateChange`. Ensure session hydration completes before the router decides the initial route.
- Any screen that directly imports from `@/services/firebase/*` — repointed to `@/services/supabase/*`. Most go through stores, so this should be a small handful of files at most.
- `app.json` — remove Firebase plugin config if any; no new native plugins needed for Supabase JS SDK.
- `package.json` — remove `firebase`, add `@supabase/supabase-js` and `react-native-url-polyfill`.

**Unchanged:**

- `src/core/*`, `src/components/*`, `src/theme/*`, `src/hooks/*`
- All UI screens under `src/app/(main)`, `src/app/(auth)`, `src/app/(onboarding)` (only the files doing direct Firebase imports get touched)
- Drug database JSON and its build script
- Expo notifications setup
- RevenueCat client integration

---

## 7. Scope and risk

**Rough work breakdown** (no time estimates, just a sense of effort):

| Piece | Size | Notes |
|---|---|---|
| Schema + RLS SQL, applied and smoke-tested in Supabase dashboard | Small | Runs in the SQL editor; takes minutes |
| New Supabase service layer (`auth.ts`, `pills.ts`, WAL adapter) | Medium | The biggest chunk of the work |
| Store rewiring | Small | Interfaces stable, imports swapped |
| Screen imports, auth listener in `_layout.tsx` | Small | Few touchpoints |
| Deleting Firebase code, config files, and `functions/` | Small | Mechanical |
| Manual smoke test pass on Android device | Medium | Register, sign in, add pill, record dose, edit timer, delete pill, open history, kill-and-resume offline behavior |

**Why this is low risk right now:**

- **No production data.** Exactly one debug user exists in the current Firestore project. We wipe it before starting, no migration script needed, no dual-write period.
- **Clean abstraction boundaries.** The `core/` module is already backend-agnostic. The stores already hide the backend from the UI.
- **Stable public API in the stores.** Every UI screen will keep working unchanged.
- **The WAL is portable.** It was built as an operation log, not as a Firestore-specific thing.

**What could still bite us:**

- **Session hydration on cold start.** Supabase's AsyncStorage adapter works, but we need `_layout.tsx` to wait for the initial `getSession()` call before deciding whether to route the user to `(auth)` or `(main)`. Getting this wrong causes a flash of the login screen on every app open. The assistant will handle this explicitly.
- **RLS policy correctness.** If a policy is too strict, queries silently return empty arrays and the app looks broken. If it is too loose, users can read each other's data. The Post-migration checklist (Section 9) includes a direct REST test against each table to verify both cases.
- **Email confirmation flow.** By default Supabase requires email confirmation before sign-in works. For development we will disable this in the dashboard. The checklist calls it out.

---

## 8. Step-by-step Supabase setup (developer actions)

This section is a complete zero-to-running Supabase setup. Follow it in order. No prior Supabase experience is assumed. Every click path was verified against the current Supabase dashboard.

### 8.1 Create a Supabase account

1. Open a browser and go to **https://supabase.com**.
2. Click **Start your project** (top-right).
3. Sign up with GitHub (recommended — it's the same account you use for this repo). Email/password also works.
4. You will land on the Supabase dashboard. If this is your first time, it will prompt you to create an organization. Name it anything you like (for example, your own name, or `halflifecontrol-org`). Select **Free** as the plan.

### 8.2 Create the project

1. Click **New project** on the dashboard.
2. Choose the organization you just created.
3. Fill in:
   - **Name**: `HalfLifeControl`
   - **Database password**: click **Generate a password** and **COPY IT IMMEDIATELY INTO A PASSWORD MANAGER**. You cannot recover it later through the dashboard — if you lose it, you will have to reset it. You will rarely use it (only for direct Postgres access, migrations via CLI, or psql), but losing it is annoying.
   - **Region**: pick the region closest to your primary users.
     - For US users: `East US (North Virginia)` or `West US (Oregon)`.
     - For Europe: `West EU (Ireland)` or `Central EU (Frankfurt)`.
     - **Important**: This cannot be changed later without creating a new project. Pick deliberately.
   - **Pricing plan**: **Free** (covers 500 MB database, 5 GB egress, 50k MAU, which is plenty for development and early users).
4. Click **Create new project**.
5. Wait ~2 minutes while Supabase provisions the Postgres instance. The dashboard will show a progress indicator, then drop you into the project once it is ready.

### 8.3 Save the project URL and anon key

1. In the left sidebar, click the **Project Settings** icon (gear icon near the bottom).
2. In the settings submenu, click **API**.
3. You will see two blocks on this page:
   - **Project URL** — looks like `https://abcdefghijklmno.supabase.co`. Copy it.
   - **Project API keys** — contains two keys:
     - **`anon` public** — safe to embed in the client app. This is what we put in `.env`.
     - **`service_role` secret** — **NEVER put this in the client**. It bypasses RLS. Only use it server-side or from your own local admin scripts.
4. Copy the `anon` public key.
5. Save both values in a scratchpad or password manager for now. You will paste them into the local `.env` file once the assistant wires up the code.

### 8.4 Apply the database schema

1. In the left sidebar of your project, click the **SQL Editor** icon (looks like a document with `<>`).
2. Click **+ New query** (top-left of the SQL Editor).
3. Open `docs/MIGRATIONTOSUPABASE.md` on your machine, copy the **entire SQL block from Section 4** (everything between the two ```sql fences), and paste it into the SQL Editor.
4. Click the green **Run** button (bottom-right, or press `Ctrl+Enter` / `Cmd+Enter`).
5. You should see **Success. No rows returned** at the bottom. If you see an error, stop and read it — the most common cause is partial execution from a previous attempt. If you suspect this, run `drop table if exists public.doses, public.pills, public.profiles cascade;` first, then re-run the full schema.
6. Verify the tables exist: click the **Table Editor** icon in the sidebar. You should see `profiles`, `pills`, and `doses` listed under the `public` schema.
7. Click each table and confirm the columns match the schema definition.

### 8.5 Verify Row Level Security is enabled

RLS is the only thing between a signed-in user and everyone else's data. Supabase enables it when the `alter table ... enable row level security` statement runs, but verify it manually because forgetting this step is the most common cause of data leaks in Supabase apps.

1. In the left sidebar, click **Authentication** → **Policies**.
2. You should see three tables listed: `profiles`, `pills`, `doses`.
3. For each of them, confirm:
   - A green **RLS enabled** badge is shown.
   - The `*_own` policy exists with the condition `(auth.uid() = id)` for profiles or `(auth.uid() = user_id)` for pills and doses.
4. If any table is missing the RLS badge, click it and toggle **Enable RLS**. If the policy is missing, re-run the `create policy` statements from Section 4.

### 8.6 Configure email/password authentication

The Supabase auth service is enabled by default, but email confirmation is on. For development, turn it off so that you can sign up and immediately use the account without opening an email.

1. In the left sidebar, click **Authentication** → **Providers**.
2. Confirm **Email** is listed as an enabled provider (it is by default). Click it to expand.
3. Scroll to **Confirm email** and toggle it **off** for now.
4. Click **Save**.
5. Still under **Authentication**, click **URL Configuration** (or **Redirect URLs** depending on dashboard version).
6. **Site URL**: for development, set to `halflifecontrol://` (the app's scheme — we'll register this in `app.json` during the code phase). For now, you can leave it at the default or set it to `http://localhost:8081`. It only matters for password-reset and magic-link flows, which we are not using yet.
7. Save.

> **Re-enable email confirmation before production**. Add a TODO in your personal notes, or put it in the Post-migration checklist below.

### 8.7 Test the setup with a throwaway user

Before handing the URL and anon key off to the assistant, sanity-check that auth works.

1. In the sidebar, click **Authentication** → **Users**.
2. Click **Add user** → **Create new user**.
3. Email: `test@example.com`, Password: `testtest` (or any 6+ char password), toggle **Auto Confirm User** ON.
4. Click **Create user**.
5. Switch to **Table Editor** → **profiles**. A row for `test@example.com` should have been auto-created by the `handle_new_user` trigger. If it is missing, the trigger did not install correctly — re-run the SQL block and try again.
6. Delete the test user (Authentication → Users → click the row → `...` → **Delete user**). The profile row should cascade-delete automatically because of `on delete cascade`. Confirm it is gone in the Table Editor.

If all of that worked, the backend is ready.

### 8.8 Wipe the Firebase debug data (optional but recommended)

You can leave the Firebase project dormant, but it is cleaner to wipe the one debug user so there is nothing to confuse later.

1. Go to **https://console.firebase.google.com**.
2. Open the HalfLifeControl project.
3. **Authentication** → **Users** → delete the debug user.
4. **Firestore Database** → find the `users/{uid}` document → delete it (and its subcollections).
5. You can stop there. Deleting the whole Firebase project is not necessary; it will cost $0 sitting idle.

### 8.9 Save these values for the assistant

When you run the command to start the code migration, have these ready:

- [ ] **`EXPO_PUBLIC_SUPABASE_URL`** (from Step 8.3)
- [ ] **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** (from Step 8.3)
- [ ] **Confirmation that Step 8.5 (RLS) passed**
- [ ] **Confirmation that Step 8.7 (test user auto-created a profile row) passed**

The assistant will paste the two env values into your local `.env` and `.env.example`, and wire them into `src/services/supabase/config.ts`.

### 8.10 Supabase CLI (optional, recommended for the future)

Not required to complete the migration, but worth installing so future schema changes can live in version-controlled migration files instead of being run ad-hoc in the dashboard SQL editor.

1. Install the CLI:
   - **Windows (Scoop)**: `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`
   - **Windows (npm)**: `npm install -g supabase`
   - **macOS (Homebrew)**: `brew install supabase/tap/supabase`
2. Authenticate: `supabase login` (opens a browser, paste the generated token back into the terminal).
3. Link your local repo to the remote project: from the project root, run `supabase link --project-ref <your-project-ref>`. The project ref is the subdomain of your project URL (everything before `.supabase.co`).
4. From then on, schema changes can be authored locally under `supabase/migrations/` and pushed with `supabase db push`.

---

## 9. Post-migration checklist

After the assistant finishes the code changes and you rebuild the app, walk through every item below on a real Android device. Check each box only when you personally verified it.

**Core flows:**

- [ ] Cold start of the app shows the login screen (no flash of the dashboard).
- [ ] Register a new user with email/password. Sign-up succeeds immediately (because email confirmation is off in dev).
- [ ] After register, the dashboard loads with empty stack and empty one-time sections.
- [ ] Back in Supabase → Table Editor → `profiles`: a row exists for the new user with `onboarding_complete = false`.
- [ ] Add a scheduled pill to the stack. It appears on the dashboard.
- [ ] In Supabase → `pills`: a row exists with the correct `user_id`, `pill_type = 'scheduled'`, and the right `schedule` JSON.
- [ ] Tap the pill, change the preferred timer, back out. Dashboard reflects the new timer instantly.
- [ ] In Supabase → `pills`: the `preferred_timer` column shows the new value.
- [ ] Tap the play button on a pill. A live countdown appears.
- [ ] In Supabase → `doses`: a row exists with `status = 'active'` and a computed `elimination_at`.
- [ ] Record another dose on a different pill. Both countdowns run.
- [ ] Kill the app. Re-open. Both countdowns resume at the correct progress with no network call visible (served from cache + Supabase rehydrate).
- [ ] Delete a pill from the detail screen. It disappears from the dashboard. In Supabase the row still exists with `is_active = false`.
- [ ] Open the history screen. It shows the doses recorded above.

**Multi-device / offline:**

- [ ] Turn airplane mode on. Record a dose. UI updates instantly (WAL).
- [ ] Kill the app with airplane mode still on.
- [ ] Turn airplane mode off. Re-open the app. The dose that was recorded offline reaches Supabase within a few seconds of app start (check the `doses` table).

**Security:**

- [ ] Sign out. Sign up a second user. Confirm the second user cannot see the first user's pills or doses (they should see an empty dashboard).
- [ ] Manually try to query the first user's data from the second user's session using the Supabase JS client in a throwaway script. RLS should return an empty array, not an error.

**Cleanup:**

- [ ] The Firebase project is either deleted or sitting idle with no data.
- [ ] `firebase` is not in `package.json`.
- [ ] `src/services/firebase/` is gone.
- [ ] `functions/` is gone.
- [ ] `firestore.rules` and `firestore.indexes.json` are gone.
- [ ] `.env` contains only Supabase keys for the backend (plus any unrelated RevenueCat / Sentry keys).

**Before going to production (not needed for dev):**

- [ ] Re-enable email confirmation in Supabase → Authentication → Providers → Email.
- [ ] Rotate the database password and store it in a secrets manager.
- [ ] Review RLS policies one more time against the final schema.

---

## 10. Rollback plan

If the migration goes wrong mid-stream and we need to revert:

1. `git revert` the migration commits. The Firebase code is preserved in git history and can be restored cleanly since there is no data to lose.
2. Re-enable the Firebase project (it is not deleted, just idle).
3. Restore `.env` from backup or re-enter the Firebase values from the Firebase console.

Because there is no production data and no dual-write period, rollback is just a git operation. This is the main reason we are doing the migration now instead of later.

---

## Appendix: decisions we explicitly did not make

These are intentional non-decisions at this point in the migration. Each becomes a separate follow-up change if/when needed.

- **Supabase Edge Functions** for the RevenueCat webhook — Phase 5 work.
- **Supabase Realtime** for cross-device live updates — considered and deferred per Section 2.
- **Google / Apple Sign-In** via Supabase OAuth — deferred per Section 2.
- **Server-side pill limit enforcement** via a Postgres trigger — deferred until abuse is actually observed.
- **A local Supabase dev instance** via `supabase start` — overkill for a single-developer project at this stage.

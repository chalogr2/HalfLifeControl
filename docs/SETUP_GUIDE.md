# HalfLifeControl — External Services Setup Guide

This guide covers everything you need to set up manually before we start coding. Complete these steps in order — later steps depend on earlier ones.

> **Backend note (2026-04)**: HalfLifeControl is migrating from Firebase to Supabase. The **primary, current source of truth** for backend setup is **[`MIGRATIONTOSUPABASE.md`](./MIGRATIONTOSUPABASE.md) Section 8**, which contains a complete step-by-step Supabase setup. Section 3 below has been replaced with a short pointer to that document. Every other section (Expo, Apple, Google Play, RevenueCat, Sentry) is unchanged and still applies.

---

## Table of Contents

1. [Prerequisites (Install These First)](#1-prerequisites)
2. [Expo / EAS Account](#2-expo--eas-account)
3. [Supabase Project](#3-supabase-project)
4. [Apple Developer Account](#4-apple-developer-account)
5. [Google Play Developer Account](#5-google-play-developer-account)
6. [RevenueCat (Subscriptions)](#6-revenuecat)
7. [Sentry (Crash Reporting)](#7-sentry)
8. [Checklist — Values You'll Give Me](#8-checklist)

---

## 1. Prerequisites

Install these tools on your machine before anything else.

### 1.1 Node.js (LTS)

1. Go to https://nodejs.org
2. Download the **LTS** version (20.x or newer)
3. Run the installer, accept defaults
4. Verify in your terminal:
   ```
   node --version    # Should show v20.x.x or higher
   npm --version     # Should show 10.x.x or higher
   ```

### 1.2 Git (already done)

You already have Git installed and your repo connected. Nothing to do here.

### 1.3 Expo CLI

1. In your terminal, run:
   ```
   npm install -g eas-cli
   ```
2. Verify:
   ```
   eas --version
   ```

### 1.4 Supabase CLI (optional, recommended)

Not required to run the app, but worth installing so future schema changes live in version-controlled migration files instead of ad-hoc runs in the dashboard SQL editor.

1. In your terminal, run:
   ```
   npm install -g supabase
   ```
2. Verify:
   ```
   supabase --version
   ```
3. Log in (only needed once you want to push migrations):
   ```
   supabase login
   ```
   This opens a browser window — paste the generated token back into the terminal.

Detailed usage is covered in [`MIGRATIONTOSUPABASE.md`](./MIGRATIONTOSUPABASE.md) Section 8.10.

### 1.5 Java Development Kit (JDK) — needed for Android builds

1. Download JDK 17 from https://adoptium.net (Temurin)
2. Run the installer
3. Verify:
   ```
   java --version    # Should show 17.x.x
   ```

---

## 2. Expo / EAS Account

EAS (Expo Application Services) handles building and submitting your app to both stores.

### 2.1 Create an Expo account

1. Go to https://expo.dev/signup
2. Create an account (remember your username — you'll need it)

### 2.2 Log in from the CLI

1. In your terminal, run:
   ```
   eas login
   ```
2. Enter your Expo credentials

### 2.3 Verify

```
eas whoami
```
Should show your username.

---

## 3. Supabase Project

Supabase provides our backend: Postgres database, authentication, and Row-Level Security. It replaces Firebase (Auth + Firestore + Cloud Functions + FCM).

**The complete, authoritative Supabase setup lives in [`MIGRATIONTOSUPABASE.md`](./MIGRATIONTOSUPABASE.md) Section 8**. That guide walks you through, click by click:

- 8.1 Creating a Supabase account
- 8.2 Creating the project (region, database password, free plan)
- 8.3 Copying the project URL and anon key
- 8.4 Applying the schema (SQL migration with pills, doses, profiles, RLS policies, triggers)
- 8.5 Verifying Row-Level Security is enabled
- 8.6 Configuring email/password authentication
- 8.7 Testing the setup with a throwaway user
- 8.8 Wiping the old Firebase debug data (optional but recommended)
- 8.9 Saving the values you'll give me
- 8.10 Installing the Supabase CLI (optional)

When you finish Section 8 you will have:

- A Supabase project URL (for `EXPO_PUBLIC_SUPABASE_URL`)
- A Supabase `anon` public key (for `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- A working schema with `profiles`, `pills`, and `doses` tables
- RLS policies enforced on every table
- A verified signup flow that auto-creates a profile row via a Postgres trigger

**Important**: iOS and Android builds do NOT require any platform-specific config file from Supabase (unlike Firebase's `google-services.json` and `GoogleService-Info.plist`). Supabase works entirely through the JS SDK plus two environment variables. This simplifies the setup considerably.

---

## 4. Apple Developer Account

Required for: iOS builds, App Store submission, Apple Sign-In, push notifications (APNs).

### 4.1 Enroll in the Apple Developer Program

1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with your Apple ID (or create one)
3. Enroll as an **Individual** ($99/year)
4. Complete the enrollment — approval can take 24-48 hours

### 4.2 Create an App ID

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click the **"+"** button
3. Select **App IDs** > **App**
4. Description: **HalfLifeControl**
5. Bundle ID: select **Explicit**, enter: **`com.halflifecontrol.app`**
6. Under Capabilities, check:
   - **Push Notifications**
   - **Sign In with Apple** (we'll use this in Phase 6)
7. Click **Continue** > **Register**

### 4.3 Create an APNs Key (for push notifications — only if/when we add server push)

> **Note**: With the Supabase migration we no longer have FCM as a push backend. Push notifications are **not part of the current migration scope** — the app relies on `expo-notifications` (local) only. If and when we add server-initiated push, we will revisit this step and configure an APNs key at that time. You can skip 4.3 and 4.4 for now.

1. Go to https://developer.apple.com/account/resources/authkeys/list
2. Click the **"+"** button
3. Key Name: **HalfLifeControl Push**
4. Check **Apple Push Notifications service (APNs)**
5. Click **Continue** > **Register**
6. **Download the `.p8` file** — you can only download it ONCE. Save it securely.
7. Note the **Key ID** shown on the page
8. Also note your **Team ID** — visible at the top-right of the developer portal, or at https://developer.apple.com/account under Membership details

### 4.4 (Deferred) Upload the APNs key to your push backend

Skipped until server push is reintroduced. Keep the `.p8` file safe if you created one.

### 4.5 Values to save

Write down:
- **Team ID**: (from Apple developer portal)
- **Bundle ID**: `com.halflifecontrol.app`

---

## 5. Google Play Developer Account

Required for: Android builds, Play Store submission, in-app purchases.

### 5.1 Register as a Google Play Developer

1. Go to https://play.google.com/console/signup
2. Sign in with your Google account
3. Pay the **one-time $25 registration fee**
4. Complete identity verification (can take a few days)

### 5.2 Create your app listing (basic setup)

1. In Google Play Console, click **"Create app"**
2. App name: **HalfLifeControl**
3. Default language: **English (United States)**
4. App or Game: **App**
5. Free or Paid: **Free** (we monetize via in-app subscriptions)
6. Accept the declarations and click **Create app**

### 5.3 Create a service account (for EAS Submit)

This lets EAS automatically upload builds to Google Play.

1. Go to Google Play Console > **Setup** > **API access**
2. Click **"Link"** to link to Google Cloud (if prompted)
3. Under **Service accounts**, click **"Create new service account"**
4. This opens Google Cloud Console. Follow these steps:
   a. Click **"+ Create Service Account"**
   b. Service account name: **eas-submit**
   c. Click **Create and Continue**
   d. Role: **Service Account User** (or skip and we'll set permissions in Play Console)
   e. Click **Done**
5. Back in the Google Cloud Console, find the service account you just created
6. Click the **three dots** menu > **Manage keys**
7. Click **Add key** > **Create new key** > **JSON** > **Create**
8. **Download the JSON key file** — save it as `google-play-key.json`
9. Go back to **Google Play Console** > **Setup** > **API access**
10. Find the service account and click **"Manage Play Console permissions"**
11. Under **App permissions**, add **HalfLifeControl** and grant:
    - **Releases** — full access
    - **Store presence** — full access
12. Click **Invite user** > **Send invite**

### 5.4 Values to save

- The **`google-play-key.json`** file — I'll tell you where to place it

---

## 6. RevenueCat

RevenueCat handles in-app subscriptions across both iOS and Android.

### 6.1 Create a RevenueCat account

1. Go to https://app.revenuecat.com/signup
2. Sign up (GitHub login works)

### 6.2 Create a project

1. Click **"+ New"** in the top-left > **Project**
2. Project name: **HalfLifeControl**

### 6.3 Add your Apple app

1. Inside the project, click **"+ New"** > **App**
2. Platform: **App Store**
3. App name: **HalfLifeControl**
4. Apple bundle ID: `com.halflifecontrol.app`
5. For **App-Specific Shared Secret**:
   a. Go to https://appstoreconnect.apple.com (you may need to create the app first in App Store Connect)
   b. In App Store Connect: **My Apps** > **+** > **New App** > fill in details (name, bundle ID, SKU)
   c. Then go to the app > **General** > **App Information** > **App-Specific Shared Secret** > **Manage**
   d. Generate a shared secret and copy it
   e. Paste it back in RevenueCat
6. Click **Save**

### 6.4 Add your Android app

1. Click **"+ New"** > **App**
2. Platform: **Play Store**
3. App name: **HalfLifeControl**
4. Package name: `com.halflifecontrol.app`
5. For **Service Account credentials JSON**:
   - You can reuse the `google-play-key.json` from Step 5.3, or create a separate one
   - Upload the JSON file
6. Click **Save**

### 6.5 Create Products (Subscription)

1. First, create the products in the stores:

   **Apple (App Store Connect)**:
   a. Go to your app in App Store Connect > **Monetization** > **Subscriptions**
   b. Create a **Subscription Group**: name it **"HalfLifeControl Pro"**
   c. Create a subscription inside the group:
      - Reference Name: **Pro Monthly**
      - Product ID: **`halflifecontrol_pro_monthly`**
      - Duration: **1 Month**
      - Price: **$4.99**
   d. Create another subscription:
      - Reference Name: **Pro Yearly**
      - Product ID: **`halflifecontrol_pro_yearly`**
      - Duration: **1 Year**
      - Price: **$39.99**

   **Google (Play Console)**:
   a. Go to your app in Play Console > **Monetize** > **Products** > **Subscriptions**
   b. Click **"Create subscription"**
   c. Product ID: **`halflifecontrol_pro_monthly`**
   d. Name: **Pro Monthly**
   e. Add a **base plan**: billing period **1 month**, price **$4.99**
   f. Create another subscription:
   g. Product ID: **`halflifecontrol_pro_yearly`**
   h. Name: **Pro Yearly**
   i. Add a base plan: billing period **1 year**, price **$39.99**

2. Back in RevenueCat:
   a. Go to **Products** > click **"+ New"**
   b. Add all 4 products (2 iOS, 2 Android) using the product IDs above
   c. Go to **Entitlements** > **"+ New"**
   d. Identifier: **`pro`**
   e. Attach all 4 products to this entitlement
   f. Go to **Offerings** > edit the **Default** offering
   g. Create a package for **Monthly** and **Annual**, attach the corresponding products

### 6.6 Copy your API keys

1. In RevenueCat, go to your project > **API Keys** (sidebar)
2. Copy the **Public app-specific API key** for:
   - **Apple app** — save as `REVENUECAT_APPLE_KEY`
   - **Android app** — save as `REVENUECAT_ANDROID_KEY`

---

## 7. Sentry (Crash Reporting)

Sentry captures crashes and errors in production. This is a Phase 6 task but you can set it up now if you want.

### 7.1 Create a Sentry account

1. Go to https://sentry.io/signup/
2. Sign up (GitHub login works)

### 7.2 Create a project

1. Click **"Create Project"**
2. Platform: **React Native**
3. Project name: **halflifecontrol**
4. Click **Create Project**

### 7.3 Copy your DSN

1. Go to **Settings** > **Projects** > **halflifecontrol** > **Client Keys (DSN)**
2. Copy the **DSN** string (looks like `https://abc123@o456.ingest.sentry.io/789`)
3. Save this as `SENTRY_DSN`

---

## 8. Checklist — Values You'll Give Me

Once you've completed the steps above, you'll need to provide me with these values so I can configure the project. I'll store them securely in a `.env` file (gitignored).

### Supabase (from [`MIGRATIONTOSUPABASE.md`](./MIGRATIONTOSUPABASE.md) Section 8.3)
- [ ] `EXPO_PUBLIC_SUPABASE_URL`
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Confirmation that RLS is enabled on `profiles`, `pills`, `doses` (Section 8.5)
- [ ] Confirmation that the `handle_new_user` trigger auto-creates a profile row on signup (Section 8.7)

### Apple (from Section 4.5)
- [ ] Apple Team ID
- [ ] Bundle ID: `com.halflifecontrol.app`

### Google Play (from Section 5.3)
- [ ] `google-play-key.json` (for EAS Submit)

### RevenueCat (from Section 6.6)
- [ ] `REVENUECAT_APPLE_KEY`
- [ ] `REVENUECAT_ANDROID_KEY`

### Sentry (from Section 7.3)
- [ ] `SENTRY_DSN`

### Expo (from Section 2)
- [ ] Your Expo username

---

## What I'll Handle For You

Once you give me the values above, I will:

- Create/update the `.env` and `.env.example` files with Supabase keys
- Install `@supabase/supabase-js` and `react-native-url-polyfill`
- Wire the Supabase client in `src/services/supabase/config.ts` with the AsyncStorage session adapter
- Rewrite the service layer and point the Zustand stores at it
- Delete the old Firebase code (`src/services/firebase/`, `functions/`, `firestore.rules`, `firestore.indexes.json`)
- Configure `app.json` / `eas.json` with the correct identifiers (no Firebase plugin needed)
- Set up the entire codebase, project structure, and all configurations
- Configure CI/CD (GitHub Actions)

**You handle the accounts and credentials. I handle the code.**

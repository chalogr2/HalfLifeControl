# HalfLifeControl — External Services Setup Guide

This guide covers everything you need to set up manually before we start coding. Complete these steps in order — later steps depend on earlier ones.

---

## Table of Contents

1. [Prerequisites (Install These First)](#1-prerequisites)
2. [Expo / EAS Account](#2-expo--eas-account)
3. [Firebase Project](#3-firebase-project)
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

### 1.4 Firebase CLI

1. In your terminal, run:
   ```
   npm install -g firebase-tools
   ```
2. Verify:
   ```
   firebase --version
   ```
3. Log in:
   ```
   firebase login
   ```
   This opens a browser window — sign in with the Google account you'll use for Firebase.

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

## 3. Firebase Project

Firebase provides authentication, database (Firestore), push notifications (FCM), and Cloud Functions.

### 3.1 Create the Firebase project

1. Go to https://console.firebase.google.com
2. Click **"Create a project"** (or "Add project")
3. Project name: **`HalfLifeControl`**
4. **Enable Google Analytics** — select "Default Account for Firebase" (or create one). Analytics is useful for tracking user behavior and is free.
5. Wait for the project to be created, then click **Continue**

### 3.2 Upgrade to Blaze plan (required for Cloud Functions)

1. In the Firebase console, click the **gear icon** (bottom-left) > **Usage and billing** > **Details & settings**
2. Click **"Modify plan"** and select **Blaze (pay as you go)**
3. Add a billing account (credit card required)
4. **Cost note**: The Blaze plan has a generous free tier. For development and early users, you will likely pay $0. Firebase charges only for usage beyond the free quotas. Cloud Functions require Blaze but won't cost anything during development.

### 3.3 Enable Authentication

1. In the Firebase console sidebar, click **Build** > **Authentication**
2. Click **"Get started"**
3. Under **Sign-in method**, enable:
   - **Email/Password** — click it, toggle **Enable** on, click **Save**
4. (We'll add Google and Apple sign-in later in Phase 6)

### 3.4 Enable Firestore

1. In the sidebar, click **Build** > **Firestore Database**
2. Click **"Create database"**
3. Choose a location closest to your target users:
   - For US users: **`us-central1` (Iowa)** or **`us-east1` (South Carolina)**
   - **Important**: This cannot be changed later. Pick carefully.
4. Start in **Production mode** (we'll deploy proper security rules from code)
5. Click **Create**

### 3.5 Register an Android app

1. In the Firebase console, click the **gear icon** next to "Project Overview" > **Project settings**
2. Scroll down to **"Your apps"** and click the **Android icon**
3. Android package name: **`com.halflifecontrol.app`**
   - This must match what we'll set in `app.json`. Use exactly this value.
4. App nickname: **HalfLifeControl**
5. Skip the SHA-1 for now (we'll add it later for Google Sign-In)
6. Click **Register app**
7. Download **`google-services.json`**
8. **Save this file** — you'll place it in the project root later. I'll tell you when.

### 3.6 Register an iOS app

1. Still in Project settings > Your apps, click the **iOS icon**
2. Apple bundle ID: **`com.halflifecontrol.app`**
   - This must also match what we'll set in `app.json`.
3. App nickname: **HalfLifeControl**
4. Skip the App Store ID for now
5. Click **Register app**
6. Download **`GoogleService-Info.plist`**
7. **Save this file** alongside the Android one.

### 3.7 Enable Cloud Messaging (FCM)

1. In Project settings, click the **Cloud Messaging** tab
2. If you see a banner saying "Cloud Messaging API (Legacy) is disabled", that's fine — we use the v1 API which is enabled by default
3. Note: iOS push notifications require an APNs key (covered in Section 4)

### 3.8 Set up Cloud Functions (just init — we'll write code later)

No action needed yet. I'll initialize Firebase Functions in the project when we start coding. Just make sure you completed Step 3.2 (Blaze plan).

### 3.9 Copy your Firebase config values

1. Go to **Project settings** > **General** tab
2. Scroll down to your **Web app** section. If you don't see one, click **"Add app"** > **Web** (`</>` icon):
   - Nickname: **HalfLifeControl Web**
   - Skip Firebase Hosting
   - Click **Register app**
3. You'll see a config object like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "halflifecontrol.firebaseapp.com",
     projectId: "halflifecontrol",
     storageBucket: "halflifecontrol.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123",
   };
   ```
4. **Copy and save all these values.** You'll give them to me to put in the `.env` file.

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

### 4.3 Create an APNs Key (for push notifications)

1. Go to https://developer.apple.com/account/resources/authkeys/list
2. Click the **"+"** button
3. Key Name: **HalfLifeControl Push**
4. Check **Apple Push Notifications service (APNs)**
5. Click **Continue** > **Register**
6. **Download the `.p8` file** — you can only download it ONCE. Save it securely.
7. Note the **Key ID** shown on the page
8. Also note your **Team ID** — visible at the top-right of the developer portal, or at https://developer.apple.com/account under Membership details

### 4.4 Upload the APNs key to Firebase

1. Go to Firebase console > **Project settings** > **Cloud Messaging** tab
2. Under **Apple app configuration**, click **Upload** next to "APNs Authentication Key"
3. Upload the `.p8` file you just downloaded
4. Enter the **Key ID** and your **Team ID**
5. Click **Upload**

### 4.5 Values to save

Write down:
- **Team ID**: (from Apple developer portal)
- **Key ID**: (from the APNs key you created)
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

### Firebase (from Section 3.9)
- [ ] `FIREBASE_API_KEY`
- [ ] `FIREBASE_AUTH_DOMAIN`
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_STORAGE_BUCKET`
- [ ] `FIREBASE_MESSAGING_SENDER_ID`
- [ ] `FIREBASE_APP_ID`

### Firebase config files (from Sections 3.5 and 3.6)
- [ ] `google-services.json` (Android)
- [ ] `GoogleService-Info.plist` (iOS)

### Apple (from Section 4.5)
- [ ] Apple Team ID
- [ ] APNs Key ID

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

- Create the `.env` and `.env.example` files
- Place `google-services.json` and `GoogleService-Info.plist` in the right locations
- Configure `app.json` / `eas.json` with all the correct identifiers
- Write Firestore security rules and deploy instructions
- Set up the entire codebase, project structure, and all configurations
- Configure CI/CD (GitHub Actions)

**You handle the accounts and credentials. I handle the code.**

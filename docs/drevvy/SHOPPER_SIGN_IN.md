# Shopper sign-in (iOS and Android)

Real-device testers sign in with Apple or Google. The app sends the identity token to the existing consumer auth routes. Those routes call Supabase `signInWithIdToken`, then `ensure_consumer_profile`. That function creates `consumer_profiles` and grants the existing **3 starter keys** (`starter_grant`). It does not create a new key pack.

Looking around stays free. Matters v5 still ends on **Find my next car** with no purchase and no account screen. Demo chat stays on the device until someone is signed in.

After onboarding, open the account sheet (the avatar). **Sign in to message a dealer** uses Apple or Google. It does not open a paywall. **Continue with email** on the create-account screen is still look-around only. It does not create a server account.

Signed-in dealer chat calls `POST /api/consumer/deals` with the shopper token and the car (year, make, model, price). A signed-out shopper never calls that route. The local stub chat stays for UI walks.

This file is the click list. No SQL. Do not commit a client secret, a `.p8` file, or a Firebase private key.

## What is already in the repo

| Piece | Where |
| --- | --- |
| iOS bundle id | `com.drevvy.drevvyApp` |
| Android application id | `com.drevvy.drevvy_app` |
| Sign in with Apple entitlement | `apps/drevvy-app/ios/Runner/Runner.entitlements` (`com.apple.developer.applesignin` = Default). Wired in the Xcode project. |
| Google iOS URL scheme and `GIDClientID` | `apps/drevvy-app/ios/Runner/Info.plist` |
| Public Google client IDs (not secrets) | `DREVVY_GOOGLE_SERVER_CLIENT_ID` (web) and `DREVVY_GOOGLE_IOS_CLIENT_ID` (iOS) in `apps/drevvy-app/lib/core/config/drevvy_config.dart` |
| Android Apple return activity | `AndroidManifest.xml` activity `SignInWithAppleCallback`, scheme `signinwithapple` |
| Android return URL | `https://www.drevvy.com/api/consumer/auth/apple/callback` |
| Apple Services ID | Empty until you pass `--dart-define=DREVVY_APPLE_SERVICE_ID=...` |
| Starter keys | `supabase/migrations/20261029170000_starter_free_keys.sql` and `ensureConsumerProfile` on the Apple and Google auth routes |

Google Sign-In on Android does **not** need `google-services.json`. The plugin uses the web client ID already compiled into the app. `google-services.json.example` is for Firebase push, not for this login.

## Build flags

iOS Sign in with Apple needs no extra flag. Android Sign in with Apple needs the Services ID you create below:

```bash
cd apps/drevvy-app
flutter run \
  --dart-define=DREVVY_APPLE_SERVICE_ID=YOUR_SERVICES_ID
```

Override the return URL only if the API host is not `https://www.drevvy.com`:

```bash
--dart-define=DREVVY_APPLE_REDIRECT_URI=https://YOUR_HOST/api/consumer/auth/apple/callback
```

Rotate a Google client by passing new public client IDs and updating `GIDClientID` plus the reversed URL scheme in `Info.plist`. Do not commit a Google client secret.

```bash
--dart-define=DREVVY_GOOGLE_SERVER_CLIENT_ID=YOUR_WEB_CLIENT_ID \
--dart-define=DREVVY_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID
```

## Apple Developer (you click this)

1. Open [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources).
2. Identifiers → App ID `com.drevvy.drevvyApp` → enable **Sign in with Apple** → Save. Leave the server-to-server notification URL blank. Supabase does not use it.
3. Keys → create a key, enable **Sign in with Apple**, attach it to `com.drevvy.drevvyApp`. Download the `.p8` once. Write down the Key ID and your Team ID (10 characters). Store the `.p8` outside the repo. If it leaks, revoke it and make a new key.
4. Identifiers → plus → **Services ID**. Example: `com.drevvy.drevvyApp.signin`. Enable **Sign in with Apple**. Configure it against the App ID `com.drevvy.drevvyApp`.
5. On that Services ID, add website URLs:
   - Domain: `www.drevvy.com`. Apple will ask you to verify the domain. Host the file they give you. This repo cannot invent that file.
   - Return URL: `https://www.drevvy.com/api/consumer/auth/apple/callback`
   - Also add the Supabase callback if the dashboard asks for it: domain `<project-ref>.supabase.co`, return URL `https://<project-ref>.supabase.co/auth/v1/callback`.
6. Xcode: open `apps/drevvy-app/ios/Runner.xcworkspace` → target Runner → Signing & Capabilities. **Sign in with Apple** should already show, because `Runner.entitlements` is the code-sign entitlements file. Turn on automatic signing with the team that owns `com.drevvy.drevvyApp`. If the device install says the capability is missing, the App ID in step 2 is not saved yet. Refresh the profile. This does not need a new entitlement in git.
7. Android builds pass the Services ID from step 4 as `DREVVY_APPLE_SERVICE_ID`.

The Apple client secret expires about every 6 months because Android uses the Services ID. Set a reminder. Native iOS tokens keep working, but Android sign-in stops when the secret is stale. Generate a new secret from the same `.p8` in the Supabase Apple provider page.

## Google Cloud (you click this)

Use the Google Cloud project that already owns the client IDs in `drevvy_config.dart`, or create new clients and replace those public IDs in the app.

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → OAuth consent screen. App name Drevvy. Add a privacy policy URL and a terms URL. Add the test Google accounts under Test users while the app is in testing.
2. Credentials → the **Web** client. Its client ID is `DREVVY_GOOGLE_SERVER_CLIENT_ID`. Android asks Google for an ID token for this client. You do not paste this client's secret into the app or into git.
3. Credentials → **iOS** client. Bundle ID `com.drevvy.drevvyApp`. Its client ID must match `GIDClientID` in `Info.plist` and `DREVVY_GOOGLE_IOS_CLIENT_ID`. The URL scheme is the reversed client ID and is already in `Info.plist` for the current ID (`com.googleusercontent.apps.` + the part before `.apps.googleusercontent.com`).
4. Credentials → **Android** client.
   - Package name: `com.drevvy.drevvy_app` (not the iOS bundle id).
   - SHA-1 for the key that signs the test build. Debug keystore:

```bash
keytool -list -v -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android
```

   Add the release SHA-1 as well before a Play build. One Android client can hold more than one SHA-1.

5. Copy the public client IDs into the backend env `GOOGLE_OAUTH_CLIENT_IDS` (see below). Do not copy the client secret into the app.

## Supabase Auth (you click this)

Dashboard → Authentication → Providers. No migration. Do not run SQL from this setup.

### Apple

1. Enable Apple.
2. Services ID is the **first** Client ID. Then the iOS bundle id, comma-separated:
   `YOUR_SERVICES_ID,com.drevvy.drevvyApp`
   Supabase uses the first ID for web OAuth. Native `signInWithIdToken` accepts any ID in the list. iOS tokens use `com.drevvy.drevvyApp`. Android tokens use the Services ID.
3. Generate the secret from Team ID, Key ID, Services ID, and the `.p8`. Paste it into the Apple provider. Do not put it in this repo.
4. Save.

### Google

1. Enable Google.
2. Client IDs, comma-separated, **web client first**, then the iOS client ID, then the Android client ID:
   `WEB_CLIENT_ID,IOS_CLIENT_ID,ANDROID_CLIENT_ID`
3. Turn **Skip nonce check** on. This app's Google sign-in does not send a nonce. Leave it off and Google sign-in is rejected.
4. The web client secret goes in the Supabase Google provider if the form asks. It does not go in the Flutter app.
5. Save.

### Redirect URLs

Authentication → URL Configuration. Add:

- `https://www.drevvy.com/api/consumer/auth/apple/callback`
- `https://<project-ref>.supabase.co/auth/v1/callback` (usually already there)

The shopper app does not use a Supabase redirect for iOS. Android Apple uses the drevvy.com callback, which then opens `signinwithapple://callback` in the app.

## Backend env (you paste this)

On the Drevvy backend project (Vercel), set:

```bash
GOOGLE_OAUTH_CLIENT_IDS=WEB_CLIENT_ID,IOS_CLIENT_ID,ANDROID_CLIENT_ID
```

Web client ID first. Same IDs as the Supabase Google provider. When this is empty, `POST /api/consumer/auth/google` returns 503 and the app stays in demo mode.

Apple has no backend env var. Supabase checks the Apple token.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must already be set. The auth routes refuse to start without them.

Confirm `supabase/migrations/20261029170000_starter_free_keys.sql` is already applied. This setup does not apply it. If Apple sign-in returns 500 after the token is accepted, `ensure_consumer_profile` is missing on that database.

## How to tell it worked

1. Install a build that includes `DREVVY_APPLE_SERVICE_ID` if you are on Android.
2. Finish Matters v5 with **Find my next car**. Shop opens. No paywall.
3. Open the account sheet. Continue with Apple or Google.
4. The sheet says **Signed in**. The key count comes from `GET /api/consumer/credits`. A new shopper has 3 keys. Signing in again does not add 3 more.
5. On an in-network car, ask the dealer. That calls `POST /api/consumer/deals` with the shopper token. The dealer desk can see the thread. A signed-out phone keeps the local practice chat and does not call that route.

## What this setup does not do

It does not upload a TestFlight build, create distribution certificates, or create App Store or Play key products. Purchases stay on the existing RevenueCat path.

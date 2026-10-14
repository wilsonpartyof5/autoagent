import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Runtime configuration for auth and push.
///
/// Real keys are supplied with `--dart-define` (or by editing the defaults
/// below). Empty values keep the app building and running in demo mode.
class DrevvyConfig {
  const DrevvyConfig._();

  /// TODO: Point this at the deployed Drevvy backend origin, with no trailing slash.
  static const apiBaseUrl = String.fromEnvironment(
    'DREVVY_API_BASE_URL',
    defaultValue: 'https://www.drevvy.com',
  );

  static const applePath = '/api/consumer/auth/apple';

  /// Same public-session contract as [applePath]: `{ identityToken, nonce? }`
  /// in, `{ accessToken, refreshToken, expiresAt, consumerUserId }` out.
  /// The backend slice that is checked in today exposes Apple, refresh, and
  /// sign-out. A missing Google route fails the sign-in and leaves demo mode on.
  static const googlePath = '/api/consumer/auth/google';

  static const refreshPath = '/api/consumer/auth/refresh';
  static const signOutPath = '/api/consumer/auth/signout';
  static const profilePath = '/api/consumer/profile';

  /// Consumer device registry. A 404 or 405 is treated as "not shipped yet".
  static const devicesPath = '/api/consumer/devices';

  /// TODO: Web/server OAuth client ID. Required for Google ID tokens on Android.
  static const googleServerClientId = String.fromEnvironment(
    'DREVVY_GOOGLE_SERVER_CLIENT_ID',
    defaultValue: '',
  );

  /// TODO: iOS OAuth client ID. Also set GIDClientID in ios/Runner/Info.plist.
  static const googleIosClientId = String.fromEnvironment(
    'DREVVY_GOOGLE_IOS_CLIENT_ID',
    defaultValue: '',
  );

  /// TODO: Apple Services ID for Sign in with Apple on Android and web.
  static const appleServiceId = String.fromEnvironment(
    'DREVVY_APPLE_SERVICE_ID',
    defaultValue: '',
  );

  /// TODO: HTTPS redirect registered on that Services ID. Not localhost.
  static const appleRedirectUri = String.fromEnvironment(
    'DREVVY_APPLE_REDIRECT_URI',
    defaultValue: '',
  );

  /// TODO: Firebase project values from GoogleService-Info.plist / google-services.json.
  /// See ios/Runner/GoogleService-Info.plist.example and android/app/google-services.json.example.
  static const firebaseProjectId = String.fromEnvironment('DREVVY_FIREBASE_PROJECT_ID', defaultValue: '');
  static const firebaseApiKey = String.fromEnvironment('DREVVY_FIREBASE_API_KEY', defaultValue: '');
  static const firebaseAppId = String.fromEnvironment('DREVVY_FIREBASE_APP_ID', defaultValue: '');
  static const firebaseMessagingSenderId = String.fromEnvironment(
    'DREVVY_FIREBASE_MESSAGING_SENDER_ID',
    defaultValue: '',
  );

  static bool get googleConfigured {
    if (kIsWeb || defaultTargetPlatform == TargetPlatform.android) {
      return googleServerClientId.isNotEmpty;
    }
    return googleIosClientId.isNotEmpty || googleServerClientId.isNotEmpty;
  }

  static bool get appleWebConfigured =>
      appleServiceId.isNotEmpty && appleRedirectUri.isNotEmpty;

  static FirebaseOptions? get firebaseOptions {
    if (firebaseProjectId.isEmpty ||
        firebaseApiKey.isEmpty ||
        firebaseAppId.isEmpty ||
        firebaseMessagingSenderId.isEmpty) {
      return null;
    }
    return const FirebaseOptions(
      apiKey: firebaseApiKey,
      appId: firebaseAppId,
      messagingSenderId: firebaseMessagingSenderId,
      projectId: firebaseProjectId,
    );
  }
}

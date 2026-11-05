import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

import 'drevvy_api_config.dart';

/// Runtime configuration for auth and push.
///
/// Real keys are supplied with `--dart-define` (or by editing the defaults
/// below). Empty values keep the app building and running in demo mode.
class DrevvyConfig {
  const DrevvyConfig._();

  /// Same origin as credits, key spend, rooftop match, and deal chips.
  ///
  /// Reads [DrevvyApiConfig]. Empty until
  /// `--dart-define=DREVVY_API_BASE_URL=https://api.drevvy.com`.
  /// Demo mode does not fall back to `https://www.drevvy.com`.
  static String get apiBaseUrl => DrevvyApiConfig.fromEnvironment().origin;

  static const applePath = '/api/consumer/auth/apple';

  /// Same public-session contract as [applePath]: `{ identityToken, nonce? }`
  /// in, `{ accessToken, refreshToken, expiresAt, consumerUserId }` out.
  /// Both routes call `ensure_consumer_profile`, which grants the starter keys.
  static const googlePath = '/api/consumer/auth/google';

  static const refreshPath = '/api/consumer/auth/refresh';
  static const signOutPath = '/api/consumer/auth/signout';
  static const profilePath = '/api/consumer/profile';

  /// Consumer device registry. A 404 or 405 is treated as "not shipped yet".
  static const devicesPath = '/api/consumer/devices';

  /// Web OAuth client ID. Required for Google ID tokens on Android.
  /// Override with `--dart-define=DREVVY_GOOGLE_SERVER_CLIENT_ID=...`.
  static const googleServerClientId = String.fromEnvironment(
    'DREVVY_GOOGLE_SERVER_CLIENT_ID',
    defaultValue: '802176042106-majjp9ij3jof60rpd5rdlr0rsvl5d4rj.apps.googleusercontent.com',
  );

  /// iOS OAuth client ID. Also set as GIDClientID in ios/Runner/Info.plist.
  /// Override with `--dart-define=DREVVY_GOOGLE_IOS_CLIENT_ID=...`.
  static const googleIosClientId = String.fromEnvironment(
    'DREVVY_GOOGLE_IOS_CLIENT_ID',
    defaultValue: '802176042106-4crn4kfl0mf52k8rrsdb1k1ti5gpuhoa.apps.googleusercontent.com',
  );

  /// Apple Services ID for Sign in with Apple on Android.
  /// iOS uses the bundle id and does not need this.
  /// Override with `--dart-define=DREVVY_APPLE_SERVICE_ID=...`.
  /// Leave empty until the Services ID exists. Do not invent one.
  static const appleServiceId = String.fromEnvironment(
    'DREVVY_APPLE_SERVICE_ID',
    defaultValue: '',
  );

  /// HTTPS return URL registered on that Services ID.
  /// The app route answers this URL and sends Android back into the app.
  /// Override with `--dart-define=DREVVY_APPLE_REDIRECT_URI=...` for another host.
  static const appleRedirectUri = String.fromEnvironment(
    'DREVVY_APPLE_REDIRECT_URI',
    defaultValue: 'https://www.drevvy.com/api/consumer/auth/apple/callback',
  );

  /// TODO: Firebase project values from GoogleService-Info.plist / google-services.json.
  /// See ios/Runner/GoogleService-Info.plist.example and android/app/google-services.json.example.
  static const firebaseProjectId = String.fromEnvironment(
    'DREVVY_FIREBASE_PROJECT_ID',
    defaultValue: '',
  );
  static const firebaseApiKey = String.fromEnvironment(
    'DREVVY_FIREBASE_API_KEY',
    defaultValue: '',
  );
  static const firebaseAppId = String.fromEnvironment(
    'DREVVY_FIREBASE_APP_ID',
    defaultValue: '',
  );
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

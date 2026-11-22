import 'package:flutter/foundation.dart';

import '../../core/config/drevvy_api_config.dart';

/// Which compile mode is choosing the RevenueCat key.
///
/// Debug keeps the Test Store (`test_`). Release and profile, including
/// TestFlight, use the iOS public SDK key (`appl_`).
enum PurchaseBuildMode { debug, profile, release }

/// Selects the demo purchase service until a key this build accepts is set.
///
/// Pass keys at build time. Never commit a key value, and never put a
/// RevenueCat secret key in the app.
///
/// Debug:
/// `--dart-define=REVENUECAT_IOS_API_KEY=test_...`
/// `--dart-define=REVENUECAT_ANDROID_API_KEY=test_...`
///
/// Release and profile (TestFlight):
/// `--dart-define=REVENUECAT_IOS_API_KEY=appl_...`
/// `--dart-define=DREVVY_DATA_MODE=live`
/// `--dart-define=DREVVY_API_BASE_URL=https://api.drevvy.com`
///
/// Optional: `--dart-define=SUPERWALL_IOS_API_KEY=...`
/// `--dart-define=SUPERWALL_ANDROID_API_KEY=...`
///
/// [apiBaseUrl] is the shared reader in [DrevvyApiConfig], not a second default.
class PurchaseConfig {
  const PurchaseConfig({
    this.revenueCatIosApiKey = '',
    this.revenueCatAndroidApiKey = '',
    this.superwallIosApiKey = '',
    this.superwallAndroidApiKey = '',
    this.apiBaseUrl = '',
    this.mode = DrevvyDataMode.demo,
    this.buildMode,
  });

  factory PurchaseConfig.fromEnvironment() {
    final api = DrevvyApiConfig.fromEnvironment();
    return PurchaseConfig(
      revenueCatIosApiKey: const String.fromEnvironment(
        'REVENUECAT_IOS_API_KEY',
      ),
      revenueCatAndroidApiKey: const String.fromEnvironment(
        'REVENUECAT_ANDROID_API_KEY',
      ),
      superwallIosApiKey: const String.fromEnvironment('SUPERWALL_IOS_API_KEY'),
      superwallAndroidApiKey: const String.fromEnvironment(
        'SUPERWALL_ANDROID_API_KEY',
      ),
      apiBaseUrl: api.origin,
      mode: api.mode,
    );
  }

  final String revenueCatIosApiKey;
  final String revenueCatAndroidApiKey;
  final String superwallIosApiKey;
  final String superwallAndroidApiKey;

  /// Shopper API origin. Empty in demo mode keeps the local credit balance.
  /// Empty in live mode is not configured and must not look like a success.
  final String apiBaseUrl;

  /// `demo` keeps labeled local data. `live` reports endpoint failures.
  final DrevvyDataMode mode;

  /// Override for tests. Null follows the Flutter compile mode.
  final PurchaseBuildMode? buildMode;

  bool get isLive => mode == DrevvyDataMode.live;

  PurchaseBuildMode get resolvedBuildMode =>
      buildMode ?? _compiledPurchaseBuildMode();

  /// A public SDK key is present for this platform. `appl_` and `goog_` keys
  /// are used for sandbox testers and for production, so this is not proof
  /// that a purchase is a sandbox transaction.
  bool get usesRevenueCat =>
      _present(revenueCatApiKeyFor(defaultTargetPlatform));

  bool get usesSuperwall => _present(superwallApiKeyFor(defaultTargetPlatform));

  /// RevenueCat Test Store keys start with `test_`. The SDK does not call
  /// Apple or Google for those keys.
  bool get hasTestStoreKey {
    final key = revenueCatApiKeyFor(defaultTargetPlatform);
    return key != null && key.startsWith('test_');
  }

  /// Live Test Store purchases. Debug only, and only with an API origin so a
  /// completed purchase can be confirmed by `POST /api/consumer/credits`.
  /// Demo mode stays on the labeled local service even if a Test Store key
  /// is compiled in.
  bool get sandboxPurchasesEnabled =>
      resolvedBuildMode == PurchaseBuildMode.debug &&
      isLive &&
      apiBaseUrl.trim().isNotEmpty &&
      hasTestStoreKey;

  /// Live store purchases for the key this build accepts.
  ///
  /// Debug accepts `test_`. Release and profile accept an iOS `appl_` key.
  /// A missing key, a blank key, or any other prefix stays off. Demo mode
  /// stays on the labeled local service.
  bool get storePurchasesEnabled {
    if (!isLive || apiBaseUrl.trim().isEmpty) return false;
    final platform = defaultTargetPlatform;
    return _revenueCatKeyAccepted(
      revenueCatApiKeyFor(platform),
      platform: platform,
      buildMode: resolvedBuildMode,
    );
  }

  String? revenueCatApiKeyFor(TargetPlatform platform) {
    return switch (platform) {
      TargetPlatform.iOS => _blankToNull(revenueCatIosApiKey),
      TargetPlatform.android => _blankToNull(revenueCatAndroidApiKey),
      _ => null,
    };
  }

  String? superwallApiKeyFor(TargetPlatform platform) {
    return switch (platform) {
      TargetPlatform.iOS => _blankToNull(superwallIosApiKey),
      TargetPlatform.android => _blankToNull(superwallAndroidApiKey),
      _ => null,
    };
  }

  static bool _present(String? value) => value != null && value.isNotEmpty;

  static String? _blankToNull(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}

PurchaseBuildMode _compiledPurchaseBuildMode() {
  if (kReleaseMode) return PurchaseBuildMode.release;
  if (kProfileMode) return PurchaseBuildMode.profile;
  return PurchaseBuildMode.debug;
}

/// Debug accepts a Test Store key on the current platform. Release and
/// profile accept only the iOS public SDK key. Anything else is rejected.
bool _revenueCatKeyAccepted(
  String? apiKey, {
  required TargetPlatform platform,
  required PurchaseBuildMode buildMode,
}) {
  final key = apiKey?.trim();
  if (key == null || key.isEmpty) return false;
  return switch (buildMode) {
    PurchaseBuildMode.debug => key.startsWith('test_'),
    PurchaseBuildMode.profile || PurchaseBuildMode.release =>
      platform == TargetPlatform.iOS && key.startsWith('appl_'),
  };
}

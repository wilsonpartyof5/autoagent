import 'package:flutter/foundation.dart';

/// Selects the demo purchase service until store SDK keys exist.
///
/// Pass keys at build time:
/// `--dart-define=REVENUECAT_IOS_API_KEY=appl_...`
/// `--dart-define=REVENUECAT_ANDROID_API_KEY=goog_...`
/// `--dart-define=SUPERWALL_IOS_API_KEY=...`
/// `--dart-define=SUPERWALL_ANDROID_API_KEY=...`
/// `--dart-define=DREVVY_API_BASE_URL=https://api.drevvy.com`
///
/// Public SDK keys only. Never put a RevenueCat secret key in the app.
class PurchaseConfig {
  const PurchaseConfig({
    this.revenueCatIosApiKey = '',
    this.revenueCatAndroidApiKey = '',
    this.superwallIosApiKey = '',
    this.superwallAndroidApiKey = '',
    this.apiBaseUrl = '',
  });

  factory PurchaseConfig.fromEnvironment() {
    return const PurchaseConfig(
      revenueCatIosApiKey: String.fromEnvironment('REVENUECAT_IOS_API_KEY'),
      revenueCatAndroidApiKey: String.fromEnvironment('REVENUECAT_ANDROID_API_KEY'),
      superwallIosApiKey: String.fromEnvironment('SUPERWALL_IOS_API_KEY'),
      superwallAndroidApiKey: String.fromEnvironment('SUPERWALL_ANDROID_API_KEY'),
      apiBaseUrl: String.fromEnvironment('DREVVY_API_BASE_URL'),
    );
  }

  final String revenueCatIosApiKey;
  final String revenueCatAndroidApiKey;
  final String superwallIosApiKey;
  final String superwallAndroidApiKey;

  /// Shopper API origin. Empty keeps the local demo credit balance.
  final String apiBaseUrl;

  bool get usesRevenueCat => _present(revenueCatApiKeyFor(defaultTargetPlatform));

  bool get usesSuperwall => _present(superwallApiKeyFor(defaultTargetPlatform));

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

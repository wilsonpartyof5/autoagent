import 'package:flutter/foundation.dart';

import '../../core/config/drevvy_api_config.dart';

/// Selects the demo purchase service until store SDK keys exist.
///
/// Pass keys at build time:
/// `--dart-define=REVENUECAT_IOS_API_KEY=appl_...`
/// `--dart-define=REVENUECAT_ANDROID_API_KEY=goog_...`
/// `--dart-define=SUPERWALL_IOS_API_KEY=...`
/// `--dart-define=SUPERWALL_ANDROID_API_KEY=...`
/// `--dart-define=DREVVY_DATA_MODE=live`
/// `--dart-define=DREVVY_API_BASE_URL=https://api.drevvy.com`
///
/// Public SDK keys only. Never put a RevenueCat secret key in the app.
/// [apiBaseUrl] is the shared reader in [DrevvyApiConfig], not a second default.
class PurchaseConfig {
  const PurchaseConfig({
    this.revenueCatIosApiKey = '',
    this.revenueCatAndroidApiKey = '',
    this.superwallIosApiKey = '',
    this.superwallAndroidApiKey = '',
    this.apiBaseUrl = '',
    this.mode = DrevvyDataMode.demo,
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

  bool get isLive => mode == DrevvyDataMode.live;

  bool get usesRevenueCat =>
      _present(revenueCatApiKeyFor(defaultTargetPlatform));

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

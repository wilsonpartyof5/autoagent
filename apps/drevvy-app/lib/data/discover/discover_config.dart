import '../../core/config/drevvy_api_config.dart';

/// Live Discover follows the shared shopper mode, not the URL by itself.
///
/// [fromEnvironment] reads [DrevvyApiConfig]. Shop and vehicle detail stay on
/// the labeled demo catalog unless `DREVVY_DATA_MODE=live`. Live with an empty
/// `DREVVY_API_BASE_URL` is not configured: it does not search demo inventory.
///
/// A config built in tests can still point at a host. The default [mode] for
/// that explicit config is live so a test client can call the public API.
/// The app path uses [fromEnvironment], which stays demo until the define says
/// live.
///
/// The contract host is `https://api.drevvy.com`. This client never sends
/// `INVENTORY_SEARCH_API_KEY`, `x-api-key`, or a Bearer inventory key.
class DiscoverConfig {
  const DiscoverConfig({
    required this.apiBaseUrl,
    this.mode = DrevvyDataMode.live,
  });

  factory DiscoverConfig.fromEnvironment() {
    final api = DrevvyApiConfig.fromEnvironment();
    return DiscoverConfig(apiBaseUrl: api.origin, mode: api.mode);
  }

  final String apiBaseUrl;
  final DrevvyDataMode mode;

  /// Trimmed origin with no trailing slash. Empty when the define is unset.
  String get origin {
    final trimmed = apiBaseUrl.trim();
    if (trimmed.endsWith('/')) {
      return trimmed.substring(0, trimmed.length - 1);
    }
    return trimmed;
  }

  /// Live inventory requires both an explicit live build and a shared origin.
  bool get isLive => mode == DrevvyDataMode.live && origin.isNotEmpty;

  /// Live build with no origin. Callers must show an error, not demo cars.
  bool get needsConfiguration => mode == DrevvyDataMode.live && origin.isEmpty;
}

/// Live Discover is on only when the build sets `DREVVY_API_BASE_URL`.
///
/// The raw dart-define has no default. [DrevvyConfig.apiBaseUrl] still defaults
/// to `https://www.drevvy.com` for auth, and that default must not turn Shop
/// into a live search that 404s. An empty value keeps Shop and vehicle detail
/// on the labeled demo catalog.
///
/// The contract host is `https://api.drevvy.com`. This client never sends
/// `INVENTORY_SEARCH_API_KEY`, `x-api-key`, or a Bearer inventory key.
class DiscoverConfig {
  const DiscoverConfig({required this.apiBaseUrl});

  factory DiscoverConfig.fromEnvironment() {
    return const DiscoverConfig(
      apiBaseUrl: String.fromEnvironment('DREVVY_API_BASE_URL'),
    );
  }

  final String apiBaseUrl;

  bool get isLive => apiBaseUrl.trim().isNotEmpty;

  String get origin {
    final trimmed = apiBaseUrl.trim();
    if (trimmed.endsWith('/')) {
      return trimmed.substring(0, trimmed.length - 1);
    }
    return trimmed;
  }
}

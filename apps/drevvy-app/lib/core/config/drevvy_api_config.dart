/// Shared shopper API origin and the explicit demo/live switch.
///
/// Both auth and purchases read this. There is no `www.drevvy.com` default.
///
/// ```bash
/// flutter run \
///   --dart-define=DREVVY_DATA_MODE=live \
///   --dart-define=DREVVY_API_BASE_URL=https://api.drevvy.com
/// ```
///
/// `DREVVY_DATA_MODE` is `demo` (default) or `live`. Any other value stays demo.
/// Demo keeps the demo repository and labeled samples. Live does not turn a
/// missing URL or a failed credits/key-spend/rooftop call into a local success.
enum DrevvyDataMode { demo, live }

class DrevvyApiConfig {
  const DrevvyApiConfig({required this.apiBaseUrl, required this.mode});

  factory DrevvyApiConfig.fromEnvironment() {
    const rawUrl = String.fromEnvironment('DREVVY_API_BASE_URL');
    const rawMode = String.fromEnvironment(
      'DREVVY_DATA_MODE',
      defaultValue: 'demo',
    );
    return DrevvyApiConfig(apiBaseUrl: rawUrl, mode: modeFromDefine(rawMode));
  }

  final String apiBaseUrl;
  final DrevvyDataMode mode;

  bool get isLive => mode == DrevvyDataMode.live;

  bool get isDemo => mode == DrevvyDataMode.demo;

  /// Trimmed origin with no trailing slash. Empty when the define is unset.
  String get origin {
    final trimmed = apiBaseUrl.trim();
    if (trimmed.endsWith('/')) {
      return trimmed.substring(0, trimmed.length - 1);
    }
    return trimmed;
  }

  bool get hasBaseUrl => origin.isNotEmpty;

  static DrevvyDataMode modeFromDefine(String raw) {
    return raw.trim().toLowerCase() == 'live'
        ? DrevvyDataMode.live
        : DrevvyDataMode.demo;
  }
}

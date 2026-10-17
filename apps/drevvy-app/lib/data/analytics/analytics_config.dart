/// PostHog project settings supplied at build time.
///
/// ```bash
/// flutter run \
///   --dart-define=POSTHOG_API_KEY=phc_xxx \
///   --dart-define=POSTHOG_HOST=https://us.i.posthog.com
/// ```
///
/// An empty [apiKey] leaves analytics disabled. Demo mode does not need a key.
class AnalyticsConfig {
  const AnalyticsConfig({required this.apiKey, required this.host});

  final String apiKey;
  final String host;

  static const defaultHost = 'https://us.i.posthog.com';

  static const fromEnvironment = AnalyticsConfig(
    apiKey: String.fromEnvironment('POSTHOG_API_KEY'),
    host: String.fromEnvironment('POSTHOG_HOST', defaultValue: defaultHost),
  );

  bool get configured => apiKey.trim().isNotEmpty;

  String get normalizedHost {
    final value = host.trim();
    if (value.isEmpty) return defaultHost;
    return value.endsWith('/') ? value.substring(0, value.length - 1) : value;
  }
}

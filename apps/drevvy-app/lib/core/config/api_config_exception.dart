const apiNotConfiguredMessage = 'Drevvy API base URL is not configured.';

const creditsUnavailableMessage = 'Key balance is unavailable.';

/// Live mode refused to invent a local success.
class ApiConfigException implements Exception {
  const ApiConfigException(this.message);

  static const notConfigured = ApiConfigException(apiNotConfiguredMessage);

  static const creditsUnavailable = ApiConfigException(
    creditsUnavailableMessage,
  );

  final String message;

  @override
  String toString() => message;
}

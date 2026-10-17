/// Sink used by [ProductAnalytics]. Tests pass a fake. Production uses PostHog.
abstract class AnalyticsClient {
  Future<void> setup({
    required String apiKey,
    required String host,
    required bool optOut,
  });

  Future<void> capture({
    required String eventName,
    Map<String, Object>? properties,
    Map<String, Object>? userPropertiesSetOnce,
  });

  Future<void> identify({
    required String userId,
    Map<String, Object>? userPropertiesSetOnce,
  });

  Future<void> setPersonProperties({
    Map<String, Object>? userPropertiesToSetOnce,
  });

  Future<void> register(String key, Object value);

  Future<void> optOut();

  Future<void> optIn();

  Future<void> reset();
}

class NoopAnalyticsClient implements AnalyticsClient {
  const NoopAnalyticsClient();

  @override
  Future<void> setup({
    required String apiKey,
    required String host,
    required bool optOut,
  }) async {}

  @override
  Future<void> capture({
    required String eventName,
    Map<String, Object>? properties,
    Map<String, Object>? userPropertiesSetOnce,
  }) async {}

  @override
  Future<void> identify({
    required String userId,
    Map<String, Object>? userPropertiesSetOnce,
  }) async {}

  @override
  Future<void> setPersonProperties({
    Map<String, Object>? userPropertiesToSetOnce,
  }) async {}

  @override
  Future<void> register(String key, Object value) async {}

  @override
  Future<void> optOut() async {}

  @override
  Future<void> optIn() async {}

  @override
  Future<void> reset() async {}
}

import 'package:flutter/foundation.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import 'analytics_client.dart';
import 'analytics_sanitizer.dart';

/// PostHog SDK adapter. Failures are swallowed so shop and demo mode keep running.
class PosthogAnalyticsClient implements AnalyticsClient {
  PosthogAnalyticsClient({Posthog? posthog}) : _posthog = posthog ?? Posthog();

  final Posthog _posthog;

  @override
  Future<void> setup({
    required String apiKey,
    required String host,
    required bool optOut,
  }) async {
    final config = PostHogConfig(apiKey);
    config.host = host;
    config.debug = false;
    config.optOut = optOut;
    config.captureApplicationLifecycleEvents = false;
    config.sessionReplay = false;
    config.surveys = false;
    config.personProfiles = PostHogPersonProfiles.identifiedOnly;
    config.beforeSend = [_scrub];
    await _guard(() => _posthog.setup(config));
  }

  @override
  Future<void> capture({
    required String eventName,
    Map<String, Object>? properties,
    Map<String, Object>? userPropertiesSetOnce,
  }) {
    return _guard(
      () => _posthog.capture(
        eventName: eventName,
        properties: properties,
        userPropertiesSetOnce: userPropertiesSetOnce,
      ),
    );
  }

  @override
  Future<void> identify({
    required String userId,
    Map<String, Object>? userPropertiesSetOnce,
  }) {
    return _guard(
      () => _posthog.identify(
        userId: userId,
        userPropertiesSetOnce: userPropertiesSetOnce,
      ),
    );
  }

  @override
  Future<void> setPersonProperties({
    Map<String, Object>? userPropertiesToSetOnce,
  }) {
    return _guard(
      () => _posthog.setPersonProperties(
        userPropertiesToSetOnce: userPropertiesToSetOnce,
      ),
    );
  }

  @override
  Future<void> register(String key, Object value) {
    return _guard(() => _posthog.register(key, value));
  }

  @override
  Future<void> optOut() => _guard(_posthog.optOut);

  @override
  Future<void> optIn() => _guard(_posthog.optIn);

  @override
  Future<void> reset() => _guard(_posthog.reset);

  Future<void> _guard(Future<void> Function() action) async {
    try {
      await action();
    } catch (error, stack) {
      debugPrint('PostHog call failed: $error\n$stack');
    }
  }
}

/// Last-line scrub. Drops autocapture and any personal fields that slipped through.
PostHogEvent? _scrub(PostHogEvent event) {
  if (event.event.startsWith(r'$') || event.event.startsWith('Application ')) {
    return null;
  }
  event.properties = _clean(event.properties);
  event.userProperties = _clean(event.userProperties);
  event.userPropertiesSetOnce = _clean(event.userPropertiesSetOnce);
  return event;
}

Map<String, Object>? _clean(Map<String, Object>? raw) {
  if (raw == null) return null;
  final safe = sanitizeProperties(raw);
  return safe.isEmpty ? null : safe;
}

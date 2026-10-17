import 'dart:async';

import 'package:flutter/widgets.dart';

import '../notifications/local_flags.dart';
import 'analytics_client.dart';
import 'analytics_config.dart';
import 'analytics_events.dart';
import 'analytics_sanitizer.dart';
import 'analytics_screens.dart';
import 'creator_attribution.dart';
import 'posthog_analytics_client.dart';

export 'analytics_events.dart';

/// Product analytics for the shopper app.
///
/// With no [AnalyticsConfig.apiKey] every call is a no-op and demo mode is unchanged.
/// Events always include the stored creator attribution. The distinct id is the
/// Supabase user id, and only after sign-in.
class ProductAnalytics {
  ProductAnalytics({
    required this.config,
    required this._client,
    required this._flags,
    DateTime Function()? now,
    this._attachLifecycle = false,
  }) : _now = now ?? DateTime.now;

  static ProductAnalytics instance = ProductAnalytics.disabled();

  static ProductAnalytics disabled() {
    return ProductAnalytics(
      config: const AnalyticsConfig(apiKey: '', host: AnalyticsConfig.defaultHost),
      client: const NoopAnalyticsClient(),
      flags: MemoryFlags(),
    );
  }

  final AnalyticsConfig config;
  final AnalyticsClient _client;
  final LocalFlags _flags;
  final DateTime Function() _now;
  final bool _attachLifecycle;

  bool optedIn = true;
  CreatorAttribution attribution = CreatorAttribution.empty;

  bool get configured => config.configured;
  bool get captureAllowed => configured && optedIn;

  Future<void> get flushed => _tail;

  Future<void> _tail = Future<void>.value();
  String? _lastScreenSignature;
  DateTime? _lastScreenAt;
  bool _sessionOpen = false;
  DateTime? _sessionStartedAt;
  String? _userId;
  _AnalyticsLifecycle? _lifecycle;
  bool _bootstrapped = false;

  static const _optInKey = 'drevvy.analytics.opt_in';
  static const _installKey = 'drevvy.analytics.app_install_sent';
  static const _onboardingKey = 'drevvy.analytics.onboarding_completed_sent';
  static const _attributionKey = 'drevvy.analytics.attribution';

  static Future<ProductAnalytics> start({
    AnalyticsConfig config = AnalyticsConfig.fromEnvironment,
    AnalyticsClient? client,
    LocalFlags? flags,
    String? launchRoute,
    String? installReferrer,
    bool attachLifecycle = true,
    DateTime Function()? now,
  }) async {
    final analytics = ProductAnalytics(
      config: config,
      client: client ?? (config.configured ? PosthogAnalyticsClient() : const NoopAnalyticsClient()),
      flags: flags ?? SharedPreferencesFlags(),
      now: now,
      attachLifecycle: attachLifecycle && config.configured,
    );
    instance = analytics;
    await analytics.bootstrap(launchRoute: launchRoute, installReferrer: installReferrer);
    return analytics;
  }

  Future<void> bootstrap({String? launchRoute, String? installReferrer}) async {
    if (_bootstrapped) return;
    _bootstrapped = true;
    optedIn = await _readOptIn();
    attribution = await _readAttribution();
    _merge(CreatorAttribution.parse(launchRoute));
    _merge(CreatorAttribution.parse(installReferrer));
    await _persistAttribution();
    if (!configured) return;
    await _enqueue(
      () => _client.setup(
        apiKey: config.apiKey.trim(),
        host: config.normalizedHost,
        optOut: !optedIn,
      ),
    );
    await _publishAttribution();
    if (!optedIn) {
      await _enqueue(_client.optOut);
    }
    await captureFirstLaunch();
    beginSession(resumed: false);
    if (_attachLifecycle) {
      _lifecycle = _AnalyticsLifecycle(this);
      WidgetsBinding.instance.addObserver(_lifecycle!);
    }
  }

  void dispose() {
    final lifecycle = _lifecycle;
    if (lifecycle != null) {
      WidgetsBinding.instance.removeObserver(lifecycle);
      _lifecycle = null;
    }
  }

  void captureLocation(String location) {
    final previous = attribution;
    _merge(CreatorAttribution.parse(location));
    if (identical(previous, attribution)) return;
    _enqueue(_persistAttribution);
    _enqueue(() => _publishAttribution());
  }

  void recordLocation(String location) {
    captureLocation(location);
    final uri = _locationUri(location);
    if (uri == null) return;
    final route = resolveAnalyticsRoute(uri);
    if (route == null) return;
    screen(route.screen, route.properties);
    if (route.onboardingStep != null) {
      track(AnalyticsEvents.onboardingStepViewed, {
        'step': route.onboardingStep,
        'index': route.onboardingIndex,
      });
    }
    if (route.paywallPlacement != null) {
      track(AnalyticsEvents.paywallViewed, {
        'placement': route.paywallPlacement,
        'provider': 'local',
      });
      track(AnalyticsEvents.packViewed, {
        'placement': route.paywallPlacement,
        'pack_count': 3,
      });
    }
    if (route.screen == 'error') {
      track(AnalyticsEvents.errorShown, {
        'surface': 'navigation',
        'code': route.errorCode ?? 'unknown',
      });
    }
  }

  void screen(String name, [Map<String, Object?>? properties]) {
    final safe = sanitizeProperties({'screen': name, ...?properties});
    final signature = _signature(safe);
    final now = _now();
    final lastAt = _lastScreenAt;
    if (_lastScreenSignature == signature &&
        lastAt != null &&
        now.difference(lastAt) < const Duration(milliseconds: 400)) {
      return;
    }
    _lastScreenSignature = signature;
    _lastScreenAt = now;
    track(AnalyticsEvents.screenViewed, Map<String, Object?>.from(safe));
  }

  void track(String event, [Map<String, Object?>? properties]) {
    if (!captureAllowed) return;
    final safe = sanitizeProperties(properties);
    safe.addAll(attribution.eventProperties);
    _enqueue(
      () => _client.capture(
        eventName: event,
        properties: safe.isEmpty ? null : safe,
      ),
    );
  }

  Future<void> captureFirstLaunch() async {
    if (!captureAllowed) return;
    if (await _flags.getBool(_installKey)) return;
    await _flags.setBool(_installKey, true);
    track(AnalyticsEvents.appInstall);
    track(AnalyticsEvents.firstOpen);
  }

  Future<void> onboardingCompleted() async {
    if (!captureAllowed) return;
    if (await _flags.getBool(_onboardingKey)) return;
    await _flags.setBool(_onboardingKey, true);
    track(AnalyticsEvents.onboardingCompleted);
  }

  void identify(String userId) {
    final trimmed = userId.trim();
    if (!isAnalyticsUserId(trimmed)) return;
    _userId = trimmed;
    if (!captureAllowed) return;
    final props = attribution.eventProperties;
    _enqueue(
      () => _client.identify(
        userId: trimmed,
        userPropertiesSetOnce: props.isEmpty ? null : props,
      ),
    );
  }

  void signOut() {
    track(AnalyticsEvents.signOut);
    _userId = null;
    if (!configured) return;
    _enqueue(() async {
      await _client.reset();
      await _publishAttribution();
      if (!optedIn) await _client.optOut();
    });
  }

  Future<void> setOptedIn(bool value) async {
    final wasAllowed = captureAllowed;
    if (wasAllowed && !value) {
      track(AnalyticsEvents.analyticsToggled, {'enabled': false});
    }
    optedIn = value;
    await _flags.setString(_optInKey, value ? 'true' : 'false');
    if (!configured) return;
    if (value) {
      await _enqueue(_client.optIn);
      await _publishAttribution();
      track(AnalyticsEvents.analyticsToggled, {'enabled': true});
      await captureFirstLaunch();
      final userId = _userId;
      if (userId != null) identify(userId);
    } else {
      await _enqueue(_client.optOut);
    }
  }

  void beginSession({required bool resumed}) {
    if (_sessionOpen) return;
    _sessionOpen = true;
    _sessionStartedAt = _now();
    track(AnalyticsEvents.sessionStarted, {'resumed': resumed});
  }

  void endSession() {
    if (!_sessionOpen) return;
    _sessionOpen = false;
    final started = _sessionStartedAt ?? _now();
    final seconds = _now().difference(started).inSeconds;
    track(AnalyticsEvents.sessionEnded, {'duration_seconds': seconds < 0 ? 0 : seconds});
  }

  void handleLifecycle(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        beginSession(resumed: true);
      case AppLifecycleState.paused:
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        endSession();
      case AppLifecycleState.inactive:
        break;
    }
  }

  void _merge(CreatorAttribution? incoming) {
    if (incoming == null || incoming.isEmpty) return;
    final next = attribution.mergeFirstTouch(incoming);
    if (next.properties.length == attribution.properties.length &&
        next.properties.entries.every((entry) => attribution.properties[entry.key] == entry.value)) {
      return;
    }
    attribution = next;
  }

  Future<void> _publishAttribution() async {
    if (!captureAllowed) return;
    final props = attribution.eventProperties;
    for (final entry in props.entries) {
      await _client.register(entry.key, entry.value);
    }
    if (props.isNotEmpty) {
      await _client.setPersonProperties(userPropertiesToSetOnce: props);
    }
  }

  Future<bool> _readOptIn() async {
    final raw = await _flags.getString(_optInKey);
    return raw != 'false';
  }

  Future<CreatorAttribution> _readAttribution() async {
    return CreatorAttribution.fromJson(await _flags.getString(_attributionKey)) ??
        CreatorAttribution.empty;
  }

  Future<void> _persistAttribution() async {
    if (attribution.isEmpty) return;
    await _flags.setString(_attributionKey, attribution.toJson());
  }

  Future<void> _enqueue(Future<void> Function() action) {
    _tail = _tail.then((_) => action()).catchError((Object _) {});
    return _tail;
  }

  Uri? _locationUri(String location) {
    final trimmed = location.trim();
    if (trimmed.isEmpty) return null;
    if (trimmed.startsWith('/')) return Uri.tryParse('https://drevvy.local$trimmed');
    return Uri.tryParse(trimmed);
  }

  String _signature(Map<String, Object> properties) {
    final keys = properties.keys.toList()..sort();
    return keys.map((key) => '$key=${properties[key]}').join('&');
  }
}

class _AnalyticsLifecycle with WidgetsBindingObserver {
  _AnalyticsLifecycle(this.analytics);

  final ProductAnalytics analytics;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    analytics.handleLifecycle(state);
  }
}

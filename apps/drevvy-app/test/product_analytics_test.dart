import 'dart:io';

import 'package:drevvy_app/data/analytics/analytics_client.dart';
import 'package:drevvy_app/data/analytics/analytics_config.dart';
import 'package:drevvy_app/data/analytics/analytics_sanitizer.dart';
import 'package:drevvy_app/data/analytics/creator_attribution.dart';
import 'package:drevvy_app/data/analytics/product_analytics.dart';
import 'package:drevvy_app/data/analytics/search_analytics.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/notifications/local_flags.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final disabled = ProductAnalytics.instance;

  tearDown(() {
    ProductAnalytics.instance.dispose();
    ProductAnalytics.instance = disabled;
  });

  test('sanitizer drops personal fields', () {
    final safe = sanitizeProperties({
      'email': 'ada@example.com',
      'phone': '555-0100',
      'dealer_name': 'Main Street Motors',
      'query': 'blue suv',
      'note': 'call me',
      'zip': '94107',
      'surface': 'ask',
      'channel': 'user@example.com',
      'status': 401,
    });

    expect(safe.containsKey('email'), isFalse);
    expect(safe.containsKey('phone'), isFalse);
    expect(safe.containsKey('dealer_name'), isFalse);
    expect(safe.containsKey('query'), isFalse);
    expect(safe.containsKey('note'), isFalse);
    expect(safe.containsKey('zip'), isFalse);
    expect(safe.containsKey('channel'), isFalse);
    expect(safe['surface'], 'ask');
    expect(safe['status'], 401);
  });

  test('attribution parses creator links and keeps the first creator', () {
    final parsed = CreatorAttribution.parse(
      '?c=creatorid&v=videoid&utm_source=tiktok&utm_campaign=spring',
    );
    expect(parsed?.properties['creator_id'], 'creatorid');
    expect(parsed?.properties['video_id'], 'videoid');
    expect(parsed?.properties['utm_source'], 'tiktok');
    expect(parsed?.properties['utm_campaign'], 'spring');

    final unsafe = CreatorAttribution.parse(
      'drevvy://open?c=ada@example.com&v=5551234567&utm_term=has%20spaces',
    );
    expect(unsafe, isNull);

    final first = CreatorAttribution.parse('/shop?c=first&v=one')!;
    final merged = first.mergeFirstTouch(
      CreatorAttribution.parse('/shop?c=second&v=two&utm_medium=social')!,
    );
    expect(merged.properties['creator_id'], 'first');
    expect(merged.properties['video_id'], 'one');
    expect(merged.properties['utm_medium'], 'social');
  });

  test('a missing key sends nothing', () async {
    final client = RecordingAnalyticsClient();
    final analytics = await ProductAnalytics.start(
      config: const AnalyticsConfig(apiKey: '', host: ''),
      client: client,
      flags: MemoryFlags(),
      attachLifecycle: false,
    );

    analytics.track(AnalyticsEvents.searchSubmitted, {'surface': 'ask'});
    analytics.identify('user_123');
    await analytics.flushed;

    expect(client.setups, 0);
    expect(client.events, isEmpty);
    expect(client.identifies, isEmpty);
  });

  test('opt-out captures the toggle, then drops later events', () async {
    final client = RecordingAnalyticsClient();
    final analytics = await _started(client);
    await analytics.flushed;
    client.events.clear();

    await analytics.setOptedIn(false);
    analytics.track(AnalyticsEvents.carViewed, {'listing_id': 'car_1'});
    await analytics.flushed;

    expect(client.events.map((event) => event.name), ['analytics_toggled']);
    expect(client.events.single.properties?['enabled'], false);
    expect(client.optOuts, 1);
  });

  test('events keep first-touch attribution and survive sign-out', () async {
    final client = RecordingAnalyticsClient();
    final analytics = await _started(
      client,
      launchRoute: 'drevvy://open?c=creatorid&v=videoid&utm_source=tiktok',
    );

    analytics.track(AnalyticsEvents.carSaved, {
      'listing_id': 'car_1',
      'source': 'shop',
    });
    await analytics.flushed;
    expect(client.events.last.properties?['creator_id'], 'creatorid');
    expect(client.events.last.properties?['video_id'], 'videoid');
    expect(client.events.last.properties?['utm_source'], 'tiktok');

    analytics.captureLocation('drevvy://open?c=other&v=other');
    analytics.track(AnalyticsEvents.tabSelected, {'tab': 'deals'});
    await analytics.flushed;
    expect(client.events.last.properties?['creator_id'], 'creatorid');

    analytics.signOut();
    await analytics.flushed;
    expect(client.resets, 1);

    analytics.track(AnalyticsEvents.screenViewed, {'screen': 'shop'});
    await analytics.flushed;
    expect(client.events.last.properties?['creator_id'], 'creatorid');
    expect(client.registered['creator_id'], 'creatorid');
  });

  test('identify accepts a user id and rejects email and phone', () async {
    final client = RecordingAnalyticsClient();
    final analytics = await _started(
      client,
      launchRoute: '/shop?c=creatorid&v=videoid',
    );
    await analytics.flushed;

    analytics.identify('ada@example.com');
    analytics.identify('+15551234567');
    analytics.identify('11111111-2222-3333-4444-555555555555');
    await analytics.flushed;

    expect(client.identifies, hasLength(1));
    expect(
      client.identifies.single.userId,
      '11111111-2222-3333-4444-555555555555',
    );
    expect(
      client.identifies.single.userPropertiesSetOnce?['creator_id'],
      'creatorid',
    );
    expect(
      client.identifies.single.userPropertiesSetOnce?.containsKey('email'),
      isNot(true),
    );
  });

  test('app_install and first_open fire once', () async {
    final flags = MemoryFlags();
    final firstClient = RecordingAnalyticsClient();
    final first = await _started(firstClient, flags: flags);
    await first.flushed;
    expect(
      firstClient.events.map((event) => event.name),
      containsAll(['app_install', 'first_open']),
    );

    final secondClient = RecordingAnalyticsClient();
    final second = await _started(secondClient, flags: flags);
    await second.flushed;
    expect(
      secondClient.events.map((event) => event.name),
      isNot(contains('app_install')),
    );
    expect(
      secondClient.events.map((event) => event.name),
      isNot(contains('first_open')),
    );
  });

  test('screen_viewed is debounced for the same screen', () async {
    final client = RecordingAnalyticsClient();
    final analytics = await _started(
      client,
      now: () => DateTime.utc(2026, 1, 1, 12),
    );
    await analytics.flushed;
    client.events.clear();

    analytics.screen('shop');
    analytics.screen('shop');
    analytics.screen('deals');
    await analytics.flushed;

    final screens = client.events
        .where((event) => event.name == 'screen_viewed')
        .map((event) => event.properties?['screen'])
        .toList();
    expect(screens, ['shop', 'deals']);
  });

  test('search properties keep category and length, not the text', () {
    const query = 'family suv email ada@example.com';
    final properties = searchEventProperties(
      surface: 'ask',
      query: query,
      source: 'composer',
    );
    expect(properties['query_category'], 'suv');
    expect(properties['query_length'], query.length);
    expect(properties.containsKey('query'), isFalse);
    expect(properties.values.join(' '), isNot(contains('ada@example.com')));
    expect(properties.values.join(' '), isNot(contains('family')));
  });

  test('purchase properties keep pack id, price, and currency', () async {
    final client = RecordingAnalyticsClient();
    final analytics = await _started(client);
    await analytics.flushed;
    client.events.clear();

    final pack = CarPackType.bestValue;
    analytics.track(AnalyticsEvents.purchaseCompleted, {
      'pack_id': pack.productId,
      'price': pack.priceUsd,
      'currency': 'USD',
      'email': 'ada@example.com',
    });
    await analytics.flushed;

    final event = client.events.single;
    expect(event.name, 'purchase_completed');
    expect(event.properties?['pack_id'], pack.productId);
    expect(event.properties?['price'], pack.priceUsd);
    expect(event.properties?['currency'], 'USD');
    expect(event.properties?.containsKey('email'), isFalse);
  });

  test('paywall events include the 1-key pack in the mix', () async {
    final client = RecordingAnalyticsClient();
    final analytics = await _started(client);
    await analytics.flushed;
    client.events.clear();

    analytics.recordLocation('/paywall');
    analytics.track(AnalyticsEvents.packSelected, {
      'pack_id': CarPackType.single.productId,
      'pack_size': CarPackType.single.cars,
      'pack_mix': CarPackType.packMix,
      'price': CarPackType.single.priceUsd,
      'currency': 'USD',
      'stage': 'preview',
    });
    await analytics.flushed;

    final viewed = client.events.firstWhere(
      (event) => event.name == 'pack_viewed',
    );
    expect(viewed.properties?['pack_count'], 4);
    expect(viewed.properties?['pack_mix'], '1,5,10,25');
    final selected = client.events.firstWhere(
      (event) => event.name == 'pack_selected',
    );
    expect(selected.properties?['pack_size'], 1);
    expect(selected.properties?['pack_mix'], contains('1'));
  });

  test('ANALYTICS.md documents every event', () {
    final dictionary = File('ANALYTICS.md').readAsStringSync();
    for (final name in AnalyticsEvents.all) {
      expect(dictionary, contains('`$name`'), reason: name);
    }
  });
}

Future<ProductAnalytics> _started(
  RecordingAnalyticsClient client, {
  MemoryFlags? flags,
  String? launchRoute,
  DateTime Function()? now,
}) {
  return ProductAnalytics.start(
    config: const AnalyticsConfig(
      apiKey: 'phc_test',
      host: 'https://us.i.posthog.com',
    ),
    client: client,
    flags: flags ?? MemoryFlags(),
    launchRoute: launchRoute,
    attachLifecycle: false,
    now: now,
  );
}

class RecordingAnalyticsClient implements AnalyticsClient {
  final events = <_Captured>[];
  final identifies = <_Identified>[];
  final registered = <String, Object>{};
  int setups = 0;
  int optOuts = 0;
  int resets = 0;

  @override
  Future<void> setup({
    required String apiKey,
    required String host,
    required bool optOut,
  }) async {
    setups += 1;
  }

  @override
  Future<void> capture({
    required String eventName,
    Map<String, Object>? properties,
    Map<String, Object>? userPropertiesSetOnce,
  }) async {
    events.add(_Captured(eventName, properties));
  }

  @override
  Future<void> identify({
    required String userId,
    Map<String, Object>? userPropertiesSetOnce,
  }) async {
    identifies.add(_Identified(userId, userPropertiesSetOnce));
  }

  @override
  Future<void> setPersonProperties({
    Map<String, Object>? userPropertiesToSetOnce,
  }) async {}

  @override
  Future<void> register(String key, Object value) async {
    registered[key] = value;
  }

  @override
  Future<void> optOut() async {
    optOuts += 1;
  }

  @override
  Future<void> optIn() async {}

  @override
  Future<void> reset() async {
    resets += 1;
    registered.clear();
  }
}

class _Captured {
  _Captured(this.name, this.properties);

  final String name;
  final Map<String, Object>? properties;
}

class _Identified {
  _Identified(this.userId, this.userPropertiesSetOnce);

  final String userId;
  final Map<String, Object>? userPropertiesSetOnce;
}

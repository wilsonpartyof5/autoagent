import 'dart:async';
import 'dart:io';

import 'package:drevvy_app/core/providers/app_services.dart';
import 'package:drevvy_app/data/discover/discover_catalog.dart';
import 'package:drevvy_app/data/discover/discover_filters.dart';
import 'package:drevvy_app/data/discover/discover_page.dart';
import 'package:drevvy_app/data/discover/discover_shop_controller.dart';
import 'package:drevvy_app/data/location/location_providers.dart';
import 'package:drevvy_app/data/location/location_sources.dart';
import 'package:drevvy_app/data/location/shop_location.dart';
import 'package:drevvy_app/data/location/shop_location_store.dart';
import 'package:drevvy_app/data/location/zip_location.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/notifications/local_flags.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _fortMill = ShopLocation(
  latitude: 35.0071,
  longitude: -80.9398,
  label: 'Current location',
);

class _FakeDevice implements DeviceLocationSource {
  _FakeDevice.granted() : place = _fortMill, fail = false;
  _FakeDevice.denied() : place = _fortMill, fail = true;

  final ShopLocation place;
  final bool fail;
  int calls = 0;

  @override
  Future<ShopLocation> current() async {
    calls++;
    if (fail) {
      throw const LocationFailure(
        'Location permission is off. Search for a city instead.',
      );
    }
    return place;
  }
}

class _FakePlaces implements PlaceSearch {
  _FakePlaces(this.handler);

  final Future<List<ShopLocation>> Function(String query) handler;
  final queries = <String>[];

  @override
  Future<List<ShopLocation>> search(String query) {
    queries.add(query);
    return handler(query);
  }
}

class _RecordingCatalog implements DiscoverCatalog {
  final searched = <ShopLocation>[];

  @override
  Future<Listing> listing(String id) => throw UnimplementedError();

  @override
  Future<DiscoverPage> search({
    required ShopLocation location,
    required DiscoverFilters filters,
    int page = 1,
  }) async {
    searched.add(location);
    return const DiscoverPage(listings: [], page: 1, hasNextPage: false);
  }
}

_FakePlaces _zipGeocoder() => _FakePlaces(
  (query) async => [
    const ShopLocation(latitude: 35.0187, longitude: -80.9384, label: 'x'),
  ],
);

Future<void> _openWhereToLook(
  WidgetTester tester, {
  required MemoryFlags flags,
  required DeviceLocationSource device,
  required PlaceSearch places,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        localFlagsProvider.overrideWithValue(flags),
        deviceLocationSourceProvider.overrideWithValue(device),
        placeSearchProvider.overrideWithValue(places),
      ],
      child: const DrevvyApp(),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Let’s find your car'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Surprise fees'));
  await tester.pump(const Duration(milliseconds: 420));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Whole price'));
  await tester.pump(const Duration(milliseconds: 420));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Keep texts in Drevvy'));
  await tester.pump(const Duration(milliseconds: 420));
  await tester.pumpAndSettle();
  await tester.tap(find.text('See how Drevvy helps'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Next · Meet the dealer'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Skip for now'));
  await tester.pumpAndSettle();
  expect(find.text('Where should we look?'), findsOneWidget);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.physicalSize = const Size(800, 2000);
    view.devicePixelRatio = 1;
  });

  tearDown(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.resetPhysicalSize();
    view.resetDevicePixelRatio();
    DemoRepository.instance
      ..resetDemoUser()
      ..resetDemoSearchProfile();
  });

  group('locationForZip', () {
    test('uses the OS geocoder point and labels it with the ZIP', () async {
      final places = _zipGeocoder();
      final place = await locationForZip(places, '29715');
      expect(places.queries, ['29715, USA']);
      expect(place, isNotNull);
      expect(place!.latitude, 35.0187);
      expect(place.longitude, -80.9384);
      expect(place.label, 'ZIP 29715');
    });

    test('never calls the geocoder for a bad ZIP', () async {
      final places = _zipGeocoder();
      for (final zip in ['', '2971', '297155', '29a15', '29715-1234']) {
        expect(await locationForZip(places, zip), isNull, reason: zip);
      }
      expect(places.queries, isEmpty);
    });

    test(
      'returns null when the geocoder fails, is slow, or has no match',
      () async {
        final failing = _FakePlaces(
          (_) async =>
              throw const LocationFailure('Could not look up that place.'),
        );
        expect(await locationForZip(failing, '29715'), isNull);

        final throwing = _FakePlaces((_) async => throw StateError('boom'));
        expect(await locationForZip(throwing, '29715'), isNull);

        final empty = _FakePlaces((_) async => const []);
        expect(await locationForZip(empty, '29715'), isNull);

        final never = Completer<List<ShopLocation>>();
        final slow = _FakePlaces((_) => never.future);
        expect(
          await locationForZip(
            slow,
            '29715',
            timeout: const Duration(milliseconds: 10),
          ),
          isNull,
        );
      },
    );

    test('skips (0, 0) and points outside the US', () async {
      final places = _FakePlaces(
        (_) async => const [
          ShopLocation(latitude: 0, longitude: 0, label: 'x'),
          ShopLocation(latitude: 48.8566, longitude: 2.3522, label: 'Paris'),
        ],
      );
      expect(await locationForZip(places, '75001'), isNull);

      final mixed = _FakePlaces(
        (_) async => const [
          ShopLocation(latitude: 48.8566, longitude: 2.3522, label: 'Paris'),
          ShopLocation(latitude: 61.2181, longitude: -149.9003, label: 'AK'),
        ],
      );
      final place = await locationForZip(mixed, '99501');
      expect(place?.latitude, 61.2181);
      expect(place?.label, 'ZIP 99501');
    });
  });

  testWidgets(
    'Share my location asks the OS and saves the point for Discover',
    (tester) async {
      final flags = MemoryFlags();
      final device = _FakeDevice.granted();
      final places = _zipGeocoder();
      await _openWhereToLook(
        tester,
        flags: flags,
        device: device,
        places: places,
      );

      expect(find.text('Share my location'), findsOneWidget);
      await tester.tap(find.text('Share my location'));
      await tester.pumpAndSettle();

      expect(device.calls, 1);
      expect(find.text('✓ Location shared'), findsOneWidget);
      final saved = await ShopLocationStore(flags).read();
      expect(saved?.latitude, 35.0071);
      expect(saved?.longitude, -80.9398);

      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(find.text('What kind of car?'), findsOneWidget);
      expect(places.queries, isEmpty);
    },
  );

  testWidgets('a no from the OS falls back to the ZIP, and the ZIP becomes the '
      'Discover point', (tester) async {
    final flags = MemoryFlags();
    final device = _FakeDevice.denied();
    final places = _zipGeocoder();
    await _openWhereToLook(
      tester,
      flags: flags,
      device: device,
      places: places,
    );

    await tester.tap(find.text('Share my location'));
    await tester.pumpAndSettle();
    expect(device.calls, 1);
    expect(find.text('✓ Location shared'), findsNothing);
    expect(
      find.text('We could not get your location. Type your zip instead.'),
      findsOneWidget,
    );
    expect(await ShopLocationStore(flags).read(), isNull);

    // Still not skippable: Continue does nothing without a ZIP.
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Where should we look?'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '29715');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.text('What kind of car?'), findsOneWidget);
    expect(places.queries, ['29715, USA']);
    final saved = await ShopLocationStore(flags).read();
    expect(saved?.latitude, 35.0187);
    expect(saved?.longitude, -80.9384);
    expect(saved?.label, 'ZIP 29715');
  });

  testWidgets(
    'a ZIP the geocoder cannot place still moves on with no fake point',
    (tester) async {
      final flags = MemoryFlags();
      final places = _FakePlaces(
        (_) async => throw const LocationFailure('No map location found.'),
      );
      await _openWhereToLook(
        tester,
        flags: flags,
        device: _FakeDevice.denied(),
        places: places,
      );

      await tester.enterText(find.byType(TextField), '00000');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(find.text('What kind of car?'), findsOneWidget);
      expect(places.queries, ['00000, USA']);
      expect(await ShopLocationStore(flags).read(), isNull);
    },
  );

  test('Discover searches from the point onboarding saved', () async {
    final flags = MemoryFlags();
    final saved = await locationForZip(_zipGeocoder(), '29715');
    await ShopLocationStore(flags).write(saved!);

    final catalog = _RecordingCatalog();
    final controller = DiscoverShopController(
      catalog: catalog,
      locations: ShopLocationStore(flags),
    );
    await controller.restore();
    expect(controller.location?.label, 'ZIP 29715');
    await controller.search(reset: true);

    expect(catalog.searched, hasLength(1));
    expect(catalog.searched.single.latitude, 35.0187);
    expect(catalog.searched.single.longitude, -80.9384);
  });

  test('onboarding and Shop use the same storage key', () {
    final container = ProviderContainer(
      overrides: [localFlagsProvider.overrideWithValue(MemoryFlags())],
    );
    addTearDown(container.dispose);
    expect(container.read(shopLocationStoreProvider), isA<ShopLocationStore>());
    expect(ShopLocationStore.storageKey, 'discover_shop_location');
  });

  test('the OS prompt has its usage string and permissions', () {
    final plist = File('ios/Runner/Info.plist').readAsStringSync();
    expect(plist, contains('<key>NSLocationWhenInUseUsageDescription</key>'));
    expect(
      plist,
      contains(
        'Drevvy uses your location to show cars near you. '
        'You can type your ZIP or pick a city instead.',
      ),
    );
    final manifest = File('android/app/src/main/AndroidManifest.xml')
        .readAsStringSync();
    expect(manifest, contains('android.permission.ACCESS_COARSE_LOCATION'));
    expect(manifest, contains('android.permission.ACCESS_FINE_LOCATION'));
  });
}

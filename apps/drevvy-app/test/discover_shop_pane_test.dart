import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/discover/discover_catalog.dart';
import 'package:drevvy_app/data/discover/discover_exception.dart';
import 'package:drevvy_app/data/discover/discover_filters.dart';
import 'package:drevvy_app/data/discover/discover_page.dart';
import 'package:drevvy_app/data/discover/discover_shop_controller.dart';
import 'package:drevvy_app/data/location/location_sources.dart';
import 'package:drevvy_app/data/location/shop_location.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/features/shop/widgets/discover_location_sheet.dart';
import 'package:drevvy_app/features/shop/widgets/discover_shop_pane.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _place = ShopLocation(
  latitude: 39.7817,
  longitude: -89.6501,
  label: 'Springfield, IL',
);

Listing _civic() {
  return const Listing(
    id: 'live_civic',
    vin: '1HGCV1F16LA000111',
    price: 18990,
    miles: 24000,
    build: ListingBuild(year: 2020, make: 'Honda', model: 'Civic'),
    media: ListingMedia(photoLinks: []),
  );
}

class ScriptedCatalog implements DiscoverCatalog {
  ScriptedCatalog(this.results);

  final List<Object> results;
  int calls = 0;

  @override
  Future<Listing> listing(String id) async => _civic();

  @override
  Future<DiscoverPage> search({
    required ShopLocation location,
    required DiscoverFilters filters,
    int page = 1,
  }) async {
    final result = results[calls];
    calls += 1;
    if (result is DiscoverException) throw result;
    return result as DiscoverPage;
  }
}

class _FakeDevice implements DeviceLocationSource {
  _FakeDevice(this.result);

  final Object result;

  @override
  Future<ShopLocation> current() async {
    final result = this.result;
    if (result is LocationFailure) throw result;
    return result as ShopLocation;
  }
}

class _FakePlaces implements PlaceSearch {
  _FakePlaces(this.result);

  final Object result;

  @override
  Future<List<ShopLocation>> search(String query) async {
    final result = this.result;
    if (result is LocationFailure) throw result;
    return result as List<ShopLocation>;
  }
}

Widget _app(Widget child) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(body: child),
  );
}

void main() {
  testWidgets('an error offers retry and does not show demo cars', (tester) async {
    final catalog = ScriptedCatalog([
      const DiscoverException(
        status: 502,
        code: 'UPSTREAM_ERROR',
        message: 'Inventory is unavailable.',
      ),
      DiscoverPage(listings: [_civic()], page: 1, hasNextPage: false),
    ]);
    final controller = DiscoverShopController(catalog: catalog, location: _place);
    await controller.search(reset: true);

    await tester.pumpWidget(
      _app(
        DiscoverShopPane(
          controller: controller,
          onOpen: (_) {},
          onLocation: () {},
          onFilters: () {},
        ),
      ),
    );

    expect(find.text('Couldn’t load cars'), findsOneWidget);
    expect(find.text('Inventory is unavailable.'), findsOneWidget);
    expect(find.text('RAV4'), findsNothing);
    expect(find.textContaining('123456'), findsNothing);
    expect(find.textContaining('below similar'), findsNothing);

    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();

    expect(catalog.calls, 2);
    expect(find.textContaining('Civic'), findsWidgets);
    expect(find.text('RAV4'), findsNothing);
    expect(find.textContaining('below similar'), findsNothing);
  });

  testWidgets('an empty filter result stays empty', (tester) async {
    final catalog = ScriptedCatalog([
      const DiscoverPage(listings: [], page: 1, hasNextPage: false),
    ]);
    final controller = DiscoverShopController(catalog: catalog, location: _place);
    await controller.search(reset: true);

    await tester.pumpWidget(
      _app(
        DiscoverShopPane(
          controller: controller,
          onOpen: (_) {},
          onLocation: () {},
          onFilters: () {},
        ),
      ),
    );

    expect(find.text('No cars found'), findsOneWidget);
    expect(find.text('RAV4'), findsNothing);
    expect(controller.listings, isEmpty);
  });

  testWidgets('a tapped city result is the location that is saved', (tester) async {
    ShopLocation? picked;
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: Scaffold(
          body: Builder(
            builder: (context) {
              return TextButton(
                onPressed: () async {
                  picked = await DiscoverLocationSheet.show(
                    context,
                    device: _FakeDevice(
                      const LocationFailure('Location permission is off.'),
                    ),
                    places: _FakePlaces([_place]),
                  );
                },
                child: const Text('Open location'),
              );
            },
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open location'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Springfield IL');
    await tester.tap(find.text('Search places'));
    await tester.pumpAndSettle();
    expect(find.textContaining('39.7817'), findsOneWidget);

    await tester.tap(find.text('Springfield, IL'));
    await tester.pumpAndSettle();

    expect(picked?.latitude, _place.latitude);
    expect(picked?.longitude, _place.longitude);
    expect(picked?.isUsable, isTrue);
  });
}

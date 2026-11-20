import 'package:drevvy_app/data/discover/discover_catalog.dart';
import 'package:drevvy_app/data/discover/discover_exception.dart';
import 'package:drevvy_app/data/discover/discover_filters.dart';
import 'package:drevvy_app/data/discover/discover_page.dart';
import 'package:drevvy_app/data/discover/discover_shop_controller.dart';
import 'package:drevvy_app/data/location/shop_location.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:flutter_test/flutter_test.dart';

const _place = ShopLocation(
  latitude: 39.7817,
  longitude: -89.6501,
  label: 'Springfield, IL',
);

Listing _live(String id) {
  return Listing(
    id: id,
    vin: '1HGCV1F16LA000111',
    price: 18990,
    build: const ListingBuild(year: 2020, make: 'Honda', model: 'Civic'),
    media: const ListingMedia(photoLinks: []),
  );
}

class ScriptedCatalog implements DiscoverCatalog {
  ScriptedCatalog(this.results);

  final List<Object> results;
  int calls = 0;
  ShopLocation? lastLocation;

  @override
  Future<Listing> listing(String id) async => _live(id);

  @override
  Future<DiscoverPage> search({
    required ShopLocation location,
    required DiscoverFilters filters,
    int page = 1,
  }) async {
    lastLocation = location;
    final result = results[calls];
    calls += 1;
    if (result is DiscoverException) throw result;
    return result as DiscoverPage;
  }
}

void main() {
  test('a failed search clears listings and retry uses the next response', () async {
    final catalog = ScriptedCatalog([
      const DiscoverException(
        status: 502,
        code: 'UPSTREAM_ERROR',
        message: 'Inventory is unavailable.',
      ),
      DiscoverPage(listings: [_live('live_civic')], page: 1, hasNextPage: false),
    ]);
    final controller = DiscoverShopController(catalog: catalog, location: _place);

    await controller.search(reset: true);

    expect(controller.phase, DiscoverShopPhase.error);
    expect(controller.listings, isEmpty);
    expect(controller.errorMessage, 'Inventory is unavailable.');
    expect(controller.listings.map((listing) => listing.id), isNot(contains('listing_001')));

    await controller.retry();

    expect(catalog.calls, 2);
    expect(controller.phase, DiscoverShopPhase.results);
    expect(controller.listings.single.id, 'live_civic');
    expect(controller.listings.single.vin, isNot(endsWith('123456')));
  });

  test('an empty page stays empty', () async {
    final catalog = ScriptedCatalog([
      const DiscoverPage(listings: [], page: 1, hasNextPage: false, total: 0),
    ]);
    final controller = DiscoverShopController(catalog: catalog, location: _place);

    await controller.search(reset: true);

    expect(controller.phase, DiscoverShopPhase.empty);
    expect(controller.listings, isEmpty);
    expect(catalog.calls, 1);
  });

  test('a missing location does not call Discover', () async {
    final catalog = ScriptedCatalog(const []);
    final controller = DiscoverShopController(catalog: catalog);

    await controller.search(query: 'Honda Civic', reset: true);

    expect(catalog.calls, 0);
    expect(controller.phase, DiscoverShopPhase.needsLocation);
    expect(controller.listings, isEmpty);
  });

  test('(0, 0) is not sent', () async {
    final catalog = ScriptedCatalog(const []);
    final controller = DiscoverShopController(catalog: catalog);

    await controller.setLocation(
      const ShopLocation(latitude: 0, longitude: 0, label: 'Null island'),
    );

    expect(catalog.calls, 0);
    expect(controller.phase, DiscoverShopPhase.error);
    expect(controller.listings, isEmpty);
  });

  test('load-more failure keeps the cars already shown', () async {
    final catalog = ScriptedCatalog([
      DiscoverPage(listings: [_live('live_page_1')], page: 1, hasNextPage: true),
      const DiscoverException(
        status: 0,
        code: 'NETWORK',
        message: 'Drevvy could not reach inventory. Try again.',
      ),
    ]);
    final controller = DiscoverShopController(catalog: catalog, location: _place);

    await controller.search(reset: true);
    await controller.search(reset: false);

    expect(controller.listings.single.id, 'live_page_1');
    expect(controller.errorMessage, contains('Try again'));
    expect(controller.phase, DiscoverShopPhase.results);
  });
}

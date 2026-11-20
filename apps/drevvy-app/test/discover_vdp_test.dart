import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/discover/discover_catalog.dart';
import 'package:drevvy_app/data/discover/discover_config.dart';
import 'package:drevvy_app/data/discover/discover_exception.dart';
import 'package:drevvy_app/data/discover/discover_filters.dart';
import 'package:drevvy_app/data/discover/discover_page.dart';
import 'package:drevvy_app/data/location/shop_location.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/features/shop/screens/vdp_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _liveConfig = DiscoverConfig(apiBaseUrl: 'https://api.drevvy.com');

Listing _civic() {
  return const Listing(
    id: 'live_civic',
    vin: '1HGCV1F16LA000111',
    price: 18990,
    miles: 24000,
    build: ListingBuild(year: 2020, make: 'Honda', model: 'Civic'),
    media: ListingMedia(photoLinks: []),
    carLocation: CarLocation(city: 'Springfield', state: 'IL'),
  );
}

class ScriptedCatalog implements DiscoverCatalog {
  ScriptedCatalog(this.details);

  final List<Object> details;
  int calls = 0;

  @override
  Future<Listing> listing(String id) async {
    final result = details[calls];
    calls += 1;
    if (result is DiscoverException) throw result;
    return result as Listing;
  }

  @override
  Future<DiscoverPage> search({
    required ShopLocation location,
    required DiscoverFilters filters,
    int page = 1,
  }) async {
    fail('Live vehicle detail does not search the demo catalog');
  }
}

void main() {
  testWidgets('a live detail error retries the listing endpoint', (tester) async {
    final catalog = ScriptedCatalog([
      const DiscoverException(
        status: 502,
        code: 'UPSTREAM_ERROR',
        message: 'This listing could not be loaded.',
      ),
      _civic(),
    ]);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: drevvyTheme(Brightness.light),
          home: VdpScreen(
            listingId: 'live_civic',
            discoverConfig: _liveConfig,
            discoverCatalog: catalog,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Couldn’t open this car'), findsOneWidget);
    expect(find.text('This listing could not be loaded.'), findsOneWidget);
    expect(find.text('Listed by Dealer A'), findsNothing);
    expect(find.text('RAV4'), findsNothing);

    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();

    expect(catalog.calls, 2);
    expect(find.textContaining('Civic'), findsWidgets);
    await tester.scrollUntilVisible(
      find.textContaining('Fair price is not part of this listing'),
      300,
    );
    expect(find.textContaining('Fair price is not part of this listing'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.textContaining('Dealer chat is not opened'),
      300,
    );
    expect(find.textContaining('Dealer chat is not opened'), findsOneWidget);
    expect(find.text('Listed by Dealer A'), findsNothing);
    expect(find.textContaining('below similar'), findsNothing);
  });

  test('default config is not live without a dart-define', () {
    expect(DiscoverConfig.fromEnvironment().isLive, isFalse);
  });
}

import 'package:drevvy_app/core/config/api_config_exception.dart';
import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/discover/discover_client.dart';
import 'package:drevvy_app/data/discover/discover_config.dart';
import 'package:drevvy_app/data/discover/discover_exception.dart';
import 'package:drevvy_app/data/discover/discover_filters.dart';
import 'package:drevvy_app/data/location/shop_location.dart';
import 'package:drevvy_app/features/shop/screens/shop_screen.dart';
import 'package:drevvy_app/features/shop/screens/vdp_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

Future<void> _flushDelays(WidgetTester tester) async {
  for (var i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 500));
  }
}

const _springfield = ShopLocation(
  latitude: 39.7817,
  longitude: -89.6501,
  label: 'Springfield, IL',
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Discover follows the shared mode and origin', () {
    final api = DrevvyApiConfig.fromEnvironment();
    final discover = DiscoverConfig.fromEnvironment();

    expect(discover.origin, api.origin);
    expect(discover.mode, api.mode);
    expect(discover.isLive, isFalse);
    expect(discover.needsConfiguration, isFalse);
    expect(api.origin, isNot(contains('www.drevvy.com')));

    expect(
      const DiscoverConfig(
        apiBaseUrl: 'https://api.drevvy.com',
        mode: DrevvyDataMode.demo,
      ).isLive,
      isFalse,
    );
    expect(
      const DiscoverConfig(apiBaseUrl: '', mode: DrevvyDataMode.live).isLive,
      isFalse,
    );
    expect(
      const DiscoverConfig(
        apiBaseUrl: '',
        mode: DrevvyDataMode.live,
      ).needsConfiguration,
      isTrue,
    );
    expect(
      const DiscoverConfig(
        apiBaseUrl: 'https://api.drevvy.com/',
        mode: DrevvyDataMode.live,
      ).isLive,
      isTrue,
    );
  });

  test('demo mode does not call Discover when a URL is set', () async {
    var called = false;
    final client = DiscoverClient(
      config: const DiscoverConfig(
        apiBaseUrl: 'https://api.drevvy.com',
        mode: DrevvyDataMode.demo,
      ),
      httpClient: MockClient((request) async {
        called = true;
        return http.Response('{}', 200);
      }),
    );

    await expectLater(
      client.search(location: _springfield, filters: const DiscoverFilters()),
      throwsA(
        isA<DiscoverException>().having(
          (error) => error.code,
          'code',
          'NOT_CONFIGURED',
        ),
      ),
    );
    expect(called, isFalse);
  });

  testWidgets('live mode without a URL does not show demo inventory', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: const ShopScreen(
          discoverConfig: DiscoverConfig(
            apiBaseUrl: '',
            mode: DrevvyDataMode.live,
          ),
        ),
      ),
    );
    await _flushDelays(tester);

    await tester.tap(find.text('Shop'));
    await _flushDelays(tester);

    expect(find.text('Live inventory is not configured'), findsOneWidget);
    expect(find.text(apiNotConfiguredMessage), findsOneWidget);
    expect(find.text('See price'), findsNothing);
  });

  testWidgets('a URL without live mode keeps the demo catalog', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: const ShopScreen(
          discoverConfig: DiscoverConfig(
            apiBaseUrl: 'https://api.drevvy.com',
            mode: DrevvyDataMode.demo,
          ),
        ),
      ),
    );
    await _flushDelays(tester);

    await tester.tap(find.text('Shop'));
    await _flushDelays(tester);

    expect(find.text('Live inventory is not configured'), findsNothing);
    expect(find.text('2024 Toyota RAV4'), findsOneWidget);
    expect(find.text('Reaching out'), findsWidgets);
  });

  testWidgets(
    'a live vehicle detail without a URL does not open the demo car',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: drevvyTheme(Brightness.light),
            home: const VdpScreen(
              listingId: 'listing_001',
              discoverConfig: DiscoverConfig(
                apiBaseUrl: '',
                mode: DrevvyDataMode.live,
              ),
            ),
          ),
        ),
      );
      await _flushDelays(tester);

      expect(find.text(apiNotConfiguredMessage), findsOneWidget);
      expect(find.textContaining('RAV4'), findsNothing);
      expect(find.textContaining('Listed by Dealer'), findsNothing);
    },
  );
}

import 'dart:convert';

import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/core/theme/drevvy_tokens.dart';
import 'package:drevvy_app/data/discover/discover_config.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/chat.dart';
import 'package:drevvy_app/data/models/deal.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/market_context.dart';
import 'package:drevvy_app/data/models/rooftop_match.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/deal_chips_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/rooftop_match_endpoint.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:drevvy_app/features/deals/widgets/deal_dealer_chat.dart';
import 'package:drevvy_app/features/shop/screens/shop_screen.dart';
import 'package:drevvy_app/features/shop/widgets/dealer_chat_sheet.dart';
import 'package:drevvy_app/features/shop/widgets/vdp_cta_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _origin = 'https://api.drevvy.com';

const _demoUrl = PurchaseConfig(apiBaseUrl: _origin);

const _live = PurchaseConfig(mode: DrevvyDataMode.live);

const _liveUrl = PurchaseConfig(mode: DrevvyDataMode.live, apiBaseUrl: _origin);

const _rav4 = Listing(
  id: 'listing_001',
  vin: '2T3P1RFV5RC123456',
  price: 32995,
  build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
  media: ListingMedia(photoLinks: []),
);

const _liveMatch = RooftopMatch(
  matched: true,
  rooftopId: 'rt_live',
  source: RooftopMatchSource.live,
);

void main() {
  setUp(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.physicalSize = const Size(800, 1400);
    view.devicePixelRatio = 1;
  });

  tearDown(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.resetPhysicalSize();
    view.resetDevicePixelRatio();
  });

  test('demo with a URL does not request chips, spend, or rooftop', () async {
    final requests = _RecordingClient();
    final repo = DemoRepository(
      config: _demoUrl,
      httpClient: requests.client,
      networkDelay: Duration.zero,
      initialBalance: const CarCreditBalance.withBalance(4),
    );

    expect(repo.isLive, isFalse);
    expect(repo.dealChips, isA<MissingDealChipsEndpoint>());
    expect(await repo.getRooftopMatch(_rav4), isA<RooftopMatch>());
    expect((await repo.getRooftopMatch(_rav4)).source, RooftopMatchSource.stub);

    final deal = await repo.startDealerConversation(
      _rav4,
      StubRooftopMatchEndpoint.stubFor(_rav4),
    );
    expect(deal, isNotNull);
    expect((await repo.getCreditBalance()).balance, 3);
    expect(requests.calls, isEmpty);

    final market = await repo.getMarketContext(_rav4);
    expect(market.fairVehiclePrice, (32995 * 1.03).round());
  });

  test('live with an origin does not spend on stub or unavailable', () async {
    final requests = _RecordingClient();
    final repo = DemoRepository(
      config: _liveUrl,
      httpClient: requests.client,
      networkDelay: Duration.zero,
      initialBalance: const CarCreditBalance.withBalance(4),
    );

    expect(repo.dealChips, isA<HttpDealChipsEndpoint>());
    expect(
      await repo.startDealerConversation(
        _rav4,
        StubRooftopMatchEndpoint.stubFor(_rav4),
      ),
      isNull,
    );
    expect(
      await repo.startDealerConversation(
        _rav4,
        const RooftopMatch.unavailable(),
      ),
      isNull,
    );
    expect((await repo.getCreditBalance()).balance, 4);
    expect(requests.calls, isEmpty);
    expect(repo.getMarketContext(_rav4), throwsStateError);
  });

  test('a missing origin makes no request and no spend', () async {
    final requests = _RecordingClient();
    final repo = DemoRepository(
      config: _live,
      httpClient: requests.client,
      networkDelay: Duration.zero,
      initialBalance: const CarCreditBalance.withBalance(4),
    );

    expect(repo.dealChips, isA<MissingDealChipsEndpoint>());
    expect(
      (await repo.getRooftopMatch(_rav4)).source,
      RooftopMatchSource.unavailable,
    );
    expect(await repo.startDealerConversation(_rav4, _liveMatch), isNull);
    expect(
      await repo.startDealerConversation(
        _rav4,
        StubRooftopMatchEndpoint.stubFor(_rav4),
      ),
      isNull,
    );
    expect(
      await repo.startDealerConversation(
        _rav4,
        const RooftopMatch.unavailable(),
      ),
      isNull,
    );
    expect((await repo.getCreditBalance()).balance, 4);
    expect(requests.calls, isEmpty);
  });

  test('a verified live match can still post the conversation spend', () async {
    final store = ShopperSessionStore.instance;
    final previous = store.session;
    store.session = const ShopperSession(accessToken: 'shopper-jwt');
    addTearDown(() => store.session = previous);

    final requests = _RecordingClient(
      body: jsonEncode({
        'success': true,
        'data': {'dealId': 'deal_verified', 'balance': 3},
      }),
    );
    final repo = DemoRepository(
      config: _liveUrl,
      httpClient: requests.client,
      networkDelay: Duration.zero,
      initialBalance: const CarCreditBalance.withBalance(4),
    );

    final deal = await repo.startDealerConversation(_rav4, _liveMatch);
    expect(deal?.id, 'deal_verified');
    expect(deal?.marketContext, isNull);
    expect((await repo.getCreditBalance()).balance, 3);
    expect(requests.calls, hasLength(1));
    expect(requests.calls.single.method, 'POST');
    expect(requests.calls.single.url.path, '/api/consumer/deals');
    final body = jsonDecode(requests.calls.single.body) as Map<String, dynamic>;
    expect(body.containsKey('fairPrice'), isFalse);
    expect(body['spendKind'], 'dealer_conversation');
  });

  testWidgets(
    'live deal chat posts no synthetic fair price and does not spend',
    (tester) async {
      final requests = _RecordingClient(
        body: jsonEncode({
          'data': {'network': 'in_network', 'chips': <Object?>[]},
        }),
      );
      final repo = DemoRepository(
        config: _liveUrl,
        httpClient: requests.client,
        networkDelay: Duration.zero,
        initialBalance: const CarCreditBalance.withBalance(4),
      );
      final deal = _pricedDeal(fairVehiclePrice: 999001);

      await tester.pumpWidget(_frame(const SizedBox.shrink()));
      final opened = await openDealDealerChat(
        context: tester.element(find.byType(SizedBox)),
        repo: repo,
        deal: deal,
        match: const RooftopMatch(
          matched: true,
          rooftopId: 'rooftop_demo_springfield',
          source: RooftopMatchSource.stub,
        ),
        creditBalance: const CarCreditBalance.withBalance(4),
        shopperFirstName: 'Dana',
        market: const MarketContext(
          fairVehiclePrice: 111111,
          fairOtd: 114611,
          lowPrice: 100000,
          medianPrice: 110000,
          highPrice: 120000,
          comparablesCount: 4,
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(opened, isTrue);
      final sheet = tester.widget<DealerChatSheet>(
        find.byType(DealerChatSheet),
      );
      expect(sheet.chipInputs?.fairPrice, isNull);
      expect(sheet.chipInputs?.compsLowPrice, isNull);
      expect(requests.calls, hasLength(1));
      expect(
        requests.calls.single.url.path,
        '/api/consumer/deals/deal_guard/chips',
      );
      final posted =
          jsonDecode(requests.calls.single.body) as Map<String, dynamic>;
      final intel = posted['intel'] as Map<String, dynamic>;
      expect(intel.containsKey('fairPrice'), isFalse);
      expect(intel.containsKey('compsLowPrice'), isFalse);
      expect(intel.containsKey('compsCount'), isFalse);
      expect(posted.toString(), isNot(contains('999001')));
      expect(posted.toString(), isNot(contains('111111')));

      await tester.runAsync(() async {
        await sheet.onSend(message: 'Is this still available?');
        expect((await repo.getCreditBalance()).balance, 4);
      });
      expect(
        requests.calls.where((call) => call.url.path == '/api/consumer/deals'),
        isEmpty,
      );
    },
  );

  testWidgets('null listing price shows Price unavailable', (tester) async {
    const unpriced = Listing(
      id: 'listing_blank',
      vin: 'VINBLANK',
      price: null,
      build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
      media: ListingMedia(photoLinks: []),
    );
    await tester.pumpWidget(
      _frame(
        VdpCtaBar(
          listing: unpriced,
          creditBalance: const CarCreditBalance.withBalance(0),
          match: const RooftopMatch.unavailable(),
          marketIntelUnlocked: false,
          conversationOpen: false,
          otdRequested: false,
          onMarketIntel: _noop,
          onConversation: _noop,
          onOtdRequest: _noop,
        ),
      ),
    );

    expect(find.text('Price unavailable'), findsOneWidget);
    expect(find.text(r'$0'), findsNothing);
  });

  testWidgets(
    'live empty origin Ask-to-Shop does not search the demo catalog',
    (tester) async {
      final repo = _SearchProbe();
      await tester.pumpWidget(
        _frame(
          ShopScreen(
            discoverConfig: const DiscoverConfig(
              apiBaseUrl: '',
              mode: DrevvyDataMode.live,
            ),
            repository: repo,
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 800));

      expect(find.text('BACK TO YOUR SEARCH'), findsOneWidget);
      await tester.tap(find.text('BACK TO YOUR SEARCH'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(repo.searches, 0);
      expect(find.text('Live inventory is not configured'), findsOneWidget);
      expect(
        find.text('Drevvy API base URL is not configured.'),
        findsOneWidget,
      );
    },
  );
}

void _noop() {}

Widget _frame(Widget child) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(body: child),
  );
}

Deal _pricedDeal({required int fairVehiclePrice}) {
  return Deal(
    id: 'deal_guard',
    listingId: 'listing_guard',
    letter: 'A',
    status: DealStatus.reachingOut,
    listedAtStart: 32995,
    addedAt: DateTime.now(),
    listing: const Listing(
      id: 'listing_guard',
      vin: 'VINGUARD',
      stockNo: 'T12345',
      price: 32995,
      media: ListingMedia(photoLinks: []),
      build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
      extra: ListingExtra(highValueFeatures: ['Heated Seats']),
    ),
    marketContext: MarketContext(
      fairVehiclePrice: fairVehiclePrice,
      fairOtd: fairVehiclePrice + 3500,
      lowPrice: fairVehiclePrice - 1000,
      medianPrice: fairVehiclePrice,
      highPrice: fairVehiclePrice + 1000,
      comparablesCount: 9,
    ),
  );
}

class _RecordingClient {
  _RecordingClient({this.body = '{}'}) {
    client = MockClient((request) async {
      calls.add(request);
      return http.Response(body, 200);
    });
  }

  final String body;
  late final http.Client client;
  final calls = <http.Request>[];
}

class _SearchProbe extends DemoRepository {
  _SearchProbe() : super(networkDelay: Duration.zero);

  int searches = 0;

  @override
  Future<List<Listing>> searchListings({
    String? query,
    int? maxPrice,
    List<String>? bodyTypes,
    int? radius,
    int limit = 10,
    SearchFilters? filters,
  }) async {
    searches++;
    return const [];
  }
}

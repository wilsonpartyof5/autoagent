import 'dart:convert';

import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/providers/app_services.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/discover/discover_catalog.dart';
import 'package:drevvy_app/data/discover/discover_config.dart';
import 'package:drevvy_app/data/discover/discover_filters.dart';
import 'package:drevvy_app/data/discover/discover_page.dart';
import 'package:drevvy_app/data/location/shop_location.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/rooftop_match.dart';
import 'package:drevvy_app/data/notifications/local_flags.dart';
import 'package:drevvy_app/data/notifications/notification_prompt.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:drevvy_app/features/deals/screens/deal_chat_screen.dart';
import 'package:drevvy_app/features/deals/screens/deals_screen.dart';
import 'package:drevvy_app/features/shop/screens/vdp_screen.dart';
import 'package:drevvy_app/features/shop/widgets/dealer_chat_sheet.dart';
import 'package:drevvy_app/features/shop/widgets/live_discover_vdp.dart';
import 'package:drevvy_app/features/shop/widgets/vdp_cta_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _live = PurchaseConfig(
  apiBaseUrl: 'https://api.drevvy.com',
  mode: DrevvyDataMode.live,
);

const _listing = Listing(
  id: 'live_civic',
  vin: '1HGCV1F16LA000111',
  price: 18990,
  build: ListingBuild(year: 2020, make: 'Honda', model: 'Civic'),
  media: ListingMedia(photoLinks: []),
);

const _inNetworkBody = {
  'success': true,
  'data': {
    'state': 'in_network',
    'ctas': [
      {
        'kind': 'dealer_conversation',
        'keyCost': 1,
        'endpoint': '/api/consumer/keys/conversation',
      },
    ],
  },
};

const _dealRow = {
  'id': 'deal_list_1',
  'listingId': 'live_civic',
  'status': 'interested',
  'endState': 'open',
  'createdAt': '2026-11-22T12:00:00.000Z',
  'shopperLastName': 'Wilson',
  'phone': '555-0100',
  'email': 'dana@example.com',
  'vehicle': {'year': 2020, 'make': 'Honda', 'model': 'Civic', 'price': 18990},
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ShopperSession? previousSession;

  setUp(() {
    previousSession = ShopperSessionStore.instance.session;
    ShopperSessionStore.instance.session = const ShopperSession(
      accessToken: 'shopper-jwt',
      consumerUserId: 'user_1',
    );
  });

  tearDown(() {
    ShopperSessionStore.instance.session = previousSession;
  });

  test('poll wait doubles after a miss and resets after a hit', () {
    const base = Duration(seconds: 4);
    const max = Duration(seconds: 30);
    final once = nextDealPollDelay(
      base,
      failed: true,
      base: base,
      max: max,
    );
    expect(once, const Duration(seconds: 8));
    final capped = nextDealPollDelay(
      const Duration(seconds: 16),
      failed: true,
      base: base,
      max: max,
    );
    expect(capped, max);
    expect(
      nextDealPollDelay(capped, failed: false, base: base, max: max),
      base,
    );
  });

  testWidgets('classified in-network shows the chat key, not the free ask', (
    tester,
  ) async {
    final match = RooftopMatch.parseNetworkResponse(_inNetworkBody);
    expect(match.rooftopId, isNull);
    expect(match.isInNetwork, isTrue);

    await tester.pumpWidget(
      _frame(
        VdpCtaBar(
          listing: _listing,
          creditBalance: const CarCreditBalance.withBalance(2),
          match: match,
          marketIntelUnlocked: false,
          conversationOpen: false,
          otdRequested: false,
          onMarketIntel: () {},
          onConversation: () {},
          onOtdRequest: () {},
        ),
      ),
    );

    expect(find.text(KeySpend.conversationCta), findsOneWidget);
    expect(find.text(KeySpend.otdRequestCta), findsNothing);
  });

  testWidgets('live detail shows Ask only for a verified in-network dealer', (
    tester,
  ) async {
    final inNetwork = RooftopMatch.parseNetworkResponse(_inNetworkBody);
    final offNetwork = RooftopMatch.parseNetworkResponse(const {
      'success': true,
      'data': {'state': 'off_network', 'ctas': []},
    });

    await tester.pumpWidget(
      _frame(
        LiveDiscoverVdp(
          isLoading: false,
          listing: _listing,
          errorMessage: null,
          onRetry: () {},
          network: inNetwork,
          onAskDealer: () {},
        ),
      ),
    );
    await tester.scrollUntilVisible(
      find.byKey(const Key('ask-this-dealer')),
      200,
    );
    expect(find.text(KeySpend.conversationCta), findsOneWidget);
    expect(find.byKey(const Key('ask-for-whole-price')), findsNothing);
    expect(find.textContaining('Dealer chat is not opened'), findsNothing);

    await tester.pumpWidget(
      _frame(
        LiveDiscoverVdp(
          isLoading: false,
          listing: _listing,
          errorMessage: null,
          onRetry: () {},
          network: offNetwork,
          onOtdRequest: () {},
        ),
      ),
    );
    await tester.scrollUntilVisible(
      find.byKey(const Key('ask-for-whole-price')),
      200,
    );
    expect(find.text(KeySpend.otdRequestCta), findsOneWidget);
    expect(find.byKey(const Key('ask-this-dealer')), findsNothing);

    await tester.pumpWidget(
      _frame(
        LiveDiscoverVdp(
          isLoading: false,
          listing: _listing,
          errorMessage: null,
          onRetry: () {},
          network: const RooftopMatch.unavailable(),
        ),
      ),
    );
    await tester.scrollUntilVisible(
      find.textContaining('Dealer chat is not opened'),
      200,
    );
    expect(find.byKey(const Key('ask-this-dealer')), findsNothing);
    expect(find.byKey(const Key('ask-for-whole-price')), findsNothing);
  });

  testWidgets('Ask posts the car snapshot and opens that deal chat', (
    tester,
  ) async {
    final requests = <http.Request>[];
    final repo = _repo(
      requests: requests,
      handler: (request) async {
        if (request.url.path.endsWith('/listings/network')) {
          return _json(200, _inNetworkBody);
        }
        if (request.method == 'POST' && request.url.path.endsWith('/deals')) {
          return _json(200, {
            'success': true,
            'data': {'id': 'deal_live_1'},
            'credits': {'balance': 2},
            'match': {
              'rooftopId': 'secret-rooftop',
              'shopperFirstName': 'Dana Wilson',
            },
          });
        }
        return _json(500, {'success': false});
      },
    );

    await _pumpVdp(tester, repo);
    await tester.scrollUntilVisible(
      find.byKey(const Key('ask-this-dealer')),
      200,
    );
    await tester.tap(find.byKey(const Key('ask-this-dealer')));
    await tester.pumpAndSettle();

    final create = requests.singleWhere(
      (request) =>
          request.method == 'POST' && request.url.path.endsWith('/deals'),
    );
    final body = jsonDecode(create.body) as Map<String, dynamic>;
    expect(body.keys.toSet(), {'listingId', 'vehicle'});
    expect(body['listingId'], 'live_civic');
    expect(
      (body['vehicle'] as Map).cast<String, dynamic>().keys.toSet(),
      {'year', 'make', 'model', 'price'},
    );
    expect(body['vehicle'], {
      'year': 2020,
      'make': 'Honda',
      'model': 'Civic',
      'price': 18990,
    });
    expect(create.headers['Authorization'], 'Bearer shopper-jwt');
    expect(find.text('opened deal_live_1'), findsOneWidget);
    expect(find.textContaining('Dana Wilson'), findsNothing);
    expect(find.textContaining('secret-rooftop'), findsNothing);
    expect(find.textContaining('555'), findsNothing);
    expect((await repo.getCreditBalance()).balance, 2);
  });

  testWidgets('an off-network refusal keeps the key and uses plain copy', (
    tester,
  ) async {
    final repo = _repo(
      initialBalance: const CarCreditBalance.withBalance(4),
      handler: (request) async {
        if (request.url.path.endsWith('/listings/network')) {
          return _json(200, _inNetworkBody);
        }
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {
              'code': 'off_network',
              'message': 'Call Dana Wilson at 555-0199 dana@dealer.test',
            },
          }),
          409,
        );
      },
    );

    await _pumpVdp(tester, repo);
    await tester.scrollUntilVisible(
      find.byKey(const Key('ask-this-dealer')),
      200,
    );
    await tester.tap(find.byKey(const Key('ask-this-dealer')));
    await tester.pumpAndSettle();

    expect(
      find.text('This dealer is not on Drevvy. Your key was not used.'),
      findsOneWidget,
    );
    expect(find.textContaining('Dana'), findsNothing);
    expect(find.textContaining('555'), findsNothing);
    expect(find.textContaining('dana@'), findsNothing);
    expect((await repo.getCreditBalance()).balance, 4);
    expect(repo.lastConversationNotice, DealerConversationNotice.offNetwork);
  });

  testWidgets('no keys opens the pack sheet once and does not post again', (
    tester,
  ) async {
    var creates = 0;
    final repo = _repo(
      initialBalance: const CarCreditBalance.withBalance(3),
      handler: (request) async {
        if (request.url.path.endsWith('/listings/network')) {
          return _json(200, _inNetworkBody);
        }
        creates += 1;
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {'code': 'no_credits', 'message': 'buy a pack'},
          }),
          402,
        );
      },
    );

    await _pumpVdp(tester, repo);
    await tester.scrollUntilVisible(
      find.byKey(const Key('ask-this-dealer')),
      200,
    );
    await tester.tap(find.byKey(const Key('ask-this-dealer')));
    await tester.pumpAndSettle();

    expect(creates, 1);
    expect(find.text(KeySpend.packHeadline), findsOneWidget);
    expect(find.textContaining('buy a pack'), findsNothing);
    expect((await repo.getCreditBalance()).balance, 3);
  });

  testWidgets('a dropped connection says to try again', (tester) async {
    final repo = _repo(
      initialBalance: const CarCreditBalance.withBalance(4),
      handler: (request) async {
        if (request.url.path.endsWith('/listings/network')) {
          return _json(200, _inNetworkBody);
        }
        throw http.ClientException('offline');
      },
    );

    await _pumpVdp(tester, repo);
    await tester.scrollUntilVisible(
      find.byKey(const Key('ask-this-dealer')),
      200,
    );
    await tester.tap(find.byKey(const Key('ask-this-dealer')));
    await tester.pumpAndSettle();

    expect(
      find.text('Drevvy could not reach the dealer. Try again.'),
      findsOneWidget,
    );
    expect((await repo.getCreditBalance()).balance, 4);
  });

  testWidgets('Deals loads the server list and a tap opens chat', (
    tester,
  ) async {
    final repo = _repo(
      handler: (request) async {
        expect(request.method, 'GET');
        expect(request.body, isEmpty);
        return _json(200, {
          'success': true,
          'data': [_dealRow],
          'credits': {'balance': 6},
        });
      },
    );
    final router = GoRouter(
      initialLocation: '/deals',
      routes: [
        GoRoute(
          path: '/deals',
          builder: (_, _) => DealsScreen(repository: repo),
        ),
        GoRoute(
          path: '/deals/:dealId/chat',
          builder: (_, state) =>
              Text('opened ${state.pathParameters['dealId']}'),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp.router(
          theme: drevvyTheme(Brightness.light),
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('2020 Honda Civic'), findsOneWidget);
    expect(find.textContaining('Wilson'), findsNothing);
    expect(find.textContaining('555-0100'), findsNothing);
    expect(find.textContaining('dana@'), findsNothing);
    await tester.tap(find.text('2020 Honda Civic'));
    await tester.pumpAndSettle();
    expect(find.text('opened deal_list_1'), findsOneWidget);
  });

  testWidgets('a server thread sends one line and polls while it is visible', (
    tester,
  ) async {
    var messageGets = 0;
    http.Request? posted;
    final repo = _repo(
      handler: (request) async {
        if (request.method == 'GET' && request.url.path == '/api/consumer/deals') {
          return _json(200, {
            'success': true,
            'data': [_dealRow],
          });
        }
        if (request.method == 'GET' && request.url.path.endsWith('/messages')) {
          messageGets += 1;
          expect(request.body, isEmpty);
          final salesperson = messageGets > 1;
          return _json(200, {
            'success': true,
            'data': {
              'shopperFirstName': 'Dana Wilson',
              'messages': [
                {
                  'author': 'shopper',
                  'kind': 'chat',
                  'body': 'Is the price firm?',
                  'phone': '555-0100',
                },
                if (salesperson)
                  {
                    'author': 'salesperson',
                    'kind': 'chat',
                    'body': 'We can do 18000.',
                    'email': 'dana@dealer.test',
                  },
              ],
            },
          });
        }
        if (request.method == 'POST' && request.url.path.endsWith('/messages')) {
          posted = request;
          return _json(200, {
            'success': true,
            'data': {
              'shopperFirstName': 'Dana Wilson',
              'messages': [
                {
                  'author': 'shopper',
                  'kind': 'chat',
                  'body': 'Is the price firm?',
                },
              ],
            },
          });
        }
        return _json(500, {'success': false});
      },
    );
    final nav = GlobalKey<NavigatorState>();
    await tester.pumpWidget(
      MaterialApp(
        navigatorKey: nav,
        theme: drevvyTheme(Brightness.light),
        home: DealChatScreen(
          dealId: 'deal_list_1',
          repository: repo,
          pollInterval: const Duration(milliseconds: 80),
          maxPollInterval: const Duration(milliseconds: 200),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Is the price firm?'), findsOneWidget);
    expect(find.text('Salesperson'), findsNothing);
    expect(find.textContaining('Dana Wilson'), findsNothing);
    expect(messageGets, 1);

    await tester.enterText(
      find.byKey(const Key('deal-chat-composer')),
      'Is the price firm?',
    );
    await tester.tap(find.byKey(const Key('deal-chat-send')));
    await tester.pump();
    await tester.pump();

    expect(posted, isNotNull);
    final body = jsonDecode(posted!.body) as Map<String, dynamic>;
    expect(body.keys.toSet(), {'body'});
    expect(body['body'], 'Is the price firm?');
    expect(posted!.headers['Authorization'], 'Bearer shopper-jwt');

    nav.currentState!.push(
      MaterialPageRoute<void>(
        builder: (_) => const Scaffold(body: Text('covered')),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(messageGets, 1);
    expect(find.text('covered'), findsOneWidget);

    nav.currentState!.pop();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(messageGets, 2);
    expect(find.text('Salesperson'), findsOneWidget);
    expect(find.text('We can do 18000.'), findsOneWidget);
    expect(find.textContaining('dana@'), findsNothing);
    expect(find.textContaining('555'), findsNothing);
  });

  testWidgets('live chat hides the dealer inbox preview', (tester) async {
    await tester.pumpWidget(
      _frame(
        DealerChatSheet(
          listing: _listing,
          match: RooftopMatch.parseNetworkResponse(_inNetworkBody),
          creditBalance: const CarCreditBalance.withBalance(2),
          alreadyOpen: true,
          shopperFirstName: 'Dana Wilson',
          showInboxStub: false,
          onSend: ({templateId, message}) async {},
        ),
      ),
    );

    expect(find.text('Dealer inbox preview'), findsNothing);
    expect(find.text('Dana Wilson'), findsNothing);
  });
}

DemoRepository _repo({
  required Future<http.Response> Function(http.Request request) handler,
  CarCreditBalance? initialBalance,
  List<http.Request>? requests,
}) {
  return DemoRepository(
    config: _live,
    httpClient: MockClient((request) async {
      requests?.add(request);
      return handler(request);
    }),
    networkDelay: Duration.zero,
    initialBalance: initialBalance,
  );
}

http.Response _json(int status, Object body) {
  return http.Response(jsonEncode(body), status);
}

Widget _frame(Widget child) {
  return MaterialApp(
    theme: drevvyTheme(Brightness.light),
    home: Scaffold(body: child),
  );
}

Future<void> _pumpVdp(WidgetTester tester, DemoRepository repo) async {
  tester.view.physicalSize = const Size(800, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final flags = MemoryFlags();
  await flags.setBool(PushFlags.prompted, true);
  final router = GoRouter(
    initialLocation: '/car',
    routes: [
      GoRoute(
        path: '/car',
        builder: (_, _) => VdpScreen(
          listingId: 'live_civic',
          discoverConfig: const DiscoverConfig(apiBaseUrl: 'https://api.drevvy.com'),
          discoverCatalog: _Catalog(_listing),
          repository: repo,
        ),
      ),
      GoRoute(
        path: '/deals/:dealId/chat',
        builder: (_, state) => Text('opened ${state.pathParameters['dealId']}'),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        notificationPromptProvider.overrideWith(
          (ref) => NotificationPromptGate(flags: flags),
        ),
      ],
      child: MaterialApp.router(
        theme: drevvyTheme(Brightness.light),
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

class _Catalog implements DiscoverCatalog {
  _Catalog(this.detail);

  final Listing detail;

  @override
  Future<Listing> listing(String id) async => detail;

  @override
  Future<DiscoverPage> search({
    required ShopLocation location,
    required DiscoverFilters filters,
    int page = 1,
  }) {
    throw UnimplementedError();
  }
}

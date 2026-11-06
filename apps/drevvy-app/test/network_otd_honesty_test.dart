import 'dart:async';
import 'dart:convert';

import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/rooftop_match.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/key_spend_endpoint.dart';
import 'package:drevvy_app/data/services/otd_request_client.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/rooftop_match_endpoint.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:drevvy_app/features/onboarding/matters_v5.dart';
import 'package:drevvy_app/features/onboarding/screens/create_account_screen.dart';
import 'package:drevvy_app/features/shop/widgets/account_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _live = PurchaseConfig(
  apiBaseUrl: 'https://api.drevvy.com',
  mode: DrevvyDataMode.live,
);

void main() {
  Map<String, dynamic> stateBody(
    String state, {
    List<Map<String, Object>>? ctas,
  }) {
    return {
      'success': true,
      'data': {'state': state, 'ctas': ctas ?? <Map<String, Object>>[]},
    };
  }

  const verifiedCtas = <Map<String, Object>>[
    {
      'kind': 'market_intel',
      'keyCost': 1,
      'endpoint': '/api/consumer/keys/market-save',
    },
    {
      'kind': 'dealer_conversation',
      'keyCost': 1,
      'endpoint': '/api/consumer/keys/conversation',
    },
  ];

  test('verified in_network classifies without a rooftop id or send', () {
    final match = RooftopMatch.parseNetworkResponse(
      stateBody('in_network', ctas: verifiedCtas),
    );
    expect(match.source, RooftopMatchSource.live);
    expect(match.classifiedInNetwork, isTrue);
    expect(match.isInNetwork, isFalse);
    expect(match.rooftopId, isNull);
    expect(match.vdpUrl, isNull);
  });

  test(
    'in_network without the verified conversation cta stays unavailable',
    () {
      final match = RooftopMatch.parseNetworkResponse(stateBody('in_network'));
      expect(match.source, RooftopMatchSource.unavailable);
      expect(match.classifiedInNetwork, isFalse);
      expect(match.rooftopId, isNull);
    },
  );

  test('explicit off_network classifies and does not carry a dealer URL', () {
    final match = RooftopMatch.parseNetworkResponse(
      stateBody(
        'off_network',
        ctas: const [
          {
            'kind': 'off_network_otd_request',
            'keyCost': 0,
            'endpoint': '/api/consumer/otd-requests',
          },
        ],
      ),
    );
    expect(match.source, RooftopMatchSource.live);
    expect(match.classifiedOffNetwork, isTrue);
    expect(match.isInNetwork, isFalse);
    expect(match.rooftopId, isNull);
    expect(match.vdpUrl, isNull);
  });

  test('a misleading cta does not reclassify identity_unavailable', () {
    final match = RooftopMatch.parseNetworkResponse(
      stateBody(
        'identity_unavailable',
        ctas: const [
          {
            'kind': 'off_network_otd_request',
            'keyCost': 0,
            'endpoint': '/api/consumer/otd-requests',
          },
          {
            'kind': 'dealer_conversation',
            'keyCost': 1,
            'endpoint': '/api/consumer/keys/conversation',
          },
        ],
      ),
    );
    expect(match.source, RooftopMatchSource.unavailable);
    expect(match.classifiedOffNetwork, isFalse);
    expect(match.classifiedInNetwork, isFalse);
  });

  test('identity_unavailable and unknown stay unavailable', () {
    for (final state in ['identity_unavailable', 'unknown', 'IN_NETWORK', '']) {
      final match = RooftopMatch.parseNetworkResponse(stateBody(state));
      expect(match.source, RooftopMatchSource.unavailable, reason: state);
      expect(match.classifiedOffNetwork, isFalse, reason: state);
      expect(match.classifiedInNetwork, isFalse, reason: state);
    }
  });

  test('a missing state stays unavailable, including a legacy null match', () {
    final bodies = [
      {
        'success': true,
        'data': {'network': 'off_network', 'match': null, 'ctas': []},
      },
      {
        'success': true,
        'data': {
          'network': 'in_network',
          'match': {'rooftopId': 'rt_guessed'},
        },
      },
      {'success': true, 'data': {}},
      {
        'success': false,
        'error': {'code': 'bad', 'message': 'no'},
      },
      {'data': 'nope'},
      <String, dynamic>{},
    ];
    for (final body in bodies) {
      final match = RooftopMatch.parseNetworkResponse(body);
      expect(match.source, RooftopMatchSource.unavailable);
      expect(match.rooftopId, isNull);
      expect(match.classifiedInNetwork, isFalse);
      expect(match.classifiedOffNetwork, isFalse);
    }
  });

  test(
    'the OTD client posts listing id and URL and reads the receipt',
    () async {
      late Map<String, dynamic> body;
      final sessions = ShopperSessionStore()
        ..session = const ShopperSession(accessToken: 'shopper-jwt');
      final client = OtdRequestClient(
        baseUrl: 'https://api.drevvy.com',
        sessionStore: sessions,
        client: MockClient((request) async {
          expect(request.method, 'POST');
          expect(request.url.path, '/api/consumer/otd-requests');
          expect(request.headers['authorization'], 'Bearer shopper-jwt');
          body = jsonDecode(request.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({
              'success': true,
              'created': true,
              'data': {
                'id': 'otd-1',
                'userId': 'user-9',
                'listingId': 'mc-listing-1',
                'listingUrl': 'https://www.cars.com/vehicledetail/9',
                'dealerDomain': 'cars.com',
                'marketcheckDealerId': null,
                'createdAt': '2026-11-05T12:00:00.000Z',
              },
            }),
            200,
          );
        }),
      );

      final receipt = await client.submit(
        listingId: 'mc-listing-1',
        listingUrl: 'https://www.cars.com/vehicledetail/9',
      );

      expect(body.keys.toSet(), {'listingId', 'listingUrl'});
      expect(body['listingId'], 'mc-listing-1');
      expect(receipt.id, 'otd-1');
      expect(receipt.created, isTrue);
      expect(receipt.dealerDomain, 'cars.com');
    },
  );

  test('an OTD error is not a saved request', () async {
    final sessions = ShopperSessionStore()
      ..session = const ShopperSession(accessToken: 'shopper-jwt');
    final client = OtdRequestClient(
      baseUrl: 'https://api.drevvy.com',
      sessionStore: sessions,
      client: MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {
              'code': 'in_network',
              'message': 'This rooftop is on Drevvy.',
            },
          }),
          409,
        );
      }),
    );

    expect(
      () => client.submit(listingId: 'mc-listing-1'),
      throwsA(
        isA<OtdRequestException>()
            .having((error) => error.status, 'status', 409)
            .having((error) => error.code, 'code', 'in_network')
            .having(
              (error) => error.message,
              'message',
              'This rooftop is on Drevvy.',
            ),
      ),
    );
  });

  test('live Ask does not answer with the demo paragraph', () async {
    final repo = DemoRepository(config: _live, networkDelay: Duration.zero);
    final thread = await repo.sendMessage('Is the RAV4 a fair price?');
    expect(thread.messages.last.text, DemoRepository.askUnavailableMessage);
    expect(thread.messages.last.text, isNot(contains('214')));
    expect(thread.sourcesCount, isNull);
    expect(await repo.getChatHistory(), isEmpty);
    expect(mattersMarketIntelSampleBadge, contains('Sample'));
  });

  test('live OTD submission does not call the network', () async {
    var called = false;
    final repo = DemoRepository(
      config: _live,
      networkDelay: Duration.zero,
      keySpend: _CountingSpend(() => called = true),
    );
    const listing = Listing(
      id: 'mc-listing-1',
      vin: '1HGCV1F16LA000111',
      price: 18990,
      build: ListingBuild(year: 2020, make: 'Honda', model: 'Civic'),
      media: ListingMedia(photoLinks: []),
    );
    expect(await repo.requestOtdNumber(listing, note: 'please'), isFalse);
    expect(called, isFalse);
    expect(repo.hasRequestedOtd(listing.id), isFalse);
  });

  testWidgets('email continue does not present itself as sign-in', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: drevvyTheme(Brightness.light),
          home: const CreateAccountScreen(),
        ),
      ),
    );
    expect(find.text('Email sign-in is not available.'), findsOneWidget);
    expect(find.text('Continue with email'), findsNothing);
    expect(find.text('Continue with Apple'), findsOneWidget);
  });

  testWidgets('delete account does not claim the account was deleted', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: drevvyTheme(Brightness.light),
        home: const Scaffold(body: AccountSheet()),
      ),
    );
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 500));
    }
    await tester.scrollUntilVisible(find.text('Delete account'), 200);
    await tester.tap(find.text('Delete account'));
    await tester.pumpAndSettle();
    expect(find.text('Account deletion is not available.'), findsOneWidget);
    expect(find.textContaining('Account deleted'), findsNothing);
    expect(find.text('permanently delete'), findsNothing);
  });

  const networkListing = Listing(
    id: 'mc-listing-1',
    vin: '1HGCV1F16LA000111',
    price: 18990,
    vdpUrl: 'https://www.cars.com/vehicledetail/9',
    build: ListingBuild(year: 2020, make: 'Honda', model: 'Civic'),
    media: ListingMedia(photoLinks: []),
  );

  HttpRooftopMatchEndpoint holdingEndpoint({
    required ShopperSessionStore sessions,
    required Completer<void> gate,
    required Map<String, dynamic> body,
    void Function(Map<String, dynamic> sent)? onBody,
  }) {
    return HttpRooftopMatchEndpoint(
      baseUrl: 'https://api.drevvy.com',
      sessionStore: sessions,
      client: MockClient((request) async {
        onBody?.call(jsonDecode(request.body) as Map<String, dynamic>);
        await gate.future;
        return http.Response(jsonEncode(body), 200);
      }),
    );
  }

  test(
    'a sign-out during network lookup drops the old classification',
    () async {
      final sessions = ShopperSessionStore()
        ..session = const ShopperSession(
          accessToken: 'jwt-a',
          consumerUserId: 'user-a',
        );
      final gate = Completer<void>();
      final endpoint = holdingEndpoint(
        sessions: sessions,
        gate: gate,
        body: stateBody('in_network', ctas: verifiedCtas),
      );
      final pending = endpoint.match(networkListing);
      sessions.session = null;
      gate.complete();
      final match = await pending;
      expect(match.source, RooftopMatchSource.unavailable);
      expect(match.classifiedInNetwork, isFalse);
    },
  );

  test(
    'an account switch during network lookup drops the old classification',
    () async {
      final sessions = ShopperSessionStore()
        ..session = const ShopperSession(
          accessToken: 'jwt-a',
          consumerUserId: 'user-a',
        );
      final gate = Completer<void>();
      late Map<String, dynamic> sent;
      final endpoint = holdingEndpoint(
        sessions: sessions,
        gate: gate,
        body: stateBody('off_network'),
        onBody: (body) => sent = body,
      );
      final pending = endpoint.match(networkListing);
      sessions.session = const ShopperSession(
        accessToken: 'jwt-b',
        consumerUserId: 'user-b',
      );
      gate.complete();
      final match = await pending;
      expect(sent.keys.toSet(), {'listingId'});
      expect(match.source, RooftopMatchSource.unavailable);
      expect(match.classifiedOffNetwork, isFalse);
    },
  );

  test('a late network match does not land on the next account', () async {
    final store = ShopperSessionStore.instance;
    final previousIdentity = store.onIdentityChanged;
    final previousCleared = store.onSessionCleared;
    store.session = null;
    final hold = _HoldMatch(
      const RooftopMatch(
        matched: true,
        source: RooftopMatchSource.live,
        networkState: RooftopNetworkState.inNetwork,
      ),
    );
    final repo = DemoRepository(
      config: _live,
      rooftopMatch: hold,
      networkDelay: const Duration(milliseconds: 30),
    );
    store.onIdentityChanged = repo.noteSignedInIdentity;
    store.onSessionCleared = repo.clearSignedInState;
    store.session = const ShopperSession(
      accessToken: 'jwt-a',
      consumerUserId: 'user-a',
    );
    addTearDown(() {
      store.onIdentityChanged = previousIdentity;
      store.onSessionCleared = previousCleared;
      store.session = null;
    });

    final pending = repo.getRooftopMatch(networkListing);
    await Future<void>.delayed(Duration.zero);
    store.session = const ShopperSession(
      accessToken: 'jwt-b',
      consumerUserId: 'user-b',
    );
    hold.gate.complete();
    final match = await pending;
    expect(match.source, RooftopMatchSource.unavailable);
    expect(match.classifiedInNetwork, isFalse);

    hold.gate = Completer<void>()..complete();
    final current = await repo.getRooftopMatch(networkListing);
    expect(current.classifiedInNetwork, isTrue);
    expect(current.isInNetwork, isFalse);
  });
}

class _HoldMatch extends RooftopMatchEndpoint {
  _HoldMatch(this.result);

  final RooftopMatch result;
  Completer<void> gate = Completer<void>();

  @override
  Future<RooftopMatch> match(Listing listing) async {
    await gate.future;
    return result;
  }
}

class _CountingSpend implements KeySpendEndpoint {
  _CountingSpend(this.onCall);

  final void Function() onCall;

  @override
  Future<KeySpendResult> requestOtdNumber(
    Listing listing, {
    String? note,
  }) async {
    onCall();
    return const KeySpendResult.blocked('called');
  }

  @override
  Future<KeySpendResult> spendMarketSave(Listing listing) async {
    onCall();
    return const KeySpendResult.blocked('called');
  }

  @override
  Future<KeySpendResult> startConversation({
    required Listing listing,
    required RooftopMatch match,
    String? templateId,
    String? message,
  }) async {
    onCall();
    return const KeySpendResult.blocked('called');
  }
}

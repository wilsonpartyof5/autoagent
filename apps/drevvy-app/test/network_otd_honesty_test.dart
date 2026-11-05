import 'dart:convert';

import 'package:drevvy_app/core/config/drevvy_api_config.dart';
import 'package:drevvy_app/core/theme/drevvy_theme.dart';
import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/rooftop_match.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/key_spend_endpoint.dart';
import 'package:drevvy_app/data/services/otd_request_client.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
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
  test('an in-network body without a rooftop id stays unavailable', () {
    final match = RooftopMatch.parseNetworkResponse({
      'success': true,
      'data': {'network': 'in_network', 'match': null},
    }, suppliedListingUrl: false);
    expect(match.source, RooftopMatchSource.unavailable);
    expect(match.rooftopId, isNull);
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

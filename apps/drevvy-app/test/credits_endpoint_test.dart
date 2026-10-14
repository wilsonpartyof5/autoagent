import 'dart:convert';

import 'package:drevvy_app/data/services/credits_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('empty base URL does not call the network', () {
    expect(
      CreditsEndpoint.fromConfig(const PurchaseConfig()),
      isA<MissingCreditsEndpoint>(),
    );
  });

  test('sends the shopper bearer token and lets the server decide credits', () async {
    final requests = <http.Request>[];
    final client = MockClient((request) async {
      requests.add(request);
      if (request.url.path.endsWith('/restore')) {
        return http.Response(
          jsonEncode({
            'balance': 8,
            'lifetimePurchased': 10,
            'lifetimeUsed': 3,
            'lifetimeRefunded': 1,
          }),
          200,
        );
      }
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {
            'balance': 10,
            'lifetimePurchased': 10,
            'lifetimeUsed': 0,
            'lifetimeRefunded': 0,
          },
        }),
        200,
      );
    });
    final session = ShopperSessionStore()
      ..save(const ShopperSession(accessToken: 'shopper-jwt'));
    final endpoint = HttpCreditsEndpoint(
      baseUrl: 'https://api.drevvy.com/',
      client: client,
      sessionStore: session,
    );

    final balance = await endpoint.grantPurchase(
      productId: 'drevvy_pack_10',
      transactionId: 'txn_10',
    );
    expect(balance?.balance, 10);
    expect(balance?.totalPurchased, 10);
    expect(balance?.totalSpent, 0);
    expect(balance?.totalRefunded, 0);
    expect(requests.single.headers['Authorization'], 'Bearer shopper-jwt');
    expect(requests.single.url.path, '/api/consumer/credits');
    expect(jsonDecode(requests.single.body), {
      'productId': 'drevvy_pack_10',
      'transactionId': 'txn_10',
    });

    final restored = await endpoint.restorePurchases(transactionIds: const ['txn_10']);
    expect(restored?.balance, 8);
    expect(restored?.totalPurchased, 10);
    expect(restored?.totalSpent, 3);
    expect(restored?.totalRefunded, 1);
    expect(requests.last.headers['Authorization'], 'Bearer shopper-jwt');
    expect(jsonDecode(requests.last.body), {
      'transactionIds': ['txn_10'],
    });
  });

  test('accepts the previous balance field names', () async {
    final endpoint = HttpCreditsEndpoint(
      baseUrl: 'https://api.drevvy.com',
      sessionStore: ShopperSessionStore()
        ..save(const ShopperSession(accessToken: 'shopper-jwt')),
      client: MockClient(
        (request) async => http.Response(
          jsonEncode({
            'balance': 4,
            'totalPurchased': 6,
            'totalSpent': 2,
            'totalRefunded': 1,
          }),
          200,
        ),
      ),
    );

    final balance = await endpoint.grantPurchase(
      productId: 'drevvy_pack_5',
      transactionId: 'txn_5',
    );
    expect(balance?.balance, 4);
    expect(balance?.totalPurchased, 6);
    expect(balance?.totalSpent, 2);
    expect(balance?.totalRefunded, 1);
  });

  test('a missing credits route keeps the caller on the local balance', () async {
    final endpoint = HttpCreditsEndpoint(
      baseUrl: 'https://api.drevvy.com',
      sessionStore: ShopperSessionStore(),
      client: MockClient((request) async => http.Response('missing', 404)),
    );
    expect(
      await endpoint.restorePurchases(transactionIds: const ['txn_10']),
      isNull,
    );
  });

  test('a failed request keeps the caller on the local balance', () async {
    final endpoint = HttpCreditsEndpoint(
      baseUrl: 'https://api.drevvy.com',
      sessionStore: ShopperSessionStore()
        ..save(const ShopperSession(accessToken: 'shopper-jwt')),
      client: MockClient((request) async => http.Response('nope', 500)),
    );
    expect(
      await endpoint.grantPurchase(
        productId: 'drevvy_pack_5',
        transactionId: 'txn_5',
      ),
      isNull,
    );
  });
}

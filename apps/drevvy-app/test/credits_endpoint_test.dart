import 'dart:convert';

import 'package:drevvy_app/data/services/credits_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
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

  test('parses a credits balance and treats 404 as absent', () async {
    final requests = <http.Request>[];
    final client = MockClient((request) async {
      requests.add(request);
      if (request.url.path.endsWith('/restore')) {
        return http.Response('missing', 404);
      }
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {
            'balance': 10,
            'totalPurchased': 10,
            'totalSpent': 0,
            'totalRefunded': 0,
          },
        }),
        200,
      );
    });
    final endpoint = HttpCreditsEndpoint(
      baseUrl: 'https://api.drevvy.com/',
      client: client,
    );

    final balance = await endpoint.grantPurchase(
      productId: 'drevvy_pack_10',
      credits: 10,
      transactionId: 'txn_10',
    );
    expect(balance?.balance, 10);
    expect(requests.single.url.path, '/api/consumer/credits');
    expect(jsonDecode(requests.single.body), {
      'productId': 'drevvy_pack_10',
      'credits': 10,
      'transactionId': 'txn_10',
      'reason': 'purchase',
    });

    expect(
      await endpoint.restorePurchases(transactionIds: const ['txn_10']),
      isNull,
    );
  });

  test('a failed request keeps the caller on the local balance', () async {
    final endpoint = HttpCreditsEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: MockClient((request) async => http.Response('nope', 500)),
    );
    expect(
      await endpoint.grantPurchase(
        productId: 'drevvy_pack_5',
        credits: 5,
        transactionId: 'txn_5',
      ),
      isNull,
    );
  });
}

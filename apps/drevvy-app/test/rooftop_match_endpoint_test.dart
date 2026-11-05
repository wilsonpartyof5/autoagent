import 'dart:convert';

import 'package:drevvy_app/data/models/listing.dart';
import 'package:drevvy_app/data/models/rooftop_match.dart';
import 'package:drevvy_app/data/services/key_spend_endpoint.dart';
import 'package:drevvy_app/data/services/purchase_config.dart';
import 'package:drevvy_app/data/services/rooftop_match_endpoint.dart';
import 'package:drevvy_app/data/services/shopper_session_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  const rav4 = Listing(
    id: 'listing_001',
    vin: 'VIN',
    price: 1,
    build: ListingBuild(year: 2024, make: 'Toyota', model: 'RAV4'),
    media: ListingMedia(photoLinks: []),
  );
  const crv = Listing(
    id: 'listing_002',
    vin: 'VIN2',
    price: 1,
    build: ListingBuild(year: 2024, make: 'Honda', model: 'CR-V'),
    media: ListingMedia(photoLinks: []),
  );

  test('stub treats RAV4 and Tacoma as in-network', () {
    expect(StubRooftopMatchEndpoint.stubFor(rav4).isInNetwork, isTrue);
    expect(StubRooftopMatchEndpoint.stubFor(crv).isInNetwork, isFalse);
  });

  test('empty API base URL uses the stub', () {
    expect(
      RooftopMatchEndpoint.fromConfig(const PurchaseConfig()),
      isA<StubRooftopMatchEndpoint>(),
    );
    expect(
      KeySpendEndpoint.fromConfig(const PurchaseConfig()),
      isA<MissingKeySpendEndpoint>(),
    );
  });

  test('live network posts the listing id and reads the rooftop id', () async {
    late Map<String, dynamic> body;
    final sessions = ShopperSessionStore()
      ..session = const ShopperSession(accessToken: 'shopper-token');
    final client = MockClient((request) async {
      expect(request.method, 'POST');
      expect(request.url.path, '/api/consumer/listings/network');
      expect(request.headers['authorization'], 'Bearer shopper-token');
      body = jsonDecode(request.body) as Map<String, dynamic>;
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {
            'network': 'in_network',
            'match': {
              'method': 'marketcheck_dealer_id',
              'rooftopId': 'rt_1',
              'channel': 'in_app_message',
              'shopperKnown': true,
            },
            'ctas': [],
          },
        }),
        200,
      );
    });
    final endpoint = HttpRooftopMatchEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: client,
      sessionStore: sessions,
    );
    final match = await endpoint.match(rav4);
    expect(body.containsKey('listingUrl'), isFalse);
    expect(body['listingId'], 'listing_001');
    expect(match.isInNetwork, isTrue);
    expect(match.rooftopId, 'rt_1');
    expect(match.vdpUrl, isNull);
    expect(match.source, RooftopMatchSource.live);
  });

  test('a listing-id-only off-network body stays unavailable', () async {
    final sessions = ShopperSessionStore()
      ..session = const ShopperSession(accessToken: 'shopper-token');
    final endpoint = HttpRooftopMatchEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {'network': 'off_network', 'match': null, 'ctas': []},
          }),
          200,
        );
      }),
      sessionStore: sessions,
    );
    final match = await endpoint.match(rav4);
    expect(match.source, RooftopMatchSource.unavailable);
    expect(match.isInNetwork, isFalse);
    expect(match.rooftopId, isNull);
  });

  test('a real listing URL can confirm off-network', () async {
    late Map<String, dynamic> body;
    const withUrl = Listing(
      id: 'listing_002',
      vin: 'VIN2',
      price: 1,
      vdpUrl: 'https://www.cars.com/vehicledetail/x',
      build: ListingBuild(year: 2024, make: 'Honda', model: 'CR-V'),
      media: ListingMedia(photoLinks: []),
    );
    final sessions = ShopperSessionStore()
      ..session = const ShopperSession(accessToken: 'shopper-token');
    final endpoint = HttpRooftopMatchEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: MockClient((request) async {
        body = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {'network': 'off_network', 'match': null, 'ctas': []},
          }),
          200,
        );
      }),
      sessionStore: sessions,
    );
    final match = await endpoint.match(withUrl);
    expect(body['listingUrl'], 'https://www.cars.com/vehicledetail/x');
    expect(match.source, RooftopMatchSource.live);
    expect(match.isInNetwork, isFalse);
    expect(match.vdpUrl, 'https://www.cars.com/vehicledetail/x');
  });

  test('a network error is unavailable and does not use the stub', () async {
    final sessions = ShopperSessionStore()
      ..session = const ShopperSession(accessToken: 'shopper-token');
    final endpoint = HttpRooftopMatchEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: MockClient((request) async => http.Response('missing', 404)),
      sessionStore: sessions,
    );
    final match = await endpoint.match(rav4);
    expect(match.source, RooftopMatchSource.unavailable);
    expect(match.rooftopId, isNot(StubRooftopMatchEndpoint.demoRooftopId));
  });

  test('a signed-out shopper does not call network classification', () async {
    var called = false;
    final endpoint = HttpRooftopMatchEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: MockClient((request) async {
        called = true;
        return http.Response('{}', 200);
      }),
      sessionStore: ShopperSessionStore(),
    );
    final match = await endpoint.match(rav4);
    expect(called, isFalse);
    expect(match.source, RooftopMatchSource.unavailable);
  });

  test('OTD submission stays blocked and does not post', () async {
    var called = false;
    final endpoint = HttpKeySpendEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: MockClient((request) async {
        called = true;
        return http.Response('{}', 200);
      }),
      sessionStore: ShopperSessionStore()
        ..session = const ShopperSession(accessToken: 'shopper-token'),
    );
    final result = await endpoint.requestOtdNumber(crv, note: 'need OTD');
    expect(called, isFalse);
    expect(result.ok, isFalse);
    expect(result.source, KeySpendSource.blocked);
  });

  test('a signed-out shopper does not call live dealer chat', () async {
    var called = false;
    final client = MockClient((request) async {
      called = true;
      return http.Response('{}', 500);
    });
    final endpoint = HttpKeySpendEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: client,
      sessionStore: ShopperSessionStore(),
    );
    final result = await endpoint.startConversation(
      listing: rav4,
      match: const RooftopMatch(matched: true, rooftopId: 'roof-1'),
    );
    expect(called, isFalse);
    expect(result.source, KeySpendSource.missing);
  });

  test(
    'a signed-in shopper posts the vehicle and reads the live deal',
    () async {
      late Map<String, dynamic> body;
      final sessions = ShopperSessionStore()
        ..session = const ShopperSession(
          accessToken: 'shopper-token',
          consumerUserId: 'user-1',
        );
      final client = MockClient((request) async {
        expect(request.url.path, '/api/consumer/deals');
        expect(request.headers['Authorization'], 'Bearer shopper-token');
        body = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {'id': 'deal-live-1', 'listingId': 'listing_001'},
            'credits': {'balance': 2, 'canAdd': true, 'reason': 'ok'},
          }),
          200,
        );
      });
      final endpoint = HttpKeySpendEndpoint(
        baseUrl: 'https://api.drevvy.com',
        client: client,
        sessionStore: sessions,
      );
      final result = await endpoint.startConversation(
        listing: rav4,
        match: const RooftopMatch(matched: true, rooftopId: 'roof-1'),
      );
      expect(result.ok, isTrue);
      expect(result.source, KeySpendSource.live);
      expect(result.dealId, 'deal-live-1');
      expect(result.balance?.balance, 2);
      expect(result.balance?.totalPurchased, 0);
      final vehicle = body['vehicle'] as Map<String, dynamic>;
      expect(vehicle['year'], 2024);
      expect(vehicle['make'], 'Toyota');
      expect(vehicle['model'], 'RAV4');
      expect(vehicle['price'], 1);
    },
  );
}

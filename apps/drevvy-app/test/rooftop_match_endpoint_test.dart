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

  test('live rooftop match parses match boolean and rooftop id', () async {
    final client = MockClient((request) async {
      expect(request.url.path, '/api/consumer/listings/listing_001/rooftop-match');
      return http.Response(
        jsonEncode({
          'matched': true,
          'rooftopId': 'rt_1',
          'vdpUrl': 'https://example.com/vdp',
        }),
        200,
      );
    });
    final endpoint = HttpRooftopMatchEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: client,
      sessionStore: ShopperSessionStore(),
    );
    final match = await endpoint.match(rav4);
    expect(match.isInNetwork, isTrue);
    expect(match.rooftopId, 'rt_1');
    expect(match.source, RooftopMatchSource.live);
  });

  test('missing rooftop match route falls back to the stub', () async {
    final client = MockClient((request) async => http.Response('', 404));
    final endpoint = HttpRooftopMatchEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: client,
      sessionStore: ShopperSessionStore(),
    );
    final match = await endpoint.match(rav4);
    expect(match.isInNetwork, isTrue);
    expect(match.source, RooftopMatchSource.stub);
  });

  test('OTD request posts as a free analytics form, not a key spend', () async {
    late Map<String, dynamic> body;
    final client = MockClient((request) async {
      expect(request.url.path, '/api/consumer/listings/listing_002/otd-request');
      body = jsonDecode(request.body) as Map<String, dynamic>;
      return http.Response(jsonEncode({'ok': true}), 200);
    });
    final endpoint = HttpKeySpendEndpoint(
      baseUrl: 'https://api.drevvy.com',
      client: client,
      sessionStore: ShopperSessionStore(),
    );
    final result = await endpoint.requestOtdNumber(crv, note: 'need OTD');
    expect(result.ok, isTrue);
    expect(body['free'], isTrue);
    expect(body['usesKey'], isFalse);
    expect(body['note'], 'need OTD');
  });
}

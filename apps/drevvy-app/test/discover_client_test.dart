import 'dart:convert';

import 'package:drevvy_app/data/discover/discover_client.dart';
import 'package:drevvy_app/data/discover/discover_config.dart';
import 'package:drevvy_app/data/discover/discover_exception.dart';
import 'package:drevvy_app/data/discover/discover_filters.dart';
import 'package:drevvy_app/data/location/shop_location.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _springfield = ShopLocation(
  latitude: 39.7817,
  longitude: -89.6501,
  label: 'Springfield, IL',
);

DiscoverClient _client(MockClient httpClient) {
  return DiscoverClient(
    config: const DiscoverConfig(apiBaseUrl: 'https://api.drevvy.com'),
    httpClient: httpClient,
  );
}

Map<String, Object?> _listingJson({
  required String id,
  Object? price = 18990,
}) {
  return {
    'id': id,
    'vin': '1HGCV1F16LA000111',
    'price': price,
    'miles': 24000,
    'build': {'year': 2020, 'make': 'Honda', 'model': 'Civic'},
    'media': {'photo_links': ['https://cdn.example/civic.jpg']},
  };
}

void main() {
  test('search posts coordinates and never sends an inventory key', () async {
    late http.Request captured;
    final client = _client(
      MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {
              'listings': [
                _listingJson(id: 'live_civic'),
                {'price': 1},
              ],
              'pagination': {
                'page': 1,
                'page_size': 10,
                'total': 1,
                'has_next_page': false,
              },
            },
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );

    final page = await client.search(
      location: _springfield,
      filters: const DiscoverFilters(make: 'Honda', radiusMiles: 25),
    );

    expect(captured.method, 'POST');
    expect(captured.url.path, '/api/public/discover/search');
    expect(captured.url.host, 'api.drevvy.com');
    final names = captured.headers.keys.map((key) => key.toLowerCase());
    expect(names, isNot(contains('authorization')));
    expect(names, isNot(contains('x-api-key')));
    expect(captured.body.toLowerCase(), isNot(contains('inventory_search_api_key')));
    final body = jsonDecode(captured.body) as Map<String, dynamic>;
    expect(body['latitude'], _springfield.latitude);
    expect(body['longitude'], _springfield.longitude);
    expect(body.containsKey('zip'), isFalse);
    expect(body['filters'], {'make': 'Honda'});
    expect(page.listings, hasLength(1));
    expect(page.listings.single.id, 'live_civic');
    expect(page.listings.single.vin, isNot(endsWith('123456')));
  });

  test('an empty listing page stays empty', () async {
    final client = _client(
      MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {
              'listings': <Object>[],
              'pagination': {'page': 1, 'has_next_page': false, 'total': 0},
            },
          }),
          200,
        );
      }),
    );

    final page = await client.search(
      location: _springfield,
      filters: const DiscoverFilters(),
    );

    expect(page.listings, isEmpty);
    expect(page.total, 0);
  });

  test('null and decimal prices do not throw', () async {
    final client = _client(
      MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {
              'listings': [
                _listingJson(id: 'no_price', price: null),
                _listingJson(id: 'decimal', price: 21000.4),
              ],
              'pagination': {'page': 1, 'has_next_page': false},
            },
          }),
          200,
        );
      }),
    );

    final page = await client.search(
      location: _springfield,
      filters: const DiscoverFilters(),
    );

    expect(page.listings.map((listing) => listing.price), [null, 21000]);
  });

  test('error statuses surface the server message', () async {
    final cases = <int, String>{400: 'INVALID_FILTERS', 502: 'UPSTREAM_ERROR'};
    for (final entry in cases.entries) {
      final client = _client(
        MockClient((request) async {
          return http.Response(
            jsonEncode({
              'success': false,
              'error': {'code': entry.value, 'message': 'No cars for that search.'},
            }),
            entry.key,
            headers: {'retry-after': '4'},
          );
        }),
      );

      expect(
        () => client.search(location: _springfield, filters: const DiscoverFilters()),
        throwsA(
          isA<DiscoverException>()
              .having((error) => error.status, 'status', entry.key)
              .having((error) => error.code, 'code', entry.value)
              .having((error) => error.retryAfterSeconds, 'retry', 4)
              .having((error) => error.message, 'message', 'No cars for that search.'),
        ),
      );
    }
  });

  test('listing detail reads the data object', () async {
    late http.Request captured;
    final client = _client(
      MockClient((request) async {
        captured = request;
        return http.Response(
          jsonEncode({
            'success': true,
            'data': _listingJson(id: 'live_detail'),
          }),
          200,
        );
      }),
    );

    final listing = await client.listing('live_detail');

    expect(captured.method, 'GET');
    expect(captured.url.path, '/api/public/discover/listings/live_detail');
    expect(listing.id, 'live_detail');
    expect(listing.build.model, 'Civic');
  });

  test('(0, 0) is rejected before any request', () async {
    final client = _client(
      MockClient((request) async {
        fail('Discover must not be called for null island');
      }),
    );

    expect(
      () => client.search(
        location: const ShopLocation(latitude: 0, longitude: 0, label: 'Nowhere'),
        filters: const DiscoverFilters(),
      ),
      throwsA(
        isA<DiscoverException>().having(
          (error) => error.code,
          'code',
          'INVALID_LOCATION',
        ),
      ),
    );
  });
}

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../location/shop_location.dart';
import '../models/json_values.dart';
import '../models/listing.dart';
import 'discover_config.dart';
import 'discover_exception.dart';
import 'discover_filters.dart';
import 'discover_page.dart';

/// Anonymous client for Sheet #125 `POST/GET /api/public/discover/*`.
///
/// No `x-api-key`, no `Authorization`, no inventory secret. Failures throw
/// [DiscoverException]. This class has no demo catalog.
class DiscoverClient {
  DiscoverClient({
    DiscoverConfig? config,
    http.Client? httpClient,
    this.pageSize = 10,
    this.timeout = const Duration(seconds: 20),
  }) : _config = config ?? DiscoverConfig.fromEnvironment(),
       _http = httpClient ?? http.Client();

  final DiscoverConfig _config;
  final http.Client _http;
  final int pageSize;
  final Duration timeout;

  static const _headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  Future<DiscoverPage> search({
    required ShopLocation location,
    required DiscoverFilters filters,
    int page = 1,
  }) async {
    _requireLive();
    _requireLocation(location);
    final problem = filters.validate();
    if (problem != null) {
      throw DiscoverException(
        status: 0,
        code: 'INVALID_FILTERS',
        message: problem,
      );
    }
    if (page < 1 || page > 10) {
      throw const DiscoverException(
        status: 0,
        code: 'INVALID_PAGINATION',
        message: 'Page must be between 1 and 10.',
      );
    }
    final size = pageSize.clamp(1, 20);
    final filterBody = filters.toJson();
    final response = await _send(
      () => _http.post(
        _uri('/api/public/discover/search'),
        headers: _headers,
        body: jsonEncode({
          'latitude': location.latitude,
          'longitude': location.longitude,
          'radius_miles': filters.radiusMiles,
          'page': page,
          'page_size': size,
          if (filterBody.isNotEmpty) 'filters': filterBody,
        }),
      ),
    );
    final root = _decode(response);
    final data = root['data'];
    final payload = data is Map ? Map<String, dynamic>.from(data) : root;
    final rawList = payload['listings'];
    final listings = <Listing>[];
    if (rawList is List) {
      for (final item in rawList) {
        if (item is! Map) continue;
        final listing = Listing.tryFromJson(Map<String, dynamic>.from(item));
        if (listing != null) listings.add(listing);
      }
    }
    final pagination = payload['pagination'];
    final pageValue = pagination is Map
        ? jsonInt(pagination['page']) ?? page
        : page;
    final hasNext = pagination is Map && pagination['has_next_page'] == true;
    final total = pagination is Map ? jsonInt(pagination['total']) : null;
    return DiscoverPage(
      listings: listings,
      page: pageValue,
      hasNextPage: hasNext,
      total: total,
    );
  }

  Future<Listing> listing(String id) async {
    _requireLive();
    final trimmed = id.trim();
    if (trimmed.isEmpty) {
      throw const DiscoverException(
        status: 0,
        code: 'INVALID_ID',
        message: 'This listing id is not valid.',
      );
    }
    final response = await _send(
      () => _http.get(
        _uri('/api/public/discover/listings/${Uri.encodeComponent(trimmed)}'),
        headers: _headers,
      ),
    );
    final root = _decode(response);
    final data = root['data'];
    final payload = data is Map
        ? Map<String, dynamic>.from(data)
        : root;
    final listingMap = payload['id'] != null
        ? payload
        : payload['listing'] is Map
        ? Map<String, dynamic>.from(payload['listing'] as Map)
        : null;
    final listing = listingMap == null ? null : Listing.tryFromJson(listingMap);
    if (listing == null) {
      throw const DiscoverException(
        status: 200,
        code: 'LISTING_NOT_FOUND',
        message: 'This listing is no longer available.',
      );
    }
    return listing;
  }

  void _requireLive() {
    if (!_config.isLive) {
      throw const DiscoverException(
        status: 0,
        code: 'NOT_CONFIGURED',
        message: 'Discover is not configured for this build.',
      );
    }
  }

  void _requireLocation(ShopLocation location) {
    if (!location.isUsable) {
      throw const DiscoverException(
        status: 0,
        code: 'INVALID_LOCATION',
        message: 'A real location is required. (0, 0) is not a place.',
      );
    }
  }

  Future<http.Response> _send(Future<http.Response> Function() send) async {
    try {
      return await send().timeout(timeout);
    } on DiscoverException {
      rethrow;
    } catch (_) {
      throw const DiscoverException(
        status: 0,
        code: 'NETWORK',
        message: 'Drevvy could not reach inventory. Try again.',
      );
    }
  }

  Map<String, dynamic> _decode(http.Response response) {
    Map<String, dynamic>? root;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map) root = Map<String, dynamic>.from(decoded);
    } on FormatException {
      root = null;
    }
    final ok = response.statusCode >= 200 && response.statusCode < 300;
    if (!ok || root == null || root['success'] == false) {
      throw _error(response, root);
    }
    return root;
  }

  DiscoverException _error(http.Response response, Map<String, dynamic>? root) {
    final error = root?['error'];
    final code = error is Map ? jsonString(error['code']) : null;
    final message = error is Map ? jsonString(error['message']) : null;
    final retry = int.tryParse(response.headers['retry-after'] ?? '');
    return DiscoverException(
      status: response.statusCode,
      code: code ?? 'HTTP_${response.statusCode}',
      message: message ?? 'Drevvy could not load cars.',
      retryAfterSeconds: retry,
    );
  }

  Uri _uri(String path) => Uri.parse('${_config.origin}$path');
}

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../../core/config/api_config_exception.dart';
import '../analytics/product_analytics.dart';
import '../models/car_pack.dart';
import '../models/listing.dart';
import '../models/rooftop_match.dart';
import 'purchase_config.dart';
import 'shopper_session_store.dart';

/// Result of a Key A / Key B spend against the shopper API.
class KeySpendResult {
  const KeySpendResult({
    required this.ok,
    this.balance,
    this.dealId,
    this.source = KeySpendSource.stub,
    this.message,
  });

  final bool ok;
  final CarCreditBalance? balance;
  final String? dealId;
  final KeySpendSource source;
  final String? message;

  const KeySpendResult.unavailable()
    : ok = false,
      balance = null,
      dealId = null,
      source = KeySpendSource.missing,
      message = null;

  /// Live mode refused a local spend. [ok] is false.
  const KeySpendResult.blocked(String message)
    : ok = false,
      balance = null,
      dealId = null,
      source = KeySpendSource.blocked,
      message = message;
}

enum KeySpendSource { live, stub, missing, blocked }

/// Live spend routes from backend PRs, with a missing-route fallback.
///
/// - Key A: `POST /api/consumer/keys/market-save` `{listingId, vin}`
/// - Key B: `POST /api/consumer/deals` `{listingId, rooftopId, templateId?}`
/// - Off-network OTD is `POST /api/consumer/otd-requests`. This client does
///   not send it. Submission stays unavailable until that hold is cleared.
abstract class KeySpendEndpoint {
  const KeySpendEndpoint();

  static KeySpendEndpoint fromConfig(
    PurchaseConfig config, {
    http.Client? client,
  }) {
    final baseUrl = config.apiBaseUrl.trim();
    if (config.isLive) {
      if (baseUrl.isEmpty) return const UnconfiguredKeySpendEndpoint();
      return HttpKeySpendEndpoint(
        baseUrl: baseUrl,
        client: client,
        strict: true,
      );
    }
    if (baseUrl.isEmpty) return const MissingKeySpendEndpoint();
    return HttpKeySpendEndpoint(baseUrl: baseUrl, client: client);
  }

  Future<KeySpendResult> spendMarketSave(Listing listing);

  Future<KeySpendResult> startConversation({
    required Listing listing,
    required RooftopMatch match,
    String? templateId,
    String? message,
  });

  Future<KeySpendResult> requestOtdNumber(Listing listing, {String? note});
}

/// Live mode with no base URL. Does not report a local key spend as done.
class UnconfiguredKeySpendEndpoint extends KeySpendEndpoint {
  const UnconfiguredKeySpendEndpoint();

  @override
  Future<KeySpendResult> spendMarketSave(Listing listing) async {
    return const KeySpendResult.blocked(apiNotConfiguredMessage);
  }

  @override
  Future<KeySpendResult> startConversation({
    required Listing listing,
    required RooftopMatch match,
    String? templateId,
    String? message,
  }) async {
    return const KeySpendResult.blocked(apiNotConfiguredMessage);
  }

  @override
  Future<KeySpendResult> requestOtdNumber(
    Listing listing, {
    String? note,
  }) async {
    return const KeySpendResult.blocked(apiNotConfiguredMessage);
  }
}

class MissingKeySpendEndpoint extends KeySpendEndpoint {
  const MissingKeySpendEndpoint();

  @override
  Future<KeySpendResult> spendMarketSave(Listing listing) async {
    return const KeySpendResult.unavailable();
  }

  @override
  Future<KeySpendResult> startConversation({
    required Listing listing,
    required RooftopMatch match,
    String? templateId,
    String? message,
  }) async {
    return const KeySpendResult.unavailable();
  }

  @override
  Future<KeySpendResult> requestOtdNumber(
    Listing listing, {
    String? note,
  }) async {
    return const KeySpendResult.unavailable();
  }
}

class HttpKeySpendEndpoint extends KeySpendEndpoint {
  HttpKeySpendEndpoint({
    required this.baseUrl,
    http.Client? client,
    ShopperSessionStore? sessionStore,
    this.log,
    this.strict = false,
    this.timeout = const Duration(seconds: 8),
  }) : _client = client ?? http.Client(),
       _sessionStore = sessionStore ?? ShopperSessionStore.instance;

  final String baseUrl;
  final bool strict;
  final Duration timeout;
  final http.Client _client;
  final ShopperSessionStore _sessionStore;
  final void Function(String message)? log;

  @override
  Future<KeySpendResult> spendMarketSave(Listing listing) {
    return _post(
      '/api/consumer/keys/market-save',
      {'listingId': listing.id, 'vin': listing.vin},
      surface: 'market_save',
      requiresSignIn: true,
    );
  }

  @override
  Future<KeySpendResult> startConversation({
    required Listing listing,
    required RooftopMatch match,
    String? templateId,
    String? message,
  }) {
    final vdpUrl = listing.vdpUrl;
    return _post(
      '/api/consumer/deals',
      {
        'listingId': listing.id,
        'vin': listing.vin,
        'vehicle': _vehicleSnapshot(listing),
        if (vdpUrl != null &&
            (vdpUrl.startsWith('https://') || vdpUrl.startsWith('http://')))
          'listingUrl': vdpUrl,
        'rooftopId': match.rooftopId,
        if (templateId != null) 'templateId': templateId,
        if (message != null) 'message': message,
        'spendKind': 'dealer_conversation',
      },
      surface: 'dealer_conversation',
      requiresSignIn: true,
      conversation: true,
    );
  }

  @override
  Future<KeySpendResult> requestOtdNumber(
    Listing listing, {
    String? note,
  }) async {
    return const KeySpendResult.blocked(
      'An out-the-door request is not available yet.',
    );
  }

  /// Year, make, model, and price are what `POST /api/consumer/deals` requires.
  Map<String, Object?> _vehicleSnapshot(Listing listing) {
    final build = listing.build;
    final location = listing.carLocation;
    final city = location?.city;
    final state = location?.state;
    final latitude = location?.latitude;
    final longitude = location?.longitude;
    return {
      'year': build.year,
      'make': build.make,
      'model': build.model,
      'price': listing.price,
      if (build.trim != null && build.trim!.isNotEmpty) 'trim': build.trim,
      if (build.bodyType != null && build.bodyType!.isNotEmpty)
        'bodyType': build.bodyType,
      if (listing.vin.isNotEmpty) 'vin': listing.vin,
      if (listing.miles != null) 'miles': listing.miles,
      if (listing.msrp != null) 'msrp': listing.msrp,
      if (listing.domActive != null) 'daysOnMarket': listing.domActive,
      if (city != null && city.isNotEmpty) 'city': city,
      if (state != null && state.isNotEmpty) 'state': state,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      'condition': listing.isCpo
          ? 'certified'
          : listing.isNew
          ? 'new'
          : 'used',
    };
  }

  Future<KeySpendResult> _post(
    String path,
    Map<String, Object?> body, {
    required String surface,
    bool requiresSignIn = false,
    bool conversation = false,
  }) async {
    if (requiresSignIn && _sessionStore.accessToken == null) {
      if (strict) {
        return const KeySpendResult.blocked('Sign in to use a key.');
      }
      return const KeySpendResult.unavailable();
    }
    try {
      final response = await _client
          .post(_uri(path), headers: _headers(), body: jsonEncode(body))
          .timeout(timeout);
      if (_endpointMissing(response.statusCode)) {
        if (strict) {
          return KeySpendResult.blocked(
            'Key spend route $path is not available.',
          );
        }
        _log(
          'Key spend route $path missing (${response.statusCode}). Using stub.',
        );
        return const KeySpendResult.unavailable();
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        ProductAnalytics.instance.track(AnalyticsEvents.apiFailed, {
          'surface': surface,
          'status': response.statusCode,
        });
        return KeySpendResult(
          ok: false,
          source: KeySpendSource.live,
          message: 'Could not complete this key spend.',
        );
      }
      return _parse(response.body, conversation: conversation);
    } on Exception {
      ProductAnalytics.instance.track(AnalyticsEvents.apiFailed, {
        'surface': surface,
        'status': 0,
      });
      if (strict || (requiresSignIn && _sessionStore.accessToken != null)) {
        return const KeySpendResult(
          ok: false,
          source: KeySpendSource.live,
          message: 'Drevvy could not reach the server.',
        );
      }
      return const KeySpendResult.unavailable();
    }
  }

  KeySpendResult _parse(String body, {bool conversation = false}) {
    if (body.trim().isEmpty) {
      return const KeySpendResult(ok: true, source: KeySpendSource.live);
    }
    final decoded = jsonDecode(body);
    if (decoded is! Map) {
      return const KeySpendResult(ok: true, source: KeySpendSource.live);
    }
    final root = Map<String, dynamic>.from(decoded);
    final payload = root['data'] is Map
        ? Map<String, dynamic>.from(root['data'] as Map)
        : root;
    CarCreditBalance? balance;
    final credits = root['credits'];
    if (credits is Map) {
      balance = _balanceFrom(
        Map<String, dynamic>.from(credits),
        purchasedFallback: 0,
      );
    }
    balance ??= _balanceFrom(payload, purchasedFallback: null);
    final deal = payload['deal'];
    String? dealId;
    if (deal is Map && deal['id'] is String) {
      dealId = deal['id'] as String;
    } else if (payload['dealId'] is String) {
      dealId = payload['dealId'] as String;
    } else if (conversation && payload['id'] is String) {
      dealId = payload['id'] as String;
    }
    return KeySpendResult(
      ok:
          root['success'] != false &&
          payload['ok'] != false &&
          payload['success'] != false,
      balance: balance,
      dealId: dealId,
      source: KeySpendSource.live,
    );
  }

  CarCreditBalance? _balanceFrom(
    Map<String, dynamic> payload, {
    required int? purchasedFallback,
  }) {
    final rawBalance = payload['balance'];
    if (rawBalance is! num) return null;
    final fallback = purchasedFallback ?? rawBalance.toInt();
    return CarCreditBalance(
      balance: rawBalance.toInt(),
      totalPurchased: _intField(payload, const [
        'lifetimePurchased',
        'totalPurchased',
      ], fallback),
      totalSpent: _intField(payload, const ['lifetimeUsed', 'totalSpent'], 0),
      totalRefunded: _intField(payload, const [
        'lifetimeRefunded',
        'totalRefunded',
      ], 0),
    );
  }

  int _intField(Map<String, dynamic> payload, List<String> keys, int fallback) {
    for (final key in keys) {
      final value = payload[key];
      if (value is num) return value.toInt();
    }
    return fallback;
  }

  Map<String, String> _headers() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    final token = _sessionStore.accessToken;
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Uri _uri(String path) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$root$path');
  }

  void _log(String message) {
    final sink = log;
    if (sink != null) {
      sink(message);
      return;
    }
    debugPrint(message);
  }

  bool _endpointMissing(int statusCode) {
    return statusCode == 404 || statusCode == 405 || statusCode == 501;
  }
}

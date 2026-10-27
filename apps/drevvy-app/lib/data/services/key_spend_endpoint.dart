import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

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
}

enum KeySpendSource { live, stub, missing }

/// Live spend routes from backend PRs, with a missing-route fallback.
///
/// - Key A: `POST /api/consumer/keys/market-save` `{listingId, vin}`
/// - Key B: `POST /api/consumer/deals` `{listingId, rooftopId, templateId?}`
/// - Off-network OTD: `POST /api/consumer/listings/:id/otd-request`
abstract class KeySpendEndpoint {
  const KeySpendEndpoint();

  static KeySpendEndpoint fromConfig(
    PurchaseConfig config, {
    http.Client? client,
  }) {
    final baseUrl = config.apiBaseUrl.trim();
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
    this.timeout = const Duration(seconds: 8),
  }) : _client = client ?? http.Client(),
       _sessionStore = sessionStore ?? ShopperSessionStore.instance;

  final String baseUrl;
  final Duration timeout;
  final http.Client _client;
  final ShopperSessionStore _sessionStore;
  final void Function(String message)? log;

  @override
  Future<KeySpendResult> spendMarketSave(Listing listing) {
    return _post('/api/consumer/keys/market-save', {
      'listingId': listing.id,
      'vin': listing.vin,
    }, surface: 'market_save');
  }

  @override
  Future<KeySpendResult> startConversation({
    required Listing listing,
    required RooftopMatch match,
    String? templateId,
    String? message,
  }) {
    return _post('/api/consumer/deals', {
      'listingId': listing.id,
      'vin': listing.vin,
      'rooftopId': match.rooftopId,
      if (templateId != null) 'templateId': templateId,
      if (message != null) 'message': message,
      'spendKind': 'dealer_conversation',
    }, surface: 'dealer_conversation');
  }

  @override
  Future<KeySpendResult> requestOtdNumber(
    Listing listing, {
    String? note,
  }) {
    return _post('/api/consumer/listings/${listing.id}/otd-request', {
      'listingId': listing.id,
      if (listing.vdpUrl != null) 'url': listing.vdpUrl,
      if (note != null && note.isNotEmpty) 'note': note,
      'free': true,
      'usesKey': false,
    }, surface: 'otd_request');
  }

  Future<KeySpendResult> _post(
    String path,
    Map<String, Object?> body, {
    required String surface,
  }) async {
    try {
      final response = await _client
          .post(
            _uri(path),
            headers: _headers(),
            body: jsonEncode(body),
          )
          .timeout(timeout);
      if (_endpointMissing(response.statusCode)) {
        _log('Key spend route $path missing (${response.statusCode}). Using stub.');
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
      return _parse(response.body);
    } on Exception {
      ProductAnalytics.instance.track(AnalyticsEvents.apiFailed, {
        'surface': surface,
        'status': 0,
      });
      return const KeySpendResult.unavailable();
    }
  }

  KeySpendResult _parse(String body) {
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
    final rawBalance = payload['balance'];
    if (rawBalance is num) {
      balance = CarCreditBalance(
        balance: rawBalance.toInt(),
        totalPurchased: _intField(payload, const [
          'lifetimePurchased',
          'totalPurchased',
        ], rawBalance.toInt()),
        totalSpent: _intField(payload, const ['lifetimeUsed', 'totalSpent'], 0),
        totalRefunded: _intField(payload, const [
          'lifetimeRefunded',
          'totalRefunded',
        ], 0),
      );
    }
    final deal = payload['deal'];
    String? dealId;
    if (deal is Map && deal['id'] is String) {
      dealId = deal['id'] as String;
    } else if (payload['dealId'] is String) {
      dealId = payload['dealId'] as String;
    }
    return KeySpendResult(
      ok: payload['ok'] != false && payload['success'] != false,
      balance: balance,
      dealId: dealId,
      source: KeySpendSource.live,
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

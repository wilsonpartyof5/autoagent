import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/car_pack.dart';
import 'purchase_config.dart';
import 'shopper_session_store.dart';

/// Grants car credits after a store purchase.
///
/// `GET` and `POST /api/consumer/credits` and `POST /api/consumer/credits/restore`.
/// A purchase body is `{productId, transactionId}`. A restore body is
/// `{transactionIds}`. The balance response is
/// `{data: {balance, lifetimePurchased, lifetimeUsed, lifetimeRefunded}}`.
/// A missing route (404, 405, 501), a 503 `purchases not configured`, an empty
/// base URL, or a network failure returns null so the caller keeps the local
/// demo balance.
abstract class CreditsEndpoint {
  const CreditsEndpoint();

  static CreditsEndpoint fromConfig(PurchaseConfig config, {http.Client? client}) {
    final baseUrl = config.apiBaseUrl.trim();
    if (baseUrl.isEmpty) return const MissingCreditsEndpoint();
    return HttpCreditsEndpoint(baseUrl: baseUrl, client: client);
  }

  Future<CarCreditBalance?> grantPurchase({
    required String productId,
    required String transactionId,
  });

  Future<CarCreditBalance?> restorePurchases({
    List<String> transactionIds = const [],
  });
}

class MissingCreditsEndpoint extends CreditsEndpoint {
  const MissingCreditsEndpoint();

  @override
  Future<CarCreditBalance?> grantPurchase({
    required String productId,
    required String transactionId,
  }) async {
    return null;
  }

  @override
  Future<CarCreditBalance?> restorePurchases({
    List<String> transactionIds = const [],
  }) async {
    return null;
  }
}

class HttpCreditsEndpoint extends CreditsEndpoint {
  HttpCreditsEndpoint({
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
  Future<CarCreditBalance?> grantPurchase({
    required String productId,
    required String transactionId,
  }) {
    return _post('/api/consumer/credits', {
      'productId': productId,
      'transactionId': transactionId,
    });
  }

  @override
  Future<CarCreditBalance?> restorePurchases({
    List<String> transactionIds = const [],
  }) {
    return _post('/api/consumer/credits/restore', {
      'transactionIds': transactionIds,
    });
  }

  Future<CarCreditBalance?> _post(String path, Map<String, Object?> body) async {
    try {
      final response = await _client
          .post(
            _uri(path),
            headers: _headers(),
            body: jsonEncode(body),
          )
          .timeout(timeout);
      if (_purchasesNotConfigured(response.statusCode, response.body)) {
        _log(
          'Credits server is not ready (purchases not configured). Keeping the local demo balance.',
        );
        return null;
      }
      if (_endpointMissing(response.statusCode)) return null;
      if (response.statusCode < 200 || response.statusCode >= 300) return null;
      return _parseBalance(response.body);
    } on Exception {
      return null;
    }
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
    final root = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
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

  bool _purchasesNotConfigured(int statusCode, String body) {
    return statusCode == 503 && body.toLowerCase().contains('purchases not configured');
  }

  bool _endpointMissing(int statusCode) {
    return statusCode == 404 || statusCode == 405 || statusCode == 501;
  }

  CarCreditBalance? _parseBalance(String body) {
    if (body.trim().isEmpty) return null;
    final decoded = jsonDecode(body);
    if (decoded is! Map) return null;
    final root = Map<String, dynamic>.from(decoded);
    final payload = root['data'] is Map ? Map<String, dynamic>.from(root['data'] as Map) : root;
    final balance = payload['balance'];
    if (balance is! num) return null;
    return CarCreditBalance(
      balance: balance.toInt(),
      totalPurchased: _intField(payload, const ['lifetimePurchased', 'totalPurchased'], balance.toInt()),
      totalSpent: _intField(payload, const ['lifetimeUsed', 'totalSpent'], 0),
      totalRefunded: _intField(payload, const ['lifetimeRefunded', 'totalRefunded'], 0),
    );
  }

  int _intField(Map<String, dynamic> payload, List<String> keys, int fallback) {
    for (final key in keys) {
      final value = payload[key];
      if (value is num) return value.toInt();
    }
    return fallback;
  }
}

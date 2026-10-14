import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/car_pack.dart';
import 'purchase_config.dart';

/// Grants car credits after a store purchase.
///
/// `POST /api/consumer/credits` and `POST /api/consumer/credits/restore`.
/// A missing route (404, 405, 501), an empty base URL, or a network failure
/// returns null so the caller keeps the local demo balance.
abstract class CreditsEndpoint {
  const CreditsEndpoint();

  static CreditsEndpoint fromConfig(PurchaseConfig config, {http.Client? client}) {
    final baseUrl = config.apiBaseUrl.trim();
    if (baseUrl.isEmpty) return const MissingCreditsEndpoint();
    return HttpCreditsEndpoint(baseUrl: baseUrl, client: client);
  }

  Future<CarCreditBalance?> grantPurchase({
    required String productId,
    required int credits,
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
    required int credits,
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
    this.timeout = const Duration(seconds: 8),
  }) : _client = client ?? http.Client();

  final String baseUrl;
  final Duration timeout;
  final http.Client _client;

  @override
  Future<CarCreditBalance?> grantPurchase({
    required String productId,
    required int credits,
    required String transactionId,
  }) {
    return _post('/api/consumer/credits', {
      'productId': productId,
      'credits': credits,
      'transactionId': transactionId,
      'reason': 'purchase',
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
            headers: const {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: jsonEncode(body),
          )
          .timeout(timeout);
      if (_endpointMissing(response.statusCode)) return null;
      if (response.statusCode < 200 || response.statusCode >= 300) return null;
      return _parseBalance(response.body);
    } on Exception {
      return null;
    }
  }

  Uri _uri(String path) {
    final root = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    return Uri.parse('$root$path');
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
      totalPurchased: (payload['totalPurchased'] as num?)?.toInt() ?? balance.toInt(),
      totalSpent: (payload['totalSpent'] as num?)?.toInt() ?? 0,
      totalRefunded: (payload['totalRefunded'] as num?)?.toInt() ?? 0,
    );
  }
}

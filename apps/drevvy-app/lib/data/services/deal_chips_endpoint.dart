import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../analytics/product_analytics.dart';
import '../models/deal_chip_inputs.dart';
import 'purchase_config.dart';
import 'shopper_session_store.dart';

/// Live in-network chip suggestions.
///
/// `POST /api/consumer/deals/:id/chips` with `{ stage?, messages, intel }`.
/// `GET` on the same path returns the same shape with no extra intel.
/// This client posts once the deal thread, market intel, feature, and
/// visit time have loaded, so the server can hide chips that need those
/// facts and fill T3–T5 from the spec fallback. A missing route, an
/// off-network deal, or a network failure returns null. The sheet then
/// keeps the after-opener pair. Nothing in this response is sent.
abstract class DealChipsEndpoint {
  const DealChipsEndpoint();

  static DealChipsEndpoint fromConfig(
    PurchaseConfig config, {
    http.Client? client,
  }) {
    final baseUrl = config.apiBaseUrl.trim();
    if (baseUrl.isEmpty) return const MissingDealChipsEndpoint();
    return HttpDealChipsEndpoint(baseUrl: baseUrl, client: client);
  }

  Future<DealChipSuggestionSet?> suggest(String dealId, DealChipInputs inputs);
}

class MissingDealChipsEndpoint extends DealChipsEndpoint {
  const MissingDealChipsEndpoint();

  @override
  Future<DealChipSuggestionSet?> suggest(
    String dealId,
    DealChipInputs inputs,
  ) async {
    return null;
  }
}

class HttpDealChipsEndpoint extends DealChipsEndpoint {
  HttpDealChipsEndpoint({
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
  Future<DealChipSuggestionSet?> suggest(
    String dealId,
    DealChipInputs inputs,
  ) async {
    final id = dealId.trim();
    if (id.isEmpty || !inputs.ready) return null;
    final path = '/api/consumer/deals/${Uri.encodeComponent(id)}/chips';
    try {
      final response = await _client
          .post(
            _uri(path),
            headers: _headers(),
            body: jsonEncode(inputs.toRequestBody()),
          )
          .timeout(timeout);
      if (_endpointMissing(response.statusCode)) {
        _log(
          'Chip route $path missing (${response.statusCode}). Using opener chips.',
        );
        return null;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        _reportFailure(response.statusCode);
        return null;
      }
      return _parse(response.body);
    } on Exception {
      _reportFailure(0);
      return null;
    }
  }

  DealChipSuggestionSet? _parse(String body) {
    if (body.trim().isEmpty) return null;
    try {
      final decoded = jsonDecode(body);
      if (decoded is! Map) return null;
      return DealChipSuggestionSet.tryParse(Map<String, dynamic>.from(decoded));
    } on FormatException {
      return null;
    }
  }

  void _reportFailure(int status) {
    ProductAnalytics.instance.track(AnalyticsEvents.apiFailed, {
      'surface': 'deal_chips',
      'status': status,
    });
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

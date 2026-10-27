import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../analytics/product_analytics.dart';
import '../models/deal_brain_chip.dart';
import 'purchase_config.dart';
import 'shopper_session_store.dart';

/// Live T1–T12 suggestions for one in-network deal thread.
///
/// Tries `POST /api/consumer/deals/:id/chips` with `{ stage, messages, intel }`.
/// A missing route, empty base URL, off-network deal, or network failure
/// returns null so the caller can show the local after-opener pair.
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

  Future<ChipSuggestionSet?> suggest({
    required String dealId,
    ChipIntel? intel,
    String? stage,
    List<ChipThreadMessage>? messages,
  });
}

class MissingDealChipsEndpoint extends DealChipsEndpoint {
  const MissingDealChipsEndpoint();

  @override
  Future<ChipSuggestionSet?> suggest({
    required String dealId,
    ChipIntel? intel,
    String? stage,
    List<ChipThreadMessage>? messages,
  }) async {
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
  Future<ChipSuggestionSet?> suggest({
    required String dealId,
    ChipIntel? intel,
    String? stage,
    List<ChipThreadMessage>? messages,
  }) async {
    final path = '/api/consumer/deals/$dealId/chips';
    try {
      final response = await _client
          .post(
            _uri(path),
            headers: _headers(),
            body: jsonEncode({
              if (stage != null && stage.isNotEmpty) 'stage': stage,
              if (messages != null)
                'messages': [
                  for (final message in messages.take(40)) message.toJson(),
                ],
              if (intel != null) 'intel': intel.toJson(),
            }),
          )
          .timeout(timeout);
      if (_endpointMissing(response.statusCode)) {
        _log('Deal chips route missing (${response.statusCode}). Using local pair.');
        return null;
      }
      if (response.statusCode == 409) {
        _log('Deal chips are in-network only (${response.statusCode}).');
        return null;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        ProductAnalytics.instance.track(AnalyticsEvents.apiFailed, {
          'surface': 'deal_chips',
          'status': response.statusCode,
        });
        return null;
      }
      return _parse(response.body);
    } on Exception {
      ProductAnalytics.instance.track(AnalyticsEvents.apiFailed, {
        'surface': 'deal_chips',
        'status': 0,
      });
      return null;
    }
  }

  ChipSuggestionSet? _parse(String body) {
    if (body.trim().isEmpty) return null;
    final decoded = jsonDecode(body);
    if (decoded is! Map) return null;
    final root = Map<String, dynamic>.from(decoded);
    final payload = root['data'] is Map
        ? Map<String, dynamic>.from(root['data'] as Map)
        : root;
    if (payload['success'] == false || payload['ok'] == false) return null;
    return ChipSuggestionSet.fromJson(payload);
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

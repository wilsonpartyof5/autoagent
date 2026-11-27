import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/market_intel_brief.dart';
import 'purchase_config.dart';
import 'shopper_session_store.dart';

/// Owner read of a stored fair-price unlock.
///
/// `GET /api/consumer/listings/:id/market-intel`. A missing row is locked.
/// This call does not spend a key.
class MarketIntelRead {
  const MarketIntelRead({required this.unlocked, this.brief});

  final bool unlocked;
  final MarketIntelBrief? brief;

  static MarketIntelRead? tryParse(String body) {
    final decoded = jsonDecode(body);
    if (decoded is! Map) return null;
    final root = Map<String, dynamic>.from(decoded);
    if (root['success'] == false) return null;
    final data = root['data'] is Map
        ? Map<String, dynamic>.from(root['data'] as Map)
        : root;
    final market = data['market'];
    return MarketIntelRead(
      unlocked: data['unlocked'] == true,
      brief: MarketIntelBrief.tryParse(market),
    );
  }
}

abstract class MarketIntelEndpoint {
  const MarketIntelEndpoint();

  static MarketIntelEndpoint fromConfig(
    PurchaseConfig config, {
    http.Client? client,
  }) {
    if (!config.isLive || config.apiBaseUrl.trim().isEmpty) {
      return const UnusedMarketIntelEndpoint();
    }
    return HttpMarketIntelEndpoint(baseUrl: config.apiBaseUrl, client: client);
  }

  Future<MarketIntelRead?> read(String listingId);
}

class UnusedMarketIntelEndpoint extends MarketIntelEndpoint {
  const UnusedMarketIntelEndpoint();

  @override
  Future<MarketIntelRead?> read(String listingId) async => null;
}

class HttpMarketIntelEndpoint extends MarketIntelEndpoint {
  HttpMarketIntelEndpoint({
    required this.baseUrl,
    http.Client? client,
    ShopperSessionStore? sessionStore,
    this.timeout = const Duration(seconds: 8),
  }) : _client = client ?? http.Client(),
       _sessionStore = sessionStore ?? ShopperSessionStore.instance;

  final String baseUrl;
  final Duration timeout;
  final http.Client _client;
  final ShopperSessionStore _sessionStore;

  @override
  Future<MarketIntelRead?> read(String listingId) async {
    final token = _sessionStore.accessToken;
    if (token == null || token.isEmpty) return null;
    final id = listingId.trim();
    if (id.isEmpty) return null;
    try {
      final response = await _client
          .get(_uri('/api/consumer/listings/${Uri.encodeComponent(id)}/market-intel'), headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer $token',
          })
          .timeout(timeout);
      if (response.statusCode < 200 || response.statusCode >= 300) return null;
      return MarketIntelRead.tryParse(response.body);
    } on Exception {
      return null;
    }
  }

  Uri _uri(String path) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$root$path');
  }
}

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../analytics/product_analytics.dart';
import '../models/listing.dart';
import '../models/rooftop_match.dart';
import 'purchase_config.dart';
import 'shopper_session_store.dart';

/// Classifies a listing against onboarded rooftops.
///
/// Live mode posts `POST /api/consumer/listings/network` with the listing id
/// and, only when the listing already has one, its URL. It does not invent a
/// URL or a rooftop id. A failed call is [RooftopMatch.unavailable]. Demo mode
/// with no origin keeps [StubRooftopMatchEndpoint].
abstract class RooftopMatchEndpoint {
  const RooftopMatchEndpoint();

  static RooftopMatchEndpoint fromConfig(
    PurchaseConfig config, {
    http.Client? client,
  }) {
    final baseUrl = config.apiBaseUrl.trim();
    if (config.isLive) {
      if (baseUrl.isEmpty) return const UnconfiguredRooftopMatchEndpoint();
      return HttpRooftopMatchEndpoint(baseUrl: baseUrl, client: client);
    }
    if (baseUrl.isEmpty) return const StubRooftopMatchEndpoint();
    return HttpRooftopMatchEndpoint(baseUrl: baseUrl, client: client);
  }

  Future<RooftopMatch> match(Listing listing);
}

/// Live mode with no base URL. Does not invent an in-network rooftop.
class UnconfiguredRooftopMatchEndpoint extends RooftopMatchEndpoint {
  const UnconfiguredRooftopMatchEndpoint();

  @override
  Future<RooftopMatch> match(Listing listing) async {
    return const RooftopMatch.unavailable();
  }
}

/// Demo rooftops: RAV4 (`listing_001`) and new Tacoma (`listing_007`).
class StubRooftopMatchEndpoint extends RooftopMatchEndpoint {
  const StubRooftopMatchEndpoint();

  static const inNetworkIds = {'listing_001', 'listing_007'};
  static const demoRooftopId = 'rooftop_demo_springfield';

  @override
  Future<RooftopMatch> match(Listing listing) async {
    return stubFor(listing);
  }

  static RooftopMatch stubFor(Listing listing) {
    if (listing.rooftopMatch != null) return listing.rooftopMatch!;
    final url = listing.vdpUrl ?? stubVdpUrl(listing.id);
    if (inNetworkIds.contains(listing.id)) {
      return RooftopMatch(
        matched: true,
        rooftopId: demoRooftopId,
        vdpUrl: url,
        source: RooftopMatchSource.stub,
      );
    }
    return RooftopMatch.offNetwork(vdpUrl: url);
  }

  static String stubVdpUrl(String listingId) {
    return 'https://listings.example.com/vdp/$listingId';
  }
}

class HttpRooftopMatchEndpoint extends RooftopMatchEndpoint {
  HttpRooftopMatchEndpoint({
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

  static final _listingId = RegExp(r'^[A-Za-z0-9_-]{4,64}$');

  @override
  Future<RooftopMatch> match(Listing listing) async {
    const path = '/api/consumer/listings/network';
    final listingId = _listingId.hasMatch(listing.id) ? listing.id : null;
    final listingUrl = _httpUrl(listing.vdpUrl);
    if (listingId == null && listingUrl == null) {
      return const RooftopMatch.unavailable();
    }
    if (_sessionStore.accessToken == null) {
      return const RooftopMatch.unavailable();
    }
    try {
      final payload = <String, String>{};
      if (listingId != null) payload['listingId'] = listingId;
      if (listingUrl != null) payload['listingUrl'] = listingUrl;
      final response = await _client
          .post(_uri(path), headers: _headers(), body: jsonEncode(payload))
          .timeout(timeout);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        _reportFailure(path, response.statusCode);
        return const RooftopMatch.unavailable();
      }
      final decoded = jsonDecode(response.body);
      if (decoded is! Map) return const RooftopMatch.unavailable();
      return RooftopMatch.parseNetworkResponse(
        Map<String, dynamic>.from(decoded),
        suppliedListingUrl: listingUrl != null,
        listingUrl: listingUrl,
      );
    } on Exception {
      _reportFailure(path, 0);
      return const RooftopMatch.unavailable();
    }
  }

  static String? _httpUrl(String? raw) {
    final url = raw?.trim();
    if (url == null || url.isEmpty) return null;
    if (url.startsWith('https://') || url.startsWith('http://')) return url;
    return null;
  }

  void _reportFailure(String path, int status) {
    ProductAnalytics.instance.track(AnalyticsEvents.apiFailed, {
      'surface': 'rooftop_match',
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
}

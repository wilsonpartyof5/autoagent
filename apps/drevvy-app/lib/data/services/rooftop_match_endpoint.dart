import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../analytics/product_analytics.dart';
import '../models/listing.dart';
import '../models/rooftop_match.dart';
import 'purchase_config.dart';
import 'shopper_session_store.dart';

/// Resolves whether a listing URL matches an onboarded dealer rooftop.
///
/// Tries `GET /api/consumer/listings/:id/rooftop-match`. A missing route
/// (404/405/501), empty base URL, or network failure falls back to the
/// demo stub so simulators still branch in-network vs off-network.
abstract class RooftopMatchEndpoint {
  const RooftopMatchEndpoint();

  static RooftopMatchEndpoint fromConfig(
    PurchaseConfig config, {
    http.Client? client,
  }) {
    final baseUrl = config.apiBaseUrl.trim();
    if (baseUrl.isEmpty) return const StubRooftopMatchEndpoint();
    return HttpRooftopMatchEndpoint(baseUrl: baseUrl, client: client);
  }

  Future<RooftopMatch> match(Listing listing);
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
  Future<RooftopMatch> match(Listing listing) async {
    final path = '/api/consumer/listings/${listing.id}/rooftop-match';
    try {
      final uri = _uri(path).replace(
        queryParameters: {
          if (listing.vdpUrl != null) 'url': listing.vdpUrl!,
        },
      );
      final response = await _client
          .get(uri, headers: _headers())
          .timeout(timeout);
      if (_endpointMissing(response.statusCode)) {
        _log('Rooftop match route missing (${response.statusCode}). Using stub.');
        return StubRooftopMatchEndpoint.stubFor(listing);
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        _reportFailure(path, response.statusCode);
        return StubRooftopMatchEndpoint.stubFor(listing);
      }
      final decoded = jsonDecode(response.body);
      if (decoded is! Map) {
        return StubRooftopMatchEndpoint.stubFor(listing);
      }
      final live = RooftopMatch.fromJson(Map<String, dynamic>.from(decoded));
      return live.copyWith(
        vdpUrl: live.vdpUrl ?? listing.vdpUrl,
        source: RooftopMatchSource.live,
      );
    } on Exception {
      _reportFailure(path, 0);
      return StubRooftopMatchEndpoint.stubFor(listing);
    }
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

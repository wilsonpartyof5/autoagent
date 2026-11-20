import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/json_values.dart';
import 'shopper_session_store.dart';

/// Failure from `POST /api/consumer/otd-requests`.
///
/// A failure is never a recorded request. The live screen does not call
/// [OtdRequestClient.submit] while that submission is on hold.
class OtdRequestException implements Exception {
  const OtdRequestException(this.message, {this.status = 0, this.code});

  final String message;
  final int status;
  final String? code;

  @override
  String toString() => message;
}

/// Row returned by `POST /api/consumer/otd-requests`.
///
/// This is a record that the shopper asked for an out-the-door number. It is
/// not a dealer message and not a key spend.
class OtdRequestReceipt {
  const OtdRequestReceipt({
    required this.id,
    required this.listingId,
    required this.created,
    this.listingUrl,
    this.dealerDomain,
    this.marketcheckDealerId,
  });

  final String id;
  final String listingId;
  final bool created;
  final String? listingUrl;
  final String? dealerDomain;
  final String? marketcheckDealerId;
}

/// Prepared client for `POST /api/consumer/otd-requests`.
///
/// Body is `{ listingId, listingUrl? }`. [listingUrl] is sent only when the
/// caller already has an http(s) URL. The live vehicle screen does not call
/// [submit].
class OtdRequestClient {
  OtdRequestClient({
    required this.baseUrl,
    http.Client? client,
    ShopperSessionStore? sessionStore,
    this.timeout = const Duration(seconds: 8),
  }) : _client = client ?? http.Client(),
       _sessionStore = sessionStore ?? ShopperSessionStore.instance;

  static final _listingId = RegExp(r'^[A-Za-z0-9_-]{4,64}$');

  final String baseUrl;
  final Duration timeout;
  final http.Client _client;
  final ShopperSessionStore _sessionStore;

  Future<OtdRequestReceipt> submit({
    required String listingId,
    String? listingUrl,
  }) async {
    if (!_listingId.hasMatch(listingId)) {
      throw const OtdRequestException(
        'A MarketCheck listing id is required.',
        status: 400,
        code: 'invalid_listing',
      );
    }
    final token = _sessionStore.accessToken;
    if (token == null) {
      throw const OtdRequestException(
        'Sign in to request an out-the-door number.',
        status: 401,
      );
    }
    final url = _httpUrl(listingUrl);
    final payload = <String, String>{'listingId': listingId};
    if (url != null) payload['listingUrl'] = url;
    final response = await _client
        .post(
          _uri('/api/consumer/otd-requests'),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode(payload),
        )
        .timeout(timeout);
    final decoded = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _error(decoded, response.statusCode);
    }
    if (decoded == null || decoded['success'] == false) {
      throw _error(decoded, response.statusCode);
    }
    final data = decoded['data'];
    if (data is! Map) {
      throw const OtdRequestException(
        'Out-the-door response was not a request.',
      );
    }
    final row = Map<String, dynamic>.from(data);
    final id = jsonString(row['id']);
    final savedListingId = jsonString(row['listingId']);
    if (id == null || savedListingId == null) {
      throw const OtdRequestException(
        'Out-the-door response was not a request.',
      );
    }
    return OtdRequestReceipt(
      id: id,
      listingId: savedListingId,
      created: decoded['created'] == true,
      listingUrl: jsonString(row['listingUrl']),
      dealerDomain: jsonString(row['dealerDomain']),
      marketcheckDealerId: jsonString(row['marketcheckDealerId']),
    );
  }

  Map<String, dynamic>? _decode(String body) {
    if (body.trim().isEmpty) return null;
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } on FormatException {
      return null;
    }
    return null;
  }

  OtdRequestException _error(Map<String, dynamic>? root, int status) {
    final error = root?['error'];
    final payload = error is Map ? Map<String, dynamic>.from(error) : null;
    return OtdRequestException(
      jsonString(payload?['message']) ??
          'Drevvy could not save this out-the-door request.',
      status: status,
      code: jsonString(payload?['code']),
    );
  }

  static String? _httpUrl(String? raw) {
    final url = raw?.trim();
    if (url == null || url.isEmpty) return null;
    if (url.startsWith('https://') || url.startsWith('http://')) return url;
    return null;
  }

  Uri _uri(String path) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$root$path');
  }
}

import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/json_values.dart';
import '../models/listing.dart';
import 'purchase_config.dart';
import 'shopper_session_store.dart';

/// Plain copy for each Ask failure. Third-grade reading level.
class AskCopy {
  static const invalidRequest = 'Try asking that a different way.';
  static const signedOut = 'Sign in to ask.';
  static const dealerAccount = 'Ask is for shoppers.';
  static const rateLimited = "You've asked a lot. Try again later.";
  static const busy = 'Ask is busy. Try again in a minute.';
  static const network = "We couldn't send that. Try again.";
  static const tooLong = 'That is too long. Use 500 letters or less.';
  static const notConfigured = 'Ask is not set up in this build.';
}

/// Failure from `POST /api/consumer/ask`. [message] is shopper copy, never
/// the server's raw text. [canRetry] says whether a retry button helps.
class AskException implements Exception {
  const AskException({
    required this.code,
    required this.message,
    this.status = 0,
    this.canRetry = false,
  });

  final String code;
  final String message;
  final int status;
  final bool canRetry;

  @override
  String toString() => 'AskException($status, $code)';
}

/// A 200 from `POST /api/consumer/ask`.
class AskResult {
  const AskResult({
    required this.reply,
    required this.conversationId,
    this.listings = const [],
    this.total,
    this.filters = const {},
  });

  final String reply;
  final String conversationId;
  final List<Listing> listings;
  final int? total;
  final Map<String, dynamic> filters;
}

/// Shopper Ask. Matches backend PR #165 (`POST /api/consumer/ask`):
///
/// `POST {DREVVY_API_BASE_URL}/api/consumer/ask`
/// `Authorization: Bearer <shopper Supabase JWT>`
/// Body: `{message (1-500 chars), conversationId?, lat?, lng?, zip?}`
/// `conversationId` is an opaque signed string (`<uuid>.<hmac>`, 101 chars).
/// The app treats it as opaque: any non-empty trimmed value of 128 characters
/// or fewer is stored from the latest 200 and echoed back unchanged.
/// `lat` and `lng` are sent together. `zip` is 5 digits or ZIP+4.
/// 200: `{reply, conversationId, filters, listings, total}`. `listings` use
/// the public Discover card shape. The server is stateless, so the app keeps
/// the thread. A malformed id is replaced by the server, not rejected.
/// Errors: `{success:false, error:{code, message}}` with 400 invalid_request,
/// 401 unauthorized, 403 dealer_account, 403 conversation_forbidden,
/// 413 invalid_request (body over 8KB), 429 rate_limited,
/// 503 ask_unavailable. The backend never returns 500. Ask spends no keys.
abstract class AskEndpoint {
  const AskEndpoint();

  static const maxMessageLength = 500;

  static AskEndpoint fromConfig(PurchaseConfig config, {http.Client? client}) {
    if (!config.isLive) return const UnusedAskEndpoint();
    if (config.apiBaseUrl.trim().isEmpty) {
      return const UnconfiguredAskEndpoint();
    }
    return HttpAskEndpoint(baseUrl: config.apiBaseUrl, client: client);
  }

  Future<AskResult> ask({
    required String message,
    String? conversationId,
    double? lat,
    double? lng,
    String? zip,
  });
}

/// Demo builds answer from the sample paragraph. This is never called.
class UnusedAskEndpoint extends AskEndpoint {
  const UnusedAskEndpoint();

  @override
  Future<AskResult> ask({
    required String message,
    String? conversationId,
    double? lat,
    double? lng,
    String? zip,
  }) async {
    throw const AskException(code: 'demo', message: AskCopy.notConfigured);
  }
}

class UnconfiguredAskEndpoint extends AskEndpoint {
  const UnconfiguredAskEndpoint();

  @override
  Future<AskResult> ask({
    required String message,
    String? conversationId,
    double? lat,
    double? lng,
    String? zip,
  }) async {
    throw const AskException(
      code: 'not_configured',
      message: AskCopy.notConfigured,
    );
  }
}

class HttpAskEndpoint extends AskEndpoint {
  HttpAskEndpoint({
    required this.baseUrl,
    http.Client? client,
    ShopperSessionStore? sessionStore,
    this.timeout = const Duration(seconds: 45),
  }) : _client = client ?? http.Client(),
       _sessionStore = sessionStore ?? ShopperSessionStore.instance;

  final String baseUrl;
  final Duration timeout;
  final http.Client _client;
  final ShopperSessionStore _sessionStore;

  /// Opaque conversation ids from #165 are `<uuid>.<hmac>` (101 chars).
  /// Accept any non-empty trimmed value at or under this cap; do not
  /// otherwise validate the shape. The server issues a fresh id when the
  /// presented value is malformed.
  static const maxConversationIdLength = 128;
  static final _zip = RegExp(r'^\d{5}(-\d{4})?$');

  static bool isOpaqueConversationId(String? value) {
    final id = value?.trim() ?? '';
    return id.isNotEmpty && id.length <= maxConversationIdLength;
  }

  @override
  Future<AskResult> ask({
    required String message,
    String? conversationId,
    double? lat,
    double? lng,
    String? zip,
  }) async {
    final text = message.trim();
    if (text.isEmpty) {
      throw const AskException(
        code: 'invalid_request',
        message: AskCopy.invalidRequest,
      );
    }
    if (text.length > AskEndpoint.maxMessageLength) {
      throw const AskException(code: 'too_long', message: AskCopy.tooLong);
    }
    final token = _sessionStore.accessToken;
    if (token == null || token.isEmpty) {
      throw const AskException(
        code: 'unauthorized',
        message: AskCopy.signedOut,
        status: 401,
      );
    }

    final body = <String, Object>{'message': text};
    final id = conversationId?.trim();
    if (id != null && isOpaqueConversationId(id)) {
      body['conversationId'] = id;
    }
    final hasCoords =
        lat != null &&
        lng != null &&
        lat.isFinite &&
        lng.isFinite &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        !(lat == 0 && lng == 0);
    if (hasCoords) {
      body['lat'] = lat;
      body['lng'] = lng;
    }
    final trimmedZip = zip?.trim();
    if (trimmedZip != null && _zip.hasMatch(trimmedZip)) {
      body['zip'] = trimmedZip;
    }

    final http.Response response;
    try {
      response = await _client
          .post(
            _uri('/api/consumer/ask'),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode(body),
          )
          .timeout(timeout);
    } on TimeoutException {
      throw const AskException(
        code: 'timeout',
        message: AskCopy.network,
        canRetry: true,
      );
    } on Exception {
      throw const AskException(
        code: 'network',
        message: AskCopy.network,
        canRetry: true,
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _error(response);
    }
    return _parse(response.body);
  }

  AskResult _parse(String raw) {
    Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } on FormatException {
      decoded = null;
    }
    if (decoded is! Map) throw _malformed;
    var root = Map<String, dynamic>.from(decoded);
    // Tolerate a `{success, data}` envelope like other consumer routes.
    if (root['data'] is Map) {
      root = Map<String, dynamic>.from(root['data'] as Map);
    }
    final reply = jsonString(root['reply'])?.trim();
    final conversationId = jsonString(root['conversationId'])?.trim();
    if (reply == null || reply.isEmpty) throw _malformed;
    final listings = <Listing>[];
    final rawList = root['listings'];
    if (rawList is List) {
      for (final item in rawList) {
        if (item is! Map) continue;
        final listing = Listing.tryFromJson(Map<String, dynamic>.from(item));
        if (listing != null) listings.add(listing);
      }
    }
    final filters = root['filters'];
    return AskResult(
      reply: reply,
      conversationId: conversationId ?? '',
      listings: listings,
      total: jsonInt(root['total']),
      filters: filters is Map ? Map<String, dynamic>.from(filters) : const {},
    );
  }

  static const _malformed = AskException(
    code: 'malformed',
    message: AskCopy.network,
    canRetry: true,
  );

  AskException _error(http.Response response) {
    String? code;
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map && decoded['error'] is Map) {
        code = jsonString((decoded['error'] as Map)['code']);
      }
    } on FormatException {
      code = null;
    }
    final status = response.statusCode;
    switch (status) {
      case 400:
      case 413:
        return AskException(
          code: code ?? 'invalid_request',
          message: AskCopy.invalidRequest,
          status: status,
        );
      case 401:
        return AskException(
          code: code ?? 'unauthorized',
          message: AskCopy.signedOut,
          status: status,
        );
      case 403:
        if (code == 'conversation_forbidden') {
          return AskException(
            code: 'conversation_forbidden',
            message: AskCopy.network,
            status: status,
            canRetry: true,
          );
        }
        return AskException(
          code: code ?? 'dealer_account',
          message: AskCopy.dealerAccount,
          status: status,
        );
      case 429:
        return AskException(
          code: code ?? 'rate_limited',
          message: AskCopy.rateLimited,
          status: status,
        );
      case 503:
        return AskException(
          code: code ?? 'ask_unavailable',
          message: AskCopy.busy,
          status: status,
          canRetry: true,
        );
      default:
        return AskException(
          code: code ?? 'http_$status',
          message: AskCopy.network,
          status: status,
          canRetry: status >= 500 || status == 404 || status == 408,
        );
    }
  }

  Uri _uri(String path) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$root$path');
  }
}

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../../core/config/api_config_exception.dart';
import '../analytics/product_analytics.dart';
import '../models/car_pack.dart';
import '../models/listing.dart';
import '../models/market_intel_brief.dart';
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
    this.errorCode,
    this.statusCode,
    this.brief,
    this.refunded = false,
    this.held = false,
    this.unlockState,
  });

  final bool ok;
  final CarCreditBalance? balance;
  final String? dealId;
  final KeySpendSource source;
  final String? message;
  final MarketIntelBrief? brief;

  /// True only when the server confirmed the key was returned.
  final bool refunded;

  /// True when a key is still held and the lookup is not finished.
  final bool held;

  final String? unlockState;

  /// Server `error.code` when the response included one. Null on success.
  final String? errorCode;

  /// HTTP status. `0` means the request never got a response.
  final int? statusCode;

  const KeySpendResult.unavailable()
    : ok = false,
      balance = null,
      dealId = null,
      source = KeySpendSource.missing,
      message = null,
      errorCode = null,
      statusCode = null,
      brief = null,
      refunded = false,
      held = false,
      unlockState = null;

  /// Live mode refused a local spend. [ok] is false.
  const KeySpendResult.blocked(this.message, {this.errorCode})
    : ok = false,
      balance = null,
      dealId = null,
      source = KeySpendSource.blocked,
      statusCode = null,
      brief = null,
      refunded = false,
      held = false,
      unlockState = null;
}

enum KeySpendSource { live, stub, missing, blocked }

/// Live spend routes from backend PRs, with a missing-route fallback.
///
/// - Key A: `POST /api/consumer/keys/market-save` `{listingId, vin}`
/// - Key B: `POST /api/consumer/deals` `{listingId, vehicle: {year, make, model, price}}`
/// - Off-network OTD is `POST /api/consumer/otd-requests`. This client does
///   not send it. Submission stays unavailable until that hold is cleared.
abstract class KeySpendEndpoint {
  const KeySpendEndpoint();

  static KeySpendEndpoint fromConfig(
    PurchaseConfig config, {
    http.Client? client,
  }) {
    final baseUrl = config.apiBaseUrl.trim();
    // Demo keeps the local ledger and never posts a spend, even with a URL.
    if (!config.isLive) return const MissingKeySpendEndpoint();
    if (baseUrl.isEmpty) return const UnconfiguredKeySpendEndpoint();
    return HttpKeySpendEndpoint(baseUrl: baseUrl, client: client, strict: true);
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

/// Live mode with no base URL. Does not report a local key spend as done.
class UnconfiguredKeySpendEndpoint extends KeySpendEndpoint {
  const UnconfiguredKeySpendEndpoint();

  @override
  Future<KeySpendResult> spendMarketSave(Listing listing) async {
    return const KeySpendResult.blocked(apiNotConfiguredMessage);
  }

  @override
  Future<KeySpendResult> startConversation({
    required Listing listing,
    required RooftopMatch match,
    String? templateId,
    String? message,
  }) async {
    return const KeySpendResult.blocked(apiNotConfiguredMessage);
  }

  @override
  Future<KeySpendResult> requestOtdNumber(
    Listing listing, {
    String? note,
  }) async {
    return const KeySpendResult.blocked(apiNotConfiguredMessage);
  }
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
    this.strict = false,
    this.timeout = const Duration(seconds: 8),
  }) : _client = client ?? http.Client(),
       _sessionStore = sessionStore ?? ShopperSessionStore.instance;

  final String baseUrl;
  final bool strict;
  final Duration timeout;
  final http.Client _client;
  final ShopperSessionStore _sessionStore;
  final void Function(String message)? log;

  @override
  Future<KeySpendResult> spendMarketSave(Listing listing) {
    return _post(
      '/api/consumer/keys/market-save',
      {'listingId': listing.id, 'vin': listing.vin},
      surface: 'market_save',
      requiresSignIn: true,
      timeout: const Duration(seconds: 90),
    );
  }

  @override
  Future<KeySpendResult> startConversation({
    required Listing listing,
    required RooftopMatch match,
    String? templateId,
    String? message,
  }) {
    // The server writes the opener. A chip id or a draft message is not
    // part of the create body, and neither is a rooftop id or listing URL.
    final vehicle = _conversationVehicle(listing);
    if (vehicle == null) {
      return Future.value(
        const KeySpendResult.blocked(
          'This car has no listed price yet.',
          errorCode: 'invalid_vehicle',
        ),
      );
    }
    return _post(
      '/api/consumer/deals',
      {'listingId': listing.id, 'vehicle': vehicle},
      surface: 'dealer_conversation',
      requiresSignIn: true,
      conversation: true,
    );
  }

  @override
  Future<KeySpendResult> requestOtdNumber(
    Listing listing, {
    String? note,
  }) async {
    return const KeySpendResult.blocked(
      'An out-the-door request is not available yet.',
    );
  }

  /// Year, make, model, and price. Nothing else is sent.
  /// A missing price, year, make, or model does not post.
  Map<String, Object>? _conversationVehicle(Listing listing) {
    final year = listing.build.year;
    final make = listing.build.make.trim();
    final model = listing.build.model.trim();
    final price = listing.price;
    if (year < 1980 || year > 2100) return null;
    if (make.isEmpty || model.isEmpty || price == null) return null;
    return {'year': year, 'make': make, 'model': model, 'price': price};
  }

  Future<KeySpendResult> _post(
    String path,
    Map<String, Object?> body, {
    required String surface,
    bool requiresSignIn = false,
    bool conversation = false,
    Duration? timeout,
  }) async {
    if (requiresSignIn && _sessionStore.accessToken == null) {
      if (strict) {
        return const KeySpendResult.blocked(
          'Sign in to use a key.',
          errorCode: 'signed_out',
        );
      }
      return const KeySpendResult.unavailable();
    }
    try {
      final response = await _client
          .post(_uri(path), headers: _headers(), body: jsonEncode(body))
          .timeout(timeout ?? this.timeout);
      if (_endpointMissing(response.statusCode)) {
        if (strict) {
          return KeySpendResult.blocked(
            'Key spend route $path is not available.',
          );
        }
        _log(
          'Key spend route $path missing (${response.statusCode}). Using stub.',
        );
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
          errorCode: _errorCode(response.body),
          statusCode: response.statusCode,
        );
      }
      return _parse(response.body, conversation: conversation);
    } on Exception {
      ProductAnalytics.instance.track(AnalyticsEvents.apiFailed, {
        'surface': surface,
        'status': 0,
      });
      if (strict || (requiresSignIn && _sessionStore.accessToken != null)) {
        return const KeySpendResult(
          ok: false,
          source: KeySpendSource.live,
          message: 'Drevvy could not reach the server.',
          errorCode: 'unreachable',
          statusCode: 0,
        );
      }
      return const KeySpendResult.unavailable();
    }
  }

  KeySpendResult _parse(String body, {bool conversation = false}) {
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
    final credits = root['credits'];
    if (credits is Map) {
      balance = _balanceFrom(
        Map<String, dynamic>.from(credits),
        purchasedFallback: 0,
      );
    }
    balance ??= _balanceFrom(payload, purchasedFallback: null);
    final deal = payload['deal'];
    String? dealId;
    if (deal is Map && deal['id'] is String) {
      dealId = deal['id'] as String;
    } else if (payload['dealId'] is String) {
      dealId = payload['dealId'] as String;
    } else if (conversation && payload['id'] is String) {
      dealId = payload['id'] as String;
    }
    final refused =
        root['unlocked'] == false ||
        root['available'] == false ||
        root['reason'] == 'market_unavailable';
    final message = root['message'];
    return KeySpendResult(
      ok:
          root['success'] != false &&
          payload['ok'] != false &&
          payload['success'] != false &&
          !refused,
      balance: balance,
      dealId: dealId,
      source: KeySpendSource.live,
      message: message is String ? message : null,
      brief: MarketIntelBrief.tryParse(root['market']),
      refunded: root['refunded'] == true,
      held: root['held'] == true,
      unlockState: root['unlockState'] is String ? root['unlockState'] as String : null,
    );
  }

  CarCreditBalance? _balanceFrom(
    Map<String, dynamic> payload, {
    required int? purchasedFallback,
  }) {
    final rawBalance = payload['balance'];
    if (rawBalance is! num) return null;
    final fallback = purchasedFallback ?? rawBalance.toInt();
    return CarCreditBalance(
      balance: rawBalance.toInt(),
      totalPurchased: _intField(payload, const [
        'lifetimePurchased',
        'totalPurchased',
      ], fallback),
      totalSpent: _intField(payload, const ['lifetimeUsed', 'totalSpent'], 0),
      totalRefunded: _intField(payload, const [
        'lifetimeRefunded',
        'totalRefunded',
      ], 0),
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

  String? _errorCode(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is! Map) return null;
      final error = decoded['error'];
      if (error is Map && error['code'] is String) {
        final code = (error['code'] as String).trim();
        if (code.isNotEmpty) return code;
      }
    } on FormatException {
      return null;
    }
    return null;
  }
}

/// Keeps the balance on screen from disagreeing with the unlock message.
///
/// A confirmed refund must not show a lower balance than the spend response.
/// A key that is still held must not show a higher balance than that response.
int reconcileUnlockBalance({
  required int responseBalance,
  required int? refreshed,
  required bool keyBack,
  required bool stillHeld,
}) {
  if (refreshed == null) return responseBalance;
  if (keyBack && refreshed < responseBalance) return responseBalance;
  if (stillHeld && refreshed > responseBalance) return responseBalance;
  return refreshed;
}

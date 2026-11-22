import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/config/api_config_exception.dart';
import '../../core/theme/drevvy_tokens.dart';
import '../models/deal.dart';
import '../models/deal_chip_inputs.dart';
import '../models/listing.dart';
import 'purchase_config.dart';
import 'shopper_session_store.dart';

/// A deals call failed. [message] is plain shopper copy.
class ConsumerDealsException implements Exception {
  const ConsumerDealsException(this.message, {this.status = 0, this.code});

  final String message;
  final int status;
  final String? code;

  @override
  String toString() => message;
}

/// One page of `GET /api/consumer/deals`.
class ConsumerDealsPage {
  const ConsumerDealsPage({required this.deals, this.balance});

  final List<Deal> deals;

  /// `credits.balance` when the payload included a number. Lifetime totals
  /// are not in this summary, so callers should not rebuild them from it.
  final int? balance;
}

/// Shopper deals and the in-app thread.
///
/// Demo mode does not call these routes. Live with no origin fails closed.
abstract class ConsumerDealsEndpoint {
  const ConsumerDealsEndpoint();

  static ConsumerDealsEndpoint fromConfig(
    PurchaseConfig config, {
    http.Client? client,
  }) {
    if (!config.isLive) return const UnusedConsumerDealsEndpoint();
    if (config.apiBaseUrl.trim().isEmpty) {
      return const UnconfiguredConsumerDealsEndpoint();
    }
    return HttpConsumerDealsEndpoint(
      baseUrl: config.apiBaseUrl,
      client: client,
    );
  }

  Future<ConsumerDealsPage> list();

  Future<List<DealThreadMessage>> readThread(String dealId);

  Future<List<DealThreadMessage>> postMessage(String dealId, String body);
}

class UnusedConsumerDealsEndpoint extends ConsumerDealsEndpoint {
  const UnusedConsumerDealsEndpoint();

  @override
  Future<ConsumerDealsPage> list() async {
    throw const ConsumerDealsException(
      'Deals stay on this device in demo mode.',
    );
  }

  @override
  Future<List<DealThreadMessage>> postMessage(String dealId, String body) {
    throw const ConsumerDealsException(
      'Deals stay on this device in demo mode.',
    );
  }

  @override
  Future<List<DealThreadMessage>> readThread(String dealId) {
    throw const ConsumerDealsException(
      'Deals stay on this device in demo mode.',
    );
  }
}

class UnconfiguredConsumerDealsEndpoint extends ConsumerDealsEndpoint {
  const UnconfiguredConsumerDealsEndpoint();

  @override
  Future<ConsumerDealsPage> list() async {
    throw const ConsumerDealsException(apiNotConfiguredMessage);
  }

  @override
  Future<List<DealThreadMessage>> postMessage(String dealId, String body) {
    throw const ConsumerDealsException(apiNotConfiguredMessage);
  }

  @override
  Future<List<DealThreadMessage>> readThread(String dealId) {
    throw const ConsumerDealsException(apiNotConfiguredMessage);
  }
}

class HttpConsumerDealsEndpoint extends ConsumerDealsEndpoint {
  HttpConsumerDealsEndpoint({
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

  static const listFailed = 'Drevvy could not load your deals. Try again.';
  static const threadFailed = 'Drevvy could not load this chat. Try again.';
  static const sendFailed = 'That text did not send. Try again.';
  static const unreachable = 'Drevvy could not reach the dealer. Try again.';
  static const signInDeals = 'Sign in to see your deals.';
  static const signInChat = 'Sign in to text this dealer.';

  @override
  Future<ConsumerDealsPage> list() async {
    if (_sessionStore.accessToken == null) {
      throw const ConsumerDealsException(signInDeals);
    }
    final decoded = await _send(
      method: 'GET',
      path: '/api/consumer/deals',
      signedOut: signInDeals,
      failed: listFailed,
    );
    return _parseList(decoded);
  }

  @override
  Future<List<DealThreadMessage>> readThread(String dealId) async {
    if (_sessionStore.accessToken == null) {
      throw const ConsumerDealsException(signInChat);
    }
    final decoded = await _send(
      method: 'GET',
      path: '/api/consumer/deals/${Uri.encodeComponent(dealId)}/messages',
      signedOut: signInChat,
      failed: threadFailed,
    );
    return _parseThread(decoded);
  }

  @override
  Future<List<DealThreadMessage>> postMessage(String dealId, String body) async {
    final text = body.trim();
    if (text.isEmpty) {
      throw const ConsumerDealsException(sendFailed);
    }
    if (_sessionStore.accessToken == null) {
      throw const ConsumerDealsException(signInChat);
    }
    final decoded = await _send(
      method: 'POST',
      path: '/api/consumer/deals/${Uri.encodeComponent(dealId)}/messages',
      // Shopper text only. No name, phone, or email.
      jsonBody: {'body': text},
      signedOut: signInChat,
      failed: sendFailed,
    );
    return _parseThread(decoded);
  }

  Future<Map<String, dynamic>> _send({
    required String method,
    required String path,
    required String signedOut,
    required String failed,
    Map<String, Object?>? jsonBody,
  }) async {
    if (_sessionStore.accessToken == null) {
      throw ConsumerDealsException(signedOut);
    }
    try {
      final request = http.Request(method, _uri(path))
        ..headers.addAll(_headers(json: jsonBody != null));
      if (jsonBody != null) request.body = jsonEncode(jsonBody);
      final response = await _client.send(request).timeout(timeout);
      final raw = await response.stream.bytesToString();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ConsumerDealsException(
          failed,
          status: response.statusCode,
          code: _errorCode(raw),
        );
      }
      if (raw.trim().isEmpty) {
        return const {'success': true};
      }
      final decoded = jsonDecode(raw);
      if (decoded is! Map) {
        throw ConsumerDealsException(failed, status: response.statusCode);
      }
      final root = Map<String, dynamic>.from(decoded);
      if (root['success'] == false) {
        throw ConsumerDealsException(
          failed,
          status: response.statusCode,
          code: _errorCode(raw),
        );
      }
      return root;
    } on ConsumerDealsException {
      rethrow;
    } on FormatException {
      throw ConsumerDealsException(failed);
    } on Exception {
      throw ConsumerDealsException(unreachable);
    }
  }

  Map<String, String> _headers({required bool json}) {
    final headers = <String, String>{'Accept': 'application/json'};
    if (json) headers['Content-Type'] = 'application/json';
    final token = _sessionStore.accessToken;
    if (token != null) headers['Authorization'] = 'Bearer $token';
    return headers;
  }

  Uri _uri(String path) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$root$path');
  }
}

/// Reads `GET /api/consumer/deals`.
///
/// Assumed and handled here:
/// - `data` is a list of deals. A missing list, or `success: false`, fails
///   the load. One bad row is skipped so the rest can still show.
/// - Each row uses `id`, `listingId`, `status`, `endState`, `createdAt`,
///   and `vehicle` `{year, make, model, price}`. Optional vehicle fields
///   kept for the card are trim, vin, miles, city, state, condition, and
///   an https `thumbnailUrl`.
/// - `interested` is shown as Reaching out. `negotiating` is Waiting on
///   price. `accepted` is Accepted. `closed` is No response.
/// - `endState` `sold` is No longer listed. `ended_no_response`,
///   `dealer_declined`, and `removed` are No response. Any other end state
///   uses `status`. A missing end state is treated as still open.
/// - There is no dealer letter. Letters are A, B, C in list order.
/// - `createdAt` that is not a date uses 1970-01-01 so the card does not
///   pretend the deal started now.
/// - A price that is not a whole number drops that row.
/// - `credits.balance` updates the key count when it is a number.
///   `canAdd` and `reason` are not shown.
/// - `fairPrice`, `trimNotice`, `visit`, `findSimilar`,
///   `outreachLockedUntilPaid`, `updatedAt`, `quota`, dealer name, phone,
///   email, and address are not copied onto the deal.
ConsumerDealsPage _parseList(Map<String, dynamic> root) {
  final data = root['data'];
  if (data is! List) {
    throw const ConsumerDealsException(HttpConsumerDealsEndpoint.listFailed);
  }
  final deals = <Deal>[];
  for (final item in data) {
    if (item is! Map) continue;
    final deal = _dealFromRow(Map<String, dynamic>.from(item), deals.length);
    if (deal != null) deals.add(deal);
  }
  return ConsumerDealsPage(deals: deals, balance: _balance(root['credits']));
}

int? _balance(Object? credits) {
  if (credits is! Map) return null;
  final value = credits['balance'];
  if (value is num && value.isFinite) return value.toInt();
  return null;
}

Deal? _dealFromRow(Map<String, dynamic> row, int index) {
  final id = _text(row['id']);
  final listingId = _text(row['listingId']);
  final vehicle = row['vehicle'];
  if (id == null || listingId == null || vehicle is! Map) return null;
  final car = Map<String, dynamic>.from(vehicle);
  final year = _whole(car['year']);
  final make = _text(car['make']);
  final model = _text(car['model']);
  final price = _whole(car['price']);
  if (year == null ||
      make == null ||
      model == null ||
      price == null ||
      year < 1980 ||
      year > 2100 ||
      price < 0) {
    return null;
  }
  final vin = _vin(car['vin']);
  final miles = _whole(car['miles']);
  final city = _place(car['city']);
  final state = _place(car['state']);
  final photo = _https(car['thumbnailUrl']);
  return Deal(
    id: id,
    listingId: listingId,
    letter: _letter(index),
    status: _status(row),
    listedAtStart: price,
    addedAt: DateTime.tryParse(_text(row['createdAt']) ?? '') ??
        DateTime.utc(1970),
    serverThread: true,
    listing: Listing(
      id: listingId,
      vin: vin,
      price: price,
      miles: miles != null && miles >= 0 ? miles : null,
      build: ListingBuild(
        year: year,
        make: make,
        model: model,
        trim: _text(car['trim']),
      ),
      media: ListingMedia(photoLinks: [?photo]),
      inventoryType: _inventory(car['condition']),
      carLocation: city == null && state == null
          ? null
          : CarLocation(city: city, state: state),
    ),
  );
}

/// `GET` and `POST /api/consumer/deals/:id/messages`.
///
/// Assumed and handled here:
/// - The thread is `data`. `messages` is a list. A missing list fails.
/// - Each message uses `author` and `body`. `id`, `kind`, and `sentAt` are
///   not shown. `kind` must be `chat`, `opener`, or `numbers` when it is
///   present. An unknown kind is dropped.
/// - Authors kept are `shopper`, `salesperson`, and `drevvy`. Anything else
///   is dropped so a name, phone, or email cannot become the label.
/// - `shopperFirstName` is not shown. Shopper rows have no name label.
/// - If `messages` is empty and `opener` is plain text, that opener is
///   shown as a Drevvy row. An opener with `@` is dropped.
/// - Phone, email, last name, and any other extra fields are ignored.
List<DealThreadMessage> _parseThread(Map<String, dynamic> root) {
  final data = root['data'];
  if (data is! Map) {
    throw const ConsumerDealsException(HttpConsumerDealsEndpoint.threadFailed);
  }
  final payload = Map<String, dynamic>.from(data);
  final raw = payload['messages'];
  if (raw is! List) {
    throw const ConsumerDealsException(HttpConsumerDealsEndpoint.threadFailed);
  }
  final messages = <DealThreadMessage>[];
  for (final item in raw) {
    if (item is! Map) continue;
    final message = _messageFrom(Map<String, dynamic>.from(item));
    if (message != null) messages.add(message);
  }
  if (messages.isEmpty) {
    final opener = _opener(payload['opener']);
    if (opener != null) {
      messages.add(DealThreadMessage(author: 'drevvy', body: opener));
    }
  }
  return messages;
}

DealThreadMessage? _messageFrom(Map<String, dynamic> row) {
  final author = _text(row['author'])?.toLowerCase();
  final body = _text(row['body']);
  if (body == null) return null;
  if (author != 'shopper' && author != 'salesperson' && author != 'drevvy') {
    return null;
  }
  final kind = row['kind'];
  if (kind != null &&
      kind != 'chat' &&
      kind != 'opener' &&
      kind != 'numbers') {
    return null;
  }
  return DealThreadMessage(author: author, body: body);
}

String? _opener(Object? value) {
  final text = _text(value);
  if (text == null || text.contains('@')) return null;
  return text;
}

DealStatus _status(Map<String, dynamic> row) {
  switch (_text(row['endState'])) {
    case 'sold':
      return DealStatus.noLongerListed;
    case 'ended_no_response':
    case 'dealer_declined':
    case 'removed':
      return DealStatus.noResponse;
    case 'open':
    case null:
      break;
    default:
      break;
  }
  return switch (_text(row['status'])) {
    'negotiating' => DealStatus.findingBestPrice,
    'accepted' => DealStatus.accepted,
    'closed' => DealStatus.noResponse,
    _ => DealStatus.reachingOut,
  };
}

String _letter(int index) {
  if (index >= 0 && index < 26) return String.fromCharCode(65 + index);
  return 'A';
}

String _inventory(Object? condition) {
  return switch (_text(condition)) {
    'new' => 'new',
    'certified' => 'cpo',
    _ => 'used',
  };
}

String? _text(Object? value) {
  if (value is! String) return null;
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  return trimmed;
}

String? _place(Object? value) {
  final text = _text(value);
  if (text == null || text.contains('@') || text.length > 80) return null;
  return text;
}

String _vin(Object? value) {
  final text = _text(value);
  if (text == null) return '';
  if (!RegExp(r'^[A-Za-z0-9]{11,17}$').hasMatch(text)) return '';
  return text;
}

String? _https(Object? value) {
  final text = _text(value);
  if (text == null || !text.startsWith('https://')) return null;
  return text;
}

int? _whole(Object? value) {
  if (value is int) return value;
  if (value is num && value.isFinite && value == value.roundToDouble()) {
    return value.toInt();
  }
  if (value is String) return int.tryParse(value.trim());
  return null;
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

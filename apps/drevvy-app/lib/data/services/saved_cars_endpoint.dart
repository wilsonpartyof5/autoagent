import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/config/api_config_exception.dart';
import '../models/json_values.dart';
import '../models/listing.dart';
import '../models/saved_car.dart';
import 'purchase_config.dart';
import 'shopper_session_store.dart';

/// Failure from `GET`, `POST`, or `DELETE /api/consumer/saved-cars`.
/// Callers show [message] and retry. They do not keep a local success.
class SavedCarsException implements Exception {
  const SavedCarsException(this.message, {this.status = 0});

  final String message;
  final int status;

  @override
  String toString() => message;
}

/// One saved-car row plus the live listing shell the server attached.
class SavedCarRecord {
  const SavedCarRecord({required this.car, this.listing});

  final SavedCar car;
  final Listing? listing;
}

abstract class SavedCarsEndpoint {
  const SavedCarsEndpoint();

  static SavedCarsEndpoint fromConfig(
    PurchaseConfig config, {
    http.Client? client,
  }) {
    if (!config.isLive) return const UnusedSavedCarsEndpoint();
    if (config.apiBaseUrl.trim().isEmpty) {
      return const UnconfiguredSavedCarsEndpoint();
    }
    return HttpSavedCarsEndpoint(baseUrl: config.apiBaseUrl, client: client);
  }

  Future<List<SavedCarRecord>> list();

  Future<SavedCarRecord> save({required String listingId, String? vin});

  Future<void> delete(String listingId);
}

class UnusedSavedCarsEndpoint extends SavedCarsEndpoint {
  const UnusedSavedCarsEndpoint();

  @override
  Future<void> delete(String listingId) async {}

  @override
  Future<List<SavedCarRecord>> list() async => const [];

  @override
  Future<SavedCarRecord> save({required String listingId, String? vin}) async {
    throw const SavedCarsException(
      'Saved cars stay on this device in demo mode.',
    );
  }
}

class UnconfiguredSavedCarsEndpoint extends SavedCarsEndpoint {
  const UnconfiguredSavedCarsEndpoint();

  @override
  Future<void> delete(String listingId) async {
    throw const SavedCarsException(apiNotConfiguredMessage);
  }

  @override
  Future<List<SavedCarRecord>> list() async {
    throw const SavedCarsException(apiNotConfiguredMessage);
  }

  @override
  Future<SavedCarRecord> save({required String listingId, String? vin}) async {
    throw const SavedCarsException(apiNotConfiguredMessage);
  }
}

class HttpSavedCarsEndpoint extends SavedCarsEndpoint {
  HttpSavedCarsEndpoint({
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
  Future<List<SavedCarRecord>> list() async {
    final response = await _send(
      () => _client.get(_uri('/api/consumer/saved-cars'), headers: _headers()),
    );
    final data = _data(response);
    if (data is! List) {
      throw const SavedCarsException('Saved cars response was not a list.');
    }
    return [
      for (final item in data)
        if (item is Map) parseSavedCarView(Map<String, dynamic>.from(item)),
    ];
  }

  @override
  Future<SavedCarRecord> save({required String listingId, String? vin}) async {
    final trimmedVin = vin?.trim();
    final response = await _send(
      () => _client.post(
        _uri('/api/consumer/saved-cars'),
        headers: _headers(),
        body: jsonEncode({
          'listingId': listingId,
          if (trimmedVin != null && trimmedVin.isNotEmpty) 'vin': trimmedVin,
        }),
      ),
    );
    final data = _data(response);
    if (data is! Map) {
      throw const SavedCarsException('Saved car response was not a car.');
    }
    return parseSavedCarView(Map<String, dynamic>.from(data));
  }

  @override
  Future<void> delete(String listingId) async {
    await _send(
      () => _client.delete(
        _uri('/api/consumer/saved-cars/${Uri.encodeComponent(listingId)}'),
        headers: _headers(),
      ),
    );
  }

  Future<http.Response> _send(Future<http.Response> Function() send) async {
    final token = _sessionStore.accessToken;
    if (token == null) {
      throw const SavedCarsException('Sign in to see saved cars.', status: 401);
    }
    try {
      final response = await send().timeout(timeout);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw SavedCarsException(
          _errorMessage(response.body),
          status: response.statusCode,
        );
      }
      return response;
    } on SavedCarsException {
      rethrow;
    } on Exception {
      throw const SavedCarsException('Drevvy could not reach the server.');
    }
  }

  Object? _data(http.Response response) {
    if (response.body.trim().isEmpty) return null;
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) return decoded;
    final root = Map<String, dynamic>.from(decoded);
    if (root['success'] == false) {
      throw SavedCarsException(
        _errorMessage(response.body),
        status: response.statusCode,
      );
    }
    return root.containsKey('data') ? root['data'] : root;
  }

  Map<String, String> _headers() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer ${_sessionStore.accessToken}',
    };
  }

  Uri _uri(String path) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$root$path');
  }
}

String _errorMessage(String body) {
  try {
    final decoded = jsonDecode(body);
    if (decoded is Map) {
      final error = decoded['error'];
      if (error is Map && error['message'] is String) {
        return error['message'] as String;
      }
      if (decoded['message'] is String) return decoded['message'] as String;
    }
  } on FormatException {
    // Fall through to the generic message.
  }
  return 'Saved cars are unavailable.';
}

/// Parses `SavedCarView`. The listing shell is flat (`year`, `make`, `model`),
/// not a nested Discover `build`. A missing listing still keeps the row.
SavedCarRecord parseSavedCarView(Map<String, dynamic> json) {
  final listingId = jsonString(json['listingId']);
  final savedAtRaw = jsonString(json['savedAt']);
  final savedAt = savedAtRaw == null ? null : DateTime.tryParse(savedAtRaw);
  if (listingId == null || listingId.isEmpty || savedAt == null) {
    throw const SavedCarsException(
      'Saved car is missing a listing id or time.',
    );
  }
  final listing = json['listing'] is Map
      ? listingFromSavedPayload(
          Map<String, dynamic>.from(json['listing'] as Map),
        )
      : null;
  return SavedCarRecord(
    car: SavedCar(
      id: listingId,
      userId: jsonString(json['userId']) ?? '',
      listingId: listingId,
      vin: jsonString(json['vin']) ?? listing?.vin ?? '',
      savedAt: savedAt.toLocal(),
      savedPrice: listing?.price,
    ),
    listing: listing,
  );
}

Listing? listingFromSavedPayload(Map<String, dynamic> json) {
  final id = jsonString(json['id']);
  final year = jsonInt(json['year']);
  final make = jsonString(json['make']);
  final model = jsonString(json['model']);
  if (id == null || year == null || make == null || model == null) return null;
  final photos = json['photoUrls'];
  return Listing(
    id: id,
    vin: jsonString(json['vin']) ?? '',
    price: jsonInt(json['price']),
    miles: jsonInt(json['miles']),
    msrp: jsonInt(json['msrp']),
    build: ListingBuild(
      year: year,
      make: make,
      model: model,
      trim: jsonString(json['trim']),
      bodyType: jsonString(json['bodyType']),
      drivetrain: jsonString(json['drivetrain']),
      powertrainType: jsonString(json['powertrainType']),
      engine: jsonString(json['engine']),
      cityMpg: jsonInt(json['cityMpg']),
      highwayMpg: jsonInt(json['highwayMpg']),
      seatingCapacity: jsonInt(json['seatingCapacity']),
    ),
    media: ListingMedia(
      photoLinks: photos is List
          ? [
              for (final item in photos)
                if (item is String && item.startsWith('https://')) item,
            ]
          : const [],
    ),
    carLocation: CarLocation(
      city: jsonString(json['city']),
      state: jsonString(json['state']),
      latitude: jsonDouble(json['latitude']),
      longitude: jsonDouble(json['longitude']),
    ),
    domActive: jsonInt(json['daysOnMarket']),
    inventoryType: jsonString(json['condition']) == 'new' ? 'new' : 'used',
  );
}

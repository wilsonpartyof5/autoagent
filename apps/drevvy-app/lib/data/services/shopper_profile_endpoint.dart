import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/config/api_config_exception.dart';
import '../models/json_values.dart';
import 'purchase_config.dart';
import 'shopper_session_store.dart';

/// `GET /api/consumer/profile`.
///
/// The published body is `consumerUserId`, `status`, `createdAt`, and
/// `updatedAt`. It has no given name and no email. Callers must not invent one.
class ShopperProfile {
  const ShopperProfile({required this.consumerUserId, this.status});

  final String consumerUserId;
  final String? status;
}

abstract class ShopperProfileEndpoint {
  const ShopperProfileEndpoint();

  static ShopperProfileEndpoint fromConfig(
    PurchaseConfig config, {
    http.Client? client,
  }) {
    if (!config.isLive || config.apiBaseUrl.trim().isEmpty) {
      return const MissingShopperProfileEndpoint();
    }
    return HttpShopperProfileEndpoint(
      baseUrl: config.apiBaseUrl,
      client: client,
    );
  }

  Future<ShopperProfile> fetch();
}

class MissingShopperProfileEndpoint extends ShopperProfileEndpoint {
  const MissingShopperProfileEndpoint();

  @override
  Future<ShopperProfile> fetch() async {
    throw ApiConfigException.notConfigured;
  }
}

class HttpShopperProfileEndpoint extends ShopperProfileEndpoint {
  HttpShopperProfileEndpoint({
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
  Future<ShopperProfile> fetch() async {
    final token = _sessionStore.accessToken;
    if (token == null) {
      throw const ApiConfigException('Sign in to load this account.');
    }
    final response = await _client
        .get(_uri('/api/consumer/profile'), headers: _headers(token))
        .timeout(timeout);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw const ApiConfigException('Account profile is unavailable.');
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) {
      throw const ApiConfigException('Profile response was not an account.');
    }
    final root = Map<String, dynamic>.from(decoded);
    final data = root['data'] is Map
        ? Map<String, dynamic>.from(root['data'] as Map)
        : root;
    final id = jsonString(data['consumerUserId']);
    if (id == null || id.isEmpty) {
      throw const ApiConfigException('Profile response had no account id.');
    }
    return ShopperProfile(
      consumerUserId: id,
      status: jsonString(data['status']),
    );
  }

  Map<String, String> _headers(String token) {
    return {'Accept': 'application/json', 'Authorization': 'Bearer $token'};
  }

  Uri _uri(String path) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$root$path');
  }
}

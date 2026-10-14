import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/config/drevvy_config.dart';
import 'auth_exception.dart';
import 'consumer_session.dart';

/// Client for the consumer auth routes:
/// `POST /api/consumer/auth/apple`, `POST /api/consumer/auth/google`,
/// `POST /api/consumer/auth/refresh`, `POST /api/consumer/auth/signout`,
/// and `GET /api/consumer/profile`.
class AuthApi {
  AuthApi({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? DrevvyConfig.apiBaseUrl;

  final http.Client _client;
  final String _baseUrl;

  Future<ConsumerSession> signInWithApple({
    required String identityToken,
    String? nonce,
  }) {
    return _exchange(DrevvyConfig.applePath, identityToken: identityToken, nonce: nonce);
  }

  Future<ConsumerSession> signInWithGoogle({
    required String identityToken,
    String? nonce,
  }) {
    return _exchange(DrevvyConfig.googlePath, identityToken: identityToken, nonce: nonce);
  }

  Future<ConsumerSession> refresh(String refreshToken) async {
    final response = await _post(
      DrevvyConfig.refreshPath,
      body: {'refreshToken': refreshToken},
    );
    return _sessionFromResponse(response);
  }

  Future<void> signOut(String accessToken) async {
    final response = await _post(
      DrevvyConfig.signOutPath,
      body: const {},
      accessToken: accessToken,
    );
    if (response.statusCode == 401) {
      // The server already considers the session gone.
      return;
    }
    _throwIfFailed(response);
  }

  /// Confirms the access token against the profile route. Throws [AuthException]
  /// when the backend rejects it.
  Future<void> fetchProfile(String accessToken) async {
    final response = await _client.get(
      _uri(DrevvyConfig.profilePath),
      headers: _headers(accessToken: accessToken),
    );
    _throwIfFailed(response);
  }

  Future<ConsumerSession> _exchange(
    String path, {
    required String identityToken,
    String? nonce,
  }) async {
    final body = <String, dynamic>{'identityToken': identityToken};
    if (nonce != null && nonce.isNotEmpty) body['nonce'] = nonce;
    final response = await _post(path, body: body);
    return _sessionFromResponse(response);
  }

  Future<http.Response> _post(
    String path, {
    required Map<String, dynamic> body,
    String? accessToken,
  }) {
    return _client.post(
      _uri(path),
      headers: _headers(accessToken: accessToken),
      body: jsonEncode(body),
    );
  }

  Uri _uri(String path) => Uri.parse('$_baseUrl$path');

  Map<String, String> _headers({String? accessToken}) {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (accessToken != null && accessToken.isNotEmpty) 'Authorization': 'Bearer $accessToken',
    };
  }

  ConsumerSession _sessionFromResponse(http.Response response) {
    _throwIfFailed(response);
    final decoded = _decode(response.body);
    return parseConsumerSession(decoded);
  }

  void _throwIfFailed(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = _decode(response.body);
      if (decoded['success'] == false) {
        throw authExceptionFromBody(decoded, response.statusCode);
      }
      return;
    }
    if (response.statusCode == 404) {
      throw const AuthException(
        code: 'not_found',
        message: 'That sign-in method is not available yet.',
      );
    }
    final decoded = _tryDecode(response.body);
    if (decoded != null) {
      throw authExceptionFromBody(decoded, response.statusCode);
    }
    throw AuthException(
      code: 'http_${response.statusCode}',
      message: 'Drevvy could not finish sign-in.',
    );
  }

  Map<String, dynamic> _decode(String body) {
    return _tryDecode(body) ??
        (throw const AuthException(
          code: 'invalid_response',
          message: 'Drevvy could not finish sign-in.',
        ));
  }
}

Map<String, dynamic>? _tryDecode(String body) {
  try {
    final decoded = jsonDecode(body);
    if (decoded is Map<String, dynamic>) return decoded;
    if (decoded is Map) return Map<String, dynamic>.from(decoded);
  } on FormatException {
    return null;
  }
  return null;
}

AuthException authExceptionFromBody(Map<String, dynamic> body, int statusCode) {
  final error = body['error'];
  if (error is Map) {
    final code = error['code']?.toString();
    final message = error['message']?.toString();
    return AuthException(
      code: code == null || code.isEmpty ? 'http_$statusCode' : code,
      message: message == null || message.isEmpty ? 'Drevvy could not finish sign-in.' : message,
    );
  }
  return AuthException(
    code: 'http_$statusCode',
    message: 'Drevvy could not finish sign-in.',
  );
}

/// Parses `{ success, data: { accessToken, refreshToken, expiresAt, consumerUserId } }`.
ConsumerSession parseConsumerSession(Map<String, dynamic> body) {
  final data = body['data'];
  if (data is! Map) {
    throw const AuthException(
      code: 'session_missing',
      message: 'Sign in did not return a session.',
    );
  }
  final accessToken = data['accessToken'];
  final refreshToken = data['refreshToken'];
  final consumerUserId = data['consumerUserId'];
  if (accessToken is! String ||
      accessToken.isEmpty ||
      refreshToken is! String ||
      refreshToken.isEmpty ||
      consumerUserId is! String ||
      consumerUserId.isEmpty) {
    throw const AuthException(
      code: 'session_missing',
      message: 'Sign in did not return a session.',
    );
  }
  final expiresAt = data['expiresAt'];
  return ConsumerSession(
    accessToken: accessToken,
    refreshToken: refreshToken,
    expiresAt: expiresAt is num ? expiresAt.toInt() : null,
    consumerUserId: consumerUserId,
  );
}

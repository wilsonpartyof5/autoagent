import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/config/drevvy_config.dart';
import '../auth/consumer_session.dart';

enum DeviceRegistrationStatus { registered, skipped, failed }

class DeviceRegistrationResult {
  const DeviceRegistrationResult(this.status, {this.statusCode});

  final DeviceRegistrationStatus status;
  final int? statusCode;

  bool get skipped => status == DeviceRegistrationStatus.skipped;
}

/// Posts and deletes the FCM token at `/api/consumer/devices`.
///
/// No-ops when the shopper is signed out, the token is empty, or the route
/// is missing (404 / 405). Demo mode never depends on this call succeeding.
class DeviceRegistrar {
  DeviceRegistrar({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? DrevvyConfig.apiBaseUrl;

  final http.Client _client;
  final String _baseUrl;

  Future<DeviceRegistrationResult> register({
    required ConsumerSession? session,
    required String? token,
    required String platform,
  }) async {
    if (session == null || token == null || token.isEmpty) {
      return const DeviceRegistrationResult(DeviceRegistrationStatus.skipped);
    }

    try {
      final response = await _client.post(
        Uri.parse('$_baseUrl${DrevvyConfig.devicesPath}'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ${session.accessToken}',
        },
        body: jsonEncode({
          'token': token,
          'platform': platform,
          'provider': 'fcm',
        }),
      );
      if (response.statusCode == 404 || response.statusCode == 405) {
        return DeviceRegistrationResult(DeviceRegistrationStatus.skipped, statusCode: response.statusCode);
      }
      if (response.statusCode == 401) {
        return DeviceRegistrationResult(DeviceRegistrationStatus.skipped, statusCode: response.statusCode);
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return DeviceRegistrationResult(DeviceRegistrationStatus.registered, statusCode: response.statusCode);
      }
      return DeviceRegistrationResult(DeviceRegistrationStatus.failed, statusCode: response.statusCode);
    } catch (_) {
      return const DeviceRegistrationResult(DeviceRegistrationStatus.failed);
    }
  }

  /// Removes this device before the session is cleared. A missing route is ignored.
  Future<DeviceRegistrationResult> unregister({
    required String? accessToken,
    required String? token,
    required String platform,
  }) async {
    if (accessToken == null || accessToken.isEmpty || token == null || token.isEmpty) {
      return const DeviceRegistrationResult(DeviceRegistrationStatus.skipped);
    }

    try {
      final response = await _client.delete(
        Uri.parse('$_baseUrl${DrevvyConfig.devicesPath}'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer $accessToken',
        },
        body: jsonEncode({
          'token': token,
          'platform': platform,
          'provider': 'fcm',
        }),
      );
      if (response.statusCode == 404 || response.statusCode == 405 || response.statusCode == 401) {
        return DeviceRegistrationResult(DeviceRegistrationStatus.skipped, statusCode: response.statusCode);
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return DeviceRegistrationResult(DeviceRegistrationStatus.registered, statusCode: response.statusCode);
      }
      return DeviceRegistrationResult(DeviceRegistrationStatus.failed, statusCode: response.statusCode);
    } catch (_) {
      return const DeviceRegistrationResult(DeviceRegistrationStatus.failed);
    }
  }
}

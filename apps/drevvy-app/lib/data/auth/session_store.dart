import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../core/platform/plugin_errors.dart';
import 'auth_exception.dart';
import 'consumer_session.dart';

abstract class SessionStore {
  Future<ConsumerSession?> read();
  Future<void> write(ConsumerSession session);
  Future<void> clear();
}

/// In-memory store for tests and for the fallback when secure storage is absent.
class MemorySessionStore implements SessionStore {
  ConsumerSession? _session;

  @override
  Future<void> clear() async {
    _session = null;
  }

  @override
  Future<ConsumerSession?> read() async => _session;

  @override
  Future<void> write(ConsumerSession session) async {
    _session = session;
  }
}

/// Keychain on Apple platforms and EncryptedSharedPreferences / Keystore on Android.
class SecureSessionStore implements SessionStore {
  SecureSessionStore({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _access = 'drevvy.session.accessToken';
  static const _refresh = 'drevvy.session.refreshToken';
  static const _expires = 'drevvy.session.expiresAt';
  static const _user = 'drevvy.session.consumerUserId';

  @override
  Future<ConsumerSession?> read() async {
    try {
      return ConsumerSession.fromStorage({
        'accessToken': await _storage.read(key: _access),
        'refreshToken': await _storage.read(key: _refresh),
        'expiresAt': await _storage.read(key: _expires),
        'consumerUserId': await _storage.read(key: _user),
      });
    } catch (error) {
      if (isPluginMissing(error)) return null;
      rethrow;
    }
  }

  @override
  Future<void> write(ConsumerSession session) async {
    try {
      final values = session.toStorage();
      await _storage.write(key: _access, value: values['accessToken']);
      await _storage.write(key: _refresh, value: values['refreshToken']);
      await _storage.write(key: _expires, value: values['expiresAt']);
      await _storage.write(key: _user, value: values['consumerUserId']);
    } catch (error) {
      if (isPluginMissing(error)) {
        throw const AuthException(
          code: 'storage_unavailable',
          message: 'This device could not store the sign-in securely.',
        );
      }
      rethrow;
    }
  }

  @override
  Future<void> clear() async {
    try {
      await _storage.delete(key: _access);
      await _storage.delete(key: _refresh);
      await _storage.delete(key: _expires);
      await _storage.delete(key: _user);
    } catch (error) {
      if (isPluginMissing(error)) return;
      rethrow;
    }
  }
}

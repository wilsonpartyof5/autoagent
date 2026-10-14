import '../notifications/device_registration.dart';
import 'auth_api.dart';
import 'auth_exception.dart';
import 'consumer_session.dart';
import 'identity_client.dart';
import 'session_store.dart';

sealed class AuthResult {
  const AuthResult();
}

class AuthSuccess extends AuthResult {
  const AuthSuccess(this.session);
  final ConsumerSession session;
}

class AuthCancelled extends AuthResult {
  const AuthCancelled();
}

class AuthFailure extends AuthResult {
  const AuthFailure(this.message);
  final String message;
}

/// Signs the shopper in, stores the session, and falls back to demo mode when
/// there is no session.
class AuthController {
  AuthController({
    required this._api,
    required this._store,
    required this._apple,
    required this._google,
    DateTime Function()? now,
    this._onSignedIn,
    this._devices,
    this._deviceToken,
    String Function()? platform,
  }) : _now = now ?? DateTime.now,
       _platform = platform ?? (() => 'other');

  final AuthApi _api;
  final SessionStore _store;
  final IdentityClient _apple;
  final IdentityClient _google;
  final DateTime Function() _now;
  final Future<void> Function(ConsumerSession session)? _onSignedIn;
  final DeviceRegistrar? _devices;
  final Future<String?> Function()? _deviceToken;
  final String Function() _platform;

  Future<AuthResult> signInWithApple() => _signIn(_apple, _api.signInWithApple);

  Future<AuthResult> signInWithGoogle() => _signIn(_google, _api.signInWithGoogle);

  /// Null when the shopper is signed out. Demo data keeps working in that case.
  Future<ConsumerSession?> currentSession() async {
    final stored = await _store.read();
    if (stored == null) return null;
    if (!stored.shouldRefresh(_now())) return stored;
    try {
      final refreshed = await _api.refresh(stored.refreshToken);
      await _store.write(refreshed);
      return refreshed;
    } on AuthException {
      await _store.clear();
      return null;
    }
  }

  Future<void> signOut() async {
    final stored = await _store.read();
    if (stored != null) {
      final token = await _deviceToken?.call();
      final devices = _devices;
      if (devices != null) {
        await devices.unregister(
          session: stored,
          token: token,
          platform: _platform(),
        );
      }
      try {
        await _api.signOut(stored.accessToken);
      } on AuthException {
        // Local sign-out still proceeds so demo mode can continue.
      }
    }
    await _store.clear();
  }

  Future<AuthResult> _signIn(
    IdentityClient client,
    Future<ConsumerSession> Function({required String identityToken, String? nonce}) exchange,
  ) async {
    try {
      final identity = await client.signIn();
      final session = await exchange(identityToken: identity.identityToken, nonce: identity.nonce);
      await _api.fetchProfile(session.accessToken);
      await _store.write(session);
      await _onSignedIn?.call(session);
      return AuthSuccess(session);
    } on AuthCancelledException {
      return const AuthCancelled();
    } on AuthException catch (error) {
      return AuthFailure(error.message);
    } catch (_) {
      return const AuthFailure('Drevvy could not reach the server.');
    }
  }
}

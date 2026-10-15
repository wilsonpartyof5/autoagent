import '../services/shopper_session_store.dart';
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
  }) : _now = now ?? DateTime.now;

  final AuthApi _api;
  final SessionStore _store;
  final IdentityClient _apple;
  final IdentityClient _google;
  final DateTime Function() _now;
  final Future<void> Function(ConsumerSession session)? _onSignedIn;

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
      await _publish(refreshed);
      return refreshed;
    } on AuthException {
      await _store.clear();
      if (ShopperSessionStore.instance.accessToken == stored.accessToken) {
        ShopperSessionStore.instance.session = null;
      }
      return null;
    }
  }

  /// Ends in [ShopperSessionStore.clear], which drops the device token and
  /// logs RevenueCat out. The account sheet calls that store directly.
  Future<void> signOut() async {
    final shopper = ShopperSessionStore.instance;
    final stored = await _store.read();
    if (stored != null && shopper.session == null) {
      shopper.session = ShopperSession(
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        consumerUserId: stored.consumerUserId,
      );
    }
    shopper.secureSessions = _store;
    shopper.authApi = _api;
    await shopper.clear();
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
      await _publish(session);
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

  Future<void> _publish(ConsumerSession session) {
    return ShopperSessionStore.instance.save(ShopperSession(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(session.expiresAt! * 1000, isUtc: true),
      consumerUserId: session.consumerUserId,
    ));
  }
}

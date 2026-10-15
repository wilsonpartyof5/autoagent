import '../auth/auth_api.dart';
import '../auth/auth_exception.dart';
import '../auth/session_store.dart';
import '../notifications/device_registration.dart';
import '../notifications/local_flags.dart';
import '../notifications/push_messaging.dart';
import 'revenue_cat_identity.dart';

/// Signed-in shopper session. [accessToken] is the Supabase user JWT.
/// [consumerUserId] is the Supabase user id RevenueCat logs in as.
class ShopperSession {
  const ShopperSession({
    required this.accessToken,
    this.refreshToken,
    this.expiresAt,
    this.consumerUserId,
  });

  final String accessToken;
  final String? refreshToken;
  final DateTime? expiresAt;
  final String? consumerUserId;
}

/// Holds the signed-in shopper session for API calls.
///
/// Auth writes [session] after sign-in. Callers such as the credits client
/// read [accessToken] for `Authorization: Bearer`.
class ShopperSessionStore {
  ShopperSessionStore();

  static final ShopperSessionStore instance = ShopperSessionStore();

  ShopperSession? session;

  /// Set at startup. Sign-in and sign-out sync the RevenueCat app user id.
  RevenueCatIdentity? identity;

  /// Push token store. Sign-out reads the current FCM token from here.
  LocalFlags deviceFlags = SharedPreferencesFlags();

  /// Device registry. A missing route does not block sign-out.
  DeviceRegistrar devices = DeviceRegistrar();

  String Function() devicePlatform = pushPlatformLabel;

  SessionStore secureSessions = SecureSessionStore();

  AuthApi authApi = AuthApi();

  /// Trimmed access token, or null when the shopper is signed out.
  String? get accessToken {
    final token = session?.accessToken.trim();
    if (token == null || token.isEmpty) return null;
    return token;
  }

  /// Saves the session, then logs RevenueCat in as [ShopperSession.consumerUserId].
  Future<void> save(ShopperSession next) async {
    session = next;
    final userId = next.consumerUserId?.trim();
    if (userId == null || userId.isEmpty) return;
    await identity?.onSignedIn(userId);
  }

  /// Removes this device, ends the auth session, and logs RevenueCat out.
  ///
  /// The device delete runs while [accessToken] is still set. [identity]
  /// then calls `Purchases.logOut`.
  Future<void> clear() async {
    final bearer = accessToken;
    if (bearer != null) {
      try {
        final fcm = await deviceFlags.getString(PushFlags.token);
        await devices.unregister(
          accessToken: bearer,
          token: fcm,
          platform: devicePlatform(),
        );
      } catch (_) {
        // A missing devices route must not block sign-out.
      }
    }
    try {
      final secure = await secureSessions.read();
      if (secure != null) {
        try {
          await authApi.signOut(secure.accessToken);
        } on AuthException {
          // The local session is still cleared.
        }
        await secureSessions.clear();
      }
    } catch (_) {
      // Secure storage can be absent in demo mode.
    }
    session = null;
    await identity?.onSignedOut();
  }
}

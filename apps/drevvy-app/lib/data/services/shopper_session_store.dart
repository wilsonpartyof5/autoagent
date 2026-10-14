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

  /// Clears the session and logs RevenueCat out.
  Future<void> clear() async {
    session = null;
    await identity?.onSignedOut();
  }
}

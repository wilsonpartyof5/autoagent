/// Signed-in shopper session. [accessToken] is the Supabase user JWT.
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

  /// Trimmed access token, or null when the shopper is signed out.
  String? get accessToken {
    final token = session?.accessToken.trim();
    if (token == null || token.isEmpty) return null;
    return token;
  }

  void save(ShopperSession next) {
    session = next;
  }

  void clear() {
    session = null;
  }
}

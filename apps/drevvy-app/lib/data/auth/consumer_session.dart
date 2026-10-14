/// Public session returned by the consumer auth routes.
///
/// Matches `publicConsumerSession` in the backend: access token, refresh token,
/// expiry, and the consumer user id. Contact fields are never part of this object.
class ConsumerSession {
  const ConsumerSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.consumerUserId,
  });

  final String accessToken;
  final String refreshToken;

  /// Unix seconds, or null when the backend omits expiry.
  final int? expiresAt;
  final String consumerUserId;

  /// Refresh a minute early so in-flight calls are not racing expiry.
  bool shouldRefresh(DateTime now) {
    final expiresAt = this.expiresAt;
    if (expiresAt == null) return false;
    final expiry = DateTime.fromMillisecondsSinceEpoch(expiresAt * 1000, isUtc: true);
    return !now.toUtc().isBefore(expiry.subtract(const Duration(seconds: 60)));
  }

  Map<String, String> toStorage() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'expiresAt': expiresAt?.toString() ?? '',
      'consumerUserId': consumerUserId,
    };
  }

  static ConsumerSession? fromStorage(Map<String, String?> values) {
    final accessToken = values['accessToken'];
    final refreshToken = values['refreshToken'];
    final consumerUserId = values['consumerUserId'];
    if (accessToken == null ||
        accessToken.isEmpty ||
        refreshToken == null ||
        refreshToken.isEmpty ||
        consumerUserId == null ||
        consumerUserId.isEmpty) {
      return null;
    }
    final expiresRaw = values['expiresAt'];
    return ConsumerSession(
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresAt: expiresRaw == null || expiresRaw.isEmpty ? null : int.tryParse(expiresRaw),
      consumerUserId: consumerUserId,
    );
  }
}

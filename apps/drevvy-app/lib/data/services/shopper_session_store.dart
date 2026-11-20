import '../analytics/product_analytics.dart';
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

  ShopperSession? _session;

  /// Replacing the signed-in shopper notifies [onIdentityChanged] so an
  /// in-flight account request cannot finish against the new session.
  ShopperSession? get session => _session;

  set session(ShopperSession? value) {
    final previousUser = _userId(_session?.consumerUserId);
    final previousToken = accessToken;
    _session = value;
    final nextUser = _userId(value?.consumerUserId);
    if (previousUser == nextUser && previousToken == accessToken) return;
    _notifyIdentity();
  }

  static String? _userId(String? value) {
    final trimmed = value?.trim();
    if (trimmed == null || trimmed.isEmpty) return null;
    return trimmed;
  }

  /// Set at startup. Sign-in and sign-out sync the RevenueCat app user id.
  RevenueCatIdentity? identity;

  /// Push token store. Sign-out reads the current FCM token from here.
  LocalFlags deviceFlags = SharedPreferencesFlags();

  /// Device registry. A missing route does not block sign-out.
  /// Created on first use so reading the store during test setup does not
  /// open an HTTP client outside a test.
  DeviceRegistrar? _devices;
  DeviceRegistrar get devices => _devices ??= DeviceRegistrar();
  set devices(DeviceRegistrar value) => _devices = value;

  String Function() devicePlatform = pushPlatformLabel;

  SessionStore secureSessions = SecureSessionStore();

  /// Created on first use for the same reason as [devices].
  AuthApi? _authApi;
  AuthApi get authApi => _authApi ??= AuthApi();
  set authApi(AuthApi value) => _authApi = value;

  /// Live account state to drop after the session is gone. Demo builds use
  /// this to restore the labeled sample shopper instead of the signed-in one.
  void Function()? onSessionCleared;

  /// Fired when [session] changes user id or access token, including sign-in
  /// and account switch. Sign-out also calls [onSessionCleared].
  void Function()? onIdentityChanged;

  final List<void Function()> _identityListeners = [];
  final List<void Function()> _clearedListeners = [];

  /// Extra listeners for widgets. These do not replace [onIdentityChanged],
  /// which the repository uses to drop late account writes.
  void addIdentityListener(void Function() listener) {
    _identityListeners.add(listener);
  }

  void removeIdentityListener(void Function() listener) {
    _identityListeners.remove(listener);
  }

  void addSessionClearedListener(void Function() listener) {
    _clearedListeners.add(listener);
  }

  void removeSessionClearedListener(void Function() listener) {
    _clearedListeners.remove(listener);
  }

  /// User id and access token. Widgets compare this with the value captured
  /// before an await so a stored name or balance cannot land on the next
  /// account.
  String get accountStamp {
    final user = _userId(session?.consumerUserId) ?? '';
    return '$user\u0000${accessToken ?? ''}';
  }

  void _notifyIdentity() {
    onIdentityChanged?.call();
    for (final listener in List<void Function()>.of(_identityListeners)) {
      listener();
    }
  }

  void _notifyCleared() {
    onSessionCleared?.call();
    for (final listener in List<void Function()>.of(_clearedListeners)) {
      listener();
    }
  }

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
    ProductAnalytics.instance.identify(userId);
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
    _notifyCleared();
    ProductAnalytics.instance.signOut();
    await identity?.onSignedOut();
  }
}

/// Widget-local generation for a shopper session.
///
/// The repository still drops late writes. This watch drops a name, balance,
/// or error the widget already captured before sign-out or an account switch.
class ShopperAccountWatch {
  ShopperAccountWatch(this._onChanged);

  final void Function() _onChanged;
  int _generation = 0;
  String _stamp = ShopperSessionStore.instance.accountStamp;
  var _bound = false;

  void bind() {
    if (_bound) return;
    _bound = true;
    final store = ShopperSessionStore.instance;
    store.addIdentityListener(_changed);
    store.addSessionClearedListener(_changed);
  }

  void dispose() {
    if (!_bound) return;
    _bound = false;
    final store = ShopperSessionStore.instance;
    store.removeIdentityListener(_changed);
    store.removeSessionClearedListener(_changed);
  }

  void _changed() {
    _generation++;
    _stamp = ShopperSessionStore.instance.accountStamp;
    _onChanged();
  }

  int capture() => _generation;

  bool same(int generation) {
    return generation == _generation &&
        _stamp == ShopperSessionStore.instance.accountStamp;
  }
}

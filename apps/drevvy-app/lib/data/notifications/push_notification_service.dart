import 'dart:async';

import '../auth/session_store.dart';
import 'device_registration.dart';
import 'local_flags.dart';
import 'push_deep_link.dart';
import 'push_messaging.dart';

class DeepLinkBus {
  final _locations = StreamController<String>.broadcast();

  Stream<String> get locations => _locations.stream;

  void open(String location) {
    if (!_locations.isClosed) _locations.add(location);
  }
}

/// Registers the device token and opens deep links. Permission is requested
/// only from [enable], which the UI calls after the first car is added.
class PushNotificationService {
  PushNotificationService({
    required this._messaging,
    required this._devices,
    required this._sessions,
    required this._flags,
    required this._links,
    String Function()? platform,
  }) : _platform = platform ?? pushPlatformLabel;

  final PushMessaging _messaging;
  final DeviceRegistrar _devices;
  final SessionStore _sessions;
  final LocalFlags _flags;
  final DeepLinkBus _links;
  final String Function() _platform;

  /// Called after the first frame. Does not show a permission prompt.
  Future<void> restoreWithoutPrompting() async {
    final optedIn = await _flags.getBool(PushFlags.optedIn);
    if (!optedIn) return;
    await _capture(_messaging.resume());
  }

  /// Called when the shopper accepts the in-app pre-prompt.
  Future<void> enable() async {
    await _flags.setBool(PushFlags.optedIn, true);
    await _capture(_messaging.enable());
  }

  /// Called after a successful sign-in so a token collected in demo mode
  /// is registered once a session exists.
  Future<void> registerCurrentToken() async {
    final token = await _flags.getString(PushFlags.token);
    if (token == null || token.isEmpty) return;
    await _register(token);
  }

  void openData(Map<String, dynamic> data) {
    final location = locationForPush(data);
    if (location != null) _links.open(location);
  }

  Future<void> _capture(Future<PushPermission> permissionFuture) async {
    try {
      final permission = await permissionFuture;
      final token = permission.token;
      if (token == null || token.isEmpty) return;
      await _flags.setString(PushFlags.token, token);
      await _register(token);
    } catch (_) {
      // Push setup must not take down shop or demo mode.
    }
  }

  Future<void> _register(String token) async {
    final session = await _sessions.read();
    await _devices.register(
      session: session,
      token: token,
      platform: _platform(),
    );
  }
}

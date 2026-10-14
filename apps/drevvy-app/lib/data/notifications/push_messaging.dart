import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../../core/config/drevvy_config.dart';
import '../../core/platform/plugin_errors.dart';

class PushPermission {
  const PushPermission({required this.granted, required this.configured, this.token});

  final bool granted;
  final bool configured;
  final String? token;
}

abstract class PushMessaging {
  /// Shows the OS permission prompt. Not called at launch.
  Future<PushPermission> enable();

  /// Reattaches listeners for a shopper who already opted in. Does not prompt.
  Future<PushPermission> resume();
}

typedef PushOpened = void Function(Map<String, dynamic> data);

String pushPlatformLabel() {
  if (kIsWeb) return 'web';
  return switch (defaultTargetPlatform) {
    TargetPlatform.iOS => 'ios',
    TargetPlatform.android => 'android',
    _ => 'other',
  };
}

bool _backgroundHandlerRegistered = false;

@pragma('vm:entry-point')
Future<void> drevvyMessagingBackgroundHandler(RemoteMessage message) async {
  // Taps are handled in the foreground isolate via onMessageOpenedApp.
}

class FirebasePushMessaging implements PushMessaging {
  FirebasePushMessaging({required this.onOpened});

  final PushOpened onOpened;
  bool _listening = false;

  @override
  Future<PushPermission> enable() => _start(requestPermission: true);

  @override
  Future<PushPermission> resume() => _start(requestPermission: false);

  Future<PushPermission> _start({required bool requestPermission}) async {
    final options = DrevvyConfig.firebaseOptions;
    if (options == null) {
      return const PushPermission(granted: false, configured: false);
    }

    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(options: options);
      }
      if (!_backgroundHandlerRegistered) {
        FirebaseMessaging.onBackgroundMessage(drevvyMessagingBackgroundHandler);
        _backgroundHandlerRegistered = true;
      }

      final messaging = FirebaseMessaging.instance;
      if (requestPermission) {
        final settings = await messaging.requestPermission(alert: true, badge: true, sound: true);
        final granted = settings.authorizationStatus == AuthorizationStatus.authorized ||
            settings.authorizationStatus == AuthorizationStatus.provisional;
        if (!granted) {
          return const PushPermission(granted: false, configured: true);
        }
      }

      _listen(messaging);
      final token = await messaging.getToken();
      return PushPermission(granted: true, configured: true, token: token);
    } catch (error) {
      if (isPluginMissing(error)) {
        return const PushPermission(granted: false, configured: false);
      }
      rethrow;
    }
  }

  void _listen(FirebaseMessaging messaging) {
    if (_listening) return;
    _listening = true;
    FirebaseMessaging.onMessageOpenedApp.listen((message) => onOpened(message.data));
    unawaited(_captureInitial(messaging));
  }

  Future<void> _captureInitial(FirebaseMessaging messaging) async {
    try {
      final message = await messaging.getInitialMessage();
      if (message != null) onOpened(message.data);
    } catch (error) {
      if (isPluginMissing(error)) return;
    }
  }
}

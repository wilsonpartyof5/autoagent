import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/auth/auth_api.dart';
import '../../data/auth/auth_controller.dart';
import '../../data/auth/identity_client.dart';
import '../../data/auth/session_store.dart';
import '../../data/notifications/device_registration.dart';
import '../../data/notifications/local_flags.dart';
import '../../data/notifications/notification_prompt.dart';
import '../../data/notifications/push_deep_link.dart';
import '../../data/notifications/push_messaging.dart';
import '../../data/notifications/push_notification_service.dart';

final sessionStoreProvider = Provider<SessionStore>((ref) => SecureSessionStore());

final localFlagsProvider = Provider<LocalFlags>((ref) => SharedPreferencesFlags());

final authApiProvider = Provider<AuthApi>((ref) => AuthApi());

final deviceRegistrarProvider = Provider<DeviceRegistrar>((ref) => DeviceRegistrar());

final deepLinkBusProvider = Provider<DeepLinkBus>((ref) => DeepLinkBus());

final deepLinkLocationsProvider = StreamProvider<String>((ref) {
  return ref.watch(deepLinkBusProvider).locations;
});

final pushMessagingProvider = Provider<PushMessaging>((ref) {
  final bus = ref.watch(deepLinkBusProvider);
  return FirebasePushMessaging(onOpened: (data) {
    final location = locationForPush(data);
    if (location != null) bus.open(location);
  });
});

final pushNotificationServiceProvider = Provider<PushNotificationService>((ref) {
  return PushNotificationService(
    messaging: ref.watch(pushMessagingProvider),
    devices: ref.watch(deviceRegistrarProvider),
    sessions: ref.watch(sessionStoreProvider),
    flags: ref.watch(localFlagsProvider),
    links: ref.watch(deepLinkBusProvider),
  );
});

final notificationPromptProvider = Provider<NotificationPromptGate>((ref) {
  return NotificationPromptGate(flags: ref.watch(localFlagsProvider));
});

final appleIdentityProvider = Provider<IdentityClient>((ref) => AppleIdentityClient());

final googleIdentityProvider = Provider<IdentityClient>((ref) => GoogleIdentityClient());

final authControllerProvider = Provider<AuthController>((ref) {
  return AuthController(
    api: ref.watch(authApiProvider),
    store: ref.watch(sessionStoreProvider),
    apple: ref.watch(appleIdentityProvider),
    google: ref.watch(googleIdentityProvider),
    devices: ref.watch(deviceRegistrarProvider),
    deviceToken: () => ref.read(localFlagsProvider).getString(PushFlags.token),
    platform: pushPlatformLabel,
    onSignedIn: (_) {
      return ref.read(pushNotificationServiceProvider).registerCurrentToken();
    },
  );
});

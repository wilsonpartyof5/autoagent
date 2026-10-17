import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/platform/flutter_test_env.dart';
import 'core/providers/app_services.dart';
import 'core/router/router.dart';
import 'core/theme/drevvy_theme.dart';
import 'data/analytics/install_referrer.dart';
import 'data/analytics/product_analytics.dart';
import 'data/notifications/local_flags.dart';
import 'data/services/purchase_bootstrap.dart';
import 'data/services/purchase_config.dart';
import 'features/onboarding/onboarding_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PurchaseBootstrap.start(PurchaseConfig.fromEnvironment());
  final container = ProviderContainer();
  final onboardingDone = await container
      .read(localFlagsProvider)
      .getBool(OnboardingFlags.complete);
  if (onboardingDone) {
    container.read(onboardingCompleteProvider.notifier).state = true;
  }
  if (!isFlutterTest) {
    final referrer = await const InstallReferrer().read();
    await ProductAnalytics.start(
      flags: container.read(localFlagsProvider),
      launchRoute: WidgetsBinding.instance.platformDispatcher.defaultRouteName,
      installReferrer: referrer,
    );
    try {
      final session = await container.read(sessionStoreProvider).read();
      final userId = session?.consumerUserId;
      if (userId != null && userId.isNotEmpty) {
        ProductAnalytics.instance.identify(userId);
      }
    } catch (_) {
      // A missing keychain in demo mode must not block launch.
    }
  }
  runApp(UncontrolledProviderScope(
    container: container,
    child: const DrevvyApp(),
  ));
  // Reattach push listeners for someone who already opted in.
  // This does not request notification permission.
  // Widget tests pump DrevvyApp and never call main(). The FLUTTER_TEST
  // guard also keeps this work out of a test that does call main().
  if (!isFlutterTest) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(container.read(pushNotificationServiceProvider).restoreWithoutPrompting());
    });
  }
}

class DrevvyApp extends ConsumerWidget {
  const DrevvyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    ref.listen(deepLinkLocationsProvider, (previous, next) {
      final location = next.asData?.value;
      if (location != null) router.go(location);
    });

    return MaterialApp.router(
      title: 'Drevvy',
      debugShowCheckedModeBanner: false,
      theme: drevvyTheme(Brightness.light),
      darkTheme: drevvyTheme(Brightness.dark),
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}

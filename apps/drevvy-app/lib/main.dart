import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/platform/flutter_test_env.dart';
import 'core/providers/app_services.dart';
import 'core/router/router.dart';
import 'core/theme/drevvy_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final container = ProviderContainer();
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

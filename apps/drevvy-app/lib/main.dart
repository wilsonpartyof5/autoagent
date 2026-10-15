import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/onboarding/onboarding_gate.dart';
import 'core/router/router.dart';
import 'core/theme/drevvy_theme.dart';
import 'data/services/onboarding_store.dart';
import 'data/services/purchase_bootstrap.dart';
import 'data/services/purchase_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PurchaseBootstrap.start(PurchaseConfig.fromEnvironment());
  final onboarding = PreferencesOnboardingStore();
  final onboardingDone = await onboarding.isComplete();
  runApp(
    ProviderScope(
      overrides: [
        onboardingStoreProvider.overrideWithValue(onboarding),
        onboardingCompleteProvider.overrideWith((ref) => onboardingDone),
      ],
      child: const DrevvyApp(),
    ),
  );
}

class DrevvyApp extends ConsumerWidget {
  const DrevvyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Drevvy',
      debugShowCheckedModeBanner: false,
      theme: drevvyTheme(Brightness.light),
      darkTheme: drevvyTheme(Brightness.dark),
      themeMode: ThemeMode.system,
      routerConfig: ref.watch(routerProvider),
    );
  }
}

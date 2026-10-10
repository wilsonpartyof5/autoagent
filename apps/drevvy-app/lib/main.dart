import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/router.dart';
import 'core/theme/drevvy_theme.dart';

void main() {
  runApp(const ProviderScope(child: DrevvyApp()));
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

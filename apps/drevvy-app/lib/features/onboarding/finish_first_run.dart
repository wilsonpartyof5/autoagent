import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/onboarding/onboarding_gate.dart';

/// Marks first-run onboarding finished. The router then opens Shop.
Future<void> finishFirstRun(BuildContext context) async {
  final container = ProviderScope.containerOf(context);
  try {
    await container.read(onboardingStoreProvider).markComplete();
  } catch (error, stack) {
    debugPrint('Onboarding flag was not saved: $error\n$stack');
  }
  container.read(onboardingCompleteProvider.notifier).state = true;
}

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/services/onboarding_store.dart';

/// False until the shopper finishes or skips first-run onboarding.
final onboardingCompleteProvider = StateProvider<bool>((ref) => false);

/// Memory store unless [main] installs the device-backed store.
final onboardingStoreProvider = Provider<OnboardingStore>(
  (ref) => MemoryOnboardingStore(),
);

/// Keeps a first launch on the onboarding flow, then on Shop.
///
/// `/paywall` stays reachable in both states. Ask and Shop are not behind a
/// purchase; the car-pack paywall is a separate screen.
String? onboardingRedirect({
  required bool onboardingComplete,
  required String path,
}) {
  final inFirstRun =
      path.startsWith('/onboarding') || path == '/account/create';
  final inApp =
      path == '/shop' ||
      path == '/deals' ||
      path == '/saved' ||
      path.startsWith('/vdp') ||
      path.startsWith('/deal');

  if (!onboardingComplete && inApp) return '/onboarding/welcome';
  if (onboardingComplete && inFirstRun) return '/shop';
  return null;
}

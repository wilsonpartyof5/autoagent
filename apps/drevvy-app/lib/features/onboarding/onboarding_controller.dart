import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_services.dart';
import '../../data/notifications/local_flags.dart';

/// False until the shopper finishes or skips first-run.
/// [main] overrides this from [OnboardingFlags.complete] before the first frame.
final onboardingCompleteProvider = StateProvider<bool>((ref) => false);

/// Answers collected before the paywall. Ask and Shop do not require them.
class OnboardingDraft {
  const OnboardingDraft({
    this.zip,
    this.locationGranted = false,
  });

  final String? zip;
  final bool locationGranted;

  OnboardingDraft copyWith({
    String? zip,
    bool? locationGranted,
    bool clearZip = false,
  }) {
    return OnboardingDraft(
      zip: clearZip ? null : zip ?? this.zip,
      locationGranted: locationGranted ?? this.locationGranted,
    );
  }
}

final onboardingDraftProvider = StateProvider<OnboardingDraft>(
  (ref) => const OnboardingDraft(),
);

const onboardingStepCount = 5;

/// Marks first-run done and lets the router enter Shop.
Future<void> completeFirstRun(WidgetRef ref) async {
  await ref.read(localFlagsProvider).setBool(OnboardingFlags.complete, true);
  ref.read(onboardingCompleteProvider.notifier).state = true;
}

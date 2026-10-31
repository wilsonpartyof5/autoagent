import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/app_services.dart';
import '../../data/analytics/product_analytics.dart';
import '../../data/notifications/local_flags.dart';
import '../../data/repositories/demo_repository.dart';
import 'matters_v5.dart';

/// False until the shopper finishes first-run.
/// [main] overrides this from [OnboardingFlags.complete] before the first frame.
final onboardingCompleteProvider = StateProvider<bool>((ref) => false);

/// Answers collected across Matters v5. Ask and Shop do not require them.
class OnboardingDraft {
  const OnboardingDraft({
    this.pain,
    this.outcome,
    this.control,
    this.ask,
    this.customAsk = '',
    this.zip,
    this.locationGranted = false,
    this.carType,
    this.condition,
    this.timing,
  });

  final MattersPain? pain;
  final MattersOutcome? outcome;
  final MattersControl? control;
  final MattersAsk? ask;
  final String customAsk;
  final String? zip;
  final bool locationGranted;
  final MattersCarType? carType;
  final MattersCondition? condition;
  final MattersTiming? timing;

  bool get hasLocation => locationGranted || isFiveDigitZip(zip ?? '');

  OnboardingDraft copyWith({
    MattersPain? pain,
    MattersOutcome? outcome,
    MattersControl? control,
    MattersAsk? ask,
    String? customAsk,
    String? zip,
    bool? locationGranted,
    MattersCarType? carType,
    MattersCondition? condition,
    MattersTiming? timing,
    bool clearZip = false,
    bool clearAsk = false,
  }) {
    return OnboardingDraft(
      pain: pain ?? this.pain,
      outcome: outcome ?? this.outcome,
      control: control ?? this.control,
      ask: clearAsk ? null : ask ?? this.ask,
      customAsk: customAsk ?? this.customAsk,
      zip: clearZip ? null : zip ?? this.zip,
      locationGranted: locationGranted ?? this.locationGranted,
      carType: carType ?? this.carType,
      condition: condition ?? this.condition,
      timing: timing ?? this.timing,
    );
  }
}

final onboardingDraftProvider = StateProvider<OnboardingDraft>(
  (ref) => const OnboardingDraft(),
);

const onboardingStepCount = mattersV5StepCount;

/// Marks first-run done, grants starter keys once, and lets the router enter Shop.
Future<void> completeFirstRun(WidgetRef ref) async {
  ref.read(onboardingCompleteProvider.notifier).state = true;
  await grantStarterKeysIfNeeded(ref);
  await ref.read(localFlagsProvider).setBool(OnboardingFlags.complete, true);
  await ProductAnalytics.instance.onboardingCompleted();
}

/// #119 starter_grant: 3 free keys on first begin. Local flag makes demo/unsigned
/// installs idempotent. Signed-in shoppers also get this once from the backend.
Future<bool> grantStarterKeysIfNeeded(WidgetRef ref) async {
  final flags = ref.read(localFlagsProvider);
  if (await flags.getBool(OnboardingFlags.starterGranted)) return false;
  await DemoRepository.instance.grantStarterKeys();
  await flags.setBool(OnboardingFlags.starterGranted, true);
  return true;
}

Future<void> persistOnboardingAnswers(OnboardingDraft draft) async {
  final body = bodyTypeFor(draft.carType);
  ProductAnalytics.instance.track(AnalyticsEvents.onboardingPreferencesSaved, {
    if (draft.pain != null) 'pain': analyticsId(draft.pain!),
    if (draft.outcome != null) 'outcome': analyticsId(draft.outcome!),
    if (draft.control != null) 'control': analyticsId(draft.control!),
    if (draft.ask != null) 'ask': analyticsId(draft.ask!),
    if (draft.carType != null) 'car_type': analyticsId(draft.carType!),
    if (draft.condition != null) 'condition': analyticsId(draft.condition!),
    if (draft.timing != null) 'timing': analyticsId(draft.timing!),
    'location_granted': draft.locationGranted,
    'has_zip': isFiveDigitZip(draft.zip ?? ''),
  });
  await DemoRepository.instance.saveOnboardingAnswers(
    bodyTypes: body == null ? const [] : [body],
    zip: isFiveDigitZip(draft.zip ?? '') ? draft.zip : null,
    locationGranted: draft.locationGranted,
  );
}

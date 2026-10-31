import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/analytics/product_analytics.dart';
import '../matters_v5.dart';
import '../onboarding_controller.dart';
import '../widgets/onboarding_chrome.dart';
import '../widgets/onboarding_steps.dart';

/// Live first-run. Matters v5, 10 steps. v4 paywall stays Superwall-only.
class OnboardingFlowScreen extends ConsumerStatefulWidget {
  const OnboardingFlowScreen({super.key});

  @override
  ConsumerState<OnboardingFlowScreen> createState() =>
      _OnboardingFlowScreenState();
}

class _OnboardingFlowScreenState extends ConsumerState<OnboardingFlowScreen> {
  int _step = 0;
  Timer? _advance;
  late final TextEditingController _zipController;
  late final TextEditingController _customAskController;

  @override
  void initState() {
    super.initState();
    _zipController = TextEditingController();
    _customAskController = TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_) => _trackStep());
  }

  @override
  void dispose() {
    _advance?.cancel();
    _zipController.dispose();
    _customAskController.dispose();
    super.dispose();
  }

  void _trackStep() {
    ProductAnalytics.instance.track(AnalyticsEvents.onboardingStepViewed, {
      'step': mattersStepAnalytics[_step],
      'index': _step + 1,
    });
  }

  void _goTo(int next) {
    _advance?.cancel();
    final clamped = next.clamp(0, mattersV5StepCount - 1);
    if (clamped == _step) return;
    setState(() => _step = clamped);
    _trackStep();
    if (clamped == 7) {
      ProductAnalytics.instance.track(AnalyticsEvents.locationPermissionAsked, {
        'surface': 'onboarding',
      });
    }
  }

  void _next() => _goTo(_step + 1);

  void _back() => _goTo(_step - 1);

  void _update(OnboardingDraft Function(OnboardingDraft) fn) {
    ref.read(onboardingDraftProvider.notifier).update(fn);
  }

  void _pickAndAdvance<T>(
    T value,
    OnboardingDraft Function(OnboardingDraft draft, T value) fn,
  ) {
    _advance?.cancel();
    _update((draft) => fn(draft, value));
    _advance = Timer(mattersV5AutoAdvance, () {
      if (mounted) _next();
    });
  }

  Future<void> _finish() async {
    final draft = ref.read(onboardingDraftProvider);
    unawaited(persistOnboardingAnswers(draft));
    await completeFirstRun(ref);
    if (!mounted) return;
    context.go('/shop');
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(onboardingDraftProvider);

    return Scaffold(
      body: Stack(
        children: [
          const OnboardingBackground(),
          SafeArea(
            child: Column(
              children: [
                OnboardingProgressHeader(
                  stepIndex: _step,
                  total: mattersV5StepCount,
                  onBack: _step == 0 ? null : _back,
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      mattersV5Margin,
                      8,
                      mattersV5Margin,
                      20,
                    ),
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 260),
                      switchInCurve: Curves.easeOut,
                      switchOutCurve: Curves.easeIn,
                      transitionBuilder: (child, animation) {
                        final offset = Tween<Offset>(
                          begin: const Offset(0.06, 0),
                          end: Offset.zero,
                        ).animate(animation);
                        return FadeTransition(
                          opacity: animation,
                          child: SlideTransition(position: offset, child: child),
                        );
                      },
                      child: KeyedSubtree(
                        key: ValueKey(_step),
                        child: _stepBody(draft),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _stepBody(OnboardingDraft draft) {
    return switch (_step) {
      0 => KnowTheMarketStep(onContinue: _next),
      1 => ChoiceStep<MattersPain>(
          headline: 'What would you most like to avoid?',
          lead: 'Pick one.',
          choices: mattersPains,
          selected: draft.pain,
          onSelected: (value) => _pickAndAdvance(value, (d, v) => d.copyWith(pain: v)),
        ),
      2 => ChoiceStep<MattersOutcome>(
          headline: 'What would you want to know before going?',
          lead: 'Pick one.',
          choices: mattersOutcomes,
          selected: draft.outcome,
          onSelected: (value) =>
              _pickAndAdvance(value, (d, v) => d.copyWith(outcome: v)),
        ),
      3 => ChoiceStep<MattersControl>(
          headline: 'How do you want to hear from dealers?',
          lead: 'You choose.',
          choices: mattersControls,
          selected: draft.control,
          onSelected: (value) =>
              _pickAndAdvance(value, (d, v) => d.copyWith(control: v)),
        ),
      4 => ShoppingPrioritiesStep(draft: draft, onContinue: _next),
      5 => MarketIntelStep(onContinue: _next),
      6 => RealDealersStep(
          draft: draft,
          customController: _customAskController,
          onSelectAsk: (ask) {
            _update((d) => d.copyWith(ask: ask));
          },
          onCustomChanged: (value) {
            _update((d) => d.copyWith(customAsk: value));
          },
          onSave: _next,
          onSkip: () {
            ProductAnalytics.instance.track(AnalyticsEvents.onboardingSkipped, {
              'step': 'real_dealers_draft',
              'reason': 'skip_question',
            });
            _update((d) => d.copyWith(clearAsk: true, customAsk: ''));
            _next();
          },
        ),
      7 => WhereToLookStep(
          draft: draft,
          zipController: _zipController,
          onShareLocation: () {
            ProductAnalytics.instance.track(
              AnalyticsEvents.locationPermissionGranted,
              {'surface': 'onboarding'},
            );
            _update((d) => d.copyWith(locationGranted: true, clearZip: false));
          },
          onZipChanged: (value) {
            final digits = value.replaceAll(RegExp(r'\D'), '');
            if (digits != value) {
              _zipController.value = TextEditingValue(
                text: digits,
                selection: TextSelection.collapsed(offset: digits.length),
              );
            }
            if ((draft.zip == null || draft.zip!.isEmpty) && digits.isNotEmpty) {
              ProductAnalytics.instance.track(AnalyticsEvents.locationZipStarted, {
                'surface': 'onboarding',
              });
            }
            _update((d) => d.copyWith(zip: digits));
          },
          onContinue: () {
            if (draft.locationGranted) {
              // Share is the preferred path.
            } else {
              ProductAnalytics.instance.track(
                AnalyticsEvents.locationPermissionDenied,
                {
                  'surface': 'onboarding',
                  'reason': 'zip_instead',
                  'has_zip': true,
                },
              );
            }
            _next();
          },
        ),
      8 => CarTypeStep(
          draft: draft,
          onSelectType: (value) => _update((d) => d.copyWith(carType: value)),
          onSelectCondition: (value) =>
              _update((d) => d.copyWith(condition: value)),
          onSelectTiming: (value) => _update((d) => d.copyWith(timing: value)),
          onContinue: _next,
        ),
      _ => FreeKeysStep(onContinue: _finish),
    };
  }
}

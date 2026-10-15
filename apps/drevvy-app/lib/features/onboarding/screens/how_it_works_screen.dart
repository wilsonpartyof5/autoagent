import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../onboarding_controller.dart';
import '../widgets/progress_dots.dart';

/// Screen 03: Onboarding - How it works
class HowItWorksScreen extends ConsumerWidget {
  const HowItWorksScreen({super.key});

  static const _steps = [
    (
      icon: LucideIcons.search,
      title: 'Ask or shop, free',
      body: 'Asking and shopping stay unlimited. Browse market data with no car pack required.',
    ),
    (
      icon: LucideIcons.receipt,
      title: 'Compare with market data',
      body: 'Each car shows how its listed price sits against market data.',
    ),
    (
      icon: LucideIcons.sparkles,
      title: 'Unlock my price',
      body: 'When you want a written out-the-door quote, tap Unlock my price. That uses one car.',
    ),
    (
      icon: LucideIcons.check,
      title: 'You decide',
      body: 'Review the quote. Drevvy never accepts an offer for you.',
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      body: Stack(
        children: [
          const CanvasBackground(),
          SafeArea(
            child: Column(
              children: [
                // Top bar with back button
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.s2),
                  child: Row(
                    children: [
                      IconButton(
                        icon: Icon(LucideIcons.chevronLeft, color: colors.ink),
                        onPressed: () => context.pop(),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: () async {
                          await completeFirstRun(ref);
                          if (context.mounted) context.go('/shop');
                        },
                        child: Text(
                          'Skip',
                          style: text.bodyStrong.copyWith(color: colors.muted),
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: DrevvySpace.s4),
                
                const ProgressDots(current: 1, total: onboardingStepCount),
                
                const SizedBox(height: DrevvySpace.s6),
                
                Text(
                  'How Drevvy works',
                  style: text.headline,
                  textAlign: TextAlign.center,
                ),
                
                const SizedBox(height: DrevvySpace.s8),
                
                // Steps
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
                    itemCount: _steps.length,
                    separatorBuilder: (_, _) => const SizedBox(height: DrevvySpace.s4),
                    itemBuilder: (context, index) {
                      final step = _steps[index];
                      return _StepCard(
                        icon: step.icon,
                        title: step.title,
                        body: step.body,
                        number: index + 1,
                      );
                    },
                  ),
                ),
                
                // CTA
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    DrevvySpace.gutter,
                    DrevvySpace.s4,
                    DrevvySpace.gutter,
                    DrevvySpace.s6 + bottomPadding,
                  ),
                  child: DrevvyButton(
                    label: 'Continue',
                    onPressed: () => context.push('/onboarding/location'),
                    isFullWidth: true,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StepCard extends StatelessWidget {
  const _StepCard({
    required this.icon,
    required this.title,
    required this.body,
    required this.number,
  });

  final IconData icon;
  final String title;
  final String body;
  final int number;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: colors.lilacTint,
              borderRadius: BorderRadius.circular(DrevvyRadius.xs),
            ),
            child: Icon(icon, color: colors.violet, size: 22),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.title),
                const SizedBox(height: DrevvySpace.s1),
                Text(
                  body,
                  style: text.body.copyWith(color: colors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

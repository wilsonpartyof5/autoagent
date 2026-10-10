import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../widgets/progress_dots.dart';

/// Screen 03: Onboarding - How it works
class HowItWorksScreen extends StatelessWidget {
  const HowItWorksScreen({super.key});

  static const _steps = [
    (
      icon: LucideIcons.search,
      title: 'Find a car you like',
      body: 'Browse or ask Drevvy for recommendations based on your needs.',
    ),
    (
      icon: LucideIcons.plus,
      title: 'Add it to Drevvy',
      body: 'Tap "Add to Drevvy" and we\'ll reach out to the dealer for you.',
    ),
    (
      icon: LucideIcons.messageSquare,
      title: 'We do the work',
      body: 'Drevvy asks for an itemized out-the-door price and keeps going.',
    ),
    (
      icon: LucideIcons.check,
      title: 'You decide',
      body: 'Review each offer and accept when you\'re ready. We never accept for you.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
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
                        onPressed: () => context.go('/shop'),
                        child: Text(
                          'Skip',
                          style: text.bodyStrong.copyWith(color: colors.muted),
                        ),
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: DrevvySpace.s4),
                
                const ProgressDots(current: 1, total: 5),
                
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
                    separatorBuilder: (_, __) => const SizedBox(height: DrevvySpace.s4),
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

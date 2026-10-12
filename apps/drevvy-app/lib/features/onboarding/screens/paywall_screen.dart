import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../widgets/progress_dots.dart';

/// Screen 06: Paywall (onboarding or in-context)
class PaywallScreen extends StatelessWidget {
  const PaywallScreen({super.key, this.from});

  final String? from;

  bool get isOnboarding => from == 'onboarding';

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
                // Top bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.s2),
                  child: Row(
                    children: [
                      if (!isOnboarding)
                        IconButton(
                          icon: Icon(LucideIcons.x, color: colors.ink),
                          onPressed: () => context.pop(),
                        )
                      else
                        IconButton(
                          icon: Icon(LucideIcons.chevronLeft, color: colors.ink),
                          onPressed: () => context.pop(),
                        ),
                    ],
                  ),
                ),
                
                if (isOnboarding) ...[
                  const SizedBox(height: DrevvySpace.s4),
                  const ProgressDots(current: 4, total: 5),
                ],
                
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
                    child: Column(
                      children: [
                        const SizedBox(height: DrevvySpace.s6),
                        
                        // Pro pill
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            gradient: DrevvyColors.brandGradient,
                            borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                          ),
                          child: Text(
                            'Drevvy Pro',
                            style: text.label.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        
                        const SizedBox(height: DrevvySpace.s6),
                        
                        Text(
                          'Let Drevvy find your\nbest price',
                          style: text.headline,
                          textAlign: TextAlign.center,
                        ),
                        
                        const SizedBox(height: DrevvySpace.s3),
                        
                        Text(
                          'We ask dealers for an itemized out-the-door price\nand keep going until you decide.',
                          style: text.body.copyWith(color: colors.muted),
                          textAlign: TextAlign.center,
                        ),
                        
                        const SizedBox(height: DrevvySpace.s8),
                        
                        // Price card
                        GlassCard(
                          padding: const EdgeInsets.all(DrevvySpace.s5),
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('\$', style: text.title),
                                  Text('97', style: text.figureL),
                                  Text('/mo', style: text.body.copyWith(color: colors.muted)),
                                ],
                              ),
                              const SizedBox(height: DrevvySpace.s2),
                              Text(
                                '10 cars per billing month',
                                style: text.callout.copyWith(color: colors.muted),
                              ),
                            ],
                          ),
                        ),
                        
                        const SizedBox(height: DrevvySpace.s6),
                        
                        // Benefits list
                        _BenefitRow(
                          icon: LucideIcons.messageSquare,
                          title: 'Drevvy does the work',
                          body: 'We reach out to the dealer and ask for their best itemized price.',
                        ),
                        const SizedBox(height: DrevvySpace.s4),
                        _BenefitRow(
                          icon: LucideIcons.trendingDown,
                          title: 'Data-backed asks',
                          body: 'We cite comparable listings, days listed, and market averages.',
                        ),
                        const SizedBox(height: DrevvySpace.s4),
                        _BenefitRow(
                          icon: LucideIcons.check,
                          title: 'You always decide',
                          body: 'Review each offer and accept when you\'re ready. We never accept for you.',
                        ),
                        const SizedBox(height: DrevvySpace.s4),
                        _BenefitRow(
                          icon: LucideIcons.shieldCheck,
                          title: 'Your info stays private',
                          body: 'Dealers see only your first name. Never your phone or email.',
                        ),
                        
                        const SizedBox(height: DrevvySpace.s8),
                        
                        // Illustrative example
                        Container(
                          padding: const EdgeInsets.all(DrevvySpace.s4),
                          decoration: BoxDecoration(
                            color: colors.mintTint,
                            borderRadius: BorderRadius.circular(DrevvyRadius.md),
                          ),
                          child: Column(
                            children: [
                              Text(
                                'Example savings',
                                style: text.label.copyWith(color: colors.mint),
                              ),
                              const SizedBox(height: DrevvySpace.s2),
                              Text(
                                '\$2,295 under listed',
                                style: text.title.copyWith(color: colors.mint),
                              ),
                              const SizedBox(height: DrevvySpace.s1),
                              Text(
                                'on a 2024 Toyota RAV4 Hybrid XLE',
                                style: text.callout.copyWith(color: colors.mint),
                              ),
                            ],
                          ),
                        ),
                        
                        const SizedBox(height: DrevvySpace.s8),
                      ],
                    ),
                  ),
                ),
                
                // CTAs
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    DrevvySpace.gutter,
                    DrevvySpace.s2,
                    DrevvySpace.gutter,
                    DrevvySpace.s6 + bottomPadding,
                  ),
                  child: Column(
                    children: [
                      DrevvyButton(
                        label: 'Start Drevvy Pro',
                        onPressed: () {
                          // TODO: RevenueCat/Superwall purchase flow
                          if (isOnboarding) {
                            context.push('/account/create');
                          } else {
                            context.pop();
                          }
                        },
                        isFullWidth: true,
                      ),
                      if (isOnboarding) ...[
                        const SizedBox(height: DrevvySpace.s3),
                        DrevvyGhostButton(
                          label: 'Maybe later',
                          onPressed: () => context.go('/shop'),
                          color: colors.muted,
                        ),
                      ],
                      const SizedBox(height: DrevvySpace.s4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          TextButton(
                            onPressed: () {
                              // TODO: Restore purchases
                            },
                            child: Text(
                              'Restore',
                              style: text.callout.copyWith(color: colors.muted),
                            ),
                          ),
                          Text(' · ', style: text.callout.copyWith(color: colors.muted)),
                          TextButton(
                            onPressed: () {
                              // TODO: Terms
                            },
                            child: Text(
                              'Terms',
                              style: text.callout.copyWith(color: colors.muted),
                            ),
                          ),
                          Text(' · ', style: text.callout.copyWith(color: colors.muted)),
                          TextButton(
                            onPressed: () {
                              // TODO: Privacy
                            },
                            child: Text(
                              'Privacy',
                              style: text.callout.copyWith(color: colors.muted),
                            ),
                          ),
                        ],
                      ),
                    ],
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

class _BenefitRow extends StatelessWidget {
  const _BenefitRow({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: colors.lilacTint,
            borderRadius: BorderRadius.circular(DrevvyRadius.xs),
          ),
          child: Icon(icon, color: colors.violet, size: 20),
        ),
        const SizedBox(width: DrevvySpace.s3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: text.bodyStrong),
              const SizedBox(height: DrevvySpace.s1),
              Text(body, style: text.body.copyWith(color: colors.muted)),
            ],
          ),
        ),
      ],
    );
  }
}

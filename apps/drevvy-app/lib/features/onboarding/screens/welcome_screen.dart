import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../widgets/demo_offer_card.dart';
import '../widgets/progress_dots.dart';

/// Screen 02: Onboarding Welcome
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

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
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
              child: Column(
                children: [
                  const SizedBox(height: DrevvySpace.s8),
                  
                  // Progress dots
                  const ProgressDots(current: 0, total: 5),
                  
                  const SizedBox(height: DrevvySpace.s8),
                  
                  // Logo placeholder (wordmark)
                  Text(
                    'Drevvy',
                    style: text.display.copyWith(
                      fontSize: 36,
                      foreground: Paint()
                        ..shader = DrevvyColors.brandGradient.createShader(
                          const Rect.fromLTWH(0, 0, 120, 40),
                        ),
                    ),
                  ),
                  
                  const SizedBox(height: DrevvySpace.s6),
                  
                  Text(
                    'Find your best price\non any car',
                    style: text.headline,
                    textAlign: TextAlign.center,
                  ),
                  
                  const SizedBox(height: DrevvySpace.s3),
                  
                  Text(
                    'Drevvy asks dealers for an itemized out-the-door\nprice and keeps going until you decide.',
                    style: text.body.copyWith(color: colors.muted),
                    textAlign: TextAlign.center,
                  ),
                  
                  const Spacer(),
                  
                  // Demo offer card
                  const DemoOfferCard(
                    otd: 33415,
                    underListed: 2295,
                    title: '2024 Toyota RAV4 Hybrid',
                    subtitle: 'XLE · AWD',
                  ),
                  
                  const Spacer(),
                  
                  // CTAs
                  DrevvyButton(
                    label: 'Get started',
                    onPressed: () => context.push('/onboarding/how'),
                    isFullWidth: true,
                  ),
                  
                  const SizedBox(height: DrevvySpace.s3),
                  
                  DrevvyGhostButton(
                    label: 'I already have an account',
                    onPressed: () {
                      // TODO: Navigate to sign in
                      context.go('/shop');
                    },
                  ),
                  
                  SizedBox(height: DrevvySpace.s6 + bottomPadding),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

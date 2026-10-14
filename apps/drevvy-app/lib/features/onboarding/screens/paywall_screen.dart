import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../widgets/progress_dots.dart';

/// Screen S10: Soft paywall (onboarding or in-context).
/// v1.7: Updated from monthly subscription to one-time car packs.
/// 
/// Copy: "From $9.70/car · Car packs 3 · 5 · 10 · One-time. Never expire."
class PaywallScreen extends StatefulWidget {
  const PaywallScreen({super.key, this.from});

  final String? from;

  @override
  State<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends State<PaywallScreen> {
  bool get isOnboarding => widget.from == 'onboarding';
  AvgSavingsConfig? _avgSavings;

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    final config = await DemoRepository.instance.getAvgSavingsConfig();
    if (mounted) {
      setState(() => _avgSavings = config);
    }
  }

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
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (!isOnboarding)
                        const SizedBox(width: 48)
                      else
                        IconButton(
                          icon: Icon(LucideIcons.chevronLeft, color: colors.ink),
                          onPressed: () => context.pop(),
                        ),
                      if (isOnboarding)
                        const ProgressDots(current: 9, total: 10),
                      if (!isOnboarding)
                        IconButton(
                          icon: Icon(LucideIcons.x, color: colors.ink),
                          onPressed: () => context.pop(),
                        )
                      else
                        const SizedBox(width: 48),
                    ],
                  ),
                ),
                
                const SizedBox(height: DrevvySpace.s4),
                
                // Drevvy logo
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        gradient: DrevvyColors.brandGradient,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Center(
                        child: Text(
                          'D',
                          style: text.bodyStrong.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: DrevvySpace.s2),
                    Text('Drevvy', style: text.bodyStrong),
                  ],
                ),
                
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
                    child: Column(
                      children: [
                        const SizedBox(height: DrevvySpace.s6),
                        
                        // Headline
                        Text(
                          'Your next car. Fewer surprises.',
                          style: text.headline,
                          textAlign: TextAlign.center,
                        ),
                        
                        const SizedBox(height: DrevvySpace.s3),
                        
                        // Subtitle
                        Text(
                          'Shop free. When you find the one, let Drevvy handle the dealer conversation.',
                          style: text.body.copyWith(color: colors.muted),
                          textAlign: TextAlign.center,
                        ),
                        
                        const SizedBox(height: DrevvySpace.s6),
                        
                        // v1.7: Pack pricing card
                        GlassCard(
                          padding: const EdgeInsets.all(DrevvySpace.s5),
                          child: Column(
                            children: [
                              // Price headline
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.baseline,
                                    textBaseline: TextBaseline.alphabetic,
                                    children: [
                                      Text('From ', style: text.body),
                                      Text('\$9.70', style: text.figureM),
                                      Text('/car', style: text.body),
                                    ],
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        'Car packs: 3 · 5 · 10',
                                        style: text.callout.copyWith(color: colors.muted),
                                      ),
                                      Text(
                                        'One-time. Never expire.',
                                        style: text.callout.copyWith(color: colors.muted),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              
                              const SizedBox(height: DrevvySpace.s5),
                              
                              // Benefits list (updated copy, no "negotiate")
                              _ValueProp(
                                icon: LucideIcons.check,
                                text: 'Drevvy handles the conversation with each selected vehicle\'s dealer.',
                              ),
                              const SizedBox(height: DrevvySpace.s3),
                              _ValueProp(
                                icon: LucideIcons.check,
                                text: 'Works to get a written out-the-door quote with taxes, fees, and any add-ons.',
                              ),
                              const SizedBox(height: DrevvySpace.s3),
                              _ValueProp(
                                icon: LucideIcons.check,
                                text: 'Keeps your personal phone number private from dealerships.',
                              ),
                            ],
                          ),
                        ),
                        
                        const SizedBox(height: DrevvySpace.s5),
                        
                        // Avg savings stat (hidden if unavailable)
                        if (_avgSavings != null)
                          Container(
                            padding: const EdgeInsets.all(DrevvySpace.s4),
                            decoration: BoxDecoration(
                              color: colors.mintTint,
                              borderRadius: BorderRadius.circular(DrevvyRadius.md),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _avgSavings!.value,
                                  style: text.bodyStrong.copyWith(color: colors.mint),
                                ),
                                const SizedBox(height: DrevvySpace.s1),
                                Text(
                                  _avgSavings!.label,
                                  style: text.callout.copyWith(color: colors.mint),
                                ),
                                const SizedBox(height: DrevvySpace.s1),
                                Text(
                                  'Source: ${_avgSavings!.source}.',
                                  style: text.micro.copyWith(color: colors.muted),
                                ),
                              ],
                            ),
                          ),
                        
                        const SizedBox(height: DrevvySpace.s6),
                        
                        // Bottom text
                        Text(
                          'Asking and shopping stay free. Buy a car pack only when you want Drevvy to reach out. Packs are one-time and never expire.',
                          style: text.callout.copyWith(color: colors.muted),
                          textAlign: TextAlign.center,
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
                    DrevvySpace.s4 + bottomPadding,
                  ),
                  child: Column(
                    children: [
                      DrevvyButton(
                        label: 'Start shopping free',
                        onPressed: () {
                          if (isOnboarding) {
                            context.push('/account/create');
                          } else {
                            context.go('/shop');
                          }
                        },
                        isFullWidth: true,
                      ),
                      const SizedBox(height: DrevvySpace.s3),
                      DrevvyGhostButton(
                        label: 'See how it works',
                        onPressed: () {
                          // TODO: Show how it works sheet
                          context.pop();
                        },
                        color: colors.ink,
                      ),
                      const SizedBox(height: DrevvySpace.s4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
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

/// Value proposition row with check icon.
class _ValueProp extends StatelessWidget {
  const _ValueProp({
    required this.icon,
    required this.text,
  });

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyle = context.drevvyText;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, size: 18, color: colors.mint),
        ),
        const SizedBox(width: DrevvySpace.s3),
        Expanded(
          child: Text(text, style: textStyle.body),
        ),
      ],
    );
  }
}


import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../../../data/services/packs_offering.dart';
import '../../../data/services/purchase_service.dart';
import '../widgets/progress_dots.dart';

/// First-run pack preview, and the same prices the unlock paywall sells.
///
/// Ask and Shop stay free. Buying happens at Unlock my price when the balance
/// is 0. Prices come from RevenueCat offering `packs` when a store key exists,
/// and from the catalog when the demo purchase service is in use.
class PaywallScreen extends StatefulWidget {
  const PaywallScreen({super.key, this.from, this.loadOfferings});

  final String? from;

  /// Override for tests. Defaults to the purchase service, which is the demo
  /// catalog until RevenueCat keys exist.
  final Future<List<CarPackOffering>?> Function()? loadOfferings;

  @override
  State<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends State<PaywallScreen> {
  bool get isOnboarding => widget.from == 'onboarding';
  AvgSavingsConfig? _avgSavings;
  List<CarPackOffering> _offerings = const [];

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    final config = await DemoRepository.instance.getAvgSavingsConfig();
    List<CarPackOffering> offerings = const [];
    try {
      final loaded =
          await (widget.loadOfferings ??
              DemoRepository.instance.getPackOfferings)();
      offerings = loaded ?? const [];
    } catch (_) {
      offerings = const [];
    }
    if (mounted) {
      setState(() {
        _avgSavings = config;
        _offerings = offerings;
      });
    }
  }

  CarPackOffering? _offeringFor(CarPackType pack) {
    for (final offering in _offerings) {
      if (offering.packType == pack) return offering;
    }
    return null;
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: DrevvySpace.s2,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (!isOnboarding)
                        const SizedBox(width: 48)
                      else
                        IconButton(
                          icon: Icon(
                            LucideIcons.chevronLeft,
                            color: colors.ink,
                          ),
                          onPressed: () => context.pop(),
                        ),
                      if (isOnboarding)
                        const ProgressDots(current: 4, total: 5),
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
                    padding: const EdgeInsets.symmetric(
                      horizontal: DrevvySpace.gutter,
                    ),
                    child: Column(
                      children: [
                        const SizedBox(height: DrevvySpace.s6),

                        // Headline
                        Text(
                          'See the market. Then the written price.',
                          style: text.headline,
                          textAlign: TextAlign.center,
                        ),

                        const SizedBox(height: DrevvySpace.s3),

                        Text(
                          'Ask and Shop stay unlimited. A car pack is a one-time purchase when you tap Unlock my price.',
                          style: text.body.copyWith(color: colors.muted),
                          textAlign: TextAlign.center,
                        ),

                        const SizedBox(height: DrevvySpace.s6),

                        GlassCard(
                          padding: const EdgeInsets.all(DrevvySpace.s5),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Best value · 10 cars at \$9.70 per car',
                                style: text.bodyStrong.copyWith(
                                  color: colors.mint,
                                ),
                              ),
                              const SizedBox(height: DrevvySpace.s2),
                              Text(
                                'One-time. Never expire.',
                                style: text.callout.copyWith(
                                  color: colors.muted,
                                ),
                              ),
                              const SizedBox(height: DrevvySpace.s4),
                              for (final pack in CarPackType.values) ...[
                                _PackPriceRow(
                                  pack: pack,
                                  price: displayPackPrice(
                                    pack: pack,
                                    offering: _offeringFor(pack),
                                  ),
                                  perCar: displayPerCarPrice(
                                    pack: pack,
                                    offering: _offeringFor(pack),
                                  ),
                                ),
                                if (pack != CarPackType.bestValue)
                                  const SizedBox(height: DrevvySpace.s3),
                              ],
                              const SizedBox(height: DrevvySpace.s5),
                              const _ValueProp(
                                icon: LucideIcons.check,
                                text: 'Compare this car with market data for the same trim.',
                              ),
                              const SizedBox(height: DrevvySpace.s3),
                              const _ValueProp(
                                icon: LucideIcons.check,
                                text: 'Drevvy asks for an itemized out-the-door quote, with taxes, fees, and add-ons.',
                              ),
                              const SizedBox(height: DrevvySpace.s3),
                              const _ValueProp(
                                icon: LucideIcons.check,
                                text: 'Your phone number stays private.',
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
                              borderRadius: BorderRadius.circular(
                                DrevvyRadius.md,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _avgSavings!.value,
                                  style: text.bodyStrong.copyWith(
                                    color: colors.mint,
                                  ),
                                ),
                                const SizedBox(height: DrevvySpace.s1),
                                Text(
                                  _avgSavings!.label,
                                  style: text.callout.copyWith(
                                    color: colors.mint,
                                  ),
                                ),
                                const SizedBox(height: DrevvySpace.s1),
                                Text(
                                  'Source: ${_avgSavings!.source}.',
                                  style: text.micro.copyWith(
                                    color: colors.muted,
                                  ),
                                ),
                              ],
                            ),
                          ),

                        const SizedBox(height: DrevvySpace.s6),

                        // Bottom text
                        Text(
                          'This is a transparency layer built on market data. Asking and shopping stay free.',
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
                          Text(
                            ' · ',
                            style: text.callout.copyWith(color: colors.muted),
                          ),
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

class _PackPriceRow extends StatelessWidget {
  const _PackPriceRow({
    required this.pack,
    required this.price,
    required this.perCar,
  });

  final CarPackType pack;
  final String price;
  final String perCar;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final best = pack == CarPackType.bestValue;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: DrevvySpace.s3,
        vertical: DrevvySpace.s3,
      ),
      decoration: BoxDecoration(
        color: colors.tile,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
        border: Border.all(
          color: best ? colors.violet : colors.glassBorder,
          width: best ? 2 : 1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${pack.cars} cars · ${pack.displayName}',
                  style: text.bodyStrong,
                ),
                if (best)
                  Text(
                    'BEST VALUE',
                    style: text.micro.copyWith(
                      color: colors.mint,
                      fontWeight: FontWeight.w800,
                    ),
                  )
                else
                  Text(
                    'One-time',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(price, style: text.cardTitle),
              Text(
                perCar,
                style: text.callout.copyWith(
                  color: best ? colors.mint : colors.muted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Value proposition row with check icon.
class _ValueProp extends StatelessWidget {
  const _ValueProp({required this.icon, required this.text});

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
        Expanded(child: Text(text, style: textStyle.body)),
      ],
    );
  }
}

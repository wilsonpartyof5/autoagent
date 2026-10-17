import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/canvas_background.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';
import '../../../data/models/money_format.dart';
import '../../../data/repositories/demo_repository.dart';
import '../../../data/services/cars_balance_placement.dart';
import '../../../data/services/purchase_config.dart';
import '../../../data/services/purchase_service.dart';
import '../../../data/services/superwall_placement.dart';
import '../../shop/widgets/pack_option_card.dart';
import '../onboarding_controller.dart';
import '../widgets/progress_dots.dart';

/// First-run and in-context car-pack paywall.
///
/// Superwall placement `onboarding_paywall` can replace this screen when a
/// key exists. With no store keys, the three demo packs render here:
/// 3 cars $47, 5 cars $67, 10 cars $97. Best value is 10 at $9.70 per car.
/// Asking and shopping stay free; this screen can be skipped.
class PaywallScreen extends ConsumerStatefulWidget {
  const PaywallScreen({
    super.key,
    this.from,
    this.placement,
    this.repository,
  });

  final String? from;
  final CarsBalancePlacement? placement;
  final DemoRepository? repository;

  @override
  ConsumerState<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends ConsumerState<PaywallScreen> {
  bool get isOnboarding => widget.from == 'onboarding';

  CarPackType _selected = CarPackType.bestValue;
  Map<CarPackType, CarPackOffering> _offerings = const {};
  bool _buying = false;

  DemoRepository get _repo => widget.repository ?? DemoRepository.instance;

  @override
  void initState() {
    super.initState();
    unawaited(_loadOfferings());
    if (isOnboarding) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final placement = widget.placement ??
            onboardingPaywallPlacementFor(PurchaseConfig.fromEnvironment());
        unawaited(placement.register(
          presentLocalPaywall: () {},
          onPurchased: _continueAfterStorePaywall,
        ));
      });
    }
  }

  Future<void> _loadOfferings() async {
    try {
      final offerings = await _repo.purchaseService.getOfferings();
      if (!mounted || offerings == null) return;
      setState(() {
        _offerings = {for (final offering in offerings) offering.packType: offering};
      });
    } catch (_) {
      // Demo catalog prices stay on screen.
    }
  }

  String _totalLabel(CarPackType pack) {
    final offering = _offerings[pack];
    if (offering == null || offering.currencyCode == 'USD') {
      return formatUsd(offering?.priceAmount ?? pack.priceUsd);
    }
    return offering.localizedPrice;
  }

  String _perCarLabel(CarPackType pack) {
    final offering = _offerings[pack];
    if (offering != null && offering.currencyCode != 'USD') {
      return offering.localizedPrice;
    }
    final amount = offering?.priceAmount ?? pack.priceUsd.toDouble();
    return '${formatUsd(amount / pack.cars, cents: true)}/car';
  }

  String _cta(CarPackType pack) => 'Get ${pack.cars} cars for ${_totalLabel(pack)}';

  Future<void> _continueAfterStorePaywall() async {
    if (!mounted) return;
    if (isOnboarding) {
      context.push('/account/create');
    } else if (context.canPop()) {
      context.pop();
    }
  }

  Future<void> _buy() async {
    setState(() => _buying = true);
    final result = await _repo.purchasePack(_selected);
    if (!mounted) return;
    setState(() => _buying = false);
    if (result is PurchaseSuccess) {
      await _continueAfterStorePaywall();
      return;
    }
    final message = switch (result) {
      PurchasePending() => 'Payment is pending. Cars are added when it completes.',
      PurchaseError(:final message) => message,
      PurchaseCancelled() => null,
      PurchaseSuccess() => null,
    };
    if (message != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  void _selectPack(CarPackType pack) {
    setState(() => _selected = pack);
    ProductAnalytics.instance.track(AnalyticsEvents.packSelected, {
      'placement': isOnboarding ? 'onboarding' : 'paywall',
      'pack_id': pack.productId,
      'price': pack.priceUsd,
      'currency': 'USD',
      'stage': 'preview',
    });
  }

  void _dismiss(String action) {
    ProductAnalytics.instance.track(AnalyticsEvents.paywallDismissed, {
      'placement': isOnboarding ? 'onboarding' : 'paywall',
      'action': action,
      'provider': 'local',
    });
  }

  Future<void> _startShoppingFree() async {
    _dismiss('start_shopping_free');
    if (isOnboarding) {
      context.push('/account/create');
      return;
    }
    context.go('/shop');
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
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.s2),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (isOnboarding)
                        IconButton(
                          icon: Icon(LucideIcons.chevronLeft, color: colors.ink),
                          onPressed: () {
                            _dismiss('back');
                            context.pop();
                          },
                        )
                      else
                        const SizedBox(width: 48),
                      if (isOnboarding)
                        const ProgressDots(current: 4, total: onboardingStepCount),
                      if (!isOnboarding)
                        IconButton(
                          icon: Icon(LucideIcons.x, color: colors.ink),
                          onPressed: () {
                            _dismiss('close');
                            context.pop();
                          },
                        )
                      else
                        const SizedBox(width: 48),
                    ],
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
                    child: Column(
                      children: [
                        const SizedBox(height: DrevvySpace.s4),
                        Text(
                          'Market data, then a written price.',
                          style: text.headline,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: DrevvySpace.s3),
                        Text(
                          'Drevvy is a transparency layer. It uses market data to ask the dealer for an itemized out-the-door quote.',
                          style: text.body.copyWith(color: colors.muted),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: DrevvySpace.s3),
                        Text(
                          'From \$9.70/car · Car packs 3 · 5 · 10 · One-time. Never expire.',
                          style: text.callout.copyWith(color: colors.ink),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: DrevvySpace.s5),
                        for (final pack in CarPackType.values) ...[
                          PackOptionCard(
                            pack: pack,
                            isSelected: _selected == pack,
                            showBadge: pack == CarPackType.bestValue,
                            totalLabel: _totalLabel(pack),
                            perCarLabel: _perCarLabel(pack),
                            onTap: () => _selectPack(pack),
                          ),
                          const SizedBox(height: DrevvySpace.s3),
                        ],
                        const SizedBox(height: DrevvySpace.s2),
                        Text(
                          'Asking and shopping stay free and unlimited. Buy a pack only when you tap Unlock my price and your balance is 0. Packs are one-time and never expire.',
                          style: text.callout.copyWith(color: colors.muted),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: DrevvySpace.s6),
                      ],
                    ),
                  ),
                ),
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
                        onPressed: _buying ? null : _startShoppingFree,
                        isFullWidth: true,
                      ),
                      const SizedBox(height: DrevvySpace.s3),
                      DrevvyButton(
                        label: _cta(_selected),
                        variant: DrevvyButtonVariant.secondary,
                        onPressed: _buying ? null : _buy,
                        isLoading: _buying,
                        isFullWidth: true,
                      ),
                      const SizedBox(height: DrevvySpace.s2),
                      Text(
                        'One-time purchase. No recurring charges.',
                        style: text.micro.copyWith(color: colors.muted),
                        textAlign: TextAlign.center,
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

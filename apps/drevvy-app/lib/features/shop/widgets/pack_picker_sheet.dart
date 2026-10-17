import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';
import '../../common/analytics_privacy.dart';
import 'pack_option_card.dart';

/// Screen X: Pack picker paywall sheet shown when user taps "Unlock my price".
/// v1.7: Replaces monthly subscription with one-time car packs.
///
/// Pack options, full-width rows, 10-pack preselected:
/// - 1 car (Single) $27 — $27.00/car, "One-time · never expires"
/// - 3 cars (Starter) $47 — $15.67/car, Save 42.0%/car
/// - 5 cars (Plus) $67 — $13.40/car, Save 50.4%/car
/// - 10 cars (Best Value) $97 — $9.70/car, Save 64.1%/car
///
/// Products drevvy_pack_1/3/5/10, packages pack_1/3/5/10, 1/3/5/10 CARS.
/// Superwall placement: unlock_my_price
/// Account → Buy cars uses this same sheet.
class PackPickerSheet extends StatefulWidget {
  const PackPickerSheet({
    super.key,
    this.listing,
    required this.onPurchase,
    required this.onRestore,
    required this.onKeepShopping,
    this.avgSavings,
    this.placement = 'unlock_my_price',
  });

  /// The listing context, if shown from a VDP. Null when shown from Account sheet.
  final Listing? listing;
  final Future<void> Function(CarPackType) onPurchase;
  final VoidCallback onRestore;
  final VoidCallback onKeepShopping;

  /// Server-driven avg_savings stat. Hidden if null.
  final AvgSavingsConfig? avgSavings;
  final String placement;

  @override
  State<PackPickerSheet> createState() => _PackPickerSheetState();
}

class _PackPickerSheetState extends State<PackPickerSheet> {
  CarPackType _selectedPack = CarPackType.bestValue; // Preselected per spec
  bool _isPurchasing = false;

  @override
  void initState() {
    super.initState();
    ProductAnalytics.instance.screen('pack_picker', {
      'placement': widget.placement,
    });
    ProductAnalytics.instance.track(AnalyticsEvents.paywallViewed, {
      'placement': widget.placement,
      'provider': 'local',
    });
    ProductAnalytics.instance.track(AnalyticsEvents.packViewed, {
      'placement': widget.placement,
      'pack_count': CarPackType.values.length,
      'pack_mix': CarPackType.packMix,
    });
  }

  void _selectPack(CarPackType pack) {
    setState(() => _selectedPack = pack);
    ProductAnalytics.instance.track(AnalyticsEvents.packSelected, {
      'placement': widget.placement,
      'pack_id': pack.productId,
      'pack_size': pack.cars,
      'pack_mix': CarPackType.packMix,
      'price': pack.priceUsd,
      'currency': 'USD',
      'stage': 'preview',
    });
  }

  Future<void> _handlePurchase() async {
    setState(() => _isPurchasing = true);
    try {
      await widget.onPurchase(_selectedPack);
    } finally {
      if (mounted) {
        setState(() => _isPurchasing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            height: 40,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colors.track,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: IconButton(
                    icon: Icon(LucideIcons.x, color: colors.muted),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (widget.listing?.media.primaryPhoto != null) ...[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                    child: SizedBox(
                      height: 72,
                      width: double.infinity,
                      child: Image.asset(
                        widget.listing!.media.primaryPhoto!,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  const SizedBox(height: DrevvySpace.s2),
                ],
                Text('Let Drevvy handle this dealer.', style: text.headline),
                const SizedBox(height: DrevvySpace.s1),
                Text(
                  'Pick a car pack. Each car you unlock uses one.',
                  style: text.callout.copyWith(color: colors.muted),
                ),
                const SizedBox(height: DrevvySpace.s3),
                PackPickerColumn(
                  selected: _selectedPack,
                  onSelected: _selectPack,
                ),
                if (widget.avgSavings != null) ...[
                  const SizedBox(height: DrevvySpace.s3),
                  _AvgSavingsStat(config: widget.avgSavings!),
                ],
                const SizedBox(height: DrevvySpace.s3),
                DrevvyPrimaryButton(
                  label: _selectedPack.ctaText,
                  onPressed: _isPurchasing ? null : _handlePurchase,
                  isLoading: _isPurchasing,
                ),
                Center(
                  child: DrevvyGhostButton(
                    label: 'Keep shopping free',
                    onPressed: () {
                      ProductAnalytics.instance.track(
                        AnalyticsEvents.paywallDismissed,
                        {
                          'placement': widget.placement,
                          'action': 'keep_shopping',
                          'provider': 'local',
                        },
                      );
                      widget.onKeepShopping();
                    },
                    color: colors.ink,
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    TextButton(
                      onPressed: widget.onRestore,
                      child: Text(
                        'Restore purchases',
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                    ),
                    Text(
                      ' · ',
                      style: text.callout.copyWith(color: colors.muted),
                    ),
                    TextButton(
                      onPressed: () {},
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
                      onPressed: () => showAnalyticsPrivacy(context),
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
          SizedBox(height: bottomPadding),
        ],
      ),
    );
  }
}

/// Server-driven avg_savings stat display.
class _AvgSavingsStat extends StatelessWidget {
  const _AvgSavingsStat({required this.config});

  final AvgSavingsConfig config;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      decoration: BoxDecoration(
        color: colors.mintTint,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            config.value,
            style: text.bodyStrong.copyWith(color: colors.mint),
          ),
          const SizedBox(height: DrevvySpace.s1),
          Text(config.label, style: text.callout.copyWith(color: colors.mint)),
          const SizedBox(height: DrevvySpace.s1),
          Text(
            'Source: ${config.source}.',
            style: text.micro.copyWith(color: colors.muted),
          ),
        ],
      ),
    );
  }
}

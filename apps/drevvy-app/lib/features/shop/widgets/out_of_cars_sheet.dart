import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';
import 'pack_option_card.dart';

/// Screen X: Out of cars sheet shown when balance is 0 and user tries to unlock.
/// v1.7: Replaces monthly_limit_reached / drevvy_extra_10.
///
/// Superwall placement: cars_balance_empty
class OutOfCarsSheet extends StatefulWidget {
  const OutOfCarsSheet({
    super.key,
    this.listing,
    required this.onPurchase,
    required this.onNotNow,
    this.placement = 'out_of_cars',
  });

  /// Car the shopper was trying to unlock. Omitted from the account screen.
  final Listing? listing;
  final Future<void> Function(CarPackType) onPurchase;
  final VoidCallback onNotNow;
  final String placement;

  @override
  State<OutOfCarsSheet> createState() => _OutOfCarsSheetState();
}

class _OutOfCarsSheetState extends State<OutOfCarsSheet> {
  CarPackType _selectedPack = CarPackType.bestValue; // Preselected per spec
  bool _isPurchasing = false;

  @override
  void initState() {
    super.initState();
    ProductAnalytics.instance.screen('out_of_cars', {
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
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: DrevvySpace.s3,
                    vertical: DrevvySpace.s1,
                  ),
                  decoration: BoxDecoration(
                    color: colors.honey.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                  ),
                  child: Text(
                    '0 CARS LEFT',
                    style: text.label.copyWith(
                      color: colors.honey,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: DrevvySpace.s2),
                Text("You've used all your cars.", style: text.title),
                const SizedBox(height: DrevvySpace.s1),
                Text(
                  'Your active deals keep going. Add a pack to unlock this car.',
                  style: text.callout.copyWith(color: colors.muted),
                ),
                const SizedBox(height: DrevvySpace.s3),
                PackPickerColumn(
                  selected: _selectedPack,
                  onSelected: _selectPack,
                ),
                const SizedBox(height: DrevvySpace.s3),
                DrevvyPrimaryButton(
                  label: _selectedPack.ctaText,
                  onPressed: _isPurchasing ? null : _handlePurchase,
                  isLoading: _isPurchasing,
                ),
                Center(
                  child: DrevvyGhostButton(
                    label: 'Not now',
                    onPressed: () {
                      ProductAnalytics.instance.track(
                        AnalyticsEvents.paywallDismissed,
                        {
                          'placement': widget.placement,
                          'action': 'not_now',
                          'provider': 'local',
                        },
                      );
                      widget.onNotNow();
                    },
                    color: colors.ink,
                  ),
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

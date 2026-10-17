import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/analytics_view.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';

/// Screen 37: Left dealership notification (geofence exit trigger)
/// Shown when user leaves the dealership after pickup check was enabled
class LeftDealershipSheet extends StatelessWidget {
  const LeftDealershipSheet({
    super.key,
    required this.deal,
    required this.onBought,
    required this.onStillLooking,
    required this.onDismiss,
  });

  final Deal deal;
  final VoidCallback onBought;
  final VoidCallback onStillLooking;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final dealerName = deal.dealer?.name ?? 'the dealership';

    return AnalyticsView(
      screen: 'left_dealership',
      child: Container(
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: DrevvySpace.s3),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.track,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(DrevvySpace.gutter),
            child: Column(
              children: [
                const SizedBox(height: DrevvySpace.s4),

                // Success orb
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: colors.acceptTint,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    LucideIcons.mapPinCheck,
                    size: 36,
                    color: colors.accept,
                  ),
                ),

                const SizedBox(height: DrevvySpace.s5),

                Text(
                  'How did it go?',
                  style: text.headline,
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: DrevvySpace.s2),

                Text(
                  'Looks like you just left $dealerName. Did you buy your ${deal.listing.shortTitle}?',
                  style: text.body.copyWith(color: colors.muted),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: DrevvySpace.s6),

                // Options
                DrevvyButton(
                  label: 'Yes, I bought it!',
                  icon: LucideIcons.partyPopper,
                  onPressed: () {
                    ProductAnalytics.instance.track(
                      AnalyticsEvents.leftDealershipAnswered,
                      {'answer': 'bought'},
                    );
                    onBought();
                  },
                  variant: DrevvyButtonVariant.accept,
                  isFullWidth: true,
                ),

                const SizedBox(height: DrevvySpace.s3),

                DrevvyButton(
                  label: 'Still looking',
                  icon: LucideIcons.search,
                  onPressed: () {
                    ProductAnalytics.instance.track(
                      AnalyticsEvents.leftDealershipAnswered,
                      {'answer': 'still_looking'},
                    );
                    onStillLooking();
                  },
                  variant: DrevvyButtonVariant.secondary,
                  isFullWidth: true,
                ),

                const SizedBox(height: DrevvySpace.s3),

                TextButton(
                  onPressed: () {
                    ProductAnalytics.instance.track(
                      AnalyticsEvents.leftDealershipAnswered,
                      {'answer': 'dismissed'},
                    );
                    onDismiss();
                  },
                  child: Text(
                    'Dismiss',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                ),
              ],
            ),
          ),

          SizedBox(height: bottomPadding),
        ],
      ),
      ),
    );
  }
}

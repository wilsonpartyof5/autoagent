import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/analytics_view.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';

/// v1.6: "Changed my mind" withdraw sheet in Accepted state
class WithdrawSheet extends StatelessWidget {
  const WithdrawSheet({
    super.key,
    required this.deal,
    required this.onWithdraw,
    required this.onKeepDeal,
  });

  final Deal deal;
  final VoidCallback onWithdraw;
  final VoidCallback onKeepDeal;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final listing = deal.listing;
    final offer = deal.latestOffer;

    return AnalyticsView(
      screen: 'withdraw_acceptance',
      properties: {'deal_id': deal.id},
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Changed your mind?', style: text.headline),
                const SizedBox(height: DrevvySpace.s2),
                Text(
                  'You can withdraw your acceptance, but the dealer has already been notified.',
                  style: text.body.copyWith(color: colors.muted),
                ),

                const SizedBox(height: DrevvySpace.s5),

                // Car row
                Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                      child: SizedBox(
                        width: 60,
                        height: 45,
                        child: listing.media.primaryPhoto != null
                            ? Image.asset(
                                listing.media.primaryPhoto!,
                                fit: BoxFit.cover,
                              )
                            : Container(
                                color: colors.tile,
                                child: Icon(LucideIcons.car, color: colors.muted),
                              ),
                      ),
                    ),
                    const SizedBox(width: DrevvySpace.s3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(listing.shortTitle, style: text.bodyStrong),
                          if (offer != null)
                            Text(
                              'Accepted at ${_formatPrice(offer.otd)} OTD',
                              style: text.callout.copyWith(color: colors.accept),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: DrevvySpace.s5),

                // Warning box
                Container(
                  padding: const EdgeInsets.all(DrevvySpace.s4),
                  decoration: BoxDecoration(
                    color: colors.soldTint,
                    borderRadius: BorderRadius.circular(DrevvyRadius.md),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(LucideIcons.alertTriangle, size: 20, color: colors.sold),
                      const SizedBox(width: DrevvySpace.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'This key was used',
                              style: text.bodyStrong.copyWith(color: colors.sold),
                            ),
                            Text(
                              'Drevvy has already contacted the dealer. This key will not be refunded.',
                              style: text.callout.copyWith(color: colors.sold),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: DrevvySpace.s6),

                DrevvyButton(
                  label: 'Withdraw acceptance',
                  variant: DrevvyButtonVariant.destructive,
                  onPressed: () {
                    ProductAnalytics.instance.track(
                      AnalyticsEvents.acceptanceWithdrawConfirmed,
                      {'deal_id': deal.id},
                    );
                    onWithdraw();
                  },
                  isFullWidth: true,
                ),
                const SizedBox(height: DrevvySpace.s3),
                DrevvyGhostButton(
                  label: 'Keep this deal',
                  onPressed: () {
                    ProductAnalytics.instance.track(
                      AnalyticsEvents.acceptanceWithdrawCancelled,
                      {'deal_id': deal.id},
                    );
                    onKeepDeal();
                  },
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

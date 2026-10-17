import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/analytics_view.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';

/// Screen 35: Trade-in & financing (optional) - shown after official offer
class TradeInFinancingSheet extends StatelessWidget {
  const TradeInFinancingSheet({
    super.key,
    required this.userPrefs,
    required this.onYes,
    required this.onNoThanks,
  });

  final UserPrefs userPrefs;
  final VoidCallback onYes;
  final VoidCallback onNoThanks;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    final hasTradeIn = userPrefs.tradeIn == TradeInPref.yes;
    final needsFinancing = userPrefs.payment == PaymentPref.finance;

    return AnalyticsView(
      screen: 'trade_in',
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: DrevvySpace.s2),

                Text(
                  'One more thing?',
                  style: text.headline,
                ),

                const SizedBox(height: DrevvySpace.s2),

                Text(
                  'Want Drevvy to keep going on your trade-in or financing?',
                  style: text.body.copyWith(color: colors.muted),
                ),

                const SizedBox(height: DrevvySpace.s5),

                // Trade-in option
                _OptionRow(
                  icon: LucideIcons.car,
                  title: 'Trade-in',
                  description: 'Get a quote on your current car',
                  tag: hasTradeIn ? 'You said yes' : null,
                  tagColor: hasTradeIn ? colors.mint : null,
                ),

                const SizedBox(height: DrevvySpace.s3),

                // Financing option
                _OptionRow(
                  icon: LucideIcons.creditCard,
                  title: 'Financing',
                  description: 'Compare rates from multiple lenders',
                  tag: needsFinancing ? 'You said finance' : null,
                  tagColor: needsFinancing ? colors.mint : null,
                ),

                const SizedBox(height: DrevvySpace.s6),

                // CTAs
                DrevvyPrimaryButton(
                  label: 'Yes, keep going',
                  onPressed: () {
                    ProductAnalytics.instance.track(
                      AnalyticsEvents.tradeInAnswered,
                      {'answer': 'yes'},
                    );
                    onYes();
                  },
                ),

                const SizedBox(height: DrevvySpace.s3),

                DrevvyGhostButton(
                  label: 'No thanks',
                  onPressed: () {
                    ProductAnalytics.instance.track(
                      AnalyticsEvents.tradeInAnswered,
                      {'answer': 'no'},
                    );
                    onNoThanks();
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

class _OptionRow extends StatelessWidget {
  const _OptionRow({
    required this.icon,
    required this.title,
    required this.description,
    this.tag,
    this.tagColor,
  });

  final IconData icon;
  final String title;
  final String description;
  final String? tag;
  final Color? tagColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      decoration: BoxDecoration(
        color: colors.tile,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: colors.lilacTint,
              borderRadius: BorderRadius.circular(DrevvyRadius.sm),
            ),
            child: Icon(icon, color: colors.violet, size: 22),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(title, style: text.bodyStrong),
                    if (tag != null) ...[
                      const SizedBox(width: DrevvySpace.s2),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: DrevvySpace.s2,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: tagColor?.withValues(alpha: 0.15) ?? colors.tile,
                          borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                        ),
                        child: Text(
                          tag!,
                          style: text.micro.copyWith(color: tagColor ?? colors.muted),
                        ),
                      ),
                    ],
                  ],
                ),
                Text(
                  description,
                  style: text.callout.copyWith(color: colors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

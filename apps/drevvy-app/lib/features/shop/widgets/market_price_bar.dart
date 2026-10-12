import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/models.dart';

/// Market price bar showing p5-p95 range with fair price marker
/// Per spec §10.6: low/high = p5/p95, fair price sits between them
class MarketPriceBar extends StatelessWidget {
  const MarketPriceBar({
    super.key,
    required this.listing,
    required this.market,
  });

  final Listing listing;
  final MarketContext market;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    final listedPrice = listing.price;
    final fairPrice = market.fairVehiclePrice;
    final lowPrice = market.lowPrice;
    final highPrice = market.highPrice;

    // Calculate positions for the bar (0.0 to 1.0)
    final range = highPrice - lowPrice;
    final fairPos = range > 0 ? (fairPrice - lowPrice) / range : 0.5;
    final listedPos = range > 0 
        ? ((listedPrice - lowPrice) / range).clamp(0.0, 1.0) 
        : 0.5;

    // Determine badge text and colors
    final diff = fairPrice - listedPrice;
    final isBelow = diff > 0;
    final badgeText = market.badgeText(listedPrice);
    final badgeBg = isBelow ? colors.marketBelowFill : colors.marketAboveFill;
    final badgeColor = isBelow ? colors.marketBelowText : colors.marketAboveText;

    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Market price', style: text.title),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: DrevvySpace.s3,
                  vertical: DrevvySpace.s1,
                ),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                ),
                child: Text(
                  badgeText,
                  style: text.label.copyWith(color: badgeColor),
                ),
              ),
            ],
          ),
          
          const SizedBox(height: DrevvySpace.s4),
          
          // Price bar
          SizedBox(
            height: 48,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Gradient bar
                Positioned(
                  left: 0,
                  right: 0,
                  top: 20,
                  child: Container(
                    height: 8,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: DrevvyBrand.marketBar,
                      ),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
                
                // Fair price marker (diamond)
                Positioned(
                  left: fairPos * (MediaQuery.of(context).size.width - 64 - 32) - 8,
                  top: 16,
                  child: Column(
                    children: [
                      Transform.rotate(
                        angle: 0.785398, // 45 degrees
                        child: Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: colors.fair,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                
                // Listed price marker (circle)
                Positioned(
                  left: listedPos * (MediaQuery.of(context).size.width - 64 - 32) - 10,
                  top: 14,
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      color: colors.ink,
                      shape: BoxShape.circle,
                      border: Border.all(color: colors.glassSolid, width: 2),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Labels
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _formatPrice(lowPrice),
                style: text.label.copyWith(color: colors.muted),
              ),
              Text(
                _formatPrice(highPrice),
                style: text.label.copyWith(color: colors.muted),
              ),
            ],
          ),
          
          const SizedBox(height: DrevvySpace.s4),
          
          // Legend
          Row(
            children: [
              _LegendItem(
                color: colors.ink,
                isCircle: true,
                label: 'This car ${_formatPrice(listedPrice)}',
              ),
              const SizedBox(width: DrevvySpace.s4),
              _LegendItem(
                color: colors.fair,
                isCircle: false,
                label: 'Fair price ${_formatPrice(fairPrice)}',
              ),
            ],
          ),
          
          const SizedBox(height: DrevvySpace.s2),
          
          // Scope caption
          Text(
            '${market.comparablesCount} similar vehicles within 50 mi',
            style: text.callout.copyWith(color: colors.muted),
          ),
        ],
      ),
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({
    required this.color,
    required this.isCircle,
    required this.label,
  });

  final Color color;
  final bool isCircle;
  final String label;

  @override
  Widget build(BuildContext context) {
    final text = context.drevvyText;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (isCircle)
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          )
        else
          Transform.rotate(
            angle: 0.785398,
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(1),
              ),
            ),
          ),
        const SizedBox(width: DrevvySpace.s2),
        Text(label, style: text.callout),
      ],
    );
  }
}

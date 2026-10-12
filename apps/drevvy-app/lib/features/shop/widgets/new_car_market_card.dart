import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/models.dart';

/// New-car market card showing MSRP comparison + local listings
/// Per spec §10.6: new cars use MSRP/local-listings/incentives card
class NewCarMarketCard extends StatelessWidget {
  const NewCarMarketCard({
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

    final msrp = market.msrp ?? listing.msrp ?? listing.price + 2000;
    final listedPrice = listing.price;
    final discount = msrp - listedPrice;
    final isBelow = discount > 0;

    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('New car pricing', style: text.title),
              if (isBelow)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: DrevvySpace.s3,
                    vertical: DrevvySpace.s1,
                  ),
                  decoration: BoxDecoration(
                    color: colors.marketBelowFill,
                    borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                  ),
                  child: Text(
                    '${_formatPrice(discount)} below MSRP',
                    style: text.label.copyWith(color: colors.marketBelowText),
                  ),
                ),
            ],
          ),

          const SizedBox(height: DrevvySpace.s4),

          // Price tiles
          Row(
            children: [
              Expanded(
                child: _PriceTile(
                  label: 'MSRP',
                  value: _formatPrice(msrp),
                  subLabel: 'Manufacturer',
                ),
              ),
              const SizedBox(width: DrevvySpace.s3),
              Expanded(
                child: _PriceTile(
                  label: 'This car',
                  value: _formatPrice(listedPrice),
                  subLabel: 'Listed price',
                  highlight: isBelow,
                ),
              ),
              const SizedBox(width: DrevvySpace.s3),
              Expanded(
                child: _PriceTile(
                  label: 'vs MSRP',
                  value: isBelow ? '-${_formatPrice(discount)}' : '+${_formatPrice(-discount)}',
                  subLabel: isBelow ? 'Discount' : 'Markup',
                  highlight: isBelow,
                  isGreen: isBelow,
                ),
              ),
            ],
          ),

          const SizedBox(height: DrevvySpace.s4),

          // Local listings comparison
          _LocalListingsBar(market: market, listedPrice: listedPrice),

          const SizedBox(height: DrevvySpace.s4),

          // Incentives section (if any)
          if (market.msrpDiscount != null && market.msrpDiscount! > 0) ...[
            Divider(color: colors.line),
            const SizedBox(height: DrevvySpace.s3),
            _IncentivesSection(),
          ],
        ],
      ),
    );
  }
}

class _PriceTile extends StatelessWidget {
  const _PriceTile({
    required this.label,
    required this.value,
    required this.subLabel,
    this.highlight = false,
    this.isGreen = false,
  });

  final String label;
  final String value;
  final String subLabel;
  final bool highlight;
  final bool isGreen;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      padding: const EdgeInsets.all(DrevvySpace.s3),
      decoration: BoxDecoration(
        color: highlight ? colors.mintTint : colors.tile,
        borderRadius: BorderRadius.circular(DrevvyRadius.sm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: text.label.copyWith(color: colors.muted)),
          const SizedBox(height: DrevvySpace.s1),
          Text(
            value,
            style: text.bodyStrong.copyWith(
              color: isGreen ? colors.mint : colors.ink,
            ),
          ),
          Text(subLabel, style: text.micro.copyWith(color: colors.muted)),
        ],
      ),
    );
  }
}

class _LocalListingsBar extends StatelessWidget {
  const _LocalListingsBar({
    required this.market,
    required this.listedPrice,
  });

  final MarketContext market;
  final int listedPrice;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    final lowPrice = market.lowPrice;
    final highPrice = market.highPrice;
    final range = highPrice - lowPrice;
    final listedPos = range > 0 
        ? ((listedPrice - lowPrice) / range).clamp(0.0, 1.0) 
        : 0.5;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Local new listings', style: text.callout.copyWith(color: colors.muted)),
        const SizedBox(height: DrevvySpace.s2),

        // Bar
        SizedBox(
          height: 32,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Track
              Positioned(
                left: 0,
                right: 0,
                top: 12,
                child: Container(
                  height: 8,
                  decoration: BoxDecoration(
                    color: colors.track,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              // Listed price marker
              Positioned(
                left: listedPos * (MediaQuery.of(context).size.width - 80) - 10,
                top: 6,
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
            Text(_formatPrice(lowPrice), style: text.label.copyWith(color: colors.muted)),
            Text(_formatPrice(highPrice), style: text.label.copyWith(color: colors.muted)),
          ],
        ),

        const SizedBox(height: DrevvySpace.s2),

        // Caption
        Text(
          '${market.comparablesCount} new ${market.comparablesCount == 1 ? 'listing' : 'listings'} within 50 mi',
          style: text.callout.copyWith(color: colors.muted),
        ),
      ],
    );
  }
}

class _IncentivesSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(LucideIcons.tag, size: 16, color: colors.violet),
            const SizedBox(width: DrevvySpace.s2),
            Text('Available incentives', style: text.bodyStrong),
          ],
        ),
        const SizedBox(height: DrevvySpace.s3),
        _IncentiveRow(
          title: 'Manufacturer rebate',
          detail: '\$1,500 cash back',
          endDate: 'Ends Dec 31',
        ),
        _IncentiveRow(
          title: 'Special APR',
          detail: '2.9% for 60 months',
          endDate: 'Ends Nov 30',
        ),
      ],
    );
  }
}

class _IncentiveRow extends StatelessWidget {
  const _IncentiveRow({
    required this.title,
    required this.detail,
    required this.endDate,
  });

  final String title;
  final String detail;
  final String endDate;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s2),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.body),
                Text(detail, style: text.callout.copyWith(color: colors.mint)),
              ],
            ),
          ),
          Text(endDate, style: text.micro.copyWith(color: colors.muted)),
        ],
      ),
    );
  }
}

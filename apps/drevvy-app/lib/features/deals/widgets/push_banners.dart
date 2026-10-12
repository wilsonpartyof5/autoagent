import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';

/// v1.6: Push banner for price drop notification
class PriceDropBanner extends StatelessWidget {
  const PriceDropBanner({
    super.key,
    required this.carTitle,
    required this.oldPrice,
    required this.newPrice,
    required this.onTap,
    this.onDismiss,
    this.hidePrices = false,
  });

  final String carTitle;
  final int oldPrice;
  final int newPrice;
  final VoidCallback onTap;
  final VoidCallback? onDismiss;
  final bool hidePrices;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final drop = oldPrice - newPrice;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.all(DrevvySpace.gutter),
        padding: const EdgeInsets.all(DrevvySpace.s4),
        decoration: BoxDecoration(
          color: colors.glassSolid,
          borderRadius: BorderRadius.circular(DrevvyRadius.md),
          boxShadow: colors.elev2,
          border: Border.all(color: colors.mint.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: colors.mintTint,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(LucideIcons.trendingDown, size: 20, color: colors.mint),
            ),
            const SizedBox(width: DrevvySpace.s3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Price drop', style: text.bodyStrong.copyWith(color: colors.mint)),
                      Text('now', style: text.micro.copyWith(color: colors.muted)),
                    ],
                  ),
                  Text(
                    hidePrices
                        ? '$carTitle price dropped'
                        : '$carTitle: ${_formatPrice(drop)} off',
                    style: text.callout.copyWith(color: colors.muted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (onDismiss != null) ...[
              const SizedBox(width: DrevvySpace.s2),
              IconButton(
                onPressed: onDismiss,
                icon: Icon(LucideIcons.x, size: 18, color: colors.muted),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// v1.6: Push banner for add-on removed notification
class AddOnRemovedBanner extends StatelessWidget {
  const AddOnRemovedBanner({
    super.key,
    required this.carTitle,
    required this.addOnName,
    required this.savedAmount,
    required this.onTap,
    this.onDismiss,
    this.hidePrices = false,
  });

  final String carTitle;
  final String addOnName;
  final int savedAmount;
  final VoidCallback onTap;
  final VoidCallback? onDismiss;
  final bool hidePrices;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.all(DrevvySpace.gutter),
        padding: const EdgeInsets.all(DrevvySpace.s4),
        decoration: BoxDecoration(
          color: colors.glassSolid,
          borderRadius: BorderRadius.circular(DrevvyRadius.md),
          boxShadow: colors.elev2,
          border: Border.all(color: colors.violet.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: colors.lilacTint,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(LucideIcons.minusCircle, size: 20, color: colors.violet),
            ),
            const SizedBox(width: DrevvySpace.s3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Add-on removed', style: text.bodyStrong.copyWith(color: colors.violet)),
                      Text('now', style: text.micro.copyWith(color: colors.muted)),
                    ],
                  ),
                  Text(
                    hidePrices
                        ? '$carTitle: $addOnName removed'
                        : '$carTitle: ${_formatPrice(savedAmount)} saved',
                    style: text.callout.copyWith(color: colors.muted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (onDismiss != null) ...[
              const SizedBox(width: DrevvySpace.s2),
              IconButton(
                onPressed: onDismiss,
                icon: Icon(LucideIcons.x, size: 18, color: colors.muted),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// v1.6: New offer banner (updated from earlier version)
class NewOfferBanner extends StatelessWidget {
  const NewOfferBanner({
    super.key,
    required this.carTitle,
    required this.otd,
    required this.onTap,
    this.onDismiss,
    this.hidePrices = false,
  });

  final String carTitle;
  final int otd;
  final VoidCallback onTap;
  final VoidCallback? onDismiss;
  final bool hidePrices;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.all(DrevvySpace.gutter),
        padding: const EdgeInsets.all(DrevvySpace.s4),
        decoration: BoxDecoration(
          color: colors.glassSolid,
          borderRadius: BorderRadius.circular(DrevvyRadius.md),
          boxShadow: colors.elev2,
          border: Border.all(color: colors.violet.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: DrevvyBrand.gradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(LucideIcons.sparkles, size: 20, color: DrevvyColors.onBrand),
            ),
            const SizedBox(width: DrevvySpace.s3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Drevvy', style: text.bodyStrong),
                      Text('now', style: text.micro.copyWith(color: colors.muted)),
                    ],
                  ),
                  Text(
                    hidePrices
                        ? 'New offer on $carTitle'
                        : 'New offer on $carTitle: ${_formatPrice(otd)} OTD',
                    style: text.callout.copyWith(color: colors.muted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (onDismiss != null) ...[
              const SizedBox(width: DrevvySpace.s2),
              IconButton(
                onPressed: onDismiss,
                icon: Icon(LucideIcons.x, size: 18, color: colors.muted),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

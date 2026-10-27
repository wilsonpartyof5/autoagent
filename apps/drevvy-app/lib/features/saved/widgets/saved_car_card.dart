import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/models.dart';

/// Saved car card per spec §6.15 (v1.8).
/// Shows price change chip only when real price data differs from saved price.
/// TODO: Price changes must come from live MarketCheck data, not stored prices.
class SavedCarCard extends StatelessWidget {
  const SavedCarCard({
    super.key,
    required this.savedCar,
    this.listing,
    required this.onRemove,
    required this.onUnlock,
    required this.onFindSimilar,
    this.onTap,
  });

  final SavedCar savedCar;
  final Listing? listing;
  final VoidCallback onRemove;
  final VoidCallback onUnlock;
  final VoidCallback onFindSimilar;
  final VoidCallback? onTap;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  String _formatDate(DateTime date) {
    return 'saved ${DateFormat('MMM d').format(date)}';
  }

  @override
  Widget build(BuildContext context) {
    final isNoLongerListed = savedCar.isNoLongerListed || listing == null;
    
    return Dismissible(
      key: Key(savedCar.id),
      direction: DismissDirection.endToStart,
      background: _buildDismissBackground(context),
      onDismissed: (_) => onRemove(),
      child: GestureDetector(
        onTap: isNoLongerListed ? null : onTap,
        child: isNoLongerListed
            ? _buildNoLongerListedCard(context)
            : _buildActiveCard(context),
      ),
    );
  }

  Widget _buildDismissBackground(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.only(right: DrevvySpace.s4),
      decoration: BoxDecoration(
        color: colors.danger,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(LucideIcons.trash2, color: Colors.white, size: 24),
          const SizedBox(height: 4),
          Text(
            'Remove',
            style: text.label.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _buildNoLongerListedCard(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Opacity(
      opacity: 0.6,
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(DrevvySpace.s3),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Photo with gray heart
                  Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                        child: ColorFiltered(
                          colorFilter: const ColorFilter.mode(
                            Colors.grey,
                            BlendMode.saturation,
                          ),
                          child: SizedBox(
                            width: 96,
                            height: 70,
                            child: listing?.media.primaryPhoto != null
                                ? Image.asset(
                                    listing!.media.primaryPhoto!,
                                    fit: BoxFit.cover,
                                  )
                                : Container(color: colors.tile),
                          ),
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: colors.glassSolid.withValues(alpha: 0.9),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            LucideIcons.heart,
                            size: 16,
                            color: colors.muted,
                          ),
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(width: DrevvySpace.s3),
                  
                  // Text content
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          listing?.title ?? 'Unknown Vehicle',
                          style: text.cardTitle.copyWith(color: colors.muted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (listing != null)
                          Text(
                            listing!.subtitle,
                            style: text.callout.copyWith(color: colors.muted),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        Text(
                          savedCar.savedPrice != null
                              ? _formatPrice(savedCar.savedPrice!)
                              : 'N/A',
                          style: text.figureS.copyWith(
                            color: colors.muted,
                            decoration: TextDecoration.lineThrough,
                          ),
                        ),
                        Text(
                          '${listing?.distanceFormatted ?? ''} · ${_formatDate(savedCar.savedAt)}',
                          style: text.callout.copyWith(color: colors.muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            
            // No longer listed tag
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.s3),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: colors.tile,
                  borderRadius: BorderRadius.circular(DrevvyRadius.xs),
                ),
                child: Text(
                  'No longer listed (likely sold)',
                  style: text.label.copyWith(color: colors.muted),
                ),
              ),
            ),
            
            const SizedBox(height: DrevvySpace.s3),
            
            // Find similar button
            Padding(
              padding: const EdgeInsets.fromLTRB(
                DrevvySpace.s3,
                0,
                DrevvySpace.s3,
                DrevvySpace.s3,
              ),
              child: DrevvyButton(
                label: 'Find similar cars',
                icon: LucideIcons.messageSquare,
                variant: DrevvyButtonVariant.secondary,
                onPressed: onFindSimilar,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveCard(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final listingData = listing!;

    // Calculate price change from saved price
    // TODO: In production, this must come from live MarketCheck data
    final priceChange = savedCar.savedPrice != null
        ? savedCar.savedPrice! - listingData.price
        : null;
    final hasPriceChange = priceChange != null && priceChange != 0;
    final isPriceDrop = priceChange != null && priceChange > 0;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(DrevvySpace.s3),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Photo with heart
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                      child: SizedBox(
                        width: 96,
                        height: 70,
                        child: listingData.media.primaryPhoto != null
                            ? Image.asset(
                                listingData.media.primaryPhoto!,
                                fit: BoxFit.cover,
                              )
                            : Container(color: colors.tile),
                      ),
                    ),
                    Positioned(
                      top: 4,
                      right: 4,
                      child: Container(
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          color: colors.glassSolid.withValues(alpha: 0.9),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          LucideIcons.heart,
                          size: 16,
                          color: colors.danger,
                        ),
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(width: DrevvySpace.s3),
                
                // Text content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        listingData.title,
                        style: text.cardTitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        listingData.subtitle,
                        style: text.callout.copyWith(color: colors.muted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        _formatPrice(listingData.price),
                        style: text.figureS,
                      ),
                      Text(
                        '${listingData.distanceFormatted} · Dealer A · ${_formatDate(savedCar.savedAt)}',
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          // Price change chip (only show when there's actual data)
          if (hasPriceChange)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.s3),
              child: _PriceChangeChip(
                amount: priceChange.abs(),
                isDrop: isPriceDrop,
                wasPrice: savedCar.savedPrice!,
              ),
            ),
          
          if (hasPriceChange)
            const SizedBox(height: DrevvySpace.s3),
          
          // Unlock my price button
          Padding(
            padding: const EdgeInsets.fromLTRB(
              DrevvySpace.s3,
              0,
              DrevvySpace.s3,
              DrevvySpace.s3,
            ),
            child: _UnlockButton(onPressed: onUnlock),
          ),
        ],
      ),
    );
  }
}

class _PriceChangeChip extends StatelessWidget {
  const _PriceChangeChip({
    required this.amount,
    required this.isDrop,
    required this.wasPrice,
  });

  final int amount;
  final bool isDrop;
  final int wasPrice;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    final chipColor = isDrop ? colors.mintTint : colors.danger.withValues(alpha: 0.12);
    final textColor = isDrop ? colors.mint : colors.danger;
    final arrow = isDrop ? '↓' : '↑';

    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: chipColor,
            borderRadius: BorderRadius.circular(DrevvyRadius.xs),
          ),
          child: Text(
            '$arrow ${_formatPrice(amount)} since you saved',
            style: text.label.copyWith(
              color: textColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(width: DrevvySpace.s2),
        Text(
          'was ${_formatPrice(wasPrice)}',
          style: text.callout.copyWith(color: colors.muted),
        ),
      ],
    );
  }
}

class _UnlockButton extends StatelessWidget {
  const _UnlockButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final text = context.drevvyText;

    return GestureDetector(
      onTap: onPressed,
      child: Container(
        height: DrevvySpace.minTap,
        decoration: BoxDecoration(
          gradient: DrevvyColors.brandGradient,
          borderRadius: BorderRadius.circular(DrevvyRadius.pill),
        ),
        child: Center(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.plus, color: Colors.white, size: 16),
              const SizedBox(width: 6),
              Text(
                'Open listing',
                style: text.label.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

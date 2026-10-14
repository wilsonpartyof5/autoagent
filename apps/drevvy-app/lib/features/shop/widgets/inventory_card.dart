import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/listing.dart';

/// Shop result card per spec §6.7 (v1.6.1): no fixed height, full-width CTA on own row.
/// Fixed overflow issue where badge + CTA in a Row exceeded width by 14-24pt.
/// v1.7: Removed isPro flag; CTA is now always "See price" regardless of credits.
/// v1.8: Added heart/save button on photo (§6.15).
class InventoryCard extends StatelessWidget {
  const InventoryCard({
    super.key,
    required this.listing,
    this.hasCredits = false,
    required this.onTap,
    this.marketDelta,
    this.isAlreadyAdded = false,
    this.isSaved = false,
    this.onSaveToggle,
  });

  final Listing listing;
  /// v1.7: Whether user has car credits (unused for now, kept for future A/B).
  final bool hasCredits;
  final VoidCallback onTap;
  final int? marketDelta;
  final bool isAlreadyAdded;
  /// v1.8: Whether the car is saved (heart filled).
  final bool isSaved;
  /// v1.8: Callback when heart is tapped. If null, heart is not shown.
  final VoidCallback? onSaveToggle;

  String _formatNumber(int n) {
    return n.toString().replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (m) => '${m[1]},',
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    // Per audit: badges use "vs similar listings nearby"
    final delta = marketDelta ?? ((listing.price * 0.035).round());
    final isBelow = delta > 0;
    final badgeText = isBelow
        ? '\$${_formatNumber(delta)} below similar'
        : delta < 0
            ? '\$${_formatNumber(-delta)} above similar'
            : 'At market';

    return GestureDetector(
      onTap: onTap,
      child: GlassCard(
        padding: const EdgeInsets.all(DrevvySpace.s2),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Row 1: Photo + text column
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Photo with heart overlay
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                      child: SizedBox(
                        width: 96,
                        height: 70,
                        child: listing.media.primaryPhoto != null
                            ? Image.asset(
                                listing.media.primaryPhoto!,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => _BrokenImage(),
                              )
                            : _BrokenImage(),
                      ),
                    ),
                    // v1.8: Heart button (only show if not already in Deals)
                    if (onSaveToggle != null && !isAlreadyAdded)
                      Positioned(
                        top: 4,
                        right: 4,
                        child: _HeartButton(
                          isSaved: isSaved,
                          onTap: onSaveToggle!,
                        ),
                      ),
                  ],
                ),
                
                const SizedBox(width: DrevvySpace.s3),
                
                // Text column
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Title
                      Text(
                        listing.title,
                        style: text.cardTitle.copyWith(fontSize: 15.5),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      
                      // Trim
                      if (listing.build.trim != null)
                        Text(
                          listing.subtitle,
                          style: text.callout.copyWith(color: colors.muted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      
                      // Price
                      Text(
                        listing.priceFormatted,
                        style: text.figureS.copyWith(fontSize: 18),
                      ),
                      
                      // Miles & distance
                      Text(
                        '${listing.milesFormatted} · ${listing.distanceFormatted}',
                        style: text.label.copyWith(color: colors.muted),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            
            // Row 2: Market badge (left-aligned, can wrap to 2 lines)
            const SizedBox(height: DrevvySpace.s2),
            Align(
              alignment: Alignment.centerLeft,
              child: _MarketBadge(
                text: badgeText,
                isBelow: isBelow,
              ),
            ),
            
            // Row 3: Full-width CTA button
            const SizedBox(height: DrevvySpace.s2),
            _CardCta(
              isAlreadyAdded: isAlreadyAdded,
            ),
          ],
        ),
      ),
    );
  }
}

/// Market comparison badge per spec §6.7
class _MarketBadge extends StatelessWidget {
  const _MarketBadge({
    required this.text,
    required this.isBelow,
  });

  final String text;
  final bool isBelow;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyle = context.drevvyText;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isBelow ? colors.mintTint : colors.tile,
        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            LucideIcons.gauge,
            size: 12,
            color: isBelow ? colors.mint : colors.muted,
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              text,
              style: textStyle.label.copyWith(
                color: isBelow ? colors.mint : colors.muted,
                fontWeight: FontWeight.w600,
              ),
              softWrap: true,
              maxLines: 2,
            ),
          ),
        ],
      ),
    );
  }
}

class _BrokenImage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;

    return Container(
      width: 96,
      height: 70,
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: BorderRadius.circular(DrevvyRadius.sm),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(LucideIcons.imageOff, color: colors.muted, size: 20),
          const SizedBox(height: 2),
          Text(
            'Image didn\'t load',
            style: TextStyle(
              fontSize: 8,
              color: colors.muted,
            ),
          ),
        ],
      ),
    );
  }
}

/// CTA button per spec §6.7: full-width on its own row, min height 44pt,
/// label scales down with FittedBox rather than clipping at large text sizes.
/// v1.7: Simplified CTA - always "See price" (no more Pro vs non-Pro distinction).
class _CardCta extends StatelessWidget {
  const _CardCta({
    required this.isAlreadyAdded,
  });

  final bool isAlreadyAdded;

  @override
  Widget build(BuildContext context) {
    final textStyle = context.drevvyText;

    if (isAlreadyAdded) {
      return Align(
        alignment: Alignment.centerLeft,
        child: StatusChip(DealStatus.reachingOut),
      );
    }

    // v1.7: Single CTA regardless of credit status
    const label = 'See price';
    const IconData? icon = null;

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: DrevvySpace.minTap),
      child: SizedBox(
        width: double.infinity,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: DrevvyColors.brandGradient,
            borderRadius: BorderRadius.circular(DrevvyRadius.pill),
          ),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, color: Colors.white, size: 14),
                      const SizedBox(width: 4),
                    ],
                    Text(
                      label,
                      style: textStyle.label.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Heart/save button per spec §6.15 (v1.8).
/// 30pt circle with 44pt hit area for accessibility.
class _HeartButton extends StatelessWidget {
  const _HeartButton({
    required this.isSaved,
    required this.onTap,
  });

  final bool isSaved;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 44,
        height: 44,
        child: Center(
          child: Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: colors.glassSolid.withValues(alpha: 0.9),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isSaved ? LucideIcons.heart : LucideIcons.heart,
              size: 16,
              color: isSaved ? colors.danger : colors.muted,
            ),
          ),
        ),
      ),
    );
  }
}

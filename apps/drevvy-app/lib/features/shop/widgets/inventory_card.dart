import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/listing.dart';

/// Shop result card per audit: badge = "vs similar listings nearby"
class InventoryCard extends StatelessWidget {
  const InventoryCard({
    super.key,
    required this.listing,
    required this.isPro,
    required this.onTap,
    this.marketDelta,
    this.isAlreadyAdded = false,
  });

  final Listing listing;
  final bool isPro;
  final VoidCallback onTap;
  final int? marketDelta;
  final bool isAlreadyAdded;

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
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Photo
            ClipRRect(
              borderRadius: BorderRadius.circular(DrevvyRadius.sm),
              child: listing.media.primaryPhoto != null
                  ? Image.asset(
                      listing.media.primaryPhoto!,
                      width: 96,
                      height: 70,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _BrokenImage(),
                    )
                  : _BrokenImage(),
            ),
            
            const SizedBox(width: DrevvySpace.s3),
            
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    listing.title,
                    style: text.cardTitle.copyWith(fontSize: 15.5),
                    maxLines: 1,
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
                  
                  const SizedBox(height: DrevvySpace.s1),
                  
                  // Price
                  Text(
                    listing.priceFormatted,
                    style: text.figureS.copyWith(fontSize: 18),
                  ),
                  
                  // Miles & distance
                  Text(
                    '${listing.milesFormatted} · ${listing.distanceFormatted}',
                    style: text.label.copyWith(color: colors.muted),
                  ),
                  
                  const SizedBox(height: DrevvySpace.s3),
                  
                  // Bottom row: badge + CTA
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Market badge
                      Container(
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
                            Text(
                              badgeText,
                              style: text.label.copyWith(
                                color: isBelow ? colors.mint : colors.muted,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      
                      // CTA
                      _CardCta(
                        isPro: isPro,
                        isAlreadyAdded: isAlreadyAdded,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
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

class _CardCta extends StatelessWidget {
  const _CardCta({
    required this.isPro,
    required this.isAlreadyAdded,
  });

  final bool isPro;
  final bool isAlreadyAdded;

  @override
  Widget build(BuildContext context) {
    final text = context.drevvyText;

    if (isAlreadyAdded) {
      return StatusChip(DealStatus.reachingOut);
    }

    final label = isPro ? 'Add to Drevvy' : 'Get Best Price';
    final icon = isPro ? LucideIcons.plus : null;

    return Container(
      height: DrevvySpace.compactPillHeight - 8,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        gradient: DrevvyColors.brandGradient,
        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, color: Colors.white, size: 14),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: text.label.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

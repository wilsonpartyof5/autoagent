import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/shop_bottom_chrome.dart';
import '../../../data/models/listing.dart';
import 'inventory_card.dart';

/// Screens 10, 11, 17: Shop results with loading skeleton.
/// v1.7: Removed isPro flag; using hasCredits for future A/B testing.
/// v1.8: Added heart/save support on inventory cards.
class ShopResults extends StatelessWidget {
  const ShopResults({
    super.key,
    required this.listings,
    required this.isLoading,
    this.hasCredits = false,
    required this.onListingTap,
    this.savedListingIds = const {},
    this.dealsListingIds = const {},
    this.onSaveToggle,
  });

  final List<Listing>? listings;
  final bool isLoading;

  /// v1.7: Whether user has keys (for future A/B testing).
  final bool hasCredits;
  final ValueChanged<Listing> onListingTap;

  /// v1.8: Set of listing IDs that are saved.
  final Set<String> savedListingIds;

  /// v1.8: Set of listing IDs that are in Deals.
  final Set<String> dealsListingIds;

  /// v1.8: Callback when heart is tapped on a listing.
  final void Function(Listing listing, bool isSaved)? onSaveToggle;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    if (isLoading) {
      return Column(
        children: [
          // Status line - NO listing count per audit
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: DrevvySpace.gutter,
              vertical: DrevvySpace.s3,
            ),
            child: Row(
              children: [
                Icon(LucideIcons.search, color: colors.muted, size: 14),
                const SizedBox(width: DrevvySpace.s2),
                Text(
                  'Searching listings near you...',
                  style: text.callout.copyWith(color: colors.muted),
                ),
              ],
            ),
          ),
          Expanded(
            child: ShopChromeScrollListener(
              child: ListView.builder(
                key: ShopBottomChromeMetrics.listKey,
                padding: EdgeInsets.fromLTRB(
                  DrevvySpace.gutter,
                  0,
                  DrevvySpace.gutter,
                  ShopBottomChromeMetrics.listBottomPadding(
                    MediaQuery.of(context).padding.bottom,
                  ),
                ),
                itemCount: 4,
                itemBuilder: (context, index) => const _SkeletonCard(),
              ),
            ),
          ),
        ],
      );
    }

    if (listings == null || listings!.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.search, color: colors.muted, size: 48),
            const SizedBox(height: DrevvySpace.s4),
            Text(
              'No cars found',
              style: text.title.copyWith(color: colors.muted),
            ),
            const SizedBox(height: DrevvySpace.s2),
            Text(
              'Try adjusting your search or location.',
              style: text.body.copyWith(color: colors.muted),
            ),
          ],
        ),
      );
    }

    final safeBottom = MediaQuery.of(context).padding.bottom;
    return ShopChromeScrollListener(
      child: ListView.separated(
        key: ShopBottomChromeMetrics.listKey,
        padding: EdgeInsets.fromLTRB(
          DrevvySpace.gutter,
          DrevvySpace.s4,
          DrevvySpace.gutter,
          ShopBottomChromeMetrics.listBottomPadding(safeBottom),
        ),
        itemCount: listings!.length,
        separatorBuilder: (_, _) => const SizedBox(height: DrevvySpace.s3),
        itemBuilder: (context, index) {
          final listing = listings![index];
          final isSaved = savedListingIds.contains(listing.id);
          final isInDeals = dealsListingIds.contains(listing.id);

          return InventoryCard(
            listing: listing,
            hasCredits: hasCredits,
            onTap: () => onListingTap(listing),
            isSaved: isSaved,
            isAlreadyAdded: isInDeals,
            onSaveToggle: isInDeals
                ? null
                : () {
                    onSaveToggle?.call(listing, isSaved);
                  },
          );
        },
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;

    return Container(
      margin: const EdgeInsets.only(bottom: DrevvySpace.s3),
      padding: const EdgeInsets.all(DrevvySpace.s2),
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: BorderRadius.circular(DrevvyRadius.lg),
        border: Border.all(color: colors.glassBorder),
      ),
      child: Row(
        children: [
          // Photo skeleton
          Container(
            width: 96,
            height: 70,
            decoration: BoxDecoration(
              color: colors.track,
              borderRadius: BorderRadius.circular(DrevvyRadius.sm),
            ),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title skeleton
                Container(
                  width: double.infinity * 0.6,
                  height: 16,
                  decoration: BoxDecoration(
                    color: colors.track,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: DrevvySpace.s2),
                // Trim skeleton
                Container(
                  width: 80,
                  height: 12,
                  decoration: BoxDecoration(
                    color: colors.track,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: DrevvySpace.s2),
                // Price skeleton
                Container(
                  width: 60,
                  height: 18,
                  decoration: BoxDecoration(
                    color: colors.track,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: DrevvySpace.s3),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Badge skeleton
                    Container(
                      width: 100,
                      height: 24,
                      decoration: BoxDecoration(
                        color: colors.track,
                        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                      ),
                    ),
                    // CTA skeleton
                    Container(
                      width: 80,
                      height: 36,
                      decoration: BoxDecoration(
                        color: colors.track,
                        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

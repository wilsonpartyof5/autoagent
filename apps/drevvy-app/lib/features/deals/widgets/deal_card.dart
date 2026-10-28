import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/models.dart';

/// Deal card for the Deals list (screens 20-25)
class DealCard extends StatelessWidget {
  const DealCard({
    super.key,
    required this.deal,
    required this.onTap,
    this.onAsk,
    this.onFindSimilar,
    this.showUndoHint = false,
  });

  final Deal deal;
  final VoidCallback onTap;
  final VoidCallback? onAsk;
  final VoidCallback? onFindSimilar;
  final bool showUndoHint;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  String _formatUndoTime(Duration remaining) {
    final minutes = remaining.inMinutes;
    if (minutes < 1) return 'less than a minute';
    return '$minutes min';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final listing = deal.listing;
    final isEnded = deal.status.isEnded;

    return GlassCard(
      padding: EdgeInsets.zero,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(DrevvyRadius.md),
          child: Padding(
            padding: const EdgeInsets.all(DrevvySpace.s4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: photo + info
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Photo
                    ClipRRect(
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                      child: SizedBox(
                        width: 80,
                        height: 60,
                        child: Stack(
                          children: [
                            if (listing.media.primaryPhoto != null)
                              ColorFiltered(
                                colorFilter: isEnded
                                    ? const ColorFilter.mode(
                                        Colors.grey,
                                        BlendMode.saturation,
                                      )
                                    : const ColorFilter.mode(
                                        Colors.transparent,
                                        BlendMode.multiply,
                                      ),
                                child: Image.asset(
                                  listing.media.primaryPhoto!,
                                  fit: BoxFit.cover,
                                  width: 80,
                                  height: 60,
                                ),
                              )
                            else
                              Container(
                                color: colors.tile,
                                child: Icon(
                                  LucideIcons.imageOff,
                                  color: colors.muted,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(width: DrevvySpace.s3),

                    // Info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Dealer letter + status chip
                          Row(
                            children: [
                              Text(
                                deal.status.dealerRevealed
                                    ? deal.dealer?.name ??
                                          'Dealer ${deal.letter}'
                                    : 'Dealer ${deal.letter}',
                                style: text.label.copyWith(color: colors.muted),
                              ),
                              const Spacer(),
                              StatusChip(deal.status),
                            ],
                          ),

                          const SizedBox(height: DrevvySpace.s1),

                          // Car title
                          Text(
                            listing.shortTitle,
                            style: text.cardTitle.copyWith(
                              color: isEnded ? colors.muted : colors.ink,
                            ),
                          ),

                          // Price info
                          Text(
                            listing.milesFormatted,
                            style: text.callout.copyWith(color: colors.muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                // Progress bar (for active deals)
                if (!isEnded) ...[
                  const SizedBox(height: DrevvySpace.s3),
                  _ProgressSegments(steps: deal.progressSteps),
                ],

                // Offer info (if has offer)
                if (deal.latestOffer != null && !isEnded) ...[
                  const SizedBox(height: DrevvySpace.s3),
                  Container(
                    padding: const EdgeInsets.all(DrevvySpace.s3),
                    decoration: BoxDecoration(
                      color: colors.tile,
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _formatPrice(deal.latestOffer!.otd),
                              style: text.figureS,
                            ),
                            Text(
                              'Out the door',
                              style: text.label.copyWith(color: colors.muted),
                            ),
                          ],
                        ),
                        if (deal.savings != null && deal.savings! > 0)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: DrevvySpace.s3,
                              vertical: DrevvySpace.s1,
                            ),
                            decoration: BoxDecoration(
                              color: colors.mintTint,
                              borderRadius: BorderRadius.circular(
                                DrevvyRadius.pill,
                              ),
                            ),
                            child: Text(
                              '${_formatPrice(deal.savings!)} under listed',
                              style: text.label.copyWith(color: colors.mint),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],

                // Undo hint
                if (showUndoHint && deal.canUndo) ...[
                  const SizedBox(height: DrevvySpace.s3),
                  Row(
                    children: [
                      Icon(
                        LucideIcons.rotateCcw,
                        size: 14,
                        color: colors.muted,
                      ),
                      const SizedBox(width: DrevvySpace.s2),
                      Text(
                        'Undo window: ${_formatUndoTime(deal.undoTimeRemaining!)} left',
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                    ],
                  ),
                ],

                // In-network dealer chat (same sheet as VDP / deal detail).
                if (onAsk != null && !isEnded) ...[
                  const SizedBox(height: DrevvySpace.s3),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      key: Key('deal-inbox-ask-${deal.id}'),
                      onPressed: onAsk,
                      icon: Icon(LucideIcons.messageCircle, size: 16),
                      label: const Text('Ask'),
                      style: TextButton.styleFrom(
                        foregroundColor: colors.violet,
                        padding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],

                // Ended state with "Find similar cars"
                if (isEnded) ...[
                  const SizedBox(height: DrevvySpace.s3),
                  Container(
                    padding: const EdgeInsets.all(DrevvySpace.s3),
                    decoration: BoxDecoration(
                      color: colors.endedTint,
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          deal.status == DealStatus.noLongerListed
                              ? LucideIcons.circleX
                              : LucideIcons.clock,
                          size: 16,
                          color: colors.ended,
                        ),
                        const SizedBox(width: DrevvySpace.s2),
                        Expanded(
                          child: Text(
                            deal.status == DealStatus.noLongerListed
                                ? 'No longer listed (likely sold)'
                                : 'No dealer response after 5 days',
                            style: text.callout.copyWith(color: colors.ended),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: DrevvySpace.s3),
                  TextButton.icon(
                    onPressed: onFindSimilar,
                    icon: Icon(LucideIcons.search, size: 16),
                    label: const Text('Find similar cars'),
                    style: TextButton.styleFrom(
                      foregroundColor: colors.violet,
                      padding: EdgeInsets.zero,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProgressSegments extends StatelessWidget {
  const _ProgressSegments({required this.steps});

  final int steps;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;

    return Row(
      children: List.generate(4, (i) {
        final isFilled = i < steps;
        return Expanded(
          child: Container(
            height: 4,
            margin: EdgeInsets.only(right: i < 3 ? 4 : 0),
            decoration: BoxDecoration(
              color: isFilled ? colors.violet : colors.track,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        );
      }),
    );
  }
}

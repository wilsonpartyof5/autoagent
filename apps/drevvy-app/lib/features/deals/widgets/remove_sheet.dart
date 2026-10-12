import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/models.dart';

/// Screens 39-40: Remove sheet - handles both undo window and after-contact cases
class RemoveSheet extends StatelessWidget {
  const RemoveSheet({
    super.key,
    required this.deal,
    required this.user,
    required this.onRemove,
    required this.onKeep,
  });

  final Deal deal;
  final User user;
  final VoidCallback onRemove;
  final VoidCallback onKeep;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final listing = deal.listing;
    final canUndo = deal.canUndo;

    return Container(
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
                Text(
                  canUndo ? 'Remove this car?' : 'Stop working on this deal?',
                  style: text.headline,
                ),

                const SizedBox(height: DrevvySpace.s4),

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
                          Text(
                            'Dealer ${deal.letter}',
                            style: text.callout.copyWith(color: colors.muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: DrevvySpace.s5),

                // Status box
                Container(
                  padding: const EdgeInsets.all(DrevvySpace.s4),
                  decoration: BoxDecoration(
                    color: canUndo ? colors.mintTint : colors.tile,
                    borderRadius: BorderRadius.circular(DrevvyRadius.md),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        canUndo ? LucideIcons.rotateCcw : LucideIcons.info,
                        size: 20,
                        color: canUndo ? colors.mint : colors.muted,
                      ),
                      const SizedBox(width: DrevvySpace.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              canUndo
                                  ? 'This car will be given back'
                                  : 'This car still counts',
                              style: text.bodyStrong.copyWith(
                                color: canUndo ? colors.mint : colors.ink,
                              ),
                            ),
                            Text(
                              canUndo
                                  ? 'You\'ll have ${user.usage.cap - user.usage.used + 1} of ${user.usage.cap} cars left this month.'
                                  : 'Drevvy has already contacted the dealer. The car counts toward your ${user.usage.cap} this month.',
                              style: text.callout.copyWith(
                                color: canUndo ? colors.mint : colors.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                if (!canUndo) ...[
                  const SizedBox(height: DrevvySpace.s3),
                  Text(
                    'Drevvy will send a polite close-out to the dealer.',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                ],

                const SizedBox(height: DrevvySpace.s6),

                // CTAs
                DrevvyButton(
                  label: 'Remove',
                  variant: DrevvyButtonVariant.destructive,
                  onPressed: onRemove,
                  isFullWidth: true,
                ),

                const SizedBox(height: DrevvySpace.s3),

                DrevvyGhostButton(
                  label: 'Keep it',
                  onPressed: onKeep,
                ),
              ],
            ),
          ),

          SizedBox(height: bottomPadding),
        ],
      ),
    );
  }
}

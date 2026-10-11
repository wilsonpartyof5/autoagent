import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/models.dart';

/// v1.6: Changed-after-accepted detail showing line-by-line diff
/// Actions: Accept new, Try once more (1 left), End deal
class ChangedOfferSheet extends StatelessWidget {
  const ChangedOfferSheet({
    super.key,
    required this.deal,
    required this.onAcceptNew,
    required this.onTryOnceMore,
    required this.onEndDeal,
  });

  final Deal deal;
  final VoidCallback onAcceptNew;
  final VoidCallback? onTryOnceMore;
  final VoidCallback onEndDeal;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final listing = deal.listing;
    final acceptedOffer = deal.acceptedOffer;
    final changedOffer = deal.changedOffer ?? deal.latestOffer;

    if (acceptedOffer == null || changedOffer == null) {
      return const SizedBox.shrink();
    }

    final otdDiff = changedOffer.otd - acceptedOffer.otd;
    final isHigher = otdDiff > 0;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child: Column(
        children: [
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
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(DrevvySpace.gutter),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Warning header
                  Container(
                    padding: const EdgeInsets.all(DrevvySpace.s4),
                    decoration: BoxDecoration(
                      color: colors.soldTint,
                      borderRadius: BorderRadius.circular(DrevvyRadius.md),
                    ),
                    child: Row(
                      children: [
                        Icon(LucideIcons.alertTriangle, size: 24, color: colors.sold),
                        const SizedBox(width: DrevvySpace.s3),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Offer changed after you accepted',
                                style: text.bodyStrong.copyWith(color: colors.sold),
                              ),
                              Text(
                                'The dealer modified the offer.',
                                style: text.callout.copyWith(color: colors.sold),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: DrevvySpace.s5),

                  // Car info
                  Text(listing.shortTitle, style: text.headline),
                  Text(
                    'Dealer ${deal.letter}',
                    style: text.callout.copyWith(color: colors.muted),
                  ),

                  const SizedBox(height: DrevvySpace.s5),

                  // OTD comparison
                  Row(
                    children: [
                      Expanded(
                        child: _OtdBox(
                          label: 'You accepted',
                          amount: acceptedOffer.otd,
                          isStrike: true,
                        ),
                      ),
                      const SizedBox(width: DrevvySpace.s3),
                      Expanded(
                        child: _OtdBox(
                          label: 'New offer',
                          amount: changedOffer.otd,
                          highlight: true,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: DrevvySpace.s3),

                  // Diff badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: DrevvySpace.s3,
                      vertical: DrevvySpace.s2,
                    ),
                    decoration: BoxDecoration(
                      color: isHigher ? colors.soldTint : colors.mintTint,
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          isHigher ? LucideIcons.trendingUp : LucideIcons.trendingDown,
                          size: 16,
                          color: isHigher ? colors.sold : colors.mint,
                        ),
                        const SizedBox(width: DrevvySpace.s2),
                        Text(
                          '${_formatPrice(otdDiff.abs())} ${isHigher ? 'higher' : 'lower'}',
                          style: text.bodyStrong.copyWith(
                            color: isHigher ? colors.sold : colors.mint,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: DrevvySpace.s6),

                  // Line-by-line diff
                  Text('What changed', style: text.title),
                  const SizedBox(height: DrevvySpace.s3),

                  _LineDiffSection(
                    acceptedLines: acceptedOffer.lines,
                    changedLines: changedOffer.lines,
                  ),

                  const SizedBox(height: DrevvySpace.s6),
                ],
              ),
            ),
          ),

          // Sticky CTAs
          Container(
            padding: EdgeInsets.fromLTRB(
              DrevvySpace.gutter,
              DrevvySpace.s4,
              DrevvySpace.gutter,
              DrevvySpace.s4 + bottomPadding,
            ),
            decoration: BoxDecoration(
              color: colors.glassSolid,
              border: Border(top: BorderSide(color: colors.line)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DrevvyButton(
                  label: 'Accept new offer',
                  icon: LucideIcons.check,
                  onPressed: onAcceptNew,
                  variant: DrevvyButtonVariant.accept,
                  isFullWidth: true,
                ),
                const SizedBox(height: DrevvySpace.s3),
                if (onTryOnceMore != null)
                  DrevvyButton(
                    label: 'Try once more (1 left)',
                    icon: LucideIcons.rotateCcw,
                    onPressed: onTryOnceMore,
                    variant: DrevvyButtonVariant.secondary,
                    isFullWidth: true,
                  )
                else
                  DrevvyButton(
                    label: 'Try once more (used)',
                    variant: DrevvyButtonVariant.secondary,
                    onPressed: null,
                    isFullWidth: true,
                  ),
                const SizedBox(height: DrevvySpace.s3),
                TextButton(
                  onPressed: onEndDeal,
                  child: Text(
                    'End deal',
                    style: text.bodyStrong.copyWith(color: colors.danger),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OtdBox extends StatelessWidget {
  const _OtdBox({
    required this.label,
    required this.amount,
    this.isStrike = false,
    this.highlight = false,
  });

  final String label;
  final int amount;
  final bool isStrike;
  final bool highlight;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      decoration: BoxDecoration(
        color: highlight ? colors.lilacTint : colors.tile,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
        border: highlight ? Border.all(color: colors.violet, width: 2) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: text.label.copyWith(color: colors.muted),
          ),
          const SizedBox(height: DrevvySpace.s1),
          Text(
            _formatPrice(amount),
            style: text.figureS.copyWith(
              color: isStrike ? colors.muted : (highlight ? colors.violet : colors.ink),
              decoration: isStrike ? TextDecoration.lineThrough : null,
            ),
          ),
          Text('OTD', style: text.micro.copyWith(color: colors.muted)),
        ],
      ),
    );
  }
}

class _LineDiffSection extends StatelessWidget {
  const _LineDiffSection({
    required this.acceptedLines,
    required this.changedLines,
  });

  final List<OfferLine> acceptedLines;
  final List<OfferLine> changedLines;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    final acceptedMap = {for (var l in acceptedLines) l.key: l.amount};
    final changedMap = {for (var l in changedLines) l.key: l.amount};
    final allKeys = {...acceptedMap.keys, ...changedMap.keys};

    return Column(
      children: allKeys.map((key) {
        final accepted = acceptedMap[key];
        final changed = changedMap[key];
        final hasChanged = accepted != changed;
        final diff = (changed ?? 0) - (accepted ?? 0);

        return Container(
          margin: const EdgeInsets.only(bottom: DrevvySpace.s2),
          padding: const EdgeInsets.all(DrevvySpace.s3),
          decoration: BoxDecoration(
            color: hasChanged ? colors.soldTint.withValues(alpha: 0.5) : colors.tile,
            borderRadius: BorderRadius.circular(DrevvyRadius.sm),
          ),
          child: Row(
            children: [
              Expanded(
                flex: 2,
                child: Text(key, style: text.body),
              ),
              if (hasChanged) ...[
                Text(
                  accepted != null ? _formatPrice(accepted) : '—',
                  style: text.body.copyWith(
                    color: colors.muted,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
                const SizedBox(width: DrevvySpace.s2),
                Icon(LucideIcons.arrowRight, size: 14, color: colors.muted),
                const SizedBox(width: DrevvySpace.s2),
              ],
              Text(
                changed != null ? _formatPrice(changed) : '—',
                style: text.bodyStrong.copyWith(
                  color: hasChanged
                      ? (diff > 0 ? colors.sold : colors.mint)
                      : colors.ink,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

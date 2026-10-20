import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/analytics_view.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/models.dart';

/// Confirm step before Drevvy tells the dealer. Nothing is sent until Confirm.
class AcceptConfirmSheet extends StatelessWidget {
  const AcceptConfirmSheet({
    super.key,
    required this.deal,
    required this.onAccept,
    required this.onNotYet,
  });

  final Deal deal;
  final VoidCallback onAccept;
  final VoidCallback onNotYet;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final offer = deal.latestOffer!;
    final listing = deal.listing;
    final dealer = 'Dealer ${deal.letter}';

    return AnalyticsView(
      screen: 'accept_confirm',
      properties: {'deal_id': deal.id},
      child: Container(
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
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
          Padding(
            padding: const EdgeInsets.all(DrevvySpace.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Accept ${_formatPrice(offer.otd)} out the door?',
                  style: text.headline,
                ),
                const SizedBox(height: DrevvySpace.s3),
                Text(
                  'Drevvy will tell $dealer and request the official written offer.',
                  style: text.body,
                ),
                const SizedBox(height: DrevvySpace.s4),

                // Summary card
                Container(
                  padding: const EdgeInsets.all(DrevvySpace.s4),
                  decoration: BoxDecoration(
                    color: colors.acceptTint,
                    borderRadius: BorderRadius.circular(DrevvyRadius.md),
                  ),
                  child: Row(
                    children: [
                      Icon(LucideIcons.car, color: colors.accept, size: 24),
                      const SizedBox(width: DrevvySpace.s3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(listing.shortTitle, style: text.bodyStrong),
                            Text(
                              '${_formatPrice(offer.otd)} out the door',
                              style: text.callout.copyWith(color: colors.accept),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: DrevvySpace.s6),

                Text('What happens next', style: text.title),
                const SizedBox(height: DrevvySpace.s3),

                _StepRow(number: '1', text: 'Drevvy requests an official written offer'),
                _StepRow(number: '2', text: 'The dealer emails the offer to Drevvy'),
                _StepRow(number: '3', text: 'Drevvy verifies and forwards it to you'),

                const SizedBox(height: DrevvySpace.s6),

                DrevvyButton(
                  label: 'Confirm',
                  icon: LucideIcons.check,
                  onPressed: onAccept,
                  variant: DrevvyButtonVariant.accept,
                ),
                const SizedBox(height: DrevvySpace.s3),
                DrevvyGhostButton(
                  label: 'Cancel',
                  onPressed: onNotYet,
                ),
                const SizedBox(height: DrevvySpace.s4),
                Text(
                  'Nothing goes to $dealer until you confirm. Accepting isn\'t a contract, and Drevvy never accepts for you.',
                  style: text.micro.copyWith(color: colors.muted),
                ),
              ],
            ),
          ),
          SizedBox(height: bottomPadding),
        ],
      ),
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.number, required this.text});

  final String number;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyle = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s3),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: colors.lilacTint,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                number,
                style: textStyle.label.copyWith(
                  color: colors.violet,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(child: Text(text, style: textStyle.body)),
        ],
      ),
    );
  }
}

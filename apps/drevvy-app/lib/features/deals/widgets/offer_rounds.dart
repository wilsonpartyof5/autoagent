import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/deal.dart';

/// Round-by-round price drops. Removed fees stay visible and are crossed off.
class OfferRounds extends StatelessWidget {
  const OfferRounds({super.key, required this.offers});

  final List<Offer> offers;

  String _money(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final newestFirst = offers.reversed.toList();

    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Price rounds', style: text.title),
          const SizedBox(height: DrevvySpace.s2),
          Text(
            'Each round is a written quote. Fees the dealer took off stay crossed off.',
            style: text.callout.copyWith(color: colors.muted),
          ),
          const SizedBox(height: DrevvySpace.s4),
          for (var index = 0; index < newestFirst.length; index++) ...[
            if (index > 0) Divider(height: DrevvySpace.s6, color: colors.line),
            _RoundBlock(
              roundNumber: offers.length - index,
              offer: newestFirst[index],
              previous: index == newestFirst.length - 1
                  ? null
                  : newestFirst[index + 1],
              isLatest: index == 0,
              money: _money,
            ),
          ],
        ],
      ),
    );
  }
}

class _RoundBlock extends StatelessWidget {
  const _RoundBlock({
    required this.roundNumber,
    required this.offer,
    required this.previous,
    required this.isLatest,
    required this.money,
  });

  final int roundNumber;
  final Offer offer;
  final Offer? previous;
  final bool isLatest;
  final String Function(int price) money;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final drop = previous == null ? null : previous!.otd - offer.otd;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Round $roundNumber',
              style: text.label.copyWith(color: colors.muted),
            ),
            if (isLatest) ...[
              const SizedBox(width: DrevvySpace.s2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: colors.lilacTint,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                ),
                child: Text(
                  'Latest',
                  style: text.micro.copyWith(color: colors.violet),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: DrevvySpace.s1),
        Text(money(offer.otd), style: text.figureS),
        if (drop != null && drop != 0) ...[
          const SizedBox(height: DrevvySpace.s1),
          Text(
            drop > 0
                ? 'Down ${money(drop)} from the last round'
                : 'Up ${money(-drop)} from the last round',
            style: text.callout.copyWith(
              color: drop > 0 ? colors.mint : colors.sold,
            ),
          ),
        ],
        if (offer.removedAddOns.isNotEmpty) ...[
          const SizedBox(height: DrevvySpace.s3),
          Text('Removed', style: text.label.copyWith(color: colors.muted)),
          const SizedBox(height: DrevvySpace.s2),
          for (final line in offer.removedAddOns)
            Padding(
              padding: const EdgeInsets.only(bottom: DrevvySpace.s1),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      line.key,
                      style: text.body.copyWith(
                        color: colors.muted,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                  ),
                  Text(
                    money(line.amount),
                    style: text.body.copyWith(
                      color: colors.mint,
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ],
    );
  }
}

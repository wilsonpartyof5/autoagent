import 'package:flutter/material.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/car_pack.dart';

/// Car balance in the account sheet opened from the top-corner icon.
///
/// A balance of zero is the out-of-cars state. Packs never expire.
class CarBalanceCard extends StatelessWidget {
  const CarBalanceCard({
    super.key,
    required this.balance,
    required this.onBuy,
    this.notice,
    this.showCount = true,
  });

  final CarCreditBalance balance;
  final VoidCallback onBuy;

  /// Live-mode failure. Replaces the pack pitch so a zero balance is not a
  /// silent demo wallet.
  final String? notice;

  /// False while a live balance has not been loaded from the server. The
  /// card then does not present 0 as the balance.
  final bool showCount;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final outOfCars = balance.isEmpty;
    final countVisible = showCount;

    return Container(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      decoration: BoxDecoration(
        gradient: DrevvyBrand.gradient,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (countVisible)
                  Text(
                    '${balance.balance}',
                    style: text.figureM.copyWith(color: Colors.white),
                  ),
                Text(
                  countVisible
                      ? (notice ??
                            (outOfCars
                                ? 'Out of keys'
                                : 'keys left · packs never expire'))
                      : (notice ?? 'Loading key balance'),
                  style: text.callout.copyWith(
                    color: Colors.white.withValues(alpha: 0.8),
                    fontWeight: outOfCars || notice != null
                        ? FontWeight.w800
                        : FontWeight.w500,
                  ),
                ),
                if (countVisible && notice == null && outOfCars) ...[
                  const SizedBox(height: DrevvySpace.s1),
                  Text(
                    'Packs never expire. Add a pack to unlock market intel or ask an in-network dealer. Off-network out-the-door requests stay free.',
                    style: text.callout.copyWith(
                      color: Colors.white.withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (countVisible && notice == null) ...[
            const SizedBox(width: DrevvySpace.s3),
            GestureDetector(
              onTap: onBuy,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                ),
                child: Text(
                  outOfCars ? 'Add keys' : 'Buy keys',
                  style: text.label.copyWith(
                    color: colors.violet,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

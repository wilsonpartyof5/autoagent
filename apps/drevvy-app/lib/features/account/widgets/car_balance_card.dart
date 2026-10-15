import 'package:flutter/material.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/car_pack.dart';

/// Car balance in the account sheet opened from the top-corner icon.
///
/// A balance of zero is the out-of-cars state. Packs never expire.
class CarBalanceCard extends StatelessWidget {
  const CarBalanceCard({super.key, required this.balance, required this.onBuy});

  final CarCreditBalance balance;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final outOfCars = balance.isEmpty;

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
                Text(
                  '${balance.balance}',
                  style: text.figureM.copyWith(color: Colors.white),
                ),
                Text(
                  outOfCars ? 'Out of cars' : 'cars left · packs never expire',
                  style: text.callout.copyWith(
                    color: Colors.white.withValues(alpha: 0.8),
                    fontWeight: outOfCars ? FontWeight.w800 : FontWeight.w500,
                  ),
                ),
                if (outOfCars) ...[
                  const SizedBox(height: DrevvySpace.s1),
                  Text(
                    'Packs never expire. Add a pack to unlock another car.',
                    style: text.callout.copyWith(
                      color: Colors.white.withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: DrevvySpace.s3),
          GestureDetector(
            onTap: onBuy,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(DrevvyRadius.pill),
              ),
              child: Text(
                outOfCars ? 'Add cars' : 'Buy cars',
                style: text.label.copyWith(
                  color: colors.violet,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

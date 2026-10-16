import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/car_pack.dart';
import '../../../data/models/money_format.dart';

/// One car-pack row. Best value is the 10-car pack at $9.70 per car.
class PackOptionCard extends StatelessWidget {
  const PackOptionCard({
    super.key,
    required this.pack,
    required this.isSelected,
    required this.onTap,
    this.showBadge = false,
    this.totalLabel,
    this.perCarLabel,
  });

  final CarPackType pack;
  final bool isSelected;
  final VoidCallback onTap;
  final bool showBadge;
  final String? totalLabel;
  final String? perCarLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final total = totalLabel ?? formatUsd(pack.priceUsd);
    final perCar = perCarLabel ?? '${pack.perCarFormatted}/car';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(DrevvySpace.s4),
        decoration: BoxDecoration(
          color: colors.tile,
          borderRadius: BorderRadius.circular(DrevvyRadius.md),
          border: Border.all(
            color: isSelected ? colors.violet : colors.glassBorder,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (showBadge) ...[
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: DrevvySpace.s2,
                  vertical: DrevvySpace.s1,
                ),
                decoration: BoxDecoration(
                  gradient: DrevvyColors.brandGradient,
                  borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                ),
                child: Text(
                  'BEST VALUE',
                  style: text.micro.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(height: DrevvySpace.s2),
            ],
            Row(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isSelected ? colors.violet : colors.track,
                      width: 2,
                    ),
                    color: isSelected ? colors.violet : Colors.transparent,
                  ),
                  child: isSelected
                      ? const Icon(
                          LucideIcons.check,
                          size: 14,
                          color: Colors.white,
                        )
                      : null,
                ),
                const SizedBox(width: DrevvySpace.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text('${pack.cars} cars', style: text.bodyStrong),
                          Text(
                            ' · ${pack.displayName}',
                            style: text.body.copyWith(color: colors.muted),
                          ),
                        ],
                      ),
                      if (pack.savingsText != null)
                        Text(
                          pack.savingsText!,
                          style: text.callout.copyWith(color: colors.mint),
                        )
                      else
                        Text(
                          'One-time · never expires',
                          style: text.callout.copyWith(color: colors.muted),
                        ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(total, style: text.cardTitle),
                    Text(
                      perCar,
                      style: text.callout.copyWith(
                        color: isSelected && pack == CarPackType.bestValue
                            ? colors.mint
                            : colors.muted,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

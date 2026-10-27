import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/repositories/demo_repository.dart';

/// Stat hero with savings total and credit balance.
/// v1.7: Updated to show "X cars left" instead of usage ring + "resets" text.
class StatHero extends StatelessWidget {
  const StatHero({
    super.key,
    required this.stats,
    this.isEmpty = false,
  });

  final DealStats stats;
  final bool isEmpty;

  String _formatCurrency(int amount) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(amount);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s5),
      child: Row(
        children: [
          // v1.7: Credit balance indicator (replaces usage ring)
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              gradient: DrevvyColors.brandGradient,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${stats.carsRemaining}',
                    style: text.figureS.copyWith(
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    stats.carsRemaining == 1 ? 'key' : 'keys',
                    style: text.micro.copyWith(color: DrevvyColors.onBrandMuted),
                  ),
                ],
              ),
            ),
          ),
          
          const SizedBox(width: DrevvySpace.s5),
          
          // Stats
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!isEmpty && stats.underListedTotal > 0) ...[
                  Text(
                    _formatCurrency(stats.underListedTotal),
                    style: text.figureM.copyWith(color: colors.mint),
                  ),
                  Text(
                    'Under listed',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                ] else ...[
                  Text(
                    'No savings yet',
                    style: text.title.copyWith(color: colors.muted),
                  ),
                  Text(
                    'Add a car to get started',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                ],
                
                const SizedBox(height: DrevvySpace.s2),
                
                // Pills
                Row(
                  children: [
                    if (stats.offersToReview > 0)
                      _Pill(
                        label: '${stats.offersToReview} to review',
                        color: colors.violet,
                        bgColor: colors.lilacTint,
                      ),
                    if (stats.offersToReview > 0)
                      const SizedBox(width: DrevvySpace.s2),
                    // v1.7: Show "X cars left" instead of "Resets"
                    _Pill(
                      label: stats.carsRemainingFormatted,
                      color: colors.muted,
                      bgColor: colors.tile,
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

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.color,
    required this.bgColor,
  });

  final String label;
  final Color color;
  final Color bgColor;

  @override
  Widget build(BuildContext context) {
    final text = context.drevvyText;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: DrevvySpace.s2,
        vertical: DrevvySpace.s1,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
      ),
      child: Text(
        label,
        style: text.micro.copyWith(color: color),
      ),
    );
  }
}


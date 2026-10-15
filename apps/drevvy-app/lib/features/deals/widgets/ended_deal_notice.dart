import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';

/// Sold and no-response states on a deal, with a way back to similar cars.
class EndedDealNotice extends StatelessWidget {
  const EndedDealNotice({
    super.key,
    required this.status,
    required this.onFindSimilar,
  });

  final DealStatus status;
  final VoidCallback onFindSimilar;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final sold = status == DealStatus.noLongerListed;

    return GlassCard(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                sold ? LucideIcons.circleX : LucideIcons.clock,
                size: 18,
                color: colors.sold,
              ),
              const SizedBox(width: DrevvySpace.s2),
              Expanded(
                child: Text(
                  sold
                      ? 'No longer listed (likely sold)'
                      : 'No dealer response after 5 days',
                  style: text.bodyStrong.copyWith(color: colors.sold),
                ),
              ),
            ],
          ),
          const SizedBox(height: DrevvySpace.s2),
          Text(
            'You got your car credit back. This car is off your active deals.',
            style: text.callout.copyWith(color: colors.muted),
          ),
          const SizedBox(height: DrevvySpace.s4),
          DrevvyButton(
            label: 'Find similar cars',
            icon: LucideIcons.search,
            variant: DrevvyButtonVariant.secondary,
            isFullWidth: true,
            onPressed: onFindSimilar,
          ),
        ],
      ),
    );
  }
}

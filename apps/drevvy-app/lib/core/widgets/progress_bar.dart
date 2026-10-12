import 'package:flutter/material.dart';
import '../theme/drevvy_theme.dart';
import '../theme/drevvy_tokens.dart';

class DealProgressBar extends StatelessWidget {
  const DealProgressBar({
    super.key,
    required this.filledSteps,
    this.isEnded = false,
    this.showLabels = true,
  });

  final int filledSteps;
  final bool isEnded;
  final bool showLabels;

  static const _labels = ['Reach out', 'Finding price', 'Offer', 'Accepted'];

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 6,
          child: Row(
            children: List.generate(4, (index) {
              final isFilled = index < filledSteps;
              return Expanded(
                child: Container(
                  margin: index < 3 ? const EdgeInsets.only(right: DrevvySpace.s1) : null,
                  decoration: BoxDecoration(
                    gradient: isFilled
                        ? LinearGradient(
                            colors: isEnded
                                ? colors.progressGradient.colors.map((c) => c.withValues(alpha: 0.4)).toList()
                                : colors.progressGradient.colors,
                          )
                        : null,
                    color: isFilled ? null : colors.track,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              );
            }),
          ),
        ),
        if (showLabels) ...[
          const SizedBox(height: DrevvySpace.s1),
          Row(
            children: _labels.map((label) {
              return Expanded(
                child: Text(
                  label,
                  style: text.micro.copyWith(color: colors.muted),
                ),
              );
            }).toList(),
          ),
        ],
      ],
    );
  }
}

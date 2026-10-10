import 'package:flutter/material.dart';
import '../../../core/theme/drevvy_theme.dart';

class ProgressDots extends StatelessWidget {
  const ProgressDots({
    super.key,
    required this.current,
    required this.total,
  });

  final int current;
  final int total;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(total, (index) {
        final isActive = index == current;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: isActive ? 24 : 8,
          height: 8,
          decoration: BoxDecoration(
            color: isActive ? colors.violet : colors.track,
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}

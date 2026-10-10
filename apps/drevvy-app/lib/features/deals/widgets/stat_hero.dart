import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/repositories/demo_repository.dart';

/// Stat hero with savings total and usage ring
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
          // Usage ring
          SizedBox(
            width: 80,
            height: 80,
            child: CustomPaint(
              painter: _RingPainter(
                progress: stats.used / stats.cap,
                trackColor: colors.track,
                progressColors: DrevvyPaletteLight.progressGradient,
              ),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${stats.used}',
                      style: text.figureS.copyWith(
                        color: colors.violet,
                      ),
                    ),
                    Text(
                      'of ${stats.cap}',
                      style: text.micro.copyWith(color: colors.muted),
                    ),
                  ],
                ),
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
                    _Pill(
                      label: 'Resets ${stats.resetsFormatted}',
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

class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.progress,
    required this.trackColor,
    required this.progressColors,
  });

  final double progress;
  final Color trackColor;
  final List<Color> progressColors;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - 12) / 2;
    const strokeWidth = 8.0;

    // Track
    final trackPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, trackPaint);

    // Progress arc
    if (progress > 0) {
      final rect = Rect.fromCircle(center: center, radius: radius);
      final gradient = SweepGradient(
        startAngle: -math.pi / 2,
        endAngle: math.pi * 1.5,
        colors: progressColors,
      );

      final progressPaint = Paint()
        ..shader = gradient.createShader(rect)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(
        rect,
        -math.pi / 2,
        2 * math.pi * progress.clamp(0.0, 1.0),
        false,
        progressPaint,
      );
    }
  }

  @override
  bool shouldRepaint(_RingPainter oldDelegate) {
    return progress != oldDelegate.progress;
  }
}

import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/models.dart';

/// VDP-only gate: blur Marketplace Intelligence until the shopper spends 1 key.
///
/// Onboarding has its own sample card and must not use this widget.
class MarketIntelGate extends StatelessWidget {
  const MarketIntelGate({
    super.key,
    required this.unlocked,
    required this.onUnlock,
    required this.child,
  });

  final bool unlocked;
  final VoidCallback onUnlock;
  final Widget child;

  /// Strong enough that listed/fair prices are not readable.
  static const double blurSigma = 16;

  @override
  Widget build(BuildContext context) {
    if (unlocked) return child;

    final colors = context.drevvy;
    final text = context.drevvyText;

    return Semantics(
      button: true,
      label: KeySpend.marketIntelTeaser,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onUnlock,
          borderRadius: BorderRadius.circular(DrevvyRadius.lg),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(DrevvyRadius.lg),
            child: Stack(
              alignment: Alignment.center,
              children: [
                ImageFiltered(
                  imageFilter: ImageFilter.blur(
                    sigmaX: blurSigma,
                    sigmaY: blurSigma,
                  ),
                  child: ExcludeSemantics(
                    child: IgnorePointer(child: child),
                  ),
                ),
                Positioned.fill(
                  child: ColoredBox(
                    color: colors.glassSolid.withValues(alpha: 0.35),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(DrevvySpace.s4),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 280),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: colors.glassSolid.withValues(alpha: 0.94),
                        borderRadius: BorderRadius.circular(DrevvyRadius.md),
                        border: Border.all(color: colors.glassBorder),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: DrevvySpace.s4,
                          vertical: DrevvySpace.s3,
                        ),
                        child: Text(
                          KeySpend.marketIntelTeaser,
                          style: text.bodyStrong.copyWith(color: colors.ink),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

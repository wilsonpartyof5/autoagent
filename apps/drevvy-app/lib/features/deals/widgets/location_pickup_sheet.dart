import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';

/// Screen 34: Pickup-check location pre-prompt ("Always")
/// Shown after official offer received, one-time opt-in for geofence
class LocationPickupSheet extends StatelessWidget {
  const LocationPickupSheet({
    super.key,
    required this.dealerName,
    required this.onAllow,
    required this.onNotNow,
  });

  final String dealerName;
  final VoidCallback onAllow;
  final VoidCallback onNotNow;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Container(
      decoration: BoxDecoration(
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: DrevvySpace.s3),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: colors.track,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(DrevvySpace.gutter),
            child: Column(
              children: [
                const SizedBox(height: DrevvySpace.s4),

                // Icon orb
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: DrevvyBrand.gradient,
                    shape: BoxShape.circle,
                    boxShadow: colors.elevBrand,
                  ),
                  child: Icon(
                    LucideIcons.mapPin,
                    size: 36,
                    color: DrevvyColors.onBrand,
                  ),
                ),

                const SizedBox(height: DrevvySpace.s5),

                Text(
                  'Pickup check',
                  style: text.headline,
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: DrevvySpace.s2),

                Text(
                  'Allow Drevvy to check when you visit $dealerName so we can ask how it went.',
                  style: text.body.copyWith(color: colors.muted),
                  textAlign: TextAlign.center,
                ),

                const SizedBox(height: DrevvySpace.s5),

                // Promises
                _PromiseRow(
                  icon: LucideIcons.shield,
                  text: 'Location is used only for this dealership visit',
                ),
                _PromiseRow(
                  icon: LucideIcons.userX,
                  text: 'Nothing is shared with the dealer',
                ),
                _PromiseRow(
                  icon: LucideIcons.trash2,
                  text: 'Stops automatically after you answer',
                ),

                const SizedBox(height: DrevvySpace.s4),

                // Disclosure
                Container(
                  padding: const EdgeInsets.all(DrevvySpace.s3),
                  decoration: BoxDecoration(
                    color: colors.tile,
                    borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                  ),
                  child: Row(
                    children: [
                      Icon(LucideIcons.info, size: 16, color: colors.muted),
                      const SizedBox(width: DrevvySpace.s2),
                      Expanded(
                        child: Text(
                          'Requires "Always" location permission. You can change this in Settings → Privacy → Location.',
                          style: text.callout.copyWith(color: colors.muted),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: DrevvySpace.s6),

                // CTAs
                DrevvyPrimaryButton(
                  label: 'Allow location',
                  onPressed: onAllow,
                ),

                const SizedBox(height: DrevvySpace.s3),

                DrevvyGhostButton(
                  label: 'Not now',
                  onPressed: onNotNow,
                ),
              ],
            ),
          ),

          SizedBox(height: bottomPadding),
        ],
      ),
    );
  }
}

class _PromiseRow extends StatelessWidget {
  const _PromiseRow({
    required this.icon,
    required this.text,
  });

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyle = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s3),
      child: Row(
        children: [
          Icon(icon, size: 20, color: colors.mint),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(child: Text(text, style: textStyle.body)),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/models.dart';
import 'pack_option_card.dart';

/// Screen X: Out of cars sheet shown when balance is 0 and user tries to unlock.
/// v1.7: Replaces monthly_limit_reached / drevvy_extra_10.
///
/// Superwall placement: cars_balance_empty
class OutOfCarsSheet extends StatefulWidget {
  const OutOfCarsSheet({
    super.key,
    this.listing,
    required this.onPurchase,
    required this.onNotNow,
  });

  /// Car the shopper was trying to unlock. Omitted from the account screen.
  final Listing? listing;
  final Future<void> Function(CarPackType) onPurchase;
  final VoidCallback onNotNow;

  @override
  State<OutOfCarsSheet> createState() => _OutOfCarsSheetState();
}

class _OutOfCarsSheetState extends State<OutOfCarsSheet> {
  CarPackType _selectedPack = CarPackType.bestValue; // Preselected per spec
  bool _isPurchasing = false;

  Future<void> _handlePurchase() async {
    setState(() => _isPurchasing = true);
    try {
      await widget.onPurchase(_selectedPack);
    } finally {
      if (mounted) {
        setState(() => _isPurchasing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.92,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: colors.glassSolid,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(DrevvyRadius.sheetTop),
          ),
        ),
        child: SingleChildScrollView(
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

              // Close button
              Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.only(
                    right: DrevvySpace.s2,
                    top: DrevvySpace.s1,
                  ),
                  child: IconButton(
                    icon: Icon(LucideIcons.x, color: colors.muted),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ),
              ),

              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: DrevvySpace.gutter,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Car preview image
                    if (widget.listing?.media.primaryPhoto != null)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(DrevvyRadius.md),
                        child: AspectRatio(
                          aspectRatio: 16 / 9,
                          child: Image.asset(
                            widget.listing!.media.primaryPhoto!,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),

                    const SizedBox(height: DrevvySpace.s4),

                    // "0 CARS LEFT" badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: DrevvySpace.s3,
                        vertical: DrevvySpace.s1,
                      ),
                      decoration: BoxDecoration(
                        color: colors.honey.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                      ),
                      child: Text(
                        '0 CARS LEFT',
                        style: text.label.copyWith(
                          color: colors.honey,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),

                    const SizedBox(height: DrevvySpace.s4),

                    // Title
                    Text("You've used all your cars.", style: text.headline),

                    const SizedBox(height: DrevvySpace.s2),

                    // Subtitle
                    Text(
                      'Your active deals keep going. Add a pack to unlock this car.',
                      style: text.body.copyWith(color: colors.muted),
                    ),

                    const SizedBox(height: DrevvySpace.s5),

                    for (final pack in CarPackType.values) ...[
                      PackOptionCard(
                        pack: pack,
                        isSelected: _selectedPack == pack,
                        showBadge: pack == CarPackType.bestValue,
                        onTap: () => setState(() => _selectedPack = pack),
                      ),
                      const SizedBox(height: DrevvySpace.s3),
                    ],

                    const SizedBox(height: DrevvySpace.s5),

                    // CTA button
                    DrevvyPrimaryButton(
                      label: _selectedPack.ctaText,
                      onPressed: _isPurchasing ? null : _handlePurchase,
                      isLoading: _isPurchasing,
                    ),

                    const SizedBox(height: DrevvySpace.s3),

                    // Disclosure
                    Center(
                      child: Text(
                        'One-time purchase. Packs never expire.',
                        style: text.callout.copyWith(color: colors.muted),
                        textAlign: TextAlign.center,
                      ),
                    ),

                    const SizedBox(height: DrevvySpace.s4),

                    // Not now
                    Center(
                      child: DrevvyGhostButton(
                        label: 'Not now',
                        onPressed: widget.onNotNow,
                        color: colors.ink,
                      ),
                    ),
                  ],
                ),
              ),

              SizedBox(height: bottomPadding + DrevvySpace.s4),
            ],
          ),
        ),
      ),
    );
  }
}

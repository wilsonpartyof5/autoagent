import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/models.dart';
import 'pack_option_card.dart';

/// Screen X: Pack picker paywall sheet shown when user taps "Unlock my price".
/// v1.7: Replaces monthly subscription with one-time car packs.
/// 
/// Pack options:
/// - 3 cars (Starter) $47 - $15.67/car
/// - 5 cars (Plus) $67 - $13.40/car, save 14.5%/car vs Starter
/// - 10 cars (Best Value) $97 - $9.70/car, save 38.1%/car vs Starter (preselected)
/// 
/// RevenueCat products: drevvy_pack_3, drevvy_pack_5, drevvy_pack_10
/// Superwall placement: unlock_my_price
class PackPickerSheet extends StatefulWidget {
  const PackPickerSheet({
    super.key,
    this.listing,
    required this.onPurchase,
    required this.onRestore,
    required this.onKeepShopping,
    this.avgSavings,
  });

  /// The listing context, if shown from a VDP. Null when shown from Account sheet.
  final Listing? listing;
  final Future<void> Function(CarPackType) onPurchase;
  final VoidCallback onRestore;
  final VoidCallback onKeepShopping;
  
  /// Server-driven avg_savings stat. Hidden if null.
  final AvgSavingsConfig? avgSavings;

  @override
  State<PackPickerSheet> createState() => _PackPickerSheetState();
}

class _PackPickerSheetState extends State<PackPickerSheet> {
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

          // Close button
          Align(
            alignment: Alignment.topRight,
            child: Padding(
              padding: const EdgeInsets.only(right: DrevvySpace.s2, top: DrevvySpace.s1),
              child: IconButton(
                icon: Icon(LucideIcons.x, color: colors.muted),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: DrevvySpace.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Car preview image (only shown when context listing provided)
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

                const SizedBox(height: DrevvySpace.s5),

                // Title
                Text(
                  'Let Drevvy handle this dealer.',
                  style: text.headline,
                ),

                const SizedBox(height: DrevvySpace.s2),

                // Subtitle
                Text(
                  'Pick a car pack. Each car you unlock uses one. Packs never expire.',
                  style: text.body.copyWith(color: colors.muted),
                ),

                const SizedBox(height: DrevvySpace.s5),

                // Pack options
                PackOptionCard(
                  pack: CarPackType.starter,
                  isSelected: _selectedPack == CarPackType.starter,
                  onTap: () => setState(() => _selectedPack = CarPackType.starter),
                ),
                const SizedBox(height: DrevvySpace.s3),
                PackOptionCard(
                  pack: CarPackType.plus,
                  isSelected: _selectedPack == CarPackType.plus,
                  onTap: () => setState(() => _selectedPack = CarPackType.plus),
                ),
                const SizedBox(height: DrevvySpace.s3),
                PackOptionCard(
                  pack: CarPackType.bestValue,
                  isSelected: _selectedPack == CarPackType.bestValue,
                  onTap: () => setState(() => _selectedPack = CarPackType.bestValue),
                  showBadge: true,
                ),

                const SizedBox(height: DrevvySpace.s5),

                // Avg savings stat (hidden if unavailable)
                if (widget.avgSavings != null) ...[
                  _AvgSavingsStat(config: widget.avgSavings!),
                  const SizedBox(height: DrevvySpace.s5),
                ],

                // CTA button (follows selection)
                DrevvyPrimaryButton(
                  label: _selectedPack.ctaText,
                  onPressed: _isPurchasing ? null : _handlePurchase,
                  isLoading: _isPurchasing,
                ),

                const SizedBox(height: DrevvySpace.s3),

                // Disclosure
                Center(
                  child: Text(
                    'One-time purchase. No recurring charges. Dealer response and savings are not guaranteed.',
                    style: text.callout.copyWith(color: colors.muted),
                    textAlign: TextAlign.center,
                  ),
                ),

                const SizedBox(height: DrevvySpace.s4),

                // Keep shopping free
                Center(
                  child: DrevvyGhostButton(
                    label: 'Keep shopping free',
                    onPressed: widget.onKeepShopping,
                    color: colors.ink,
                  ),
                ),

                const SizedBox(height: DrevvySpace.s3),

                // Footer links
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    TextButton(
                      onPressed: widget.onRestore,
                      child: Text(
                        'Restore purchases',
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                    ),
                    Text(' · ', style: text.callout.copyWith(color: colors.muted)),
                    TextButton(
                      onPressed: () {
                        // TODO: Open terms
                      },
                      child: Text(
                        'Terms',
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                    ),
                    Text(' · ', style: text.callout.copyWith(color: colors.muted)),
                    TextButton(
                      onPressed: () {
                        // TODO: Open privacy
                      },
                      child: Text(
                        'Privacy',
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          SizedBox(height: bottomPadding + DrevvySpace.s4),
        ],
      ),
    );
  }
}

/// Server-driven avg_savings stat display.
class _AvgSavingsStat extends StatelessWidget {
  const _AvgSavingsStat({required this.config});

  final AvgSavingsConfig config;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Container(
      padding: const EdgeInsets.all(DrevvySpace.s4),
      decoration: BoxDecoration(
        color: colors.mintTint,
        borderRadius: BorderRadius.circular(DrevvyRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            config.value,
            style: text.bodyStrong.copyWith(color: colors.mint),
          ),
          const SizedBox(height: DrevvySpace.s1),
          Text(
            config.label,
            style: text.callout.copyWith(color: colors.mint),
          ),
          const SizedBox(height: DrevvySpace.s1),
          Text(
            'Source: ${config.source}.',
            style: text.micro.copyWith(color: colors.muted),
          ),
        ],
      ),
    );
  }
}

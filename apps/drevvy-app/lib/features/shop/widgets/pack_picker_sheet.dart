import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/models.dart';

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
    required this.listing,
    required this.onPurchase,
    required this.onRestore,
    required this.onKeepShopping,
    this.avgSavings,
  });

  final Listing listing;
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
                // Car preview image
                if (widget.listing.media.primaryPhoto != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(DrevvyRadius.md),
                    child: AspectRatio(
                      aspectRatio: 16 / 9,
                      child: Image.asset(
                        widget.listing.media.primaryPhoto!,
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
                _PackOption(
                  pack: CarPackType.starter,
                  isSelected: _selectedPack == CarPackType.starter,
                  onTap: () => setState(() => _selectedPack = CarPackType.starter),
                ),
                const SizedBox(height: DrevvySpace.s3),
                _PackOption(
                  pack: CarPackType.plus,
                  isSelected: _selectedPack == CarPackType.plus,
                  onTap: () => setState(() => _selectedPack = CarPackType.plus),
                ),
                const SizedBox(height: DrevvySpace.s3),
                _PackOption(
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

/// Individual pack option with radio button.
class _PackOption extends StatelessWidget {
  const _PackOption({
    required this.pack,
    required this.isSelected,
    required this.onTap,
    this.showBadge = false,
  });

  final CarPackType pack;
  final bool isSelected;
  final VoidCallback onTap;
  final bool showBadge;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

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
            // Best Value badge
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
                // Radio button
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
                      ? Icon(
                          LucideIcons.check,
                          size: 14,
                          color: Colors.white,
                        )
                      : null,
                ),

                const SizedBox(width: DrevvySpace.s3),

                // Pack details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            '${pack.cars} cars',
                            style: text.bodyStrong,
                          ),
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

                // Price
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '\$${pack.priceUsd}',
                      style: text.cardTitle,
                    ),
                    Text(
                      pack.perCarFormatted + '/car',
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

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/models.dart';

/// Screen 14: In-context paywall sheet shown over VDP
class PaywallSheet extends StatelessWidget {
  const PaywallSheet({
    super.key,
    required this.listing,
    required this.onSubscribe,
    required this.onRestore,
  });

  final Listing listing;
  final VoidCallback onSubscribe;
  final VoidCallback onRestore;

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
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

          Padding(
            padding: const EdgeInsets.all(DrevvySpace.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Pro pill
                Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: DrevvySpace.s4,
                      vertical: DrevvySpace.s2,
                    ),
                    decoration: BoxDecoration(
                      gradient: DrevvyBrand.gradient,
                      borderRadius: BorderRadius.circular(DrevvyRadius.pill),
                    ),
                    child: Text(
                      'Drevvy Pro',
                      style: text.bodyStrong.copyWith(color: DrevvyColors.onBrand),
                    ),
                  ),
                ),

                const SizedBox(height: DrevvySpace.s5),

                // Car row
                Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                      child: SizedBox(
                        width: 60,
                        height: 45,
                        child: listing.media.primaryPhoto != null
                            ? Image.asset(
                                listing.media.primaryPhoto!,
                                fit: BoxFit.cover,
                              )
                            : Container(
                                color: colors.tile,
                                child: Icon(LucideIcons.car, color: colors.muted),
                              ),
                      ),
                    ),
                    const SizedBox(width: DrevvySpace.s3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(listing.shortTitle, style: text.bodyStrong),
                          Text(
                            _formatPrice(listing.price),
                            style: text.callout.copyWith(color: colors.muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: DrevvySpace.s5),

                // "Drevvy will" list
                Text('Drevvy will', style: text.title),
                const SizedBox(height: DrevvySpace.s3),

                _BulletRow(text: 'Ask Dealer A for their best out-the-door price'),
                _BulletRow(text: 'Keep going until you decide'),
                _BulletRow(text: 'Never share your phone or email'),

                const SizedBox(height: DrevvySpace.s5),

                // Price card
                Container(
                  padding: const EdgeInsets.all(DrevvySpace.s4),
                  decoration: BoxDecoration(
                    color: colors.tile,
                    borderRadius: BorderRadius.circular(DrevvyRadius.md),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('\$97', style: text.figureM),
                          Text(
                            'per month',
                            style: text.callout.copyWith(color: colors.muted),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('10 cars', style: text.bodyStrong),
                          Text(
                            'per billing month',
                            style: text.callout.copyWith(color: colors.muted),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: DrevvySpace.s5),

                // CTA
                DrevvyPrimaryButton(
                  label: 'Get Drevvy Pro',
                  onPressed: onSubscribe,
                ),

                const SizedBox(height: DrevvySpace.s3),

                // Restore + Terms
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    TextButton(
                      onPressed: onRestore,
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
                  ],
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

class _BulletRow extends StatelessWidget {
  const _BulletRow({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final textStyle = context.drevvyText;

    return Padding(
      padding: const EdgeInsets.only(bottom: DrevvySpace.s2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Icon(LucideIcons.check, size: 16, color: colors.mint),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(child: Text(text, style: textStyle.body)),
        ],
      ),
    );
  }
}

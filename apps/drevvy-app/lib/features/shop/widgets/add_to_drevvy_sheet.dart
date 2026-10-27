import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';

/// Screen 18: Add to Drevvy bottom sheet.
/// v1.7: Uses car credits instead of monthly usage.
/// Confirm sheet kept for saved-to-deals. Prefer [MarketIntelSheet] / [DealerChatSheet] on VDP.
class AddToDrevvySheet extends StatefulWidget {
  const AddToDrevvySheet({
    super.key,
    required this.listing,
    required this.market,
    required this.creditBalance,
    required this.onAdd,
  });

  final Listing listing;
  final MarketContext market;
  /// v1.7: Car credit balance instead of User usage.
  final CarCreditBalance creditBalance;
  final VoidCallback onAdd;

  @override
  State<AddToDrevvySheet> createState() => _AddToDrevvySheetState();
}

class _AddToDrevvySheetState extends State<AddToDrevvySheet> {
  bool _isLoading = false;
  bool _showConfirmation = false;

  @override
  void initState() {
    super.initState();
    ProductAnalytics.instance.screen('add_to_drevvy', {
      'listing_id': widget.listing.id,
    });
  }

  String _formatPrice(int price) {
    return NumberFormat.currency(symbol: r'$', decimalDigits: 0).format(price);
  }

  Future<void> _handleAdd() async {
    ProductAnalytics.instance.track(AnalyticsEvents.addToDrevvyConfirmed, {
      'listing_id': widget.listing.id,
    });
    setState(() => _isLoading = true);
    
    // Show confirmation briefly before navigating
    setState(() {
      _isLoading = false;
      _showConfirmation = true;
    });
    
    await Future.delayed(const Duration(milliseconds: 1500));
    widget.onAdd();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final listing = widget.listing;

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
            child: _showConfirmation
                ? _ConfirmationView(listing: listing)
                : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Car row
                Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                      child: SizedBox(
                        width: 80,
                        height: 60,
                        child: listing.media.primaryPhoto != null
                            ? Image.asset(
                                listing.media.primaryPhoto!,
                                fit: BoxFit.cover,
                              )
                            : Container(
                                color: colors.tile,
                                child: Icon(
                                  LucideIcons.imageOff,
                                  color: colors.muted,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(width: DrevvySpace.s3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(listing.shortTitle, style: text.cardTitle),
                          Text(
                            '${listing.milesFormatted} · ${_formatPrice(listing.price)}',
                            style: text.callout.copyWith(color: colors.muted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: DrevvySpace.s6),
                
                Text('What Drevvy will do', style: text.title),
                const SizedBox(height: DrevvySpace.s3),
                
                _BulletPoint(
                  text: 'Send a price brief to this onboarded rooftop',
                ),
                _BulletPoint(
                  text: KeySpend.dealerSeesFirstNameOnly,
                ),
                _BulletPoint(
                  text: KeySpend.refundClockNote,
                ),
                _BulletPoint(
                  text: KeySpend.dealerCloseNote,
                ),
                
                const SizedBox(height: DrevvySpace.s6),
                
                // CTA
                DrevvyPrimaryButton(
                  label: KeySpend.conversationCta,
                  onPressed: _isLoading ? null : _handleAdd,
                  isLoading: _isLoading,
                ),
                
                const SizedBox(height: DrevvySpace.s3),
                
                // v1.7: Credit balance caption
                Center(
                  child: Text(
                    '${widget.creditBalance.displayText} · ${widget.creditBalance.useText}',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
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

/// Confirmation view shown after tapping "Unlock my price"
class _ConfirmationView extends StatelessWidget {
  const _ConfirmationView({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: DrevvySpace.s8),
        
        // Success orb
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            gradient: DrevvyColors.brandGradient,
            shape: BoxShape.circle,
            boxShadow: colors.elevBrand,
          ),
          child: const Icon(
            LucideIcons.check,
            color: Colors.white,
            size: 36,
          ),
        ),
        
        const SizedBox(height: DrevvySpace.s6),
        
        Text(
          "Drevvy's on it.",
          style: text.headline,
          textAlign: TextAlign.center,
        ),
        
        const SizedBox(height: DrevvySpace.s2),
        
        Text(
          'Your price is coming.',
          style: text.body.copyWith(color: colors.muted),
          textAlign: TextAlign.center,
        ),
        
        const SizedBox(height: DrevvySpace.s3),
        
        Text(
          listing.shortTitle,
          style: text.callout.copyWith(color: colors.muted),
          textAlign: TextAlign.center,
        ),
        
        const SizedBox(height: DrevvySpace.s8),
      ],
    );
  }
}

class _BulletPoint extends StatelessWidget {
  const _BulletPoint({required this.text});

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
            padding: const EdgeInsets.only(top: 6),
            child: Icon(
              LucideIcons.check,
              size: 16,
              color: colors.mint,
            ),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(
            child: Text(text, style: textStyle.body),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';

/// Confirm Key A: market intel + save. Glass tokens stand in until Design
/// glass assets land.
class MarketIntelSheet extends StatefulWidget {
  const MarketIntelSheet({
    super.key,
    required this.listing,
    required this.creditBalance,
    required this.onConfirm,
  });

  final Listing listing;
  final CarCreditBalance creditBalance;
  final Future<void> Function() onConfirm;

  @override
  State<MarketIntelSheet> createState() => _MarketIntelSheetState();
}

class _MarketIntelSheetState extends State<MarketIntelSheet> {
  bool _isLoading = false;
  bool _showConfirmation = false;

  @override
  void initState() {
    super.initState();
    ProductAnalytics.instance.screen('market_intel', {
      'listing_id': widget.listing.id,
    });
  }

  Future<void> _handleConfirm() async {
    ProductAnalytics.instance.track(AnalyticsEvents.addToDrevvyConfirmed, {
      'listing_id': widget.listing.id,
      'spend_kind': 'market_intel',
    });
    setState(() => _isLoading = true);
    await widget.onConfirm();
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _showConfirmation = true;
    });
    await Future<void>.delayed(const Duration(milliseconds: 1200));
    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final listing = widget.listing;

    return Container(
      decoration: BoxDecoration(
        // GLASS STUB: Design glass asset pending; use token fill.
        color: colors.glassSolid,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
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
                ? const _DoneView(
                    title: KeySpend.marketIntelUnlockedConfirm,
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(KeySpend.marketIntelCta, style: text.headline),
                      const SizedBox(height: DrevvySpace.s2),
                      Text(
                        listing.shortTitle,
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                      const SizedBox(height: DrevvySpace.s5),
                      const _Bullet(
                        text:
                            'Unlock a price brief from market data for this listing',
                      ),
                      const _Bullet(text: 'Save it so you can come back later'),
                      const _Bullet(
                        text: 'This key is not refunded',
                      ),
                      const SizedBox(height: DrevvySpace.s6),
                      DrevvyPrimaryButton(
                        label: KeySpend.marketIntelCta,
                        onPressed: _isLoading ? null : _handleConfirm,
                        isLoading: _isLoading,
                      ),
                      const SizedBox(height: DrevvySpace.s3),
                      Center(
                        child: Text(
                          '${widget.creditBalance.displayText} · ${KeySpend.marketIntelUse}',
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

class _Bullet extends StatelessWidget {
  const _Bullet({required this.text});

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
            child: Icon(LucideIcons.check, size: 16, color: colors.mint),
          ),
          const SizedBox(width: DrevvySpace.s3),
          Expanded(child: Text(text, style: textStyle.body)),
        ],
      ),
    );
  }
}

class _DoneView extends StatelessWidget {
  const _DoneView({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return Column(
      children: [
        const SizedBox(height: DrevvySpace.s6),
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            gradient: DrevvyColors.brandGradient,
            shape: BoxShape.circle,
            boxShadow: colors.elevBrand,
          ),
          child: const Icon(LucideIcons.check, color: Colors.white, size: 32),
        ),
        const SizedBox(height: DrevvySpace.s5),
        Text(title, style: text.headline, textAlign: TextAlign.center),
        const SizedBox(height: DrevvySpace.s6),
      ],
    );
  }
}

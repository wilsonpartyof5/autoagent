import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';
import 'dealer_inbox_stub.dart';

/// In-network Key B: anonymous dealer chat with Deal Brain chips.
/// Glass tokens stand in until Design glass assets land.
class DealerChatSheet extends StatefulWidget {
  const DealerChatSheet({
    super.key,
    required this.listing,
    required this.match,
    required this.creditBalance,
    required this.alreadyOpen,
    required this.shopperFirstName,
    required this.onSend,
    this.chips,
  });

  final Listing listing;
  final RooftopMatch match;
  final CarCreditBalance creditBalance;
  final bool alreadyOpen;
  final String shopperFirstName;
  final Future<void> Function({String? templateId, String? message}) onSend;

  /// Server suggestions when the app has them. Otherwise the after-opener pair.
  final List<DealBrainChip>? chips;

  @override
  State<DealerChatSheet> createState() => _DealerChatSheetState();
}

class _DealerChatSheetState extends State<DealerChatSheet> {
  DealBrainChip? _selected;
  bool _isLoading = false;
  bool _sent = false;

  @override
  void initState() {
    super.initState();
    ProductAnalytics.instance.screen('dealer_chat', {
      'listing_id': widget.listing.id,
      if (widget.match.rooftopId != null) 'rooftop_id': widget.match.rooftopId,
    });
  }

  Future<void> _send(DealBrainChip chip) async {
    ProductAnalytics.instance.track(AnalyticsEvents.dealBrainChipTapped, {
      'listing_id': widget.listing.id,
      'template_id': chip.templateId,
    });
    setState(() {
      _selected = chip;
      _isLoading = true;
    });
    await widget.onSend(templateId: chip.templateId, message: chip.message);
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _sent = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;

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
            child: _sent
                ? Column(
                    children: [
                      const SizedBox(height: DrevvySpace.s4),
                      Icon(LucideIcons.send, color: colors.violet, size: 32),
                      const SizedBox(height: DrevvySpace.s4),
                      Text(
                        'Message sent.',
                        style: text.headline,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: DrevvySpace.s2),
                      Text(
                        KeySpend.dealerSeesFirstNameOnly,
                        style: text.body.copyWith(color: colors.muted),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: DrevvySpace.s2),
                      Text(
                        KeySpend.refundClockNote,
                        style: text.callout.copyWith(color: colors.muted),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: DrevvySpace.s4),
                      DealerInboxStub(
                        shopperFirstName: widget.shopperFirstName,
                        listing: widget.listing,
                        message: _selected?.message,
                      ),
                      const SizedBox(height: DrevvySpace.s3),
                      Text(
                        KeySpend.dealerCloseNote,
                        style: text.callout.copyWith(color: colors.muted),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: DrevvySpace.s5),
                      DrevvyButton(
                        label: 'Done',
                        onPressed: () => Navigator.of(context).pop(true),
                        isFullWidth: true,
                      ),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        KeySpend.conversationCta,
                        style: text.headline,
                      ),
                      const SizedBox(height: DrevvySpace.s2),
                      Text(
                        widget.alreadyOpen
                            ? 'Tap a suggestion. Nothing sends until you do.'
                            : KeySpend.conversationNote,
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                      const SizedBox(height: DrevvySpace.s2),
                      Text(
                        KeySpend.refundClockNote,
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                      const SizedBox(height: DrevvySpace.s4),
                      DealerInboxStub(
                        shopperFirstName: widget.shopperFirstName,
                        listing: widget.listing,
                      ),
                      const SizedBox(height: DrevvySpace.s5),
                      Wrap(
                        spacing: DrevvySpace.s2,
                        runSpacing: DrevvySpace.s2,
                        children: [
                          for (final chip in widget.chips ??
                              DealBrainChip.suggestionsFor(
                                stockNumber: widget.listing.stockNo,
                              ))
                            _ChipButton(
                              chip: chip,
                              selected: _selected == chip,
                              enabled: !_isLoading,
                              onTap: () => _send(chip),
                            ),
                        ],
                      ),
                      const SizedBox(height: DrevvySpace.s5),
                      if (!widget.alreadyOpen)
                        Center(
                          child: Text(
                            '${widget.creditBalance.displayText} · ${KeySpend.conversationUse}',
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

class _ChipButton extends StatelessWidget {
  const _ChipButton({
    required this.chip,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final DealBrainChip chip;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    return Material(
      color: selected ? colors.lilacTint : colors.tile,
      borderRadius: BorderRadius.circular(DrevvyRadius.pill),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(DrevvyRadius.pill),
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Text(
            chip.label,
            style: text.label.copyWith(
              color: colors.violet,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

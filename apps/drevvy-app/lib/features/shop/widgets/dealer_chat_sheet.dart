import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/analytics/product_analytics.dart';
import '../../../data/models/models.dart';
import '../../../data/services/deal_chips_endpoint.dart';
import 'dealer_inbox_stub.dart';

/// Where the suggestion row is in its fetch.
enum DealerChatChipsStatus {
  /// No deal yet, or the thread, market intel, feature, or visit time
  /// is still loading. The after-opener pair is showing.
  fallback,

  /// Those inputs are loaded and the chips route has not answered yet.
  loading,

  /// The route returned an in-network list. It may be empty.
  loaded,

  /// The route failed. The after-opener pair is showing.
  error,
}

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
    this.dealId,
    this.chipInputs,
    this.chipsEndpoint,
  });

  final Listing listing;
  final RooftopMatch match;
  final CarCreditBalance creditBalance;
  final bool alreadyOpen;
  final String shopperFirstName;
  final Future<void> Function({String? templateId, String? message}) onSend;

  /// Explicit suggestions. When set, they replace the live route.
  /// Used by tests and by a caller that already fetched chips.
  final List<DealBrainChip>? chips;

  /// In-network deal whose chips route should be read. Null keeps the
  /// after-opener pair. Off-network deals never open this sheet.
  final String? dealId;

  /// Thread, market intel, feature, and visit time. The route is called
  /// only after [DealChipInputs.ready], and again when this value changes.
  final DealChipInputs? chipInputs;

  final DealChipsEndpoint? chipsEndpoint;

  @override
  State<DealerChatSheet> createState() => DealerChatSheetState();
}

class DealerChatSheetState extends State<DealerChatSheet> {
  final TextEditingController _composer = TextEditingController();
  DealBrainChip? _selected;
  bool _isSending = false;
  bool _sent = false;
  bool _loadingChips = false;
  bool _chipError = false;
  DealChipSuggestionSet? _server;
  int _generation = 0;

  /// Chips never send themselves, including when a payload says otherwise.
  bool get autoSend => false;

  DealerChatChipsStatus get chipsStatus {
    if (widget.chips != null) return DealerChatChipsStatus.loaded;
    if (_loadingChips) return DealerChatChipsStatus.loading;
    if (_chipError) return DealerChatChipsStatus.error;
    if (_server != null) return DealerChatChipsStatus.loaded;
    return DealerChatChipsStatus.fallback;
  }

  List<DealBrainChip> get visibleChips {
    final explicit = widget.chips;
    if (explicit != null) return _allowed(explicit);
    final server = _server;
    if (!_loadingChips && !_chipError && server != null) {
      return _allowed(server.chips);
    }
    return DealBrainChip.suggestionsFor(stockNumber: widget.listing.stockNo);
  }

  static List<DealBrainChip> _allowed(List<DealBrainChip> chips) {
    return [
      for (final chip in chips)
        if (DealBrainChip.copyAllowed(chip.label, chip.message)) chip,
    ];
  }

  @override
  void initState() {
    super.initState();
    _beginFetch();
    ProductAnalytics.instance.screen('dealer_chat', {
      'listing_id': widget.listing.id,
      if (widget.match.rooftopId != null) 'rooftop_id': widget.match.rooftopId,
    });
  }

  @override
  void didUpdateWidget(covariant DealerChatSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    final inputsChanged = widget.chipInputs != oldWidget.chipInputs;
    final dealChanged = widget.dealId != oldWidget.dealId;
    final endpointChanged = !identical(
      widget.chipsEndpoint,
      oldWidget.chipsEndpoint,
    );
    final explicitChanged = widget.chips != oldWidget.chips;
    if (inputsChanged || dealChanged || endpointChanged || explicitChanged) {
      _beginFetch();
    }
  }

  @override
  void dispose() {
    _generation++;
    _composer.dispose();
    super.dispose();
  }

  void _beginFetch() {
    final generation = ++_generation;
    final dealId = widget.dealId?.trim() ?? '';
    final inputs = widget.chipInputs;
    final endpoint = widget.chipsEndpoint;

    // didUpdateWidget is followed by build, so the loading frame sees this
    // without a nested setState.
    _chipError = false;
    _server = null;
    if (widget.chips != null ||
        dealId.isEmpty ||
        inputs == null ||
        !inputs.ready ||
        endpoint == null) {
      _loadingChips = false;
      return;
    }
    _loadingChips = true;
    unawaited(_request(generation, dealId, inputs, endpoint));
  }

  Future<void> _request(
    int generation,
    String dealId,
    DealChipInputs inputs,
    DealChipsEndpoint endpoint,
  ) async {
    DealChipSuggestionSet? value;
    var failed = false;
    try {
      value = await endpoint.suggest(dealId, inputs);
      failed = value == null;
    } catch (_) {
      failed = true;
      value = null;
    }
    if (!mounted || generation != _generation) return;
    setState(() {
      _loadingChips = false;
      _chipError = failed;
      _server = failed ? null : value;
    });
  }

  void _fillChip(DealBrainChip chip) {
    ProductAnalytics.instance.track(AnalyticsEvents.dealBrainChipTapped, {
      'listing_id': widget.listing.id,
      'template_id': chip.templateId,
    });
    _composer.text = chip.message;
    _composer.selection = TextSelection.collapsed(
      offset: _composer.text.length,
    );
    setState(() => _selected = chip);
  }

  bool get _canSend =>
      !_isSending && !_sent && _composer.text.trim().isNotEmpty;

  Future<void> _submit() async {
    final message = _composer.text.trim();
    if (message.isEmpty || _isSending || _sent) return;
    final selected = _selected;
    final templateId = selected != null && selected.message.trim() == message
        ? selected.templateId
        : null;
    setState(() => _isSending = true);
    try {
      await widget.onSend(templateId: templateId, message: message);
      if (!mounted) return;
      setState(() {
        _isSending = false;
        _sent = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final chips = visibleChips;

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
                        KeySpend.conversationNote,
                        style: text.body.copyWith(color: colors.muted),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: DrevvySpace.s4),
                      DealerInboxStub(
                        shopperFirstName: widget.shopperFirstName,
                        listing: widget.listing,
                        message: _selected?.message ?? _composer.text,
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
                      Text(KeySpend.conversationCta, style: text.headline),
                      const SizedBox(height: DrevvySpace.s2),
                      Text(
                        widget.alreadyOpen
                            ? 'Tap a suggestion to fill your message. Nothing sends until you tap Send.'
                            : KeySpend.conversationNote,
                        style: text.callout.copyWith(color: colors.muted),
                      ),
                      if (!widget.alreadyOpen) ...[
                        const SizedBox(height: DrevvySpace.s2),
                        Text(
                          'Tap a suggestion to fill your message. Nothing sends until you tap Send.',
                          style: text.callout.copyWith(color: colors.muted),
                        ),
                      ],
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
                          for (final chip in chips)
                            _ChipButton(
                              chip: chip,
                              selected: _selected == chip,
                              enabled: !_isSending,
                              onTap: () => _fillChip(chip),
                            ),
                        ],
                      ),
                      const SizedBox(height: DrevvySpace.s4),
                      TextField(
                        key: const Key('dealer-chat-composer'),
                        controller: _composer,
                        minLines: 1,
                        maxLines: 3,
                        enabled: !_isSending,
                        textInputAction: TextInputAction.send,
                        onChanged: (_) => setState(() {}),
                        onSubmitted: (_) => unawaited(_submit()),
                        style: text.body,
                        decoration: InputDecoration(
                          hintText: 'Message the dealer',
                          hintStyle: text.body.copyWith(
                            color: colors.placeholder,
                          ),
                          filled: true,
                          fillColor: colors.tile,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(
                              DrevvyRadius.md,
                            ),
                            borderSide: BorderSide(color: colors.glassBorder),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(
                              DrevvyRadius.md,
                            ),
                            borderSide: BorderSide(color: colors.glassBorder),
                          ),
                        ),
                      ),
                      const SizedBox(height: DrevvySpace.s3),
                      DrevvyButton(
                        key: const Key('dealer-chat-send'),
                        label: 'Send',
                        isFullWidth: true,
                        isLoading: _isSending,
                        onPressed: _canSend ? () => unawaited(_submit()) : null,
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

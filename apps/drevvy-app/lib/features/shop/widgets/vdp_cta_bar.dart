import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../core/widgets/drevvy_buttons.dart';
import '../../../data/models/models.dart';

/// Sticky VDP actions for the two-key model.
///
/// Key A is always shown. Key B (in-network chat) or the off-network OTD
/// request is the second action. Glass tokens stand in until Design glass
/// assets land.
class VdpCtaBar extends StatelessWidget {
  const VdpCtaBar({
    super.key,
    required this.listing,
    required this.creditBalance,
    required this.match,
    required this.marketIntelUnlocked,
    this.marketIntelAvailable = true,
    required this.conversationOpen,
    required this.otdRequested,
    required this.onMarketIntel,
    required this.onConversation,
    required this.onOtdRequest,
  });

  final Listing listing;
  final CarCreditBalance creditBalance;
  final RooftopMatch? match;
  final bool marketIntelUnlocked;

  /// False when the server cannot return a real price brief. The button
  /// stays disabled so a key is not spent.
  final bool marketIntelAvailable;
  final bool conversationOpen;
  final bool otdRequested;
  final VoidCallback onMarketIntel;
  final VoidCallback onConversation;
  final VoidCallback onOtdRequest;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final inNetwork = match?.isInNetwork == true;
    final classifiedOnDrevvy = !inNetwork && match?.classifiedInNetwork == true;
    final classifiedOffDrevvy =
        match?.classifiedOffNetwork == true &&
        match?.source == RooftopMatchSource.live;
    final networkUnknown = match?.source == RooftopMatchSource.unavailable;

    return Container(
      padding: EdgeInsets.fromLTRB(
        DrevvySpace.gutter,
        DrevvySpace.s3,
        DrevvySpace.gutter,
        DrevvySpace.s3 + bottomPadding,
      ),
      decoration: BoxDecoration(
        // GLASS STUB: Design glass asset pending; use token fill.
        color: colors.glassSolid.withValues(alpha: 0.97),
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DrevvyRadius.sheetTop),
        ),
        boxShadow: colors.elevSheet,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(listing.priceFormatted, style: text.figureS),
                  Text(
                    'Listed price',
                    style: text.callout.copyWith(color: colors.muted),
                  ),
                ],
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: colors.lilacTint,
                  borderRadius: BorderRadius.circular(DrevvyRadius.sm),
                ),
                child: Text(
                  creditBalance.displayText,
                  style: text.label.copyWith(
                    color: colors.violet,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: DrevvySpace.s3),
          DrevvyButton(
            label: !marketIntelAvailable
                ? 'Market intel is unavailable'
                : marketIntelUnlocked
                ? 'Market intel saved'
                : KeySpend.marketIntelCta,
            icon: marketIntelUnlocked
                ? LucideIcons.check
                : LucideIcons.sparkles,
            onPressed: !marketIntelAvailable || marketIntelUnlocked
                ? null
                : onMarketIntel,
            isFullWidth: true,
          ),
          const SizedBox(height: DrevvySpace.s1),
          Text(
            !marketIntelAvailable
                ? 'Drevvy has no real price brief for this car, so a key is not used.'
                : marketIntelUnlocked
                ? 'Price brief is unlocked for this listing.'
                : KeySpend.marketIntelNote,
            style: text.callout.copyWith(color: colors.muted),
          ),
          const SizedBox(height: DrevvySpace.s3),
          if (inNetwork) ...[
            DrevvyButton(
              label: conversationOpen
                  ? 'Open dealer thread'
                  : KeySpend.conversationCta,
              icon: LucideIcons.messageCircle,
              variant: DrevvyButtonVariant.secondary,
              onPressed: onConversation,
              isFullWidth: true,
            ),
            const SizedBox(height: DrevvySpace.s1),
            Text(
              conversationOpen
                  ? 'Chat is already open. The dealer can see you in their inbox.'
                  : KeySpend.conversationNote,
              style: text.callout.copyWith(color: colors.muted),
            ),
          ] else if (classifiedOnDrevvy) ...[
            Text(
              'This dealer is on Drevvy.',
              style: text.callout.copyWith(color: colors.muted),
            ),
            const SizedBox(height: DrevvySpace.s1),
            Text(
              'Dealer chat is not opened from this screen.',
              style: text.callout.copyWith(color: colors.muted),
            ),
          ] else if (classifiedOffDrevvy) ...[
            Text(
              'This dealer is off Drevvy.',
              style: text.callout.copyWith(color: colors.muted),
            ),
            const SizedBox(height: DrevvySpace.s1),
            Text(
              'An out-the-door request is not available yet.',
              style: text.callout.copyWith(color: colors.muted),
            ),
          ] else if (networkUnknown) ...[
            Text(
              'Dealer network is unavailable. Drevvy is not guessing in-network or off-network.',
              style: text.callout.copyWith(color: colors.muted),
            ),
          ] else ...[
            DrevvyButton(
              label: otdRequested
                  ? 'OTD number requested'
                  : KeySpend.otdRequestCta,
              icon: LucideIcons.receipt,
              variant: DrevvyButtonVariant.secondary,
              onPressed: onOtdRequest,
              isFullWidth: true,
            ),
            const SizedBox(height: DrevvySpace.s1),
            Text(
              '${KeySpend.otdRequestFreeBadge} · ${KeySpend.otdRequestNote}',
              style: text.callout.copyWith(color: colors.muted),
            ),
          ],
        ],
      ),
    );
  }
}

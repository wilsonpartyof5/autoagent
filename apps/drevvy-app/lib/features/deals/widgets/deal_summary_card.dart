import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/navigation/shopper_label.dart';
import '../../../core/theme/drevvy_theme.dart';
import '../../../core/theme/drevvy_tokens.dart';
import '../../../data/models/models.dart';
import '../../../data/models/money_format.dart';
import '../../shop/widgets/listing_photo.dart';

/// Latest dealer line already stored on the deal thread.
/// Shopper and Drevvy lines are not shown as a dealer quote.
String? latestDealerPreview(List<DealThreadMessage> messages) {
  for (final message in messages.reversed) {
    final author = message.author?.trim().toLowerCase() ?? '';
    if (author.isEmpty || author == 'shopper' || author == 'drevvy') continue;
    final body = message.body.trim();
    if (body.isEmpty) continue;
    return body;
  }
  return null;
}

/// Dealer letter, or the revealed store name when the deal already shows it.
String dealPartyLabel(Deal deal) {
  if (deal.status.dealerRevealed) {
    final name = deal.dealer?.name.trim();
    if (name != null && name.isNotEmpty) return name;
  }
  return 'Dealer ${deal.letter}';
}

/// Whole-price amount is the latest offer's out-the-door figure.
/// "Less than listed" uses [Deal.savings]: listed price at the start
/// minus the latest offer's vehicle price. It is hidden unless that
/// difference is a real positive number. It is never taken from the
/// whole price and never estimated.
class DealSummaryCard extends StatelessWidget {
  const DealSummaryCard({
    super.key,
    required this.deal,
    required this.onOpenChat,
    this.onOpenDeal,
    this.dealerPreview,
  });

  final Deal deal;
  final VoidCallback onOpenChat;
  final VoidCallback? onOpenDeal;
  final String? dealerPreview;

  @override
  Widget build(BuildContext context) {
    final colors = context.drevvy;
    final text = context.drevvyText;
    final listing = deal.listing;
    final offer = deal.latestOffer;
    final savings = deal.savings;
    final showSavings = savings != null && savings > 0;
    final when = offer?.receivedAt ?? deal.addedAt;
    final kind = offer == null
        ? null
        : _wholePriceKind(deal.status);

    return Material(
      color: colors.glassSolid,
      borderRadius: BorderRadius.circular(18),
      elevation: 1,
      shadowColor: const Color(0x1428305A),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                height: 96,
                width: double.infinity,
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: ListingPhoto(url: listing.media.primaryPhoto),
                    ),
                    Positioned(
                      left: 8,
                      top: 8,
                      child: StatusChip(deal.status),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  GestureDetector(
                    onTap: onOpenDeal,
                    child: Text(
                      listing.shortTitle,
                      style: text.title.copyWith(fontSize: 16),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _trimLine(listing),
                    style: text.label.copyWith(color: colors.muted),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      Text(
                        offer == null
                            ? listing.priceFormatted
                            : formatUsd(offer.otd),
                        style: text.title.copyWith(fontSize: 18),
                      ),
                      if (kind != null)
                        Text(
                          kind,
                          style: text.label.copyWith(color: colors.muted),
                        ),
                      if (showSavings)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: colors.mintTint,
                            borderRadius: BorderRadius.circular(
                              DrevvyRadius.pill,
                            ),
                          ),
                          child: Text(
                            '${formatUsd(savings)} less than listed',
                            style: text.micro.copyWith(
                              color: colors.mint,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Listed ${formatUsd(deal.listedAtStart)}',
                          style: text.label.copyWith(color: colors.muted),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          '${dealPartyLabel(deal)} · ${relativeTimeLabel(when)}',
                          textAlign: TextAlign.end,
                          style: text.label.copyWith(color: colors.muted),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(10, 8, 10, 4),
                    decoration: BoxDecoration(
                      color: colors.canvas,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (dealerPreview != null)
                          Text(
                            '“$dealerPreview”',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.body.copyWith(
                              fontSize: 13,
                              color: colors.ink,
                            ),
                          ),
                        TextButton(
                          onPressed: onOpenChat,
                          style: TextButton.styleFrom(
                            foregroundColor: colors.violet,
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(44, 44),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            alignment: Alignment.centerLeft,
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Open chat'),
                              SizedBox(width: 4),
                              Icon(LucideIcons.chevronRight, size: 14),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String? _wholePriceKind(DealStatus status) {
  return switch (status) {
    DealStatus.offerReceived ||
    DealStatus.officialOfferReceived ||
    DealStatus.accepted ||
    DealStatus.changedAfterAccepted => 'whole-price offer',
    _ => 'latest whole price',
  };
}

String _trimLine(Listing listing) {
  final trim = [
    listing.build.trim,
    listing.build.drivetrain,
  ].whereType<String>().where((part) => part.trim().isNotEmpty).join(' ');
  final parts = <String>[
    if (trim.isNotEmpty) trim,
    if (listing.miles != null) listing.milesFormatted,
    if (listing.dist != null) listing.distanceFormatted,
  ];
  return parts.join(' · ');
}

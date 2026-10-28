import 'package:flutter/material.dart';

import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../../shop/widgets/dealer_chat_sheet.dart';

/// Opens the same in-network [DealerChatSheet] as VDP, with live chip
/// wiring (`dealId`, [DealChipInputs], [DemoRepository.dealChips]).
///
/// Visit day and time are loaded as absent until the shopper picks them.
/// Returns false when the rooftop is off-network so the caller can keep
/// [AskDrevvySheet] for those deals.
Future<bool> openDealDealerChat({
  required BuildContext context,
  required DemoRepository repo,
  required Deal deal,
  RooftopMatch? match,
  CarCreditBalance? creditBalance,
  String? shopperFirstName,
  MarketContext? market,
}) async {
  final listing = deal.listing;
  final resolvedMatch =
      match ?? listing.rooftopMatch ?? await repo.getRooftopMatch(listing);
  if (!resolvedMatch.isInNetwork) return false;

  final balance = creditBalance ?? await repo.getCreditBalance();
  final firstName = shopperFirstName ?? (await repo.getCurrentUser()).firstName;
  final resolvedMarket =
      market ?? deal.marketContext ?? await repo.getMarketContext(listing);
  if (!context.mounted) return false;

  // Return once the sheet is presented. Dismissal is the shopper's.
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => DealerChatSheet(
      listing: listing,
      match: resolvedMatch,
      creditBalance: balance,
      alreadyOpen: true,
      shopperFirstName: firstName,
      dealId: deal.id,
      chipInputs: _chipInputsFor(repo, deal, listing, resolvedMarket),
      chipsEndpoint: repo.dealChips,
      onSend: ({templateId, message}) async {
        await repo.startDealerConversation(
          listing,
          resolvedMatch,
          templateId: templateId,
          message: message,
        );
        final text = message?.trim() ?? '';
        if (text.isNotEmpty) {
          repo.rememberDealMessage(deal.id, body: text);
        }
      },
    ),
  );
  return true;
}

/// Thread, market intel, feature, and visit time for an existing deal.
DealChipInputs _chipInputsFor(
  DemoRepository repo,
  Deal deal,
  Listing listing,
  MarketContext? market,
) {
  return DealChipInputs.loaded(
    messages: repo.dealThread(deal.id),
    market: market,
    feature: DealChipInputs.featureFromListing(listing),
    stockNumber: listing.stockNo,
    listedPrice: listing.price,
    dom: listing.domActive,
  );
}

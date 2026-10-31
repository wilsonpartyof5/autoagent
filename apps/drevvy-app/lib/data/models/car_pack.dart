import 'package:equatable/equatable.dart';

import 'money_format.dart';

/// Two spends from the same key balance (Dustin 2026-10-27, locked 10-27).
///
/// Key A: market intel + save on a VDP. Not refunded.
/// Key B: conversation, only if the listing URL matches an onboarded rooftop.
/// Off-network OTD request is free (not chat, no key).
/// Backend refund policy (do not advertise in shopper UI): conversation-key
/// refunds after 7-day no-reply (clock starts at confirmed delivery) or sold.
/// Dealer inbox shows the shopper first name only — also not shopper copy.
/// Dealer pays $300 on shopper-confirmed purchase — not a shopper charge.
class KeySpend {
  static const marketIntelAndSave = 1;
  static const dealerConversation = 1;
  static const noReplyRefundDays = 7;
  static const dealerCloseFeeUsd = 300;

  static const marketIntelCta = 'Unlock market intel & save';
  static const marketIntelUse = 'Uses 1 key';
  static const marketIntelNote =
      'Unlocks a price brief and saves this listing. This key is not refunded.';

  /// VDP teaser on the blurred Marketplace Intelligence card.
  static const marketIntelTeaser =
      'See fair price, similar cars, days listed, price drops · 1 key';

  /// Shown after Key A spends and the listing is saved.
  static const marketIntelUnlockedConfirm = 'Fair price unlocked · Car saved.';

  static const conversationCta = 'Text the dealer · 1 key';
  static const conversationUse = 'Uses 1 key';
  static const conversationNote =
      'Only when this dealer is on Drevvy. One key opens the chat.';
  static const dealerCloseNote =
      'If you confirm you bought it, the dealer pays Drevvy \$300. You are not charged that fee.';

  static const otdRequestCta = 'Ask for the whole price · free';
  static const otdRequestFreeBadge = 'Free · no key';
  static const otdRequestNote =
      'Free. We ask for the whole price. This is not a chat.';

  static const packHeadline = 'Pick a key pack.';
  static const packSubhead =
      'Market intel + save uses 1 key. Texting an in-network dealer uses a '
      'second key. Asking for the whole price off-network is free. '
      'Packs never expire.';

  static const unlockCopy =
      'Market intel + save uses 1 key. Texting an in-network dealer uses a '
      'second key. Asking for the whole price off-network is free.';
}

/// One-time key pack purchase options.
/// Packs never expire. Store products `drevvy_keys_1/5/10/25`,
/// RevenueCat offering `keys`, packages `keys_1/5/10/25`.
enum CarPackType {
  single(
    keys: 1,
    priceUsd: 4.99,
    productId: 'drevvy_keys_1',
    packageId: 'keys_1',
  ),
  starter(
    keys: 5,
    priceUsd: 19.99,
    productId: 'drevvy_keys_5',
    packageId: 'keys_5',
  ),
  bestValue(
    keys: 10,
    priceUsd: 34.99,
    productId: 'drevvy_keys_10',
    packageId: 'keys_10',
  ),
  plus(
    keys: 25,
    priceUsd: 74.99,
    productId: 'drevvy_keys_25',
    packageId: 'keys_25',
  );

  const CarPackType({
    required this.keys,
    required this.priceUsd,
    required this.productId,
    required this.packageId,
  });

  final int keys;
  final double priceUsd;
  final String productId;

  /// RevenueCat package identifier on the `keys` offering.
  final String packageId;

  /// Pack size. Formerly named for car credits; now keys.
  int get cars => keys;

  /// Keys granted for this pack.
  int get keysGranted => keys;

  /// Alias used by existing analytics and ledger code.
  int get carsGranted => keys;

  /// PostHog pack-mix dimension: `1,5,10,25`.
  static String get packMix => values.map((pack) => '${pack.keys}').join(',');

  /// Store product id or RevenueCat package id.
  static CarPackType? fromProductId(String productId) {
    for (final pack in values) {
      if (pack.productId == productId || pack.packageId == productId) {
        return pack;
      }
    }
    return null;
  }

  /// Per-key cost in dollars.
  double get perKeyCost => priceUsd / keys;

  /// Alias for [perKeyCost].
  double get perCarCost => perKeyCost;

  /// Per-key cost formatted as dollars, e.g. "$3.50".
  String get perKeyFormatted => formatUsd(perKeyCost, cents: true);

  /// Alias for [perKeyFormatted].
  String get perCarFormatted => perKeyFormatted;

  /// Pack price formatted as dollars, e.g. "$34.99".
  String get priceFormatted => formatUsd(priceUsd);

  /// Display name for the pack.
  String get displayName => switch (this) {
    CarPackType.single => 'Single',
    CarPackType.starter => 'Starter',
    CarPackType.bestValue => 'Recommended',
    CarPackType.plus => 'Plus',
  };

  /// "1 key" or "5 keys".
  String get keysLabel => keys == 1 ? '1 key' : '$keys keys';

  /// Alias for [keysLabel].
  String get carsLabel => keysLabel;

  /// Percent saved per key versus the 1-key price, rounded by [savingsText].
  /// The 1-key pack is the baseline, so it has no savings chip.
  double? get savingsPercentVsSingle {
    final baseline = CarPackType.single.perKeyCost;
    if (perKeyCost >= baseline) return null;
    return ((baseline - perKeyCost) / baseline) * 100;
  }

  /// Chip copy: "Save 19.9%/key". Null on the 1-key pack.
  String? get savingsText {
    final pct = savingsPercentVsSingle;
    if (pct == null) return null;
    return 'Save ${pct.toStringAsFixed(1)}%/key';
  }

  /// CTA button text: "Get 1 key for $4.99" or "Get 10 keys for $34.99".
  String get ctaText => 'Get $keysLabel for $priceFormatted';
}

/// Reason for a credit balance change in the ledger.
enum CreditReason {
  /// Pack purchase
  purchase,

  /// Spent 1 key on market intel + save (Key A).
  marketIntel,

  /// Spent 1 key on an in-network dealer conversation (Key B).
  dealerConversation,

  /// Spent 1 credit on "Unlock my price" (legacy alias of [marketIntel]).
  unlock,

  /// Refund: no reply from dealer in 7 days (conversation key only).
  refundNoResponse,

  /// Refund: car no longer listed / sold (conversation key only).
  refundNoLongerListed,

  /// Refund: dealer declined
  refundDealerDecline,

  /// Refund: removed deal within 30 minutes before outreach (legacy; unused).
  refundEarlyRemoval,

  /// Manual adjustment (admin)
  adjustment,

  /// #119 three free keys on first begin. Not a purchase.
  starterGrant,
}

/// A single entry in the key credit ledger.
class CreditLedgerEntry extends Equatable {
  const CreditLedgerEntry({
    required this.id,
    required this.userId,
    required this.delta,
    required this.reason,
    required this.createdAt,
    this.dealId,
    this.listingId,
    this.packType,
    this.rcEventId,
  });

  final String id;
  final String userId;

  /// +N for credits added, -1 for credits spent.
  final int delta;
  final CreditReason reason;
  final DateTime createdAt;

  /// Associated deal ID for conversation spends/refunds.
  final String? dealId;

  /// Associated listing ID for market-intel spends.
  final String? listingId;

  /// Pack type for purchases.
  final CarPackType? packType;

  /// RevenueCat event ID for idempotency.
  final String? rcEventId;

  @override
  List<Object?> get props => [
    id,
    userId,
    delta,
    reason,
    createdAt,
    dealId,
    listingId,
    packType,
    rcEventId,
  ];
}

/// User's current key credit balance (computed from ledger).
class CarCreditBalance extends Equatable {
  const CarCreditBalance({
    required this.balance,
    required this.totalPurchased,
    required this.totalSpent,
    required this.totalRefunded,
  });

  /// Current available credits.
  final int balance;

  /// Total credits purchased (lifetime).
  final int totalPurchased;

  /// Total credits spent (lifetime).
  final int totalSpent;

  /// Total credits refunded (lifetime).
  final int totalRefunded;

  /// Whether the user can spend a key.
  bool get canUnlock => balance > 0;

  /// Whether the user is out of keys (show OutOfCars sheet).
  bool get isEmpty => balance == 0;

  /// Display text: "X keys left" or "0 keys left".
  String get displayText => balance == 1 ? '1 key left' : '$balance keys left';

  /// Display text for confirmation. Two spends from this balance.
  String get useText => 'Market + save 1 key · Chat 1 key';

  const CarCreditBalance.empty()
    : balance = 0,
      totalPurchased = 0,
      totalSpent = 0,
      totalRefunded = 0;

  /// Create with initial balance (for demo).
  const CarCreditBalance.withBalance(this.balance)
    : totalPurchased = balance,
      totalSpent = 0,
      totalRefunded = 0;

  CarCreditBalance copyWith({
    int? balance,
    int? totalPurchased,
    int? totalSpent,
    int? totalRefunded,
  }) {
    return CarCreditBalance(
      balance: balance ?? this.balance,
      totalPurchased: totalPurchased ?? this.totalPurchased,
      totalSpent: totalSpent ?? this.totalSpent,
      totalRefunded: totalRefunded ?? this.totalRefunded,
    );
  }

  @override
  List<Object?> get props => [
    balance,
    totalPurchased,
    totalSpent,
    totalRefunded,
  ];
}

/// Server-driven config for avg_savings stat (v1.7).
/// Hide if null/unavailable.
class AvgSavingsConfig extends Equatable {
  const AvgSavingsConfig({
    required this.value,
    required this.label,
    required this.source,
    required this.kind,
  });

  /// The stat value, e.g. "3–5%".
  final String value;

  /// Full label text to display.
  final String label;

  /// Source citation.
  final String source;

  /// "market" for third-party stats, "drevvy" for our own data.
  final String kind;

  @override
  List<Object?> get props => [value, label, source, kind];
}

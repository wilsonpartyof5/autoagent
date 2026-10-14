import 'package:equatable/equatable.dart';

/// One-time car pack purchase options (v1.7).
/// Packs never expire. RevenueCat products: drevvy_pack_3/5/10.
enum CarPackType {
  starter(
    cars: 3,
    priceUsd: 47,
    productId: 'drevvy_pack_3',
  ),
  plus(
    cars: 5,
    priceUsd: 67,
    productId: 'drevvy_pack_5',
  ),
  bestValue(
    cars: 10,
    priceUsd: 97,
    productId: 'drevvy_pack_10',
  );

  const CarPackType({
    required this.cars,
    required this.priceUsd,
    required this.productId,
  });

  final int cars;
  final int priceUsd;
  final String productId;

  /// Per-car cost in cents.
  double get perCarCost => priceUsd / cars;

  /// Per-car cost formatted as dollars.
  String get perCarFormatted => '\$${perCarCost.toStringAsFixed(2)}';

  /// Display name for the pack.
  String get displayName => switch (this) {
        CarPackType.starter => 'Starter',
        CarPackType.plus => 'Plus',
        CarPackType.bestValue => 'Best Value',
      };

  /// Savings vs Starter pack (per car) as percentage.
  double? get savingsVsStarter {
    if (this == CarPackType.starter) return null;
    final starterPerCar = CarPackType.starter.perCarCost;
    return ((starterPerCar - perCarCost) / starterPerCar) * 100;
  }

  /// Savings vs Starter pack in dollars (total).
  double? get savingsDollarsVsStarter {
    if (this == CarPackType.starter) return null;
    final starterPerCar = CarPackType.starter.perCarCost;
    return (starterPerCar - perCarCost) * cars;
  }

  /// Human-readable savings text: "Save 14.5%/car vs Starter".
  String? get savingsText {
    final pct = savingsVsStarter;
    if (pct == null) return null;
    final dollars = savingsDollarsVsStarter!;
    return 'Save ${pct.toStringAsFixed(1)}%/car · \$${dollars.toStringAsFixed(2)} vs Starter';
  }

  /// CTA button text: "Get X cars for $Y".
  String get ctaText => 'Get $cars cars for \$$priceUsd';
}

/// Reason for a credit balance change in the ledger.
enum CreditReason {
  /// Pack purchase
  purchase,

  /// Spent 1 credit on "Unlock my price"
  unlock,

  /// Refund: no response from dealer
  refundNoResponse,

  /// Refund: car no longer listed (sold)
  refundNoLongerListed,

  /// Refund: dealer declined
  refundDealerDecline,

  /// Refund: removed deal within 30 minutes before outreach
  refundEarlyRemoval,

  /// Manual adjustment (admin)
  adjustment,
}

/// A single entry in the car credit ledger.
class CreditLedgerEntry extends Equatable {
  const CreditLedgerEntry({
    required this.id,
    required this.userId,
    required this.delta,
    required this.reason,
    required this.createdAt,
    this.dealId,
    this.packType,
    this.rcEventId,
  });

  final String id;
  final String userId;

  /// +N for credits added, -1 for credits spent.
  final int delta;
  final CreditReason reason;
  final DateTime createdAt;

  /// Associated deal ID for unlocks/refunds.
  final String? dealId;

  /// Pack type for purchases.
  final CarPackType? packType;

  /// RevenueCat event ID for idempotency.
  final String? rcEventId;

  @override
  List<Object?> get props => [id, userId, delta, reason, createdAt, dealId, packType, rcEventId];
}

/// User's current car credit balance (computed from ledger).
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

  /// Whether the user can unlock a new car.
  bool get canUnlock => balance > 0;

  /// Whether the user is out of cars (show OutOfCars sheet).
  bool get isEmpty => balance == 0;

  /// Display text: "X cars left" or "0 CARS LEFT".
  String get displayText => balance == 1 ? '1 car left' : '$balance cars left';

  /// Display text for confirmation: "Uses 1 car".
  String get useText => 'Uses 1 car';

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
  List<Object?> get props => [balance, totalPurchased, totalSpent, totalRefunded];
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

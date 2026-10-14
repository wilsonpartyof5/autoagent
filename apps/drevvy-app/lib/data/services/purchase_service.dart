import '../models/car_pack.dart';

/// Result of a purchase attempt.
sealed class PurchaseResult {
  const PurchaseResult();
}

class PurchaseSuccess extends PurchaseResult {
  const PurchaseSuccess({
    required this.packType,
    required this.creditsAdded,
    required this.transactionId,
  });

  final CarPackType packType;
  final int creditsAdded;
  final String transactionId;
}

class PurchaseCancelled extends PurchaseResult {
  const PurchaseCancelled();
}

class PurchaseError extends PurchaseResult {
  const PurchaseError({required this.message, this.code});

  final String message;
  final String? code;
}

class PurchasePending extends PurchaseResult {
  const PurchasePending();
}

/// Abstract interface for in-app purchases.
/// Implementations: FakePurchaseService (demo), RevenueCatPurchaseService (production).
/// 
/// RevenueCat integration notes:
/// - Products: drevvy_pack_3, drevvy_pack_5, drevvy_pack_10 (consumable IAP)
/// - Virtual currency: `cars` (code CARS) - grants 3/5/10 on purchase
/// - Superwall placement: `cars_balance_empty` replaces `monthly_limit_reached`
abstract class PurchaseService {
  /// Initialize the purchase service.
  Future<void> initialize();

  /// Get available pack offerings.
  /// Returns null if offerings unavailable.
  Future<List<CarPackOffering>?> getOfferings();

  /// Purchase a car pack.
  /// Shows native purchase UI.
  Future<PurchaseResult> purchasePack(CarPackType packType);

  /// Restore previous purchases.
  /// Returns credits restored, or error.
  Future<RestoreResult> restorePurchases();

  /// Check if a specific product is available for purchase.
  Future<bool> isProductAvailable(String productId);
}

/// A pack offering with localized pricing from the store.
class CarPackOffering {
  const CarPackOffering({
    required this.packType,
    required this.localizedPrice,
    required this.currencyCode,
    required this.priceAmount,
  });

  final CarPackType packType;

  /// Localized price string, e.g. "$47.00" or "€42,00".
  final String localizedPrice;

  /// ISO currency code, e.g. "USD".
  final String currencyCode;

  /// Price as decimal amount.
  final double priceAmount;
}

/// Result of restore purchases.
sealed class RestoreResult {
  const RestoreResult();
}

/// One restored consumable transaction. Credits from these packs never expire.
class RestoredTransaction {
  const RestoredTransaction({
    required this.transactionId,
    required this.packType,
  });

  final String transactionId;
  final CarPackType packType;
}

class RestoreSuccess extends RestoreResult {
  const RestoreSuccess({
    required this.creditsRestored,
    this.transactions = const [],
  });

  final int creditsRestored;
  final List<RestoredTransaction> transactions;
}

class RestoreNoPurchases extends RestoreResult {
  const RestoreNoPurchases();
}

class RestoreError extends RestoreResult {
  const RestoreError({required this.message});

  final String message;
}

/// Fake implementation for demo/testing.
/// Simulates successful purchases without real store calls.
class FakePurchaseService implements PurchaseService {
  FakePurchaseService({
    this.simulateDelay = const Duration(milliseconds: 800),
    this.onPurchaseComplete,
  });

  final Duration simulateDelay;

  /// Callback when a purchase completes (for demo repository integration).
  final void Function(CarPackType packType, int credits)? onPurchaseComplete;

  int _transactionCounter = 0;

  @override
  Future<void> initialize() async {
    await Future.delayed(const Duration(milliseconds: 100));
  }

  @override
  Future<List<CarPackOffering>?> getOfferings() async {
    await Future.delayed(const Duration(milliseconds: 200));
    return [
      CarPackOffering(
        packType: CarPackType.starter,
        localizedPrice: '\$47.00',
        currencyCode: 'USD',
        priceAmount: 47.0,
      ),
      CarPackOffering(
        packType: CarPackType.plus,
        localizedPrice: '\$67.00',
        currencyCode: 'USD',
        priceAmount: 67.0,
      ),
      CarPackOffering(
        packType: CarPackType.bestValue,
        localizedPrice: '\$97.00',
        currencyCode: 'USD',
        priceAmount: 97.0,
      ),
    ];
  }

  @override
  Future<PurchaseResult> purchasePack(CarPackType packType) async {
    await Future.delayed(simulateDelay);

    _transactionCounter++;
    final transactionId = 'fake_txn_${DateTime.now().millisecondsSinceEpoch}_$_transactionCounter';

    onPurchaseComplete?.call(packType, packType.cars);

    return PurchaseSuccess(
      packType: packType,
      creditsAdded: packType.cars,
      transactionId: transactionId,
    );
  }

  @override
  Future<RestoreResult> restorePurchases() async {
    await Future.delayed(simulateDelay);
    return const RestoreNoPurchases();
  }

  @override
  Future<bool> isProductAvailable(String productId) async {
    return CarPackType.values.any((p) => p.productId == productId);
  }
}

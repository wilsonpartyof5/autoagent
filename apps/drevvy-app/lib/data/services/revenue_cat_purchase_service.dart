import '../models/car_pack.dart';
import 'purchase_service.dart';
import 'store_gateway.dart';

/// RevenueCat-backed key packs.
///
/// Products are consumables so they can be bought again:
/// `drevvy_keys_1` ($4.99, package `keys_1`, 1 key),
/// `drevvy_keys_5` ($19.99), `drevvy_keys_10` ($34.99 recommended),
/// `drevvy_keys_25` ($74.99). Offering lookup_key: `keys`.
/// The credits they grant never expire.
class RevenueCatPurchaseService implements PurchaseService {
  RevenueCatPurchaseService({required this.gateway});

  final StoreGateway gateway;
  bool _initialized = false;

  @override
  Future<void> initialize() async {
    if (_initialized) return;
    await gateway.configure();
    _initialized = true;
  }

  @override
  Future<List<CarPackOffering>?> getOfferings() async {
    await initialize();
    final offerings = await gateway.getOfferings();
    if (offerings.isEmpty) return null;
    return offerings;
  }

  @override
  Future<PurchaseResult> purchasePack(CarPackType packType) async {
    await initialize();
    final outcome = await gateway.purchase(packType);
    return switch (outcome) {
      StorePurchaseSucceeded(:final transactionId) => PurchaseSuccess(
        packType: packType,
        creditsAdded: packType.keys,
        transactionId: transactionId,
      ),
      StorePurchaseCancelled() => const PurchaseCancelled(),
      StorePurchasePending() => const PurchasePending(),
      StorePurchaseFailed(:final message, :final code) => PurchaseError(
        message: message,
        code: code,
      ),
    };
  }

  @override
  Future<RestoreResult> restorePurchases() async {
    await initialize();
    final transactions = await gateway.restore();
    if (transactions.isEmpty) return const RestoreNoPurchases();
    final credits = transactions.fold<int>(
      0,
      (sum, transaction) => sum + transaction.packType.keys,
    );
    return RestoreSuccess(creditsRestored: credits, transactions: transactions);
  }

  @override
  Future<bool> isProductAvailable(String productId) async {
    await initialize();
    return gateway.isAvailable(productId);
  }
}

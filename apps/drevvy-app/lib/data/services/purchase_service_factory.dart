import '../../core/config/api_config_exception.dart';
import 'purchase_config.dart';
import 'purchase_service.dart';
import 'purchases_flutter_store.dart';
import 'revenue_cat_purchase_service.dart';
import 'store_gateway.dart';

/// Demo stays on [FakePurchaseService]. Live purchases run only for a
/// RevenueCat Test Store key (`test_`) plus an API origin. A public
/// `appl_` or `goog_` key does not open the store.
PurchaseService buildPurchaseService(
  PurchaseConfig config, {
  StoreGateway? gateway,
}) {
  if (!config.isLive) return FakePurchaseService();
  if (config.sandboxPurchasesEnabled) {
    return RevenueCatPurchaseService(
      gateway: gateway ?? PurchasesFlutterStore(config),
    );
  }
  if (config.hasTestStoreKey) {
    return const UnavailablePurchaseService(message: apiNotConfiguredMessage);
  }
  if (config.usesRevenueCat) {
    return const UnavailablePurchaseService(
      message: platformKeyNotSandboxMessage,
    );
  }
  return const UnavailablePurchaseService();
}

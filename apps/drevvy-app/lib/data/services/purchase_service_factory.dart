import 'purchase_config.dart';
import 'purchase_service.dart';
import 'purchases_flutter_store.dart';
import 'revenue_cat_purchase_service.dart';
import 'store_gateway.dart';

/// Demo service until the current platform has a public RevenueCat SDK key.
PurchaseService buildPurchaseService(
  PurchaseConfig config, {
  StoreGateway? gateway,
}) {
  if (!config.usesRevenueCat) {
    return FakePurchaseService();
  }
  return RevenueCatPurchaseService(
    gateway: gateway ?? PurchasesFlutterStore(config),
  );
}

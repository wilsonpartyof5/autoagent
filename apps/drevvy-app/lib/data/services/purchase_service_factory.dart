import 'package:flutter/foundation.dart';

import '../../core/config/api_config_exception.dart';
import 'purchase_config.dart';
import 'purchase_service.dart';
import 'purchases_flutter_store.dart';
import 'revenue_cat_purchase_service.dart';
import 'store_gateway.dart';

/// Demo stays on [FakePurchaseService]. Live purchases run when this build
/// accepts the platform RevenueCat key and an API origin is set.
///
/// Debug accepts `test_`. Release and profile accept an iOS `appl_` key.
/// A missing key or a wrong prefix leaves purchases unavailable.
PurchaseService buildPurchaseService(
  PurchaseConfig config, {
  StoreGateway? gateway,
}) {
  if (!config.isLive) return FakePurchaseService();
  if (config.storePurchasesEnabled) {
    return RevenueCatPurchaseService(
      gateway: gateway ?? PurchasesFlutterStore(config),
    );
  }
  final key = config.revenueCatApiKeyFor(defaultTargetPlatform);
  if (key != null && config.apiBaseUrl.trim().isEmpty) {
    return const UnavailablePurchaseService(message: apiNotConfiguredMessage);
  }
  if (key != null) {
    return const UnavailablePurchaseService(
      message: platformKeyNotSandboxMessage,
    );
  }
  return const UnavailablePurchaseService();
}

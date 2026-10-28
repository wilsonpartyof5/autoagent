import 'package:flutter/foundation.dart';
import 'package:superwallkit_flutter/superwallkit_flutter.dart';

import '../repositories/demo_repository.dart';
import 'purchase_config.dart';
import 'purchases_flutter_store.dart';
import 'revenue_cat_identity.dart';
import 'shopper_session_store.dart';
import 'superwall_purchase_controller.dart';

/// Configures Superwall, then RevenueCat, when public SDK keys exist.
///
/// With no keys this is a no-op and the app stays on the demo purchase service.
class PurchaseBootstrap {
  static Future<void> start(PurchaseConfig config) async {
    ShopperSessionStore.instance.identity = RevenueCatIdentity(config: config);
    if (config.usesSuperwall) {
      await _startSuperwall(config);
    }
    if (config.usesRevenueCat) {
      await PurchasesFlutterStore(config).configure();
    }
  }

  static Future<void> _startSuperwall(PurchaseConfig config) async {
    final apiKey = config.superwallApiKeyFor(defaultTargetPlatform);
    if (apiKey == null) return;

    final controller = config.usesRevenueCat
        ? SuperwallPackPurchaseController(
            purchase: DemoRepository.instance.purchasePack,
            restore: DemoRepository.instance.restorePurchases,
          )
        : null;

    Superwall.configure(apiKey, purchaseController: controller);
    try {
      // Key packs are consumables, not a subscription. Leave Superwall
      // inactive so `cars_balance_empty` can still present.
      await Superwall.shared.setSubscriptionStatus(SubscriptionStatus.inactive);
    } on Exception catch (error) {
      debugPrint('Superwall subscription status skipped: $error');
    }
  }
}

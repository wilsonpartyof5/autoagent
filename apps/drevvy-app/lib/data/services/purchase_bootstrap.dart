import 'package:flutter/foundation.dart';
import 'package:superwallkit_flutter/superwallkit_flutter.dart';

import '../repositories/demo_repository.dart';
import 'purchase_config.dart';
import 'purchases_flutter_store.dart';
import 'revenue_cat_identity.dart';
import 'shopper_session_store.dart';
import 'superwall_purchase_controller.dart';

/// Configures Purchases when [PurchaseConfig.storePurchasesEnabled] is true.
///
/// Debug configures a Test Store key (`test_`). Release and profile,
/// including TestFlight, configure the iOS public SDK key (`appl_`). A
/// missing or rejected key is left unconfigured. Demo mode does not
/// configure the store either.
class PurchaseBootstrap {
  static Future<void> start(PurchaseConfig config) async {
    ShopperSessionStore.instance.identity = RevenueCatIdentity(config: config);
    if (!config.storePurchasesEnabled) return;
    if (config.usesSuperwall) {
      await _startSuperwall(config);
    }
    await PurchasesFlutterStore(config).configure();
  }

  static Future<void> _startSuperwall(PurchaseConfig config) async {
    final apiKey = config.superwallApiKeyFor(defaultTargetPlatform);
    if (apiKey == null) return;

    final controller = SuperwallPackPurchaseController(
      purchase: DemoRepository.instance.purchasePack,
      restore: DemoRepository.instance.restorePurchases,
    );

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

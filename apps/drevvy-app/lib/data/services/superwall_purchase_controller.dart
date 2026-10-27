import 'package:superwallkit_flutter/superwallkit_flutter.dart';

import '../models/car_pack.dart';
import 'purchase_service.dart' as packs;

/// Completes Superwall paywall purchases through the app purchase service
/// so a successful pack still hits the credits endpoint or the local balance.
class SuperwallPackPurchaseController extends PurchaseController {
  SuperwallPackPurchaseController({
    required this.purchase,
    required this.restore,
  });

  final Future<packs.PurchaseResult> Function(CarPackType packType) purchase;
  final Future<packs.RestoreResult> Function() restore;

  @override
  Future<PurchaseResult> purchaseFromAppStore(String productId) {
    return _buy(productId);
  }

  @override
  Future<PurchaseResult> purchaseFromGooglePlay(
    String productId,
    String? basePlanId,
    String? offerId,
  ) {
    return _buy(productId);
  }

  @override
  Future<RestorationResult> restorePurchases() async {
    final result = await restore();
    if (result is packs.RestoreError) {
      return RestorationResult.failed(result.message);
    }
    return RestorationResult.restored;
  }

  Future<PurchaseResult> _buy(String productId) async {
    final pack = CarPackType.fromProductId(productId);
    if (pack == null) {
      return PurchaseResult.failed('Unknown key pack $productId');
    }
    final result = await purchase(pack);
    return switch (result) {
      packs.PurchaseSuccess() => PurchaseResult.purchased,
      packs.PurchaseCancelled() => PurchaseResult.cancelled,
      packs.PurchasePending() => PurchaseResult.pending,
      packs.PurchaseError(:final message) => PurchaseResult.failed(message),
    };
  }
}

import 'package:flutter/foundation.dart';

import 'purchase_config.dart';
import 'purchases_flutter_store.dart';
import 'store_gateway.dart';

/// Keeps the RevenueCat app user id equal to the Supabase user id.
class RevenueCatIdentity {
  RevenueCatIdentity({required this.config, StoreGateway? gateway})
    : _gateway = gateway ?? PurchasesFlutterStore(config);

  final PurchaseConfig config;
  final StoreGateway _gateway;

  /// Called after the shopper signs in. [supabaseUserId] becomes `Purchases.logIn`.
  ///
  /// Identity login configures the SDK, so it runs only for a Test Store key.
  Future<void> onSignedIn(String supabaseUserId) async {
    if (!config.sandboxPurchasesEnabled) return;
    final appUserId = supabaseUserId.trim();
    if (appUserId.isEmpty) return;
    try {
      await _gateway.configure();
      await _gateway.logIn(appUserId);
    } on Exception catch (error) {
      debugPrint('RevenueCat logIn skipped: $error');
    }
  }

  /// Called when the shopper signs out.
  Future<void> onSignedOut() async {
    if (!config.sandboxPurchasesEnabled) return;
    try {
      await _gateway.logOut();
    } on Exception catch (error) {
      debugPrint('RevenueCat logOut skipped: $error');
    }
  }
}

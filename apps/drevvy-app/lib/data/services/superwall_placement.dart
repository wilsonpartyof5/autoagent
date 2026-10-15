import 'dart:async';

import 'package:superwallkit_flutter/superwallkit_flutter.dart';

import 'cars_balance_placement.dart';
import 'packs_offering.dart';
import 'purchase_config.dart';

/// Local sheet until a Superwall key exists.
///
/// [placementName] defaults to [unlockMyPricePlacement], the placement
/// registered when Unlock my price is tapped at a zero balance. Pass
/// [CarsBalancePlacement.name] for the older empty-balance campaign.
CarsBalancePlacement carsBalancePlacementFor(
  PurchaseConfig config, {
  String placementName = unlockMyPricePlacement,
}) {
  if (!config.usesSuperwall) return const LocalCarsBalancePlacement();
  return SuperwallCarsBalancePlacement(placementName: placementName);
}

/// Registers [placementName] when Superwall is configured.
///
/// If Superwall has no campaign for the placement, the local pack sheet is
/// presented so the dollar prices stay in the app.
class SuperwallCarsBalancePlacement implements CarsBalancePlacement {
  SuperwallCarsBalancePlacement({this.placementName = unlockMyPricePlacement});

  final String placementName;

  @override
  Future<void> register({
    required void Function() presentLocalPaywall,
    Future<void> Function()? onPurchased,
  }) async {
    var showedLocal = false;
    var presented = false;
    var continued = false;

    void showLocal() {
      if (showedLocal || presented) return;
      showedLocal = true;
      presentLocalPaywall();
    }

    Future<void> continueAfterPurchase() async {
      if (continued) return;
      continued = true;
      await onPurchased?.call();
    }

    final handler = PaywallPresentationHandler()
      ..onPresent((_) => presented = true)
      ..onSkip((_) => showLocal())
      ..onError((_) => showLocal())
      ..onDismiss((_, result) async {
        if (result is PurchasedPaywallResult ||
            result is RestoredPaywallResult) {
          await continueAfterPurchase();
        }
      });

    try {
      await Superwall.shared.registerPlacement(
        placementName,
        handler: handler,
        feature: () {
          if (presented) {
            unawaited(continueAfterPurchase());
          } else {
            showLocal();
          }
        },
      );
    } on Exception {
      showLocal();
    }
  }
}

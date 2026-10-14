import 'dart:async';

import 'package:superwallkit_flutter/superwallkit_flutter.dart';

import 'cars_balance_placement.dart';
import 'purchase_config.dart';

/// Local sheet until a Superwall key exists, then placement `cars_balance_empty`.
CarsBalancePlacement carsBalancePlacementFor(PurchaseConfig config) {
  if (!config.usesSuperwall) return const LocalCarsBalancePlacement();
  return SuperwallCarsBalancePlacement();
}

/// Registers [CarsBalancePlacement.name] when Superwall is configured.
///
/// If Superwall has no campaign for the placement, the local Out of cars
/// sheet is presented so the pack copy stays in the app.
class SuperwallCarsBalancePlacement implements CarsBalancePlacement {
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
        if (result is PurchasedPaywallResult || result is RestoredPaywallResult) {
          await continueAfterPurchase();
        }
      });

    try {
      await Superwall.shared.registerPlacement(
        CarsBalancePlacement.name,
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

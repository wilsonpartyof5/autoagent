import 'dart:async';

import 'package:superwallkit_flutter/superwallkit_flutter.dart';

import 'cars_balance_placement.dart';
import 'purchase_config.dart';

/// Superwall placement for the first-run paywall. The local screen is the fallback.
const onboardingPaywallPlacementName = 'onboarding_paywall';

/// Local sheet until a Superwall key exists, then placement `cars_balance_empty`.
CarsBalancePlacement carsBalancePlacementFor(PurchaseConfig config) {
  if (!config.usesSuperwall) return const LocalCarsBalancePlacement();
  return SuperwallCarsBalancePlacement();
}

/// First-run paywall. With no Superwall key the Flutter paywall stays on screen.
CarsBalancePlacement onboardingPaywallPlacementFor(PurchaseConfig config) {
  if (!config.usesSuperwall) return const LocalCarsBalancePlacement();
  return SuperwallCarsBalancePlacement(placementName: onboardingPaywallPlacementName);
}

/// Registers [CarsBalancePlacement.name] when Superwall is configured.
///
/// If Superwall has no campaign for the placement, the local Out of cars
/// sheet is presented so the pack copy stays in the app.
class SuperwallCarsBalancePlacement implements CarsBalancePlacement {
  SuperwallCarsBalancePlacement({this.placementName = CarsBalancePlacement.name});

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
        if (result is PurchasedPaywallResult || result is RestoredPaywallResult) {
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

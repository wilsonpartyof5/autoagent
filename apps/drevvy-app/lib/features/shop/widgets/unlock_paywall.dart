import 'dart:async';

import 'package:flutter/material.dart';

import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../../../data/services/cars_balance_placement.dart';
import '../../../data/services/purchase_config.dart';
import '../../../data/services/purchase_service.dart';
import '../../../data/services/superwall_placement.dart';
import 'out_of_cars_sheet.dart';
import 'pack_picker_sheet.dart';

/// Opens the car-pack paywall when [balance] is 0.
///
/// Superwall placement `cars_balance_empty` drives the screen when a key
/// exists. With no key, the local pack picker (first purchase) or out-of-cars
/// sheet (a later purchase) runs so the simulator can buy a demo pack.
Future<void> showUnlockPaywall({
  required BuildContext context,
  required Listing listing,
  required CarCreditBalance balance,
  required DemoRepository repo,
  AvgSavingsConfig? avgSavings,
  CarsBalancePlacement? placement,
  required Future<void> Function(CarCreditBalance balance) onCanUnlock,
}) async {
  if (balance.canUnlock) {
    await onCanUnlock(balance);
    return;
  }

  final gate =
      placement ?? carsBalancePlacementFor(PurchaseConfig.fromEnvironment());

  Future<void> continueIfFunded() async {
    final next = await repo.getCreditBalance();
    if (!context.mounted || !next.canUnlock) return;
    await onCanUnlock(next);
  }

  void showMessage(String message) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  await gate.register(
    presentLocalPaywall: () {
      if (!context.mounted) return;
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (sheetContext) {
          Future<void> purchase(CarPackType pack) async {
            final result = await repo.purchasePack(pack);
            if (!sheetContext.mounted) return;
            if (result is PurchaseSuccess) {
              Navigator.pop(sheetContext);
              await continueIfFunded();
              return;
            }
            final message = switch (result) {
              PurchasePending() =>
                'Payment is pending. Cars are added when it completes.',
              PurchaseError(:final message) => message,
              PurchaseCancelled() => null,
              PurchaseSuccess() => null,
            };
            if (message != null) showMessage(message);
          }

          Future<void> restore() async {
            final result = await repo.restorePurchases();
            if (!sheetContext.mounted) return;
            Navigator.pop(sheetContext);
            final message = switch (result) {
              RestoreSuccess(:final creditsRestored) when creditsRestored > 0 =>
                creditsRestored == 1
                    ? 'Restored 1 car.'
                    : 'Restored $creditsRestored cars.',
              RestoreSuccess() => 'Purchases restored.',
              RestoreNoPurchases() => 'No purchases to restore.',
              RestoreError(:final message) => message,
            };
            showMessage(message);
            await continueIfFunded();
          }

          if (balance.totalPurchased == 0) {
            return PackPickerSheet(
              listing: listing,
              avgSavings: avgSavings,
              onPurchase: purchase,
              onRestore: () => unawaited(restore()),
              onKeepShopping: () => Navigator.pop(sheetContext),
            );
          }
          return OutOfCarsSheet(
            listing: listing,
            onPurchase: purchase,
            onNotNow: () => Navigator.pop(sheetContext),
          );
        },
      );
    },
    onPurchased: continueIfFunded,
  );
}

import 'package:flutter/material.dart';

import '../../../core/config/api_config_exception.dart';
import '../../../data/models/models.dart';
import '../../../data/repositories/demo_repository.dart';
import '../../../data/services/purchase_service.dart';
import '../car_unlock.dart';
import 'out_of_cars_sheet.dart';
import 'pack_picker_sheet.dart';

/// Opens the existing key-pack sheet. Purchase and restore stay on
/// [DemoRepository.purchasePack] and [DemoRepository.restorePurchases].
Future<void> showGetMoreKeys(
  BuildContext context, {
  DemoRepository? repository,
}) async {
  final repo = repository ?? DemoRepository.instance;
  final CarCreditBalance balance;
  try {
    balance = await repo.getCreditBalance();
  } on ApiConfigException catch (error) {
    if (!context.mounted) return;
    _keysMessage(context, error.message);
    return;
  } catch (_) {
    if (!context.mounted) return;
    _keysMessage(context, 'Keys are not available right now.');
    return;
  }
  if (!context.mounted) return;

  final host = context;
  final outOfCars = carUnlockGate(balance) == CarUnlockGate.outOfCars;
  await showModalBottomSheet<void>(
    context: host,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) {
      if (outOfCars) {
        return OutOfCarsSheet(
          placement: 'keys_pill',
          onPurchase: (packType) => _buyPack(sheetContext, host, repo, packType),
          onNotNow: () => Navigator.pop(sheetContext),
        );
      }
      return PackPickerSheet(
        placement: 'keys_pill',
        onPurchase: (packType) => _buyPack(sheetContext, host, repo, packType),
        onRestore: () async {
          try {
            final result = await repo.restorePurchases();
            if (!host.mounted) return;
            if (sheetContext.mounted) Navigator.pop(sheetContext);
            _keysMessage(
              host,
              restoreResultMessage(result, demo: !repo.isLive),
            );
          } catch (error) {
            if (!host.mounted) return;
            _keysMessage(host, _restoreFailure(error));
          }
        },
        onKeepShopping: () => Navigator.pop(sheetContext),
      );
    },
  );
}

Future<void> _buyPack(
  BuildContext sheetContext,
  BuildContext host,
  DemoRepository repo,
  CarPackType packType,
) async {
  try {
    final result = await repo.purchasePack(packType);
    if (!host.mounted) return;
    if (result is PurchaseSuccess) {
      if (sheetContext.mounted) Navigator.pop(sheetContext);
      _keysMessage(
        host,
        keysAddedMessage(added: result.creditsAdded, demo: !repo.isLive),
      );
      return;
    }
    if (result is PurchasePending) {
      _keysMessage(
        host,
        'Payment is pending. Keys are added when it completes.',
      );
      return;
    }
    if (result is PurchaseError) {
      _keysMessage(host, result.message);
    }
  } on ApiConfigException catch (error) {
    if (!host.mounted) return;
    _keysMessage(host, error.message);
  } catch (_) {
    if (!host.mounted) return;
    _keysMessage(host, 'The key pack did not go through.');
  }
}

String _restoreFailure(Object error) {
  if (error is ApiConfigException) return error.message;
  return 'Purchases were not restored.';
}

void _keysMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

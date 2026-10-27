import 'package:flutter_test/flutter_test.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/money_format.dart';
import 'package:drevvy_app/data/services/purchase_service.dart';

void main() {
  group('CarPackType', () {
    test('pack prices and keys are correct', () {
      expect(CarPackType.single.keys, 1);
      expect(CarPackType.single.priceUsd, 4.99);
      expect(CarPackType.single.productId, 'drevvy_keys_1');
      expect(CarPackType.single.packageId, 'keys_1');
      expect(CarPackType.single.carsGranted, 1);
      expect(CarPackType.packMix, '1,5,10,25');

      expect(CarPackType.starter.keys, 5);
      expect(CarPackType.starter.priceUsd, 19.99);
      expect(CarPackType.starter.productId, 'drevvy_keys_5');
      expect(CarPackType.starter.packageId, 'keys_5');

      expect(CarPackType.bestValue.keys, 10);
      expect(CarPackType.bestValue.priceUsd, 34.99);
      expect(CarPackType.bestValue.productId, 'drevvy_keys_10');
      expect(CarPackType.bestValue.packageId, 'keys_10');

      expect(CarPackType.plus.keys, 25);
      expect(CarPackType.plus.priceUsd, 74.99);
      expect(CarPackType.plus.productId, 'drevvy_keys_25');
      expect(CarPackType.plus.packageId, 'keys_25');
    });

    test('per-key cost is calculated correctly', () {
      expect(CarPackType.single.perKeyCost, closeTo(4.99, 0.01));
      expect(CarPackType.starter.perKeyCost, closeTo(3.998, 0.01));
      expect(CarPackType.bestValue.perKeyCost, closeTo(3.499, 0.01));
      expect(CarPackType.plus.perKeyCost, closeTo(2.9996, 0.01));
    });

    test('per-key formatted string is correct', () {
      expect(CarPackType.single.perKeyFormatted, r'$4.99');
      expect(CarPackType.starter.perKeyFormatted, r'$4.00');
      expect(CarPackType.bestValue.perKeyFormatted, r'$3.50');
      expect(CarPackType.plus.perKeyFormatted, r'$3.00');
    });

    test('savings vs the 1-key price round to one decimal', () {
      expect(CarPackType.single.savingsPercentVsSingle, isNull);
      expect(CarPackType.single.savingsText, isNull);

      expect(
        CarPackType.starter.savingsPercentVsSingle,
        closeTo(19.88, 0.05),
      );
      expect(CarPackType.starter.savingsText, 'Save 19.9%/key');

      expect(
        CarPackType.bestValue.savingsPercentVsSingle,
        closeTo(29.88, 0.05),
      );
      expect(CarPackType.bestValue.savingsText, 'Save 29.9%/key');

      expect(CarPackType.plus.savingsPercentVsSingle, closeTo(39.89, 0.05));
      expect(CarPackType.plus.savingsText, 'Save 39.9%/key');
    });

    test('prices use dollar format', () {
      expect(formatUsd(4.99), r'$4.99');
      expect(formatUsd(19.99), r'$19.99');
      expect(CarPackType.single.priceFormatted, r'$4.99');
      expect(CarPackType.starter.priceFormatted, r'$19.99');
      expect(CarPackType.bestValue.priceFormatted, r'$34.99');
      expect(CarPackType.plus.priceFormatted, r'$74.99');
    });

    test('CTA text is formatted correctly', () {
      expect(CarPackType.single.ctaText, 'Get 1 key for \$4.99');
      expect(CarPackType.starter.ctaText, 'Get 5 keys for \$19.99');
      expect(CarPackType.bestValue.ctaText, 'Get 10 keys for \$34.99');
      expect(CarPackType.plus.ctaText, 'Get 25 keys for \$74.99');
    });

    test('display names are correct', () {
      expect(CarPackType.single.displayName, 'Single');
      expect(CarPackType.single.keysLabel, '1 key');
      expect(CarPackType.starter.displayName, 'Starter');
      expect(CarPackType.bestValue.displayName, 'Recommended');
      expect(CarPackType.plus.displayName, 'Plus');
    });

    test('product ids map back to packs', () {
      expect(CarPackType.fromProductId('drevvy_keys_1'), CarPackType.single);
      expect(CarPackType.fromProductId('keys_1'), CarPackType.single);
      expect(CarPackType.fromProductId('keys_10'), CarPackType.bestValue);
      expect(CarPackType.fromProductId('drevvy_keys_5'), CarPackType.starter);
      expect(CarPackType.fromProductId('drevvy_keys_25'), CarPackType.plus);
      expect(
        CarPackType.fromProductId('drevvy_keys_10'),
        CarPackType.bestValue,
      );
      expect(CarPackType.fromProductId('unknown'), isNull);
    });
  });

  group('KeySpend', () {
    test('locked product rules stay in shopper copy', () {
      expect(KeySpend.otdRequestNote.toLowerCase(), contains('free'));
      expect(KeySpend.otdRequestNote.toLowerCase(), contains('not a chat'));
      expect(KeySpend.otdRequestNote.toLowerCase(), isNot(contains('talk to dealer')));
      expect(KeySpend.conversationNote.toLowerCase(), contains('onboarded rooftop'));
      expect(KeySpend.conversationNote.toLowerCase(), contains('first name'));
      expect(KeySpend.refundClockNote.toLowerCase(), contains('confirmed delivery'));
      expect(KeySpend.dealerCloseFeeUsd, 300);
      expect(KeySpend.dealerCloseNote, contains(r'$300'));
      expect(KeySpend.dealerCloseNote.toLowerCase(), contains('dealer pays'));
      expect(KeySpend.unlockCopy.toLowerCase(), isNot(contains('negotiat')));
    });
  });

  group('CarCreditBalance', () {
    test('empty balance has correct values', () {
      const balance = CarCreditBalance.empty();
      expect(balance.balance, 0);
      expect(balance.totalPurchased, 0);
      expect(balance.totalSpent, 0);
      expect(balance.totalRefunded, 0);
      expect(balance.canUnlock, false);
      expect(balance.isEmpty, true);
    });

    test('balance with credits can unlock', () {
      const balance = CarCreditBalance.withBalance(5);
      expect(balance.balance, 5);
      expect(balance.canUnlock, true);
      expect(balance.isEmpty, false);
    });

    test('display text formats correctly', () {
      const balance1 = CarCreditBalance.withBalance(1);
      expect(balance1.displayText, '1 key left');

      const balance5 = CarCreditBalance.withBalance(5);
      expect(balance5.displayText, '5 keys left');

      const balance0 = CarCreditBalance.empty();
      expect(balance0.displayText, '0 keys left');
    });

    test('useText is the two-spend line', () {
      const balance = CarCreditBalance.withBalance(10);
      expect(balance.useText, 'Market + save 1 key · Chat 1 key');
    });

    test('copyWith works correctly', () {
      const original = CarCreditBalance(
        balance: 5,
        totalPurchased: 10,
        totalSpent: 3,
        totalRefunded: 2,
      );

      final updated = original.copyWith(balance: 4);
      expect(updated.balance, 4);
      expect(updated.totalPurchased, 10);
      expect(updated.totalSpent, 3);
      expect(updated.totalRefunded, 2);
    });
  });

  group('CreditLedgerEntry', () {
    test('purchase entry has correct structure', () {
      final entry = CreditLedgerEntry(
        id: 'ledger_001',
        userId: 'user_001',
        delta: 10,
        reason: CreditReason.purchase,
        createdAt: DateTime(2026, 10, 14),
        packType: CarPackType.bestValue,
      );

      expect(entry.delta, 10);
      expect(entry.reason, CreditReason.purchase);
      expect(entry.packType, CarPackType.bestValue);
      expect(entry.dealId, isNull);
    });

    test('unlock entry has negative delta', () {
      final entry = CreditLedgerEntry(
        id: 'ledger_002',
        userId: 'user_001',
        delta: -1,
        reason: CreditReason.unlock,
        createdAt: DateTime(2026, 10, 14),
        dealId: 'deal_001',
      );

      expect(entry.delta, -1);
      expect(entry.reason, CreditReason.unlock);
      expect(entry.dealId, 'deal_001');
    });

    test('refund entries have positive delta', () {
      final refundReasons = [
        CreditReason.refundNoResponse,
        CreditReason.refundNoLongerListed,
        CreditReason.refundDealerDecline,
        CreditReason.refundEarlyRemoval,
      ];

      for (final reason in refundReasons) {
        final entry = CreditLedgerEntry(
          id: 'ledger_${reason.index}',
          userId: 'user_001',
          delta: 1,
          reason: reason,
          createdAt: DateTime(2026, 10, 14),
          dealId: 'deal_001',
        );

        expect(entry.delta, 1, reason: 'Refund $reason should have delta +1');
      }
    });
  });

  group('FakePurchaseService', () {
    test('purchase returns success with correct credits', () async {
      int creditsAdded = 0;
      CarPackType? purchasedPack;

      final service = FakePurchaseService(
        simulateDelay: Duration.zero,
        onPurchaseComplete: (pack, credits) {
          purchasedPack = pack;
          creditsAdded = credits;
        },
      );

      await service.initialize();
      final result = await service.purchasePack(CarPackType.bestValue);

      expect(result, isA<PurchaseSuccess>());
      final success = result as PurchaseSuccess;
      expect(success.packType, CarPackType.bestValue);
      expect(success.creditsAdded, 10);
      expect(success.transactionId, isNotEmpty);

      expect(purchasedPack, CarPackType.bestValue);
      expect(creditsAdded, 10);
    });

    test('offerings returns all four packs', () async {
      final service = FakePurchaseService(simulateDelay: Duration.zero);
      await service.initialize();

      final offerings = await service.getOfferings();
      expect(offerings, isNotNull);
      expect(offerings!.length, 4);

      expect(offerings[0].packType, CarPackType.single);
      expect(offerings[0].priceAmount, 4.99);

      expect(offerings[1].packType, CarPackType.starter);
      expect(offerings[1].priceAmount, 19.99);

      expect(offerings[2].packType, CarPackType.bestValue);
      expect(offerings[2].priceAmount, 34.99);

      expect(offerings[3].packType, CarPackType.plus);
      expect(offerings[3].priceAmount, 74.99);
    });

    test('restore purchases returns no purchases in demo', () async {
      final service = FakePurchaseService(simulateDelay: Duration.zero);
      final result = await service.restorePurchases();
      expect(result, isA<RestoreNoPurchases>());
    });

    test('isProductAvailable returns true for valid products', () async {
      final service = FakePurchaseService(simulateDelay: Duration.zero);

      expect(await service.isProductAvailable('drevvy_keys_1'), true);
      expect(await service.isProductAvailable('drevvy_keys_5'), true);
      expect(await service.isProductAvailable('drevvy_keys_10'), true);
      expect(await service.isProductAvailable('drevvy_keys_25'), true);
      expect(await service.isProductAvailable('invalid_product'), false);
    });
  });

  group('AvgSavingsConfig', () {
    test('demo config has correct structure', () {
      const config = AvgSavingsConfig(
        value: '3–5%',
        label: 'Buyers who compare out-the-door quotes...',
        source: 'CarEdge, State of Dealer Fees 2026',
        kind: 'market',
      );

      expect(config.value, '3–5%');
      expect(config.kind, 'market');
    });
  });
}

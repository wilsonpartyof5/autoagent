import 'package:flutter_test/flutter_test.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/models/money_format.dart';
import 'package:drevvy_app/data/services/purchase_service.dart';

void main() {
  group('CarPackType', () {
    test('pack prices and cars are correct', () {
      expect(CarPackType.single.cars, 1);
      expect(CarPackType.single.priceUsd, 27);
      expect(CarPackType.single.productId, 'drevvy_pack_1');
      expect(CarPackType.single.packageId, 'pack_1');
      expect(CarPackType.single.carsGranted, 1);
      expect(CarPackType.packMix, '1,3,5,10');

      expect(CarPackType.starter.cars, 3);
      expect(CarPackType.starter.priceUsd, 47);
      expect(CarPackType.starter.productId, 'drevvy_pack_3');
      expect(CarPackType.starter.packageId, 'pack_3');

      expect(CarPackType.plus.cars, 5);
      expect(CarPackType.plus.priceUsd, 67);
      expect(CarPackType.plus.productId, 'drevvy_pack_5');
      expect(CarPackType.plus.packageId, 'pack_5');

      expect(CarPackType.bestValue.cars, 10);
      expect(CarPackType.bestValue.priceUsd, 97);
      expect(CarPackType.bestValue.productId, 'drevvy_pack_10');
      expect(CarPackType.bestValue.packageId, 'pack_10');
    });

    test('per-car cost is calculated correctly', () {
      // Single: $27 / 1 = $27.00
      expect(CarPackType.single.perCarCost, closeTo(27.00, 0.01));

      // Starter: $47 / 3 = $15.67
      expect(CarPackType.starter.perCarCost, closeTo(15.67, 0.01));

      // Plus: $67 / 5 = $13.40
      expect(CarPackType.plus.perCarCost, closeTo(13.40, 0.01));

      // Best Value: $97 / 10 = $9.70
      expect(CarPackType.bestValue.perCarCost, closeTo(9.70, 0.01));
    });

    test('per-car formatted string is correct', () {
      expect(CarPackType.single.perCarFormatted, r'$27.00');
      expect(CarPackType.starter.perCarFormatted, r'$15.67');
      expect(CarPackType.plus.perCarFormatted, r'$13.40');
      expect(CarPackType.bestValue.perCarFormatted, r'$9.70');
    });

    test('savings vs the 1-car price round to one decimal', () {
      expect(CarPackType.single.savingsPercentVsSingle, isNull);
      expect(CarPackType.single.savingsText, isNull);

      // (27 - 47/3) / 27 = 42.0%
      expect(
        CarPackType.starter.savingsPercentVsSingle,
        closeTo(41.975, 0.001),
      );
      expect(CarPackType.starter.savingsText, 'Save 42.0%/car');

      // (27 - 67/5) / 27 = 50.4%
      expect(CarPackType.plus.savingsPercentVsSingle, closeTo(50.370, 0.001));
      expect(CarPackType.plus.savingsText, 'Save 50.4%/car');

      // (27 - 9.70) / 27 = 64.1%
      expect(
        CarPackType.bestValue.savingsPercentVsSingle,
        closeTo(64.074, 0.001),
      );
      expect(CarPackType.bestValue.savingsText, 'Save 64.1%/car');
    });

    test('prices use dollar format', () {
      expect(formatUsd(47), r'$47');
      expect(formatUsd(97), r'$97');
      expect(formatUsd(9.7, cents: true), r'$9.70');
      expect(CarPackType.single.priceFormatted, r'$27');
      expect(CarPackType.starter.priceFormatted, r'$47');
      expect(CarPackType.plus.priceFormatted, r'$67');
      expect(CarPackType.bestValue.priceFormatted, r'$97');
    });

    test('CTA text is formatted correctly', () {
      expect(CarPackType.single.ctaText, 'Get 1 car for \$27');
      expect(CarPackType.starter.ctaText, 'Get 3 cars for \$47');
      expect(CarPackType.plus.ctaText, 'Get 5 cars for \$67');
      expect(CarPackType.bestValue.ctaText, 'Get 10 cars for \$97');
    });

    test('display names are correct', () {
      expect(CarPackType.single.displayName, 'Single');
      expect(CarPackType.single.carsLabel, '1 car');
      expect(CarPackType.starter.displayName, 'Starter');
      expect(CarPackType.plus.displayName, 'Plus');
      expect(CarPackType.bestValue.displayName, 'Best Value');
    });

    test('product ids map back to packs', () {
      expect(CarPackType.fromProductId('drevvy_pack_1'), CarPackType.single);
      expect(CarPackType.fromProductId('pack_1'), CarPackType.single);
      expect(CarPackType.fromProductId('pack_10'), CarPackType.bestValue);
      expect(CarPackType.fromProductId('drevvy_pack_3'), CarPackType.starter);
      expect(CarPackType.fromProductId('drevvy_pack_5'), CarPackType.plus);
      expect(
        CarPackType.fromProductId('drevvy_pack_10'),
        CarPackType.bestValue,
      );
      expect(CarPackType.fromProductId('unknown'), isNull);
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
      expect(balance1.displayText, '1 car left');

      const balance5 = CarCreditBalance.withBalance(5);
      expect(balance5.displayText, '5 cars left');

      const balance0 = CarCreditBalance.empty();
      expect(balance0.displayText, '0 cars left');
    });

    test('useText is consistent', () {
      const balance = CarCreditBalance.withBalance(10);
      expect(balance.useText, 'Uses 1 car');
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
      expect(offerings[0].priceAmount, 27.0);

      expect(offerings[1].packType, CarPackType.starter);
      expect(offerings[1].priceAmount, 47.0);

      expect(offerings[2].packType, CarPackType.plus);
      expect(offerings[2].priceAmount, 67.0);

      expect(offerings[3].packType, CarPackType.bestValue);
      expect(offerings[3].priceAmount, 97.0);
    });

    test('restore purchases returns no purchases in demo', () async {
      final service = FakePurchaseService(simulateDelay: Duration.zero);
      final result = await service.restorePurchases();
      expect(result, isA<RestoreNoPurchases>());
    });

    test('isProductAvailable returns true for valid products', () async {
      final service = FakePurchaseService(simulateDelay: Duration.zero);

      expect(await service.isProductAvailable('drevvy_pack_1'), true);
      expect(await service.isProductAvailable('drevvy_pack_3'), true);
      expect(await service.isProductAvailable('drevvy_pack_5'), true);
      expect(await service.isProductAvailable('drevvy_pack_10'), true);
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

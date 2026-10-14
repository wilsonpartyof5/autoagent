import 'package:flutter_test/flutter_test.dart';
import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';

void main() {
  group('DemoRepository Credit Balance', () {
    late DemoRepository repo;

    setUp(() {
      repo = DemoRepository.instance;
    });

    test('initial balance is 6 credits (demo)', () async {
      final balance = await repo.getCreditBalance();
      expect(balance.balance, 6);
      expect(balance.canUnlock, true);
    });

    test('spending a credit decreases balance', () async {
      final beforeBalance = await repo.getCreditBalance();
      final beforeValue = beforeBalance.balance;

      final success = repo.spendCredit('test_deal_001');
      expect(success, true);

      final afterBalance = await repo.getCreditBalance();
      expect(afterBalance.balance, beforeValue - 1);
      expect(afterBalance.totalSpent, beforeBalance.totalSpent + 1);
    });

    test('refunding a credit increases balance', () async {
      final beforeBalance = await repo.getCreditBalance();
      final beforeValue = beforeBalance.balance;

      final success = repo.refundCredit('test_deal_002', CreditReason.refundNoResponse);
      expect(success, true);

      final afterBalance = await repo.getCreditBalance();
      expect(afterBalance.balance, beforeValue + 1);
      expect(afterBalance.totalRefunded, beforeBalance.totalRefunded + 1);
    });

    test('cannot spend when balance is empty', () async {
      final balance = await repo.getCreditBalance();
      final currentBalance = balance.balance;

      // Spend all remaining credits
      for (var i = 0; i < currentBalance; i++) {
        repo.spendCredit('drain_deal_$i');
      }

      // Now balance should be 0
      final emptyBalance = await repo.getCreditBalance();
      expect(emptyBalance.balance, 0);
      expect(emptyBalance.canUnlock, false);

      // Attempting to spend should fail
      final success = repo.spendCredit('should_fail_deal');
      expect(success, false);
    });

    test('DealStats uses credit balance instead of monthly usage', () async {
      final stats = await repo.getDealStats();
      
      // Should have carsRemaining from credit balance, not old usage
      expect(stats.carsRemaining, isNonNegative);
      expect(stats.carsRemainingFormatted, contains('car'));
    });
  });
}

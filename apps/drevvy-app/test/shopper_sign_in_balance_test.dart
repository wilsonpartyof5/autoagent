import 'package:drevvy_app/data/models/car_pack.dart';
import 'package:drevvy_app/data/repositories/demo_repository.dart';
import 'package:drevvy_app/data/services/credits_endpoint.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('a signed-in balance replaces the local demo keys', () async {
    final repo = DemoRepository(
      networkDelay: Duration.zero,
      initialBalance: const CarCreditBalance.withBalance(6),
      credits: _StarterBalance(),
    );

    expect((await repo.getCreditBalance()).balance, 6);
    expect(await repo.pullSignedInBalance(), isTrue);
    final next = await repo.getCreditBalance();
    expect(next.balance, 3);
    expect(next.totalPurchased, 0);

    final granted = await repo.grantStarterKeys();
    expect(granted, isFalse);
    expect((await repo.getCreditBalance()).balance, 3);
  });
}

class _StarterBalance extends CreditsEndpoint {
  @override
  Future<CarCreditBalance?> fetchBalance() async {
    return const CarCreditBalance(
      balance: 3,
      totalPurchased: 0,
      totalSpent: 0,
      totalRefunded: 0,
    );
  }

  @override
  Future<CarCreditBalance?> grantPurchase({
    required String productId,
    required String transactionId,
  }) async {
    return null;
  }

  @override
  Future<CarCreditBalance?> restorePurchases({
    List<String> transactionIds = const [],
  }) async {
    return null;
  }
}

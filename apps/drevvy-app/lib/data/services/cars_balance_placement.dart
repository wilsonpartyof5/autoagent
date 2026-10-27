/// Shown when a shopper has used every key.
///
/// Superwall placement `cars_balance_empty`. Without a Superwall key, the
/// existing Out of keys sheet stays on screen.
abstract class CarsBalancePlacement {
  static const name = 'cars_balance_empty';

  Future<void> register({
    required void Function() presentLocalPaywall,
    Future<void> Function()? onPurchased,
  });
}

class LocalCarsBalancePlacement implements CarsBalancePlacement {
  const LocalCarsBalancePlacement();

  @override
  Future<void> register({
    required void Function() presentLocalPaywall,
    Future<void> Function()? onPurchased,
  }) async {
    presentLocalPaywall();
  }
}

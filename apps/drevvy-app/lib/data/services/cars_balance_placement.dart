/// Shown when a shopper has used every car credit.
///
/// Superwall placement `cars_balance_empty`. Without a Superwall key, the
/// existing Out of cars sheet stays on screen, including per-car cost,
/// savings versus the 3-pack, and the never-expires line.
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

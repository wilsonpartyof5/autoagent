import '../../data/models/car_pack.dart';

/// What to show when a shopper taps "Unlock my price".
///
/// A balance above zero goes straight to Deals. A shopper who has never
/// bought a pack sees the pack picker. A shopper who has used every car
/// sees the out-of-cars state. Packs are one-time and never expire.
enum CarUnlockGate { ready, firstPack, outOfCars }

CarUnlockGate carUnlockGate(CarCreditBalance balance) {
  if (balance.canUnlock) return CarUnlockGate.ready;
  if (balance.totalPurchased == 0) return CarUnlockGate.firstPack;
  return CarUnlockGate.outOfCars;
}

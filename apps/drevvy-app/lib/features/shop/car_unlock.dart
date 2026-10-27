import '../../data/models/car_pack.dart';

/// What to show when a shopper spends a key.
///
/// A balance above zero goes through. A shopper who has never bought a pack
/// sees the pack picker. A shopper who has used every key sees the out-of-keys
/// state. Packs are one-time and never expire. Off-network OTD requests skip
/// this gate.
enum CarUnlockGate { ready, firstPack, outOfCars }

CarUnlockGate carUnlockGate(CarCreditBalance balance) {
  if (balance.canUnlock) return CarUnlockGate.ready;
  if (balance.totalPurchased == 0) return CarUnlockGate.firstPack;
  return CarUnlockGate.outOfCars;
}

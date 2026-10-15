import '../models/car_pack.dart';
import 'purchase_service.dart';

/// RevenueCat offering that sells the one-time car packs.
const String packsOfferingId = 'packs';

/// Superwall placement registered from Unlock my price when the balance is 0.
const String unlockMyPricePlacement = 'unlock_my_price';

/// One RevenueCat offering and the packages it contains.
class StoreOfferingPackages<T> {
  const StoreOfferingPackages({
    required this.identifier,
    required this.packages,
  });

  final String identifier;
  final List<T> packages;
}

/// Prefer offering [packsOfferingId]. Fall back to the current offering, then
/// every offering, so a missing dashboard offering still resolves the products.
List<T> packagesFromPacksOffering<T>({
  StoreOfferingPackages<T>? current,
  required Iterable<StoreOfferingPackages<T>> all,
}) {
  for (final offering in all) {
    if (offering.identifier == packsOfferingId &&
        offering.packages.isNotEmpty) {
      return offering.packages;
    }
  }
  if (current != null && current.packages.isNotEmpty) return current.packages;
  return [for (final offering in all) ...offering.packages];
}

/// Store price when RevenueCat has one, otherwise the catalog dollar price.
String displayPackPrice({
  required CarPackType pack,
  CarPackOffering? offering,
}) {
  if (offering == null || offering.currencyCode.toUpperCase() == 'USD') {
    return formatUsd(offering?.priceAmount ?? pack.priceUsd, decimalDigits: 0);
  }
  return offering.localizedPrice;
}

/// `$9.70/car` from the store amount, or from the catalog when it is absent.
String displayPerCarPrice({
  required CarPackType pack,
  CarPackOffering? offering,
}) {
  if (offering == null || offering.currencyCode.toUpperCase() == 'USD') {
    final amount = offering == null
        ? pack.perCarCost
        : offering.priceAmount / pack.cars;
    return '${formatUsd(amount, decimalDigits: 2)}/car';
  }
  return '${pack.perCarFormatted}/car';
}

/// Unlock my price spends a car when any remain. Zero presents the paywall.
bool shouldPresentUnlockPaywall(CarCreditBalance balance) => !balance.canUnlock;

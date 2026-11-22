/// RevenueCat offering identifier for the one-time key packs.
const keysOfferingId = 'keys';

/// Backward-compatible alias. Prefer [keysOfferingId].
const packsOfferingId = keysOfferingId;

/// Packages on the RevenueCat offering [keysOfferingId].
///
/// Other offerings are ignored. A missing or empty `keys` offering returns
/// an empty list so the paywall does not show packs from a different offering.
List<T> selectPackPackages<T>({required Map<String, List<T>> byOfferingId}) {
  final packs = byOfferingId[keysOfferingId];
  if (packs == null || packs.isEmpty) return List<T>.empty();
  return packs;
}

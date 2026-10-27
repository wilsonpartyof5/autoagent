/// RevenueCat offering identifier for the one-time key packs.
const keysOfferingId = 'keys';

/// Backward-compatible alias. Prefer [keysOfferingId].
const packsOfferingId = keysOfferingId;

/// Prefers the `keys` offering, then the current offering, then everything else.
List<T> selectPackPackages<T>({
  required Map<String, List<T>> byOfferingId,
  List<T>? currentPackages,
}) {
  final packs = byOfferingId[keysOfferingId];
  if (packs != null && packs.isNotEmpty) return packs;
  if (currentPackages != null && currentPackages.isNotEmpty) {
    return currentPackages;
  }
  return [for (final packages in byOfferingId.values) ...packages];
}

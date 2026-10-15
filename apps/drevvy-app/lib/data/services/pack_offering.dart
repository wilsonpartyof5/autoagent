/// RevenueCat offering identifier for the one-time car packs.
const packsOfferingId = 'packs';

/// Prefers the `packs` offering, then the current offering, then everything else.
List<T> selectPackPackages<T>({
  required Map<String, List<T>> byOfferingId,
  List<T>? currentPackages,
}) {
  final packs = byOfferingId[packsOfferingId];
  if (packs != null && packs.isNotEmpty) return packs;
  if (currentPackages != null && currentPackages.isNotEmpty) {
    return currentPackages;
  }
  return [for (final packages in byOfferingId.values) ...packages];
}

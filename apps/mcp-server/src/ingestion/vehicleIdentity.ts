export type VehicleIdentityRow = {
  id: string;
  vin: string | null;
  dealership_id?: string | null;
};

/**
 * PostgREST filter: this rooftop's cars, plus unassigned rows for the same
 * MarketCheck dealer id (pre-backfill leftovers).
 */
export function rooftopVehicleOrFilter(
  dealershipId: string,
  dealerId?: string | null,
): string {
  if (dealerId) {
    return `dealership_id.eq.${dealershipId},and(dealership_id.is.null,dealer_id.eq.${dealerId})`;
  }
  return `dealership_id.eq.${dealershipId}`;
}

export function normalizeVin(vin?: string | null): string | null {
  const trimmed = vin?.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

/**
 * Reuse the rooftop's existing row when the VIN already lives there.
 * Listing IDs from MarketCheck can change; VIN + rooftop should not.
 */
export function assignStableVehicleIds<T extends VehicleIdentityRow>(
  incoming: T[],
  existingByVin: Map<string, string>,
): T[] {
  return incoming.map((row) => {
    const vin = normalizeVin(row.vin);
    const stableId = vin ? existingByVin.get(vin) : undefined;
    return {
      ...row,
      vin,
      id: stableId || row.id,
    };
  });
}

export function existingVinIdMap(
  existing: Array<{ id: string; vin: string | null; dealership_id?: string | null }>,
): Map<string, string> {
  const existingByVin = new Map<string, string>();
  for (const row of existing) {
    const vin = normalizeVin(row.vin);
    if (!vin) continue;
    const current = existingByVin.get(vin);
    if (!current || row.dealership_id) {
      existingByVin.set(vin, row.id);
    }
  }
  return existingByVin;
}

/**
 * Cars on this rooftop that are not in the new feed.
 * Match by VIN first, then listing id for VIN-less rows.
 */
export function retiredVehicleIds(
  existing: VehicleIdentityRow[],
  incoming: VehicleIdentityRow[],
): string[] {
  const keepIds = new Set(incoming.map((row) => row.id));
  const keepVins = new Set(
    incoming.map((row) => normalizeVin(row.vin)).filter((vin): vin is string => Boolean(vin)),
  );

  return existing
    .filter((row) => {
      const vin = normalizeVin(row.vin);
      if (vin && keepVins.has(vin)) return false;
      if (keepIds.has(row.id)) return false;
      return true;
    })
    .map((row) => row.id);
}

/**
 * Scope UVS inventory to one Drevvy rooftop.
 * Includes leftover rows that still only have a MarketCheck dealer id.
 */
export function rooftopVehicleOrFilter(
  dealershipId: string,
  marketcheckDealerId?: string | null,
): string {
  if (marketcheckDealerId) {
    return `dealership_id.eq.${dealershipId},and(dealership_id.is.null,dealer_id.eq.${marketcheckDealerId})`;
  }
  return `dealership_id.eq.${dealershipId}`;
}

export function applyRooftopVehicleFilter<
  Q extends {
    or: (filters: string) => Q;
    eq: (column: string, value: string) => Q;
  },
>(query: Q, dealershipId: string, marketcheckDealerId?: string | null): Q {
  if (marketcheckDealerId) {
    return query.or(rooftopVehicleOrFilter(dealershipId, marketcheckDealerId));
  }
  return query.eq('dealership_id', dealershipId);
}

export function vehicleBelongsToRooftop(
  vehicle: { dealership_id?: string | null; dealer_id?: string | null },
  dealership: { id: string; marketcheckDealerId: string | null },
): boolean {
  if (vehicle.dealership_id && vehicle.dealership_id === dealership.id) return true;
  if (
    !vehicle.dealership_id &&
    dealership.marketcheckDealerId &&
    vehicle.dealer_id === dealership.marketcheckDealerId
  ) {
    return true;
  }
  return false;
}

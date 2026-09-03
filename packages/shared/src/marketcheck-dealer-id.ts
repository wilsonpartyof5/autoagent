/**
 * MarketCheck dealership lookup returns multiple ID fields.
 * Inventory listings use `mc_website_id` as `dealer.id` (e.g. Honda Cars of
 * Rock Hill → 1038994). `mc_dealer_id` is a different identifier and often
 * returns zero active inventory when used with search/sync.
 */

export type MarketCheckDealershipRecord = {
  mc_website_id?: string | number | null;
  mc_dealer_id?: string | number | null;
  dealer_id?: string | number | null;
  seller_name?: string | null;
  dealer_name?: string | null;
  name?: string | null;
  inventory_url?: string | null;
  website?: string | null;
  dealer_website?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  mc_dealership_group_name?: string | null;
};

export type PickedMarketCheckDealerIds = {
  /** ID to use for inventory sync / UVS dealer scoping (mc_website_id preferred). */
  inventoryDealerId: string;
  websiteId: string | null;
  dealerId: string | null;
  dealerName: string | null;
  inventoryUrl: string | null;
};

function asId(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

/**
 * Pick the MarketCheck ID that correctly scopes a dealer's inventory.
 * Prefer mc_website_id → mc_dealer_id → dealer_id.
 */
export function pickInventoryDealerId(
  record: MarketCheckDealershipRecord | null | undefined,
): PickedMarketCheckDealerIds | null {
  if (!record) return null;

  const websiteId = asId(record.mc_website_id);
  const dealerId = asId(record.mc_dealer_id) ?? asId(record.dealer_id);
  const inventoryDealerId = websiteId ?? dealerId;
  if (!inventoryDealerId) return null;

  const dealerName =
    record.seller_name ?? record.dealer_name ?? record.name ?? null;
  const inventoryUrl =
    record.inventory_url ?? record.website ?? record.dealer_website ?? null;

  return {
    inventoryDealerId,
    websiteId,
    dealerId,
    dealerName: dealerName != null ? String(dealerName) : null,
    inventoryUrl: inventoryUrl != null ? String(inventoryUrl) : null,
  };
}

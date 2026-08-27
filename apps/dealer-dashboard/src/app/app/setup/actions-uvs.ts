'use server';

/**
 * UVS MarketCheck sync for enrolled dealers.
 * Inventory is pulled via Cars Dealer Inventory Syndication (same path as setup/resync).
 */

import { fetchAndIngestMarketCheckInventory } from '@/app/app/setup/actions';

type SyncInput = {
  dealerId: string;
  zip?: string;
  radiusMiles?: number;
  condition?: 'all' | 'new' | 'used';
  source?: string;
  dealershipName?: string;
};

export async function syncMarketCheckInventoryUVS({
  dealerId,
  source,
}: SyncInput) {
  if (!dealerId) {
    throw new Error('Enter your MarketCheck dealer ID before syncing.');
  }

  const result = await fetchAndIngestMarketCheckInventory({
    dealerId,
    source,
  });

  return {
    success: true,
    message: `Synced ${result.imported} vehicles from MarketCheck.`,
    count: result.imported,
    summary: result.summary,
  };
}

'use server';

/**
 * UVS MarketCheck sync for enrolled dealers.
 * Inventory is pulled via Cars Dealer Inventory Syndication (same path as setup/resync).
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchUserDealerships } from '@/lib/supabase/dealerships';
import { fetchAndIngestMarketCheckInventory } from '@/lib/ingest/marketcheck';

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const authorized = (await fetchUserDealerships()).some(
    (dealership) => dealership.marketcheckDealerId === dealerId,
  );
  if (!authorized) {
    throw new Error('You do not have access to this dealership.');
  }

  const result = await fetchAndIngestMarketCheckInventory({
    dealerId,
    source,
  });

  revalidatePath('/app/inventory');
  revalidatePath('/app/setup');

  return {
    success: true,
    message: `Synced ${result.imported} vehicles from MarketCheck.`,
    count: result.imported,
    summary: result.summary,
  };
}

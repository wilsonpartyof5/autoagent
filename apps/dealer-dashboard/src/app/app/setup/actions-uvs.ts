'use server';

/**
 * UVS MarketCheck sync for enrolled dealers.
 * Public action accepts only a Drevvy dealership UUID.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchUserDealerships } from '@/lib/supabase/dealerships';
import { fetchAndIngestMarketCheckInventory } from '@/lib/ingest/marketcheck';
import { normalizeInventoryUrlHost } from '@/lib/ingest/inventory-service';

export async function syncMarketCheckInventoryUVS({ dealershipId }: { dealershipId: string }) {
  if (!dealershipId) {
    throw new Error('dealershipId is required');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const dealership = (await fetchUserDealerships()).find((row) => row.id === dealershipId);
  if (!dealership) {
    throw new Error('You do not have access to this dealership.');
  }

  const dealerId = dealership.marketcheckDealerId?.trim();
  if (!dealerId) {
    throw new Error('This rooftop does not have a stored MarketCheck dealer ID yet.');
  }

  const result = await fetchAndIngestMarketCheckInventory({
    dealerId,
    source: normalizeInventoryUrlHost(dealership.marketcheckWebsiteUrl) ?? undefined,
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

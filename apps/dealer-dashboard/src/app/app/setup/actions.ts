'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDealerProfile, updateDealerProfile, type InventoryProvider } from '@/lib/supabase/profile';
import {
  fetchUserDealerships,
  getActiveDealership,
  updateDealership,
  type Dealership,
} from '@/lib/supabase/dealerships';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchAndIngestMarketCheckInventory,
  fetchDealerRooftopsByDealerId,
  lookupDealerIdByInventoryUrl,
  normalizeInventoryUrlHost,
  type DealerRooftop,
} from '@/lib/ingest/inventory-service';

export type { DealerRooftop };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  return user;
}

async function requireDealership(dealershipId?: string | null): Promise<Dealership> {
  await requireUser();
  const dealership = dealershipId
    ? (await fetchUserDealerships()).find((row) => row.id === dealershipId) ?? null
    : await getActiveDealership();

  if (!dealership) {
    throw new Error(
      dealershipId
        ? 'You do not have access to the selected dealership.'
        : 'No active dealership found. Please set up a dealership first.',
    );
  }
  return dealership;
}

async function cacheDealerId({
  dealerId,
  websiteUrl,
  dealershipId,
  dealerName,
}: {
  dealerId: string;
  websiteUrl?: string | null;
  dealershipId?: string | null;
  dealerName?: string | null;
}) {
  const profileUpdate = updateDealerProfile({
    marketcheckDealerId: dealerId,
    ...(websiteUrl ? { marketcheckWebsiteUrl: websiteUrl } : {}),
    inventoryConnected: false,
  }).catch((error) => {
    console.error('[marketcheck_lookup] Failed to cache dealer ID on profile', error);
  });

  const dealershipUpdate =
    dealershipId != null
      ? updateDealership(dealershipId, {
          marketcheckDealerId: dealerId,
          ...(websiteUrl ? { marketcheckWebsiteUrl: websiteUrl } : {}),
          ...(dealerName ? { name: dealerName } : {}),
        }).catch((error) => {
          console.error('[marketcheck_lookup] Failed to cache dealer ID on dealership', error);
        })
      : Promise.resolve();

  await Promise.allSettled([profileUpdate, dealershipUpdate]);
}

async function resolveStoredDealerId(activeDealership: Dealership): Promise<
  | { status: 'resolved'; dealerId: string; dealerName?: string | null; websiteUrl?: string | null }
  | { status: 'no_match'; message: string }
  | { status: 'error'; message: string }
> {
  const cachedDealerId = activeDealership.marketcheckDealerId?.trim();
  if (cachedDealerId) {
    return {
      status: 'resolved',
      dealerId: cachedDealerId,
      websiteUrl: activeDealership.marketcheckWebsiteUrl,
    };
  }

  const profile = await getDealerProfile();
  const websiteUrl = normalizeInventoryUrlHost(
    activeDealership.marketcheckWebsiteUrl ?? profile?.marketcheckWebsiteUrl ?? null,
  );

  if (!websiteUrl) {
    return {
      status: 'error',
      message: 'Add your dealership website in Settings so we can request MarketCheck to map it.',
    };
  }

  const lookupResult = await lookupDealerIdByInventoryUrl(websiteUrl);

  if (lookupResult.status === 'no_match') {
    return {
      status: 'no_match',
      message: 'We requested MarketCheck to map your website. Please try again in 24-48 hours.',
    };
  }

  if (lookupResult.status === 'error') {
    return { status: 'error', message: lookupResult.message };
  }

  await cacheDealerId({
    dealerId: lookupResult.dealerId,
    websiteUrl,
    dealershipId: activeDealership.id,
    dealerName: lookupResult.dealerName ?? null,
  });

  return {
    status: 'resolved',
    dealerId: lookupResult.dealerId,
    dealerName: lookupResult.dealerName ?? null,
    websiteUrl,
  };
}

/**
 * Re-sync inventory for a Drevvy rooftop the caller is allowed to manage.
 * MarketCheck identifiers are loaded server-side — never from the client.
 */
export async function resyncInventory(selectedDealershipId?: string) {
  const activeDealership = await requireDealership(selectedDealershipId);

  const dealerResolution = await resolveStoredDealerId(activeDealership);

  if (dealerResolution.status === 'no_match') {
    return {
      success: false,
      status: 'no_match' as const,
      fetched: 0,
      imported: 0,
      valid: 0,
      invalid: 0,
      message: dealerResolution.message,
    };
  }

  if (dealerResolution.status === 'error') {
    throw new Error(dealerResolution.message);
  }

  const dealershipId = activeDealership.id;
  const dealerId = dealerResolution.dealerId;

  try {
    await updateDealership(dealershipId, {
      marketcheckDealerId: dealerId,
      ...(dealerResolution.websiteUrl
        ? { marketcheckWebsiteUrl: dealerResolution.websiteUrl }
        : {}),
      ...(dealerResolution.dealerName ? { name: dealerResolution.dealerName } : {}),
    });
  } catch (err) {
    console.error('[resyncInventory] Failed to persist MarketCheck dealer ID', err);
    throw new Error('Failed to store MarketCheck dealer ID. Please try again.');
  }

  const admin = createAdminClient();
  const { data: persisted, error: persistedError } = await admin
    .from('dealerships')
    .select('marketcheck_dealer_id, marketcheck_website_url')
    .eq('id', dealershipId)
    .maybeSingle();

  if (persistedError || !persisted?.marketcheck_dealer_id) {
    throw new Error('Failed to verify stored MarketCheck dealer ID.');
  }

  const source =
    normalizeInventoryUrlHost(persisted.marketcheck_website_url) ||
    normalizeInventoryUrlHost(activeDealership.marketcheckWebsiteUrl) ||
    normalizeInventoryUrlHost(dealerResolution.websiteUrl) ||
    undefined;

  const result = await fetchAndIngestMarketCheckInventory({
    dealerId: persisted.marketcheck_dealer_id,
    source: source ?? undefined,
    dealershipId,
  });

  revalidatePath('/app/inventory');

  return {
    success: true,
    status: 'synced' as const,
    fetched: result.fetched,
    imported: result.imported,
    valid: result.valid,
    invalid: result.invalid,
  };
}

export { fetchAndIngestMarketCheckInventory };

/**
 * Rooftop preview for a Drevvy dealership the caller belongs to.
 */
export async function fetchDealerRooftops(dealershipId: string): Promise<DealerRooftop[]> {
  const dealership = await requireDealership(dealershipId);
  const dealerId = dealership.marketcheckDealerId?.trim();
  if (!dealerId) return [];
  return fetchDealerRooftopsByDealerId(dealerId);
}

/**
 * User-facing sync. Accepts only a Drevvy dealership UUID.
 */
export async function syncMarketCheckInventory({ dealershipId }: { dealershipId: string }) {
  if (!dealershipId?.trim()) {
    throw new Error('dealershipId is required');
  }
  return resyncInventory(dealershipId.trim());
}

export async function setInventoryProvider(provider: InventoryProvider) {
  await requireUser();
  try {
    await updateDealerProfile({
      dmsProvider: provider,
    });

    revalidatePath('/app/setup');
    revalidatePath('/app/settings');
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unable to update inventory provider. Please try again.',
    );
  }

  return { success: true };
}

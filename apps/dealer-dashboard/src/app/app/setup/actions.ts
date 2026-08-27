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

const MARKETCHECK_DEFAULT_BASE = 'https://api.marketcheck.com';
const MARKETCHECK_LOOKUP_TIMEOUT_MS = 8000;

type SyncInput = {
  dealerId?: string | null;
  zip?: string;
  radiusMiles?: number;
  condition?: 'all' | 'new' | 'used';
  source?: string; // Optional source parameter for dealer inventory endpoint
  dealershipName?: string; // Optional dealership name for creating/updating dealership
};

type FetchAndIngestInput = {
  dealerId: string;
  source?: string;
};

type DealerLookupResult =
  | { status: 'found'; dealerId: string; dealerName?: string | null; numFound?: number }
  | { status: 'no_match'; numFound?: number }
  | { status: 'error'; message: string; statusCode?: number };

function normalizeInventoryUrlHost(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname.startsWith('www.') ? parsed.hostname.slice(4) : parsed.hostname;
    return hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();
  }
}

async function lookupDealerIdByInventoryUrl(inventoryUrl: string): Promise<DealerLookupResult> {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) {
    return { status: 'error', message: 'MarketCheck API key is not configured on the server.' };
  }

  const baseUrl = (process.env.MARKETCHECK_BASE_URL || MARKETCHECK_DEFAULT_BASE).replace(/\/$/, '');
  const params = new URLSearchParams({
    api_key: apiKey,
    inventory_url: inventoryUrl,
    rows: '50',
  });

  const url = `${baseUrl}/v2/dealerships/car?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MARKETCHECK_LOOKUP_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeoutId);

    if ([401, 403, 429].includes(response.status)) {
      console.warn('[marketcheck_lookup] Request rejected or rate limited', {
        status: response.status,
        statusText: response.statusText,
      });
      return {
        status: 'error',
        statusCode: response.status,
        message: 'MarketCheck lookup was rejected or rate limited. Please try again shortly.',
      };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[marketcheck_lookup] Request failed', {
        status: response.status,
        statusText: response.statusText,
        body: body?.slice(0, 500),
      });
      return {
        status: 'error',
        statusCode: response.status,
        message: `MarketCheck lookup failed (${response.status}). Please try again.`,
      };
    }

    const payload = await response.json();
    const mcDealerships = Array.isArray(payload?.mc_dealerships) ? payload.mc_dealerships : [];
    const numFound = typeof payload?.num_found === 'number' ? payload.num_found : mcDealerships.length;

    if (numFound === 0 || mcDealerships.length === 0) {
      console.warn('[marketcheck_lookup] No dealerships returned for URL', { inventoryUrl });
      return { status: 'no_match', numFound: numFound ?? 0 };
    }

    const primary = mcDealerships[0];
    // Inventory listings key off mc_website_id; fall back to dealer_id fields.
    const dealerId = primary?.mc_website_id ?? primary?.mc_dealer_id ?? primary?.dealer_id;
    const dealerName = primary?.seller_name ?? primary?.dealer_name ?? primary?.name ?? null;

    if (!dealerId) {
      console.error('[marketcheck_lookup] Missing dealer ID in response', {
        inventoryUrl,
        primary,
      });
      return { status: 'error', message: 'MarketCheck lookup returned a dealership without an ID.' };
    }

    console.log('[marketcheck_lookup] Dealer resolved from inventory URL', {
      inventoryUrl,
      dealerId,
      numFound,
      durationMs: Date.now() - startedAt,
    });

    return { status: 'found', dealerId: String(dealerId), dealerName, numFound };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[marketcheck_lookup] Lookup timed out', {
        inventoryUrl,
        timeoutMs: MARKETCHECK_LOOKUP_TIMEOUT_MS,
      });
      return { status: 'error', message: 'MarketCheck lookup timed out. Please try again.' };
    }

    console.error('[marketcheck_lookup] Lookup error', {
      inventoryUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'MarketCheck lookup failed unexpectedly.',
    };
  }
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

async function resolveDealerIdForUser({
  providedDealerId,
  activeDealership,
}: {
  providedDealerId?: string | null;
  activeDealership?: Dealership | null;
}): Promise<
  | { status: 'resolved'; dealerId: string; websiteUrl?: string | null }
  | { status: 'resolved'; dealerId: string; dealerName?: string | null; websiteUrl?: string | null }
  | { status: 'no_match'; message: string }
  | { status: 'error'; message: string }
> {
  const trimmedInput = providedDealerId?.trim();
  if (trimmedInput) {
    return { status: 'resolved', dealerId: trimmedInput };
  }

  const cachedDealerId = activeDealership?.marketcheckDealerId?.trim();
  if (cachedDealerId) {
    return { status: 'resolved', dealerId: cachedDealerId, websiteUrl: activeDealership?.marketcheckWebsiteUrl };
  }

  const profile = await getDealerProfile();
  const websiteUrl = normalizeInventoryUrlHost(
    activeDealership?.marketcheckWebsiteUrl ?? profile?.marketcheckWebsiteUrl ?? null,
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
    dealershipId: activeDealership?.id ?? null,
  });

    await cacheDealerId({
      dealerId: lookupResult.dealerId,
      websiteUrl,
      dealershipId: activeDealership?.id ?? null,
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
 * Re-sync inventory for the active dealership
 * Uses the dealership's stored MarketCheck dealer ID and settings
 */
export async function resyncInventory(selectedDealershipId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('Not authenticated');
  }

  // A setup page can target a rooftop other than the user's current global
  // selection. Resolve the explicit rooftop through the authorized list so a
  // sync can never silently run against a different dealer.
  const activeDealership = selectedDealershipId
    ? (await fetchUserDealerships()).find(
        (dealership) => dealership.id === selectedDealershipId,
      ) ?? null
    : await getActiveDealership();
  
  if (!activeDealership) {
    throw new Error(
      selectedDealershipId
        ? 'You do not have access to the selected dealership.'
        : 'No active dealership found. Please set up a dealership first.',
    );
  }

  const dealerResolution = await resolveDealerIdForUser({
    providedDealerId: activeDealership.marketcheckDealerId,
    activeDealership,
  });

  if (dealerResolution.status === 'no_match') {
    return {
      success: false,
      status: 'no_match',
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

  const dealerId = dealerResolution.dealerId;
  const dealershipId = activeDealership.id;

  // Persist the resolved dealer ID to the dealership row (admin client to avoid RLS issues)
  const resolvedWebsite = 'websiteUrl' in dealerResolution ? dealerResolution.websiteUrl : undefined;
  const resolvedDealerName = 'dealerName' in dealerResolution ? dealerResolution.dealerName : undefined;

  try {
    await updateDealership(dealershipId, {
      marketcheckDealerId: dealerId,
      ...(resolvedWebsite ? { marketcheckWebsiteUrl: resolvedWebsite } : {}),
      ...(resolvedDealerName ? { name: resolvedDealerName } : {}),
    });
  } catch (err) {
    console.error('[resyncInventory] Failed to persist MarketCheck dealer ID', err);
    throw new Error('Failed to store MarketCheck dealer ID. Please try again.');
  }

  // Re-fetch to ensure the ID is stored and only use the stored value going forward
  const admin = createAdminClient();
  const { data: persisted, error: persistedError } = await admin
    .from('dealerships')
    .select('marketcheck_dealer_id, marketcheck_zip, marketcheck_website_url')
    .eq('id', dealershipId)
    .maybeSingle();

  if (persistedError) {
    console.error('[resyncInventory] Failed to read persisted dealership', persistedError);
    throw new Error('Failed to verify stored MarketCheck dealer ID.');
  }

  if (!persisted?.marketcheck_dealer_id) {
    console.error('[resyncInventory] Dealer ID missing after persist', { dealershipId, dealerId });
    throw new Error('MarketCheck dealer ID was not stored. Please try again.');
  }

  const dealerIdToUse = persisted.marketcheck_dealer_id;
  const source =
    normalizeInventoryUrlHost(persisted.marketcheck_website_url) ||
    normalizeInventoryUrlHost(activeDealership.marketcheckWebsiteUrl) ||
    normalizeInventoryUrlHost(resolvedWebsite) ||
    undefined;

  // Cars Dealer Inventory Syndication: stored ID + optional website hostname.
  const result = await fetchAndIngestMarketCheckInventory({
    dealerId: dealerIdToUse,
    source: source ?? undefined,
  });

  // Revalidate inventory page to show updated data
  revalidatePath('/app/inventory');

  return {
    success: true,
    status: 'synced',
    fetched: result.fetched,
    imported: result.imported,
    valid: result.valid,
    invalid: result.invalid,
  };
}

/**
 * Fetch and ingest MarketCheck inventory via MCP server endpoint
 * This is the new automated flow that handles both fetching and ingestion in one call
 */
export async function fetchAndIngestMarketCheckInventory({
  dealerId,
  source,
}: FetchAndIngestInput) {
  if (!dealerId && !source) {
    throw new Error('dealerId or source is required');
  }

  const mcpServerUrl = process.env.MCP_SERVER_URL || process.env.INGESTION_SERVICE_URL;
  if (!mcpServerUrl) {
    throw new Error('MCP_SERVER_URL or INGESTION_SERVICE_URL must be configured');
  }

  const ingestionToken = process.env.INGESTION_API_TOKEN || process.env.MCP_SERVER_TOKEN;
  const url = `${mcpServerUrl.replace(/\/+$/, '')}/api/ingest/marketcheck/fetch-and-ingest`;

  try {
    console.log('[fetchAndIngestMarketCheckInventory] Calling MCP syndication ingest:', {
      url: url.replace(ingestionToken || '', '***REDACTED***'),
      dealerId,
      source,
      endpoint: '/v2/dealerships/inventory',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ingestionToken ? { Authorization: `Bearer ${ingestionToken}` } : {}),
      },
      body: JSON.stringify({
        dealerId,
        source,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `MCP fetch-and-ingest failed (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
        if (errorJson.details) {
          errorMessage += `: ${errorJson.details}`;
        }
      } catch {
        errorMessage += `: ${errorText.substring(0, 500)}`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Fetch and ingest failed');
    }

    const summary = result.ingestion?.summary || {};
    const fetched = result.fetched || 0;
    const stored = summary.stored || 0;
    const valid = summary.valid || 0;
    const invalid = summary.invalid || 0;

    revalidatePath('/app/inventory');
    revalidatePath('/app/setup');

    return {
      success: true,
      fetched,
      imported: stored,
      valid,
      invalid,
      summary: { stored, valid, invalid },
    };
  } catch (error) {
    console.error('[fetchAndIngestMarketCheckInventory] Error:', {
      dealerId,
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export type DealerRooftop = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
};

/**
 * Fetch dealer rooftops/locations from MarketCheck
 * Extracts unique locations from dealer's active inventory listings
 */
export async function fetchDealerRooftops(dealerId: string): Promise<DealerRooftop[]> {
  if (!dealerId) {
    return [];
  }

  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) {
    console.error('[rooftops] MarketCheck API key not configured');
    return [];
  }

  const baseUrl = (process.env.MARKETCHECK_BASE_URL || MARKETCHECK_DEFAULT_BASE).replace(/\/$/, '');
  
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      dealer_id: dealerId,
      mc_website_id: dealerId,
      rows: '50',
      start: '0',
    });
    const url = `${baseUrl}/v2/dealerships/inventory?${params.toString()}`;
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      console.error(`[rooftops] MarketCheck request failed (${response.status})`);
      return [];
    }

    const payload = await response.json();
    const listings = Array.isArray(payload.listings) ? payload.listings : [];

    if (listings.length === 0) {
      return [];
    }

    // Extract unique rooftops based on dealer location data
    const rooftopsMap = new Map<string, DealerRooftop>();

    listings.forEach((listing: any) => {
      const dealer = listing.dealer || listing.mc_dealership;
      if (!dealer || !dealer.zip) {
        return;
      }

      // Use ZIP + city + state as unique key
      const key = `${dealer.zip}-${dealer.city || ''}-${dealer.state || ''}`;
      
      if (!rooftopsMap.has(key)) {
        const latitude = typeof dealer.latitude === 'string' 
          ? parseFloat(dealer.latitude) 
          : dealer.latitude;
        const longitude = typeof dealer.longitude === 'string'
          ? parseFloat(dealer.longitude)
          : dealer.longitude;

        rooftopsMap.set(key, {
          name: dealer.name || 'Unknown Location',
          address: dealer.street || dealer.address || '',
          city: dealer.city || '',
          state: dealer.state || '',
          zip: dealer.zip,
          latitude: latitude && !isNaN(latitude) ? latitude : undefined,
          longitude: longitude && !isNaN(longitude) ? longitude : undefined,
          phone: dealer.phone,
          website: dealer.website,
        });
      }
    });

    return Array.from(rooftopsMap.values());
  } catch (error) {
    console.error('[rooftops] Error fetching dealer rooftops:', error);
    return [];
  }
}

export async function syncMarketCheckInventory({
  dealerId,
  source,
}: SyncInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const activeDealership = await getActiveDealership();

  const dealerResolution = await resolveDealerIdForUser({
    providedDealerId: dealerId,
    activeDealership,
  });

  if (dealerResolution.status === 'no_match') {
    return {
      status: 'no_match',
      imported: 0,
      fetched: 0,
      valid: 0,
      invalid: 0,
      message: dealerResolution.message,
    };
  }

  if (dealerResolution.status === 'error') {
    throw new Error(dealerResolution.message);
  }

  const resolvedDealerId = dealerResolution.dealerId;
  const sourceHost =
    normalizeInventoryUrlHost(source) ||
    normalizeInventoryUrlHost(
      'websiteUrl' in dealerResolution ? dealerResolution.websiteUrl : null,
    );

  const result = await fetchAndIngestMarketCheckInventory({
    dealerId: resolvedDealerId,
    source: sourceHost ?? undefined,
  });

  if (user) {
    try {
      await updateDealerProfile({
        dmsProvider: 'marketcheck',
        inventoryConnected: result.imported > 0,
      });
    } catch (profileError) {
      console.error('[syncMarketCheckInventory] Profile update failed:', profileError);
    }
  }

  return {
    success: true,
    status: 'synced',
    imported: result.imported,
    fetched: result.fetched,
    valid: result.valid,
    invalid: result.invalid,
  };
}


/**
 * Set the inventory provider for the dealer
 */
export async function setInventoryProvider(provider: InventoryProvider) {
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

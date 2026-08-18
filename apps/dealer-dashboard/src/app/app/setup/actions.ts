'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getDealerProfile, updateDealerProfile, type InventoryProvider } from '@/lib/supabase/profile';
import {
  fetchUserDealerships,
  getActiveDealership,
  getActiveDealershipId,
  createDealership,
  updateDealership,
  getActiveDealershipIdForUser,
  type Dealership,
} from '@/lib/supabase/dealerships';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  normalizeMarketCheckVehicle,
  type MarketCheckVehicle,
  VehicleSchema,
  enrichListing,
  mergeEnrichment,
  isEnrichmentEnabled,
  pickInventoryDealerId,
} from '@autoagent/shared';

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
  zip?: string;
  radiusMiles?: number;
  condition?: 'all' | 'new' | 'used';
  pageSize?: number;
  page?: number;
  maxPages?: number;
  maxVehicles?: number;
};

type DealerLookupResult =
  | {
      status: 'found';
      dealerId: string;
      dealerName?: string | null;
      numFound?: number;
      websiteId?: string | null;
      marketcheckDealerId?: string | null;
      inventoryUrl?: string | null;
    }
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
    const picked = pickInventoryDealerId(primary);

    if (!picked) {
      console.error('[marketcheck_lookup] Missing inventory dealer ID in response', {
        inventoryUrl,
        primary,
      });
      return { status: 'error', message: 'MarketCheck lookup returned a dealership without an ID.' };
    }

    console.log('[marketcheck_lookup] Dealer resolved from inventory URL', {
      inventoryUrl,
      dealerId: picked.inventoryDealerId,
      websiteId: picked.websiteId,
      marketcheckDealerId: picked.dealerId,
      numFound,
      durationMs: Date.now() - startedAt,
    });

    return {
      status: 'found',
      dealerId: picked.inventoryDealerId,
      dealerName: picked.dealerName,
      numFound,
      websiteId: picked.websiteId,
      marketcheckDealerId: picked.dealerId,
      inventoryUrl: picked.inventoryUrl ?? inventoryUrl,
    };
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
  // Prefer website/source for MarketCheck inventory bodies. Listing dealer.id
  // matches mc_website_id; the hostname source endpoint returns actual rows.
  const websiteSource =
    resolvedWebsite ||
    (activeDealership.marketcheckWebsiteUrl
      ? normalizeInventoryUrlHost(activeDealership.marketcheckWebsiteUrl)
      : undefined) ||
    (persisted.marketcheck_website_url
      ? normalizeInventoryUrlHost(persisted.marketcheck_website_url)
      : undefined);

  const dealerSourceMap: Record<string, string> = {
    '11042155': 'myrockhillgmc.com',
  };

  const source = websiteSource || dealerSourceMap[dealerIdToUse] || undefined;
  const zip = activeDealership.marketcheckZip || undefined;

  // Primary: dealerId (mc_website_id) + source hostname when available
  let result = await fetchAndIngestMarketCheckInventory({
    dealerId: dealerIdToUse,
    source,
    zip,
    radiusMiles: 50,
    condition: 'all',
  });

  // Fallback: if source path returned nothing, retry dealerId-only search
  const hasNoResults =
    (result?.fetched ?? 0) === 0 && (result?.imported ?? 0) === 0 && (result?.valid ?? 0) === 0;
  if (hasNoResults && source) {
    try {
      console.log('[resyncInventory] Source fetch returned 0; retrying dealerId-only', {
        dealerId: dealerIdToUse,
        source,
      });
      result = await fetchAndIngestMarketCheckInventory({
        dealerId: dealerIdToUse,
        zip,
        radiusMiles: 50,
        condition: 'all',
      });
    } catch (fallbackErr) {
      console.error('[resyncInventory] dealerId-only retry failed', fallbackErr);
      throw new Error('MarketCheck sync returned no vehicles; dealerId-only retry failed.');
    }
  }

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
  zip,
  radiusMiles = 50,
  condition = 'all',
  pageSize = 100,
  page = 1,
  maxPages = 1,
  maxVehicles,
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
    console.log('[fetchAndIngestMarketCheckInventory] Calling MCP fetch-and-ingest endpoint:', {
      url: url.replace(ingestionToken || '', '***REDACTED***'),
      dealerId,
      source,
      zip,
      radiusMiles,
      condition,
      maxPages,
      maxVehicles,
    });

    // The ingestion service owns MarketCheck pagination and returns the full
    // inventory in one response. Do not paginate this endpoint again here.
    const pageBudget = Math.max(1, Number(maxPages) || 1);
    let currentPage = page;
    let totalFetched = 0;
    let totalStored = 0;
    let totalValid = 0;
    let totalInvalid = 0;

    async function callIngest(requestedPageSize: number, requestedPage: number) {
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ingestionToken ? { 'Authorization': `Bearer ${ingestionToken}` } : {}),
        },
        body: JSON.stringify({
          dealerId,
          source,
          zip,
          radiusMiles,
          condition,
          pageSize: requestedPageSize,
          page: requestedPage,
          maxPages: pageBudget,
          ...(typeof maxVehicles === 'number' ? { maxVehicles } : {}),
        }),
      });
    }

    while (currentPage <= pageBudget) {
      let response = await callIngest(pageSize, currentPage);

      // If MarketCheck rejects due to pagination limits, retry this page with smaller size
      if (!response.ok && response.status === 422) {
        const errorText = await response.text();
        const mentionsPaginationLimit = errorText.includes('pagination limit') || errorText.includes('500 rows');
        if (mentionsPaginationLimit && pageSize > 50) {
          console.warn(
            '[fetchAndIngestMarketCheckInventory] 422 pagination limit, retrying with smaller pageSize',
            {
              dealerId,
              source,
              attemptedPageSize: pageSize,
              retryPageSize: 50,
              page: currentPage,
            },
          );
          response = await callIngest(50, currentPage);
        } else {
          // Reconstruct the previous response object
          response = new Response(errorText, { status: response.status, statusText: response.statusText });
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `MCP fetch-and-ingest failed (${response.status})`;
        let errorDetails: any = {
          status: response.status,
          statusText: response.statusText,
          url: url.replace(ingestionToken || '', '***REDACTED***'),
        };
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
          if (errorJson.details) {
            errorMessage += `: ${errorJson.details}`;
          }
          errorDetails.responseBody = errorJson;
        } catch {
          errorMessage += `: ${errorText.substring(0, 500)}`;
          errorDetails.responseText = errorText.substring(0, 1000);
        }
        
        console.error('[fetchAndIngestMarketCheckInventory] API error response:', errorDetails);
        const fullError = new Error(errorMessage);
        (fullError as any).status = response.status;
        (fullError as any).responseBody = errorDetails;
        throw fullError;
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Fetch and ingest failed');
      }

      const ingestion = result.ingestion || {};
      const summary = ingestion.summary || {};

      const fetched = result.fetched || 0;
      const stored = summary.stored || 0;
      const valid = summary.valid || 0;
      const invalid = summary.invalid || 0;

      totalFetched += fetched;
      totalStored += stored;
      totalValid += valid;
      totalInvalid += invalid;

      console.log('[fetchAndIngestMarketCheckInventory] Fetch and ingest page complete:', {
        dealerId,
        source,
        page: currentPage,
        pageSize,
        fetched,
        stored,
        valid,
        invalid,
      });

      break;
    }

    // Note: Dealership sync status tracking would require additional fields in the dealerships table
    // For now, sync completion is tracked via the ingestion results and logs

    revalidatePath('/app/inventory');
    revalidatePath('/app/setup');

    return {
      success: true,
      fetched: totalFetched,
      imported: totalStored,
      valid: totalValid,
      invalid: totalInvalid,
      summary: {
        stored: totalStored,
        valid: totalValid,
        invalid: totalInvalid,
      },
    };
  } catch (error) {
    console.error('[fetchAndIngestMarketCheckInventory] Error:', {
      dealerId,
      source,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    // Log full error details for debugging
    if (error instanceof Error) {
      console.error('[fetchAndIngestMarketCheckInventory] Full error stack:', error.stack);
    }
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
    // Fetch a sample of listings to extract dealer locations
    const url = `${baseUrl}/v2/search/car/active?api_key=${apiKey}&dealer_id=${dealerId}&pageSize=50`;
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
  zip,
  radiusMiles = 50,
  condition = 'all',
  source,
  dealershipName,
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
  const normalizedZip = zip?.trim();

  // Use the new fetch-and-ingest endpoint for automated flow
  try {
    const result = await fetchAndIngestMarketCheckInventory({
      dealerId: resolvedDealerId,
      source,
      zip: normalizedZip,
      radiusMiles,
      condition,
    });

    // Update dealer profile to mark inventory as connected
    if (user) {
      try {
        await updateDealerProfile({
          dmsProvider: 'marketcheck',
          inventoryConnected: result.imported > 0,
        });
      } catch (profileError) {
        // Don't throw - allow sync to complete even if profile update fails
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
  } catch (error) {
    // If fetch-and-ingest fails, log warning but continue with legacy flow for backward compatibility
    console.warn('[syncMarketCheckInventory] Fetch-and-ingest failed, falling back to legacy sync:', {
      error: error instanceof Error ? error.message : String(error),
      dealerId: resolvedDealerId,
    });
  }

  // Legacy implementation (kept for backward compatibility if fetch-and-ingest fails)
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) {
    throw new Error('MarketCheck API key is not configured on the server.');
  }

  // Auto-detect source for known dealers that require source endpoint
  // Dealer 11042155 (My Rock Hill GMC) requires source=myrockhillgmc.com
  const dealerSourceMap: Record<string, string> = {
    '11042155': 'myrockhillgmc.com',
  };
  
  const detectedSource = dealerSourceMap[resolvedDealerId] || source;
  const useSourceEndpoint = !!detectedSource;
  
  const baseUrl = useSourceEndpoint
    ? 'https://mc-api.marketcheck.com'
    : (process.env.MARKETCHECK_BASE_URL || MARKETCHECK_DEFAULT_BASE).replace(/\/$/, '');
  
  const searchParams = new URLSearchParams({
    api_key: apiKey,
    page: '1',
    pageSize: '100',
  });

  if (useSourceEndpoint) {
    // Dealer inventory endpoint uses source parameter
    searchParams.set('source', detectedSource);
    console.log('[syncMarketCheckInventory] Using source endpoint for dealer:', {
      dealerId: resolvedDealerId,
      source: detectedSource,
    });
  } else {
    // Standard search endpoint uses dealer_id
    searchParams.set('dealer_id', resolvedDealerId);
    if (normalizedZip) searchParams.set('zip', normalizedZip);
    if (radiusMiles) searchParams.set('radius', radiusMiles.toString());
    if (condition === 'new') searchParams.set('car_type', 'new');
    if (condition === 'used') searchParams.set('car_type', 'used');
  }

  const endpoint = useSourceEndpoint
    ? '/v2/car/dealer/inventory/active'
    : '/v2/search/car/active';
  const url = `${baseUrl}${endpoint}?${searchParams.toString()}`;

  let listings: any[] = [];

  try {
    console.log('[syncMarketCheckInventory] Fetching from MarketCheck:', {
      url: url.replace(apiKey, '***REDACTED***'),
      baseUrl,
      dealerId: resolvedDealerId,
      zip: normalizedZip,
      hasApiKey: !!apiKey,
    });

    const response = await fetch(url, { cache: 'no-store' });
    
    console.log('[syncMarketCheckInventory] Response status:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.error('[syncMarketCheckInventory] MarketCheck API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 500),
      });
      throw new Error(`MarketCheck request failed (${response.status}): ${response.statusText}`);
    }

    const payload = await response.json();
    
    // Log MarketCheck response details
    const listingsArray = Array.isArray(payload.listings) ? payload.listings : [];
    const firstListing = listingsArray.length > 0 ? listingsArray[0] : null;
    const firstVin = firstListing?.vin || null;
    
    console.log('[syncMarketCheckInventory] MarketCheck response:', {
      dealerId: resolvedDealerId,
      zip: normalizedZip ?? null,
      numFound: payload.num_found ?? 0,
      listingsLength: listingsArray.length,
      firstVin,
      hasListings: listingsArray.length > 0,
      url: url.replace(apiKey, '***REDACTED***'),
    });
    
    // Log first listing details if available
    if (firstListing) {
      console.log('[syncMarketCheckInventory] First listing sample:', {
        vin: firstListing.vin,
        year: firstListing.build?.year,
        make: firstListing.build?.make,
        model: firstListing.build?.model,
        dealerId: firstListing.dealer?.id,
        dealerName: firstListing.dealer?.name,
        price: firstListing.price,
        miles: firstListing.miles,
      });
    }
    
    listings = listingsArray;
  } catch (error) {
    console.error('[syncMarketCheckInventory] Fetch error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    throw new Error(
      error instanceof Error
        ? `MarketCheck error: ${error.message}`
        : 'Unable to reach MarketCheck right now.',
    );
  }

  if (!user) {
    throw new Error('Not authenticated.');
  }

  // Get or create active dealership
  let dealershipRecord = activeDealership;
  let dealershipId: string;

  if (!dealershipRecord) {
    // Create a new dealership if none exists
    const name = dealershipName || 'Your Dealership';
    dealershipRecord = await createDealership({
      name,
      marketcheckDealerId: resolvedDealerId,
      marketcheckZip: normalizedZip ?? null,
    });
    dealershipId = dealershipRecord.id;
  } else {
    dealershipId = dealershipRecord.id;
    // Update dealership with latest MarketCheck info
    await updateDealership(dealershipId, {
      marketcheckDealerId: resolvedDealerId,
      marketcheckZip: normalizedZip ?? null,
      name: dealershipName || dealershipRecord.name,
    });
  }

  // Enrich listings if enabled
  const enrichmentEnabled = isEnrichmentEnabled();
  let enrichedCount = 0;
  let skippedCount = 0;

  const enrichedListings = await Promise.all(
    listings.map(async (listing) => {
      const baseListing = listing as MarketCheckVehicle;
      const dealerId = baseListing.dealer?.id?.toString();

      if (enrichmentEnabled && baseListing.id) {
        try {
          const enrichment = await enrichListing(baseListing.id, dealerId, baseUrl, apiKey);
          if (enrichment) {
            enrichedCount++;
            return mergeEnrichment(baseListing, enrichment);
          } else {
            skippedCount++;
          }
        } catch (error) {
          skippedCount++;
          // Log but continue with base listing if enrichment fails
          console.error(JSON.stringify({
            event: 'marketcheck_enrichment_failed',
            listingId: baseListing.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      } else {
        skippedCount++;
      }

      return baseListing;
    }),
  );

  console.log('[syncMarketCheckInventory] Starting UVS ingestion pipeline:', {
    dealerId: resolvedDealerId,
    zip: normalizedZip ?? null,
    enrichedListingsCount: enrichedListings.length,
    originalListingsCount: listings.length,
  });

  // Use UVS ingestion service to normalize, validate, and store vehicles
  const ingestionServiceUrl = process.env.MCP_SERVER_URL || process.env.INGESTION_SERVICE_URL || 'http://localhost:8787';
  const ingestionToken = process.env.INGESTION_API_TOKEN || process.env.MCP_SERVER_TOKEN;

  try {
    console.log('[syncMarketCheckInventory] Calling UVS ingestion service:', {
      url: `${ingestionServiceUrl}/api/ingest/marketcheck`,
      vehicleCount: enrichedListings.length,
      dealerId: resolvedDealerId,
    });

    const ingestionResponse = await fetch(`${ingestionServiceUrl}/api/ingest/marketcheck`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ingestionToken ? { 'Authorization': `Bearer ${ingestionToken}` } : {}),
      },
      body: JSON.stringify({
        vehicles: enrichedListings,
        options: {
          provider: 'marketcheck',
          dealerId: resolvedDealerId,
          dataSource: 'marketcheck-api',
          deletionStrategy: 'mark_unavailable', // Mark vehicles as unavailable if not in new data
          timeoutMs: 30000,
          batchSize: 100,
          continueOnError: true,
        },
      }),
    });

    if (!ingestionResponse.ok) {
      const errorText = await ingestionResponse.text().catch(() => 'Unable to read error response');
      console.error('[syncMarketCheckInventory] Ingestion service error:', {
        status: ingestionResponse.status,
        statusText: ingestionResponse.statusText,
        body: errorText.substring(0, 500),
      });
      throw new Error(`Ingestion service failed (${ingestionResponse.status}): ${ingestionResponse.statusText}`);
    }

    const ingestionResult = await ingestionResponse.json();

    console.log('[syncMarketCheckInventory] UVS ingestion complete:', {
      dealerId: resolvedDealerId,
      zip: normalizedZip ?? null,
      summary: ingestionResult.summary,
      invalidVehicles: ingestionResult.invalidVehicles?.length || 0,
    });

    if (!ingestionResult.success) {
      const errors = ingestionResult.errors || [];
      throw new Error(`Ingestion failed: ${errors.join(', ')}`);
    }

    const storedCount = ingestionResult.summary?.stored || 0;
    const validCount = ingestionResult.summary?.valid || 0;
    const invalidCount = ingestionResult.summary?.invalid || 0;

    if (storedCount === 0 && enrichedListings.length > 0) {
      console.warn('[syncMarketCheckInventory] No vehicles were stored:', {
        dealerId: resolvedDealerId,
        validCount,
        invalidCount,
        errors: ingestionResult.errors,
      });
    }

    // Update dealer profile to mark inventory as connected
    // Note: Dealership info is now stored in the dealerships table, not profiles
    try {
      console.log('[syncMarketCheckInventory] Updating dealer profile:', {
        dealerId: resolvedDealerId,
        zip: normalizedZip ?? null,
        inventoryConnected: storedCount > 0,
        userId: user.id,
        dealershipId,
      });

      await updateDealerProfile({
        dmsProvider: 'marketcheck',
        inventoryConnected: storedCount > 0,
      });

      console.log('[syncMarketCheckInventory] Profile update successful');
    } catch (profileError) {
      console.error('[syncMarketCheckInventory] Profile update failed:', {
        error: profileError instanceof Error ? profileError.message : String(profileError),
        stack: profileError instanceof Error ? profileError.stack : undefined,
        name: profileError instanceof Error ? profileError.name : undefined,
        userId: user.id,
        dealerId: resolvedDealerId,
        zip: normalizedZip ?? null,
      });
      // Don't throw - allow sync to complete even if profile update fails
      // The inventory sync was successful, profile update is secondary
    }

    revalidatePath('/app/setup');
    revalidatePath('/app/leads');
    revalidatePath('/app/inventory');

    // Log ingestion summary
    const summary = ingestionResult.summary || {};
    console.log(
      JSON.stringify({
        event: 'inventory_sync_uvs',
        provider: 'marketcheck',
        dealerId: resolvedDealerId,
        fetched: enrichedListings.length,
        valid: summary.valid || 0,
        invalid: summary.invalid || 0,
        stored: summary.stored || 0,
        deleted: summary.deleted || 0,
        markedUnavailable: summary.markedUnavailable || 0,
        enrichmentEnabled,
        enrichedCount,
        skippedCount,
      }),
    );

    return {
      success: true,
      status: 'synced',
      imported: summary.stored || 0,
      fetched: enrichedListings.length,
      valid: summary.valid || 0,
      invalid: summary.invalid || 0,
    };
  } catch (ingestionError) {
    const errorMsg = ingestionError instanceof Error ? ingestionError.message : String(ingestionError);
    console.error('[syncMarketCheckInventory] UVS ingestion failed, falling back to legacy sync:', {
      error: errorMsg,
      dealerId: resolvedDealerId,
    });

    // Fallback: If ingestion service is unavailable, log warning and return error
    // Don't fall back to old inventory_vehicles table - require UVS pipeline
    throw new Error(`UVS ingestion pipeline failed: ${errorMsg}. Please ensure the MCP server is running and accessible.`);
  }
}

type InventoryRecord = {
  user_id: string;
  dealership_id: string;
  vin: string | null;
  stock_number: string | null;
  listing_id: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  condition: string | null;
  body_type: string | null;
  drivetrain: string | null;
  fuel_type: string | null;
  transmission: string | null;
  price: number | null;
  msrp: number | null;
  price_change_history: unknown;
  miles: number | null;
  dealer_name: string | null;
  dealer_city: string | null;
  dealer_state: string | null;
  dealer_lat: number | null;
  dealer_lng: number | null;
  dealer_phone: string | null;
  dealer_website: string | null;
  dealer_id: string | null;
  dealer_address: string | null;
  photo_urls: string[] | null;
  thumbnail_url: string | null;
  primary_photo_url: string | null;
  video_url: string | null;
  features: string[] | null;
  interior_color: string | null;
  exterior_color: string | null;
  certified: boolean | null;
  market_average_price: number | null;
  days_on_market: number | null;
  source: string | null;
  last_synced_at: string | null;
  sync_status: string | null;
  data_source: string | null;
  lead_status: string | null;
  last_lead_at: string | null;
  lead_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  raw: unknown;
};

function mapVehicleToRecord(
  vehicleInput: ReturnType<typeof normalizeMarketCheckVehicle>,
  listing: unknown,
  userId: string,
  dealershipId: string,
): InventoryRecord {
  const vehicle = VehicleSchema.parse(vehicleInput);

  const photoUrls =
    vehicle.photoUrls && vehicle.photoUrls.length > 0
      ? vehicle.photoUrls
      : vehicle.imageUrl
        ? [vehicle.imageUrl]
        : null;

  return {
    user_id: userId,
    dealership_id: dealershipId,
    vin: vehicle.vin ?? null,
    stock_number: vehicle.stockNumber ?? null,
    listing_id: vehicle.listingId ?? null,
    year: vehicle.year ?? null,
    make: vehicle.make ?? null,
    model: vehicle.model ?? null,
    trim: vehicle.trim ?? null,
    condition: vehicle.condition ?? null,
    body_type: vehicle.bodyType ?? null,
    drivetrain: vehicle.drivetrain ?? null,
    fuel_type: vehicle.fuelType ?? null,
    transmission: vehicle.transmission ?? null,
    price: vehicle.price ?? null,
    msrp: vehicle.msrp ?? null,
    price_change_history: vehicle.priceChangeHistory ?? null,
    miles: vehicle.miles ?? null,
    dealer_name: vehicle.dealer.name ?? null,
    dealer_city: vehicle.dealer.city ?? null,
    dealer_state: vehicle.dealer.state ?? null,
    dealer_lat: vehicle.dealer.latitude ?? null,
    dealer_lng: vehicle.dealer.longitude ?? null,
    dealer_phone: vehicle.dealer.phone ?? null,
    dealer_website: vehicle.dealer.website ?? null,
    dealer_id: vehicle.dealer.dealerId ?? null,
    dealer_address: vehicle.dealer.address ?? null,
    photo_urls: photoUrls,
    thumbnail_url: vehicle.thumbnailUrl ?? vehicle.imageUrl ?? null,
    primary_photo_url: vehicle.imageUrl ?? null,
    video_url: vehicle.videoUrl ?? null,
    features: vehicle.features ?? null,
    interior_color: vehicle.interiorColor ?? null,
    exterior_color: vehicle.exteriorColor ?? null,
    certified: vehicle.certified ?? null,
    market_average_price: vehicle.marketAveragePrice ?? null,
    days_on_market: vehicle.daysOnMarket ?? null,
    source: vehicle.source ?? null,
    last_synced_at: vehicle.lastSyncedAt ?? null,
    sync_status: vehicle.syncStatus ?? null,
    data_source: vehicle.dataSource ?? null,
    lead_status: vehicle.leadStatus ?? null,
    last_lead_at: vehicle.lastLeadAt ?? null,
    lead_id: vehicle.leadId ?? null,
    created_at: vehicle.createdAt ?? null,
    updated_at: vehicle.updatedAt ?? null,
    raw: listing,
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

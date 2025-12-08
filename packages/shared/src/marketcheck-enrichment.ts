/**
 * MarketCheck listing enrichment service
 * 
 * Fetches additional details for listings from MarketCheck detail endpoints:
 * - /v2/listing/car/{id} - Full listing details
 * - /v2/listing/car/{id}/media - Media assets
 * - /v2/listing/car/{id}/extra - Extended features, options, seller comments
 * - /v2/dealer/{dealer_id} - Dealer metadata
 */

import type { MarketCheckVehicle } from './marketcheck.js';

export interface EnrichmentData {
  detail?: MarketCheckVehicle;
  media?: {
    photo_links?: string[];
    primary_photo_url?: string;
    thumbnail?: { url?: string };
    video_url?: string;
  };
  extra?: {
    features?: string[];
    options?: Array<{
      name?: string;
      code?: string;
      description?: string;
    }>;
    seller_comments?: string;
    description?: string;
    specifications?: Record<string, unknown>;
    warranty?: Record<string, unknown>;
    history?: Record<string, unknown>;
  };
  dealer?: {
    id?: string | number;
    name?: string;
    street?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    latitude?: number | string;
    longitude?: number | string;
    phone?: string;
    phone_formatted?: string;
    website?: string;
    email?: string;
    hours?: Record<string, string>;
    rating?: number;
    review_count?: number;
    inventory_count?: number;
  };
}

/**
 * Check if enrichment is enabled via environment variable
 */
export function isEnrichmentEnabled(): boolean {
  return process.env.MARKETCHECK_ENRICH_LISTINGS === '1';
}

/**
 * Fetch listing detail from MarketCheck API with timeout
 */
async function fetchListingDetail(
  listingId: string,
  baseUrl: string,
  apiKey: string,
): Promise<MarketCheckVehicle | null> {
  const url = `${baseUrl}/v2/listing/car/${listingId}?api_key=${apiKey}`;
  const start = Date.now();
  const timeout = 5000; // 5 second timeout per endpoint
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { 
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as MarketCheckVehicle;
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      event: 'marketcheck_enrichment_detail',
      listingId,
      duration,
      success: true,
    }));
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = Date.now() - start;
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(JSON.stringify({
        event: 'marketcheck_enrichment_timeout',
        endpoint: 'listing_detail',
        listingId,
        duration,
        timeout,
      }));
      return null; // Timeout - return null instead of throwing
    }
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch listing media from MarketCheck API with timeout
 */
async function fetchListingMedia(
  listingId: string,
  baseUrl: string,
  apiKey: string,
): Promise<EnrichmentData['media'] | null> {
  const url = `${baseUrl}/v2/listing/car/${listingId}/media?api_key=${apiKey}`;
  const start = Date.now();
  const timeout = 5000; // 5 second timeout per endpoint
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { 
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as { media?: EnrichmentData['media'] };
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      event: 'marketcheck_enrichment_media',
      listingId,
      duration,
      success: true,
    }));
    return data.media ?? null;
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = Date.now() - start;
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(JSON.stringify({
        event: 'marketcheck_enrichment_timeout',
        endpoint: 'listing_media',
        listingId,
        duration,
        timeout,
      }));
      return null; // Timeout - return null instead of throwing
    }
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch listing extra details from MarketCheck API with timeout
 */
async function fetchListingExtra(
  listingId: string,
  baseUrl: string,
  apiKey: string,
): Promise<EnrichmentData['extra'] | null> {
  const url = `${baseUrl}/v2/listing/car/${listingId}/extra?api_key=${apiKey}`;
  const start = Date.now();
  const timeout = 5000; // 5 second timeout per endpoint
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { 
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as EnrichmentData['extra'];
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      event: 'marketcheck_enrichment_extra',
      listingId,
      duration,
      success: true,
    }));
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = Date.now() - start;
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(JSON.stringify({
        event: 'marketcheck_enrichment_timeout',
        endpoint: 'listing_extra',
        listingId,
        duration,
        timeout,
      }));
      return null; // Timeout - return null instead of throwing
    }
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch dealer information from MarketCheck API with timeout
 */
async function fetchDealerInfo(
  dealerId: string,
  baseUrl: string,
  apiKey: string,
): Promise<EnrichmentData['dealer'] | null> {
  const url = `${baseUrl}/v2/dealer/${dealerId}?api_key=${apiKey}`;
  const start = Date.now();
  const timeout = 5000; // 5 second timeout per endpoint
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { 
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as { dealer?: EnrichmentData['dealer'] };
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      event: 'marketcheck_enrichment_dealer',
      dealerId,
      duration,
      success: true,
    }));
    return data.dealer ?? null;
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = Date.now() - start;
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(JSON.stringify({
        event: 'marketcheck_enrichment_timeout',
        endpoint: 'dealer_info',
        dealerId,
        duration,
        timeout,
      }));
      return null; // Timeout - return null instead of throwing
    }
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Enrich a MarketCheck listing with detail, media, extra, and dealer data
 * 
 * @param listingId - The MarketCheck listing ID
 * @param dealerId - Optional dealer ID for dealer endpoint
 * @param baseUrl - MarketCheck API base URL
 * @param apiKey - MarketCheck API key
 * @returns Enrichment data (may be partial if some endpoints fail)
 */
export async function enrichListing(
  listingId: string,
  dealerId: string | undefined,
  baseUrl: string,
  apiKey: string,
): Promise<EnrichmentData | null> {
  if (!isEnrichmentEnabled()) {
    return null;
  }

  const enrichStart = Date.now();
  const result: EnrichmentData = {};

  // Fetch all enrichment endpoints in parallel with individual timeouts
  const detailPromise = fetchListingDetail(listingId, baseUrl, apiKey);
  const mediaPromise = fetchListingMedia(listingId, baseUrl, apiKey);
  const extraPromise = fetchListingExtra(listingId, baseUrl, apiKey);
  const dealerPromise = dealerId ? fetchDealerInfo(dealerId, baseUrl, apiKey) : Promise.resolve(null);

  const [detailResult, mediaResult, extraResult, dealerResult] = await Promise.allSettled([
    detailPromise,
    mediaPromise,
    extraPromise,
    dealerPromise,
  ]);

  if (detailResult.status === 'fulfilled' && detailResult.value) {
    result.detail = detailResult.value;
  } else if (detailResult.status === 'rejected') {
    console.error(JSON.stringify({
      event: 'marketcheck_enrichment_error',
      endpoint: 'listing_detail',
      listingId,
      error: detailResult.reason instanceof Error ? detailResult.reason.message : 'Unknown error',
    }));
  }

  if (mediaResult.status === 'fulfilled' && mediaResult.value) {
    result.media = mediaResult.value;
  } else if (mediaResult.status === 'rejected') {
    console.error(JSON.stringify({
      event: 'marketcheck_enrichment_error',
      endpoint: 'listing_media',
      listingId,
      error: mediaResult.reason instanceof Error ? mediaResult.reason.message : 'Unknown error',
    }));
  }

  if (extraResult.status === 'fulfilled' && extraResult.value) {
    result.extra = extraResult.value;
  } else if (extraResult.status === 'rejected') {
    console.error(JSON.stringify({
      event: 'marketcheck_enrichment_error',
      endpoint: 'listing_extra',
      listingId,
      error: extraResult.reason instanceof Error ? extraResult.reason.message : 'Unknown error',
    }));
  }

  if (dealerResult.status === 'fulfilled' && dealerResult.value) {
    result.dealer = dealerResult.value;
  } else if (dealerResult.status === 'rejected') {
    console.error(JSON.stringify({
      event: 'marketcheck_enrichment_error',
      endpoint: 'dealer_info',
      listingId,
      dealerId,
      error: dealerResult.reason instanceof Error ? dealerResult.reason.message : 'Unknown error',
    }));
  }

  // Return null if all endpoints failed, otherwise return partial data
  if (!result.detail && !result.media && !result.extra && !result.dealer) {
    const enrichDuration = Date.now() - enrichStart;
    console.log(JSON.stringify({
      event: 'marketcheck_enrichment_complete',
      listingId,
      duration: enrichDuration,
      success: false,
      reason: 'all_endpoints_failed',
    }));
    return null;
  }

  const enrichDuration = Date.now() - enrichStart;
  console.log(JSON.stringify({
    event: 'marketcheck_enrichment_complete',
    listingId,
    duration: enrichDuration,
    success: true,
    hasDetail: !!result.detail,
    hasMedia: !!result.media,
    hasExtra: !!result.extra,
    hasDealer: !!result.dealer,
  }));

  return result;
}

/**
 * Merge enrichment data into a MarketCheck listing
 * 
 * @param listing - Base listing from search
 * @param enrichment - Enrichment data to merge
 * @returns Merged listing with enriched fields
 */
export function mergeEnrichment(
  listing: MarketCheckVehicle,
  enrichment: EnrichmentData | null,
): MarketCheckVehicle {
  if (!enrichment) {
    return listing;
  }

  const merged = { ...listing };

  // Merge detail data (prefer detail over search result for fields that exist in both)
  if (enrichment.detail) {
    Object.assign(merged, enrichment.detail);
    // Preserve search result ID
    merged.id = listing.id;
  }

  // Merge media (append additional photos, prefer enriched primary photo)
  if (enrichment.media) {
    const existingPhotos = merged.media?.photo_links ?? [];
    const enrichedPhotos = enrichment.media.photo_links ?? [];
    const allPhotos = [...new Set([...existingPhotos, ...enrichedPhotos])];

    merged.media = {
      ...merged.media,
      ...enrichment.media,
      photo_links: allPhotos.length > 0 ? allPhotos : merged.media?.photo_links,
      primary_photo_url: enrichment.media.primary_photo_url ?? merged.media?.primary_photo_url,
      thumbnail: enrichment.media.thumbnail ?? merged.media?.thumbnail,
      video_url: enrichment.media.video_url ?? merged.media?.video_url,
    };
  }

  // Merge extra features (append to existing)
  if (enrichment.extra) {
    const existingFeatures = merged.features ?? [];
    const extraFeatures = enrichment.extra.features ?? [];
    const allFeatures = [...new Set([...existingFeatures, ...extraFeatures])];
    merged.features = allFeatures.length > 0 ? allFeatures : merged.features;
  }

  // Merge dealer data (prefer enriched dealer info)
  if (enrichment.dealer) {
    merged.dealer = {
      ...merged.dealer,
      ...enrichment.dealer,
      // Preserve name from search if enriched dealer doesn't have it
      name: enrichment.dealer.name ?? merged.dealer?.name ?? 'Unknown Dealer',
    };
  }

  return merged;
}


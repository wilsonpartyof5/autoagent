'use server';

/**
 * UVS-based MarketCheck Inventory Sync
 * 
 * Uses the new UVS ingestion pipeline to normalize, validate, and store vehicles
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { updateDealerProfile } from '@/lib/supabase/profile';
import {
  getActiveDealership,
  getActiveDealershipId,
  getActiveDealershipIdForUser,
  createDealership,
  updateDealership,
} from '@/lib/supabase/dealerships';
import type { MarketCheckVehicle } from '@autoagent/shared';
import {
  enrichListing,
  mergeEnrichment,
  isEnrichmentEnabled,
} from '@autoagent/shared';

// This will need to be imported from the MCP server ingestion service
// For now, we'll create a server action that calls the ingestion API

type SyncInput = {
  dealerId: string;
  zip?: string;
  radiusMiles?: number;
  condition?: 'all' | 'new' | 'used';
  source?: string;
  dealershipName?: string;
};

const MARKETCHECK_DEFAULT_BASE = 'https://marketcheck-prod.apigee.net';

/**
 * Sync MarketCheck inventory using UVS ingestion pipeline
 */
export async function syncMarketCheckInventoryUVS({
  dealerId,
  zip,
  radiusMiles = 50,
  condition = 'all',
  source,
  dealershipName,
}: SyncInput) {
  if (!dealerId) {
    throw new Error('Enter your MarketCheck dealer ID before syncing.');
  }

  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) {
    throw new Error('MarketCheck API key is not configured on the server.');
  }

  // Auto-detect source for known dealers that require source endpoint
  const dealerSourceMap: Record<string, string> = {
    '11042155': 'myrockhillgmc.com',
  };
  
  const detectedSource = dealerSourceMap[dealerId] || source;
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
    searchParams.set('source', detectedSource);
  } else {
    searchParams.set('dealer_id', dealerId);
    if (zip) searchParams.set('zip', zip);
    if (radiusMiles) searchParams.set('radius', radiusMiles.toString());
    if (condition === 'new') searchParams.set('car_type', 'new');
    if (condition === 'used') searchParams.set('car_type', 'used');
  }

  const endpoint = useSourceEndpoint
    ? '/v2/car/dealer/inventory/active'
    : '/v2/search/car/active';
  const url = `${baseUrl}${endpoint}?${searchParams.toString()}`;

  let listings: MarketCheckVehicle[] = [];

  try {
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      throw new Error(`MarketCheck request failed (${response.status}): ${response.statusText}`);
    }

    const payload = await response.json();
    listings = Array.isArray(payload.listings) ? payload.listings : [];

    console.log('[syncMarketCheckInventoryUVS] MarketCheck response:', {
      dealerId,
      numFound: payload.num_found ?? 0,
      listingsLength: listings.length,
    });
  } catch (error) {
    console.error('[syncMarketCheckInventoryUVS] MarketCheck API error:', error);
    throw error;
  }

  if (listings.length === 0) {
    return {
      success: true,
      message: 'No vehicles found in MarketCheck inventory.',
      count: 0,
    };
  }

  // Enrich listings if enabled
  let enrichedListings = listings;
  if (isEnrichmentEnabled()) {
    enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const dealerIdStr = listing.dealer?.id?.toString();
        try {
          const enrichment = await enrichListing(listing.id, dealerIdStr, baseUrl, apiKey);
          if (enrichment) {
            return mergeEnrichment(listing, enrichment);
          }
        } catch (error) {
          console.error('[syncMarketCheckInventoryUVS] Enrichment failed:', {
            listingId: listing.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        return listing;
      })
    );
  }

  // Call UVS ingestion service
  // Note: This should call the MCP server ingestion API or import the service directly
  // For now, we'll need to set up an API endpoint or import path
  
  const ingestionServiceUrl = process.env.INGESTION_SERVICE_URL || process.env.MCP_SERVER_URL;
  
  if (!ingestionServiceUrl) {
    // Fallback: Use direct import if we can access the MCP server code
    // In a monorepo, we should be able to import from '@autoagent/mcp-server'
    throw new Error('INGESTION_SERVICE_URL or MCP_SERVER_URL must be configured');
  }

  try {
    const response = await fetch(`${ingestionServiceUrl}/api/ingest/marketcheck`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INGESTION_SERVICE_TOKEN || ''}`,
      },
      body: JSON.stringify({
        vehicles: enrichedListings,
        options: {
          provider: 'marketcheck',
          dealerId,
          dataSource: 'marketcheck-api',
          deletionStrategy: 'mark_unavailable', // Mark vehicles as unavailable if not in new data
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ingestion service failed (${response.status}): ${response.statusText}`);
    }

    const result = await response.json();

    console.log('[syncMarketCheckInventoryUVS] Ingestion complete:', result);

    // Update dealership if needed
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const dealershipId = await getActiveDealershipIdForUser(user.id);
      if (dealershipId) {
        await updateDealership(dealershipId, {});
      } else if (dealershipName) {
        // Create dealership if it doesn't exist
        await createDealership({
          name: dealershipName,
          marketcheckDealerId: dealerId,
        });
      }
    }

    revalidatePath('/app/inventory');
    revalidatePath('/app/setup');

    return {
      success: true,
      message: `Synced ${result.summary?.stored || 0} vehicles from MarketCheck.`,
      count: result.summary?.stored || 0,
      summary: result.summary,
    };
  } catch (error) {
    console.error('[syncMarketCheckInventoryUVS] Ingestion failed:', error);
    throw error;
  }
}

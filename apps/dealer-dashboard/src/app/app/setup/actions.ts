'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { updateDealerProfile, type InventoryProvider } from '@/lib/supabase/profile';
import {
  getActiveDealership,
  getActiveDealershipId,
  createDealership,
  updateDealership,
  getActiveDealershipIdForUser,
} from '@/lib/supabase/dealerships';
import {
  normalizeMarketCheckVehicle,
  type MarketCheckVehicle,
  VehicleSchema,
  enrichListing,
  mergeEnrichment,
  isEnrichmentEnabled,
} from '@autoagent/shared';

type SyncInput = {
  dealerId: string;
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
};

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
}: FetchAndIngestInput) {
  if (!dealerId && !source) {
    throw new Error('dealerId or source is required');
  }

  const mcpServerUrl = process.env.MCP_SERVER_URL || process.env.INGESTION_SERVICE_URL;
  if (!mcpServerUrl) {
    throw new Error('MCP_SERVER_URL or INGESTION_SERVICE_URL must be configured');
  }

  const ingestionToken = process.env.INGESTION_API_TOKEN || process.env.MCP_SERVER_TOKEN;
  
  const url = `${mcpServerUrl}/api/ingest/marketcheck/fetch-and-ingest`;
  
  try {
    console.log('[fetchAndIngestMarketCheckInventory] Calling MCP fetch-and-ingest endpoint:', {
      url: url.replace(ingestionToken || '', '***REDACTED***'),
      dealerId,
      source,
      zip,
      radiusMiles,
      condition,
    });

    const response = await fetch(url, {
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
        pageSize,
        page,
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

    const ingestion = result.ingestion || {};
    const summary = ingestion.summary || {};

    console.log('[fetchAndIngestMarketCheckInventory] Fetch and ingest complete:', {
      dealerId,
      source,
      fetched: result.fetched || 0,
      stored: summary.stored || 0,
      valid: summary.valid || 0,
      invalid: summary.invalid || 0,
    });

    // Note: Dealership sync status tracking would require additional fields in the dealerships table
    // For now, sync completion is tracked via the ingestion results and logs

    revalidatePath('/app/inventory');
    revalidatePath('/app/setup');

    return {
      success: true,
      fetched: result.fetched || 0,
      imported: summary.stored || 0,
      valid: summary.valid || 0,
      invalid: summary.invalid || 0,
      summary,
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

const MARKETCHECK_DEFAULT_BASE = 'https://api.marketcheck.com';

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
  if (!dealerId) {
    throw new Error('Enter your MarketCheck dealer ID before syncing.');
  }

  // Use the new fetch-and-ingest endpoint for automated flow
  try {
    const result = await fetchAndIngestMarketCheckInventory({
      dealerId: dealerId.trim(),
      source,
      zip: zip?.trim(),
      radiusMiles,
      condition,
    });

    // Update dealer profile to mark inventory as connected
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
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
      imported: result.imported,
      fetched: result.fetched,
      valid: result.valid,
      invalid: result.invalid,
    };
  } catch (error) {
    // If fetch-and-ingest fails, log warning but continue with legacy flow for backward compatibility
    console.warn('[syncMarketCheckInventory] Fetch-and-ingest failed, falling back to legacy sync:', {
      error: error instanceof Error ? error.message : String(error),
      dealerId,
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
    // Dealer inventory endpoint uses source parameter
    searchParams.set('source', detectedSource);
    console.log('[syncMarketCheckInventory] Using source endpoint for dealer:', {
      dealerId,
      source: detectedSource,
    });
  } else {
    // Standard search endpoint uses dealer_id
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

  let listings: any[] = [];

  try {
    console.log('[syncMarketCheckInventory] Fetching from MarketCheck:', {
      url: url.replace(apiKey, '***REDACTED***'),
      baseUrl,
      dealerId,
      zip,
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
      dealerId,
      zip: zip ?? null,
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated.');
  }

  // Get or create active dealership
  let activeDealership = await getActiveDealership();
  let dealershipId: string;

  if (!activeDealership) {
    // Create a new dealership if none exists
    const name = dealershipName || 'Your Dealership';
    activeDealership = await createDealership({
      name,
      marketcheckDealerId: dealerId,
      marketcheckZip: zip ?? null,
    });
    dealershipId = activeDealership.id;
  } else {
    dealershipId = activeDealership.id;
    // Update dealership with latest MarketCheck info
    await updateDealership(dealershipId, {
      marketcheckDealerId: dealerId,
      marketcheckZip: zip ?? null,
      name: dealershipName || activeDealership.name,
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
    dealerId,
    zip: zip ?? null,
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
      dealerId,
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
          dealerId,
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
      dealerId,
      zip: zip ?? null,
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
        dealerId,
        validCount,
        invalidCount,
        errors: ingestionResult.errors,
      });
    }

    // Update dealer profile to mark inventory as connected
    // Note: Dealership info is now stored in the dealerships table, not profiles
    try {
      console.log('[syncMarketCheckInventory] Updating dealer profile:', {
        dealerId,
        zip: zip ?? null,
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
        dealerId,
        zip: zip ?? null,
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
        dealerId,
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
      imported: summary.stored || 0,
    };
  } catch (ingestionError) {
    const errorMsg = ingestionError instanceof Error ? ingestionError.message : String(ingestionError);
    console.error('[syncMarketCheckInventory] UVS ingestion failed, falling back to legacy sync:', {
      error: errorMsg,
      dealerId,
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

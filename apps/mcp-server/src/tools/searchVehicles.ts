import { SearchParamsSchema, type SearchParams } from '@autoagent/shared';
import { safeParse } from '../lib/z';
import { searchCache } from '../lib/cache';
import { randomUUID } from 'crypto';
import { validateToolResult } from '../lib/responseShape';
import { getWidgetHost } from '../utils/getWidgetHost';
import { CONFIG } from '../config/env';
import { searchUVSVehicles, type UVSSearchParams } from '../db/uvs-vehicles';
import type { UnifiedVehicle } from '@autoagent/shared';
import { trackEvent } from '../lib/analytics/tracking';
import { generateRequestId } from '@autoagent/shared';

// Removed createMockVehicles - no longer needed, DB provides real data


/**
 * Generate cache key from search parameters
 */
function generateCacheKey(params: SearchParams): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key as keyof SearchParams];
      return acc;
    }, {} as Record<string, unknown>);
  
  return JSON.stringify(sortedParams);
}

/**
 * Enrich vehicle with map pin and featured card data
 */
function enrichVehicleForStructuredContent(vehicle: UnifiedVehicle | Record<string, unknown>): Record<string, unknown> {
  // Type guard: check if vehicle is UnifiedVehicle
  const isUnifiedVehicle = vehicle && typeof vehicle === 'object' && 'baseIdentity' in vehicle && 'pricing' in vehicle;
  const v = isUnifiedVehicle ? vehicle as UnifiedVehicle : null;
  
  const lat = v?.location?.dealer?.latitude;
  const lng = v?.location?.dealer?.longitude;
  const price = v?.pricing?.price;
  const photoUrl = v?.media?.primaryPhotoUrl || 
                   v?.media?.photoUrls?.[0] || 
                   v?.media?.thumbnailUrl ||
                   v?.media?.images?.[0]?.url;
  const year = v?.baseIdentity?.year;
  const make = v?.baseIdentity?.make;
  const model = v?.baseIdentity?.model;
  const trim = v?.baseIdentity?.trim;
  const title = trim 
    ? `${year} ${make} ${model} ${trim}`.trim()
    : `${year} ${make} ${model}`.trim();
  const dealerName = v?.location?.dealer?.name;
  
  return {
    ...(vehicle as Record<string, unknown>),
    ...(lat !== undefined && { lat }),
    ...(lng !== undefined && { lng }),
    ...(price !== undefined && { price }),
    ...(photoUrl !== undefined && { photoUrl, image: photoUrl }), // Alias for photoUrl
    ...(title && { title }),
    ...(dealerName !== undefined && { dealerName }),
  };
}


/**
 * Search for vehicles using UVS database (replaces MarketCheck API)
 */
export async function searchVehicles(
  params: unknown,
  context?: { /* No PII context */ }
): Promise<{
  success: boolean;
  data?: {
    content: { type: string; text: string; }[];
    vehicles?: unknown[];
    totalCount?: number;
    searchParams?: unknown;
    structuredContent?: unknown;
    components: { type: string; url: string; }[];
  };
  error?: string;
}> {
  const startTime = Date.now();
  const enrichedMetadata: Array<{
    sellerComments?: string;
    optionPackages?: Array<{ name?: string; code?: string; description?: string }>;
  }> = [];
  
  try {
    // Validate input parameters
    const parseResult = safeParse(SearchParamsSchema, params);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid search parameters: ${parseResult.error}`,
      };
    }

    const searchParams: SearchParams = parseResult.data!;
    const cacheKey = generateCacheKey(searchParams);
    // Use single requestId for entire request to maintain correlation
    const requestId = generateRequestId(); // Used as sessionId for request correlation - reused for all events in this request
    
    // Check cache first
    const cachedResult = searchCache.get(cacheKey);
    if (cachedResult) {
      const duration = Date.now() - startTime;
      console.log(JSON.stringify({
        event: 'search',
        source: 'cache',
        fromCache: true,
        results: cachedResult.vehicles.length,
        ms: duration,
      }));

      // Track cached search event
      trackEvent('inventory.search', {
        make: searchParams.make,
        model: searchParams.model,
        condition: searchParams.condition as 'new' | 'used' | 'certified' | undefined,
        priceMin: undefined, // SearchParams only has maxPrice, not minPrice
        priceMax: searchParams.maxPrice,
        location: searchParams.location,
        resultsCount: cachedResult.totalCount,
        searchDuration: duration,
      }, {
        // Note: SearchParams doesn't include dealerId - get from vehicle if needed
        requestId,
        sessionId: requestId, // Use requestId as sessionId for request-level correlation
      }).catch(() => {
        // Tracking failures should not break the request
      });

      const runId = randomUUID();
      const widgetHost = getWidgetHost();
      const isDiag = CONFIG.diagnosticsEnabled;

      // Build URL using URL API to ensure proper encoding
      let vehicleResultsUrl: string;
      try {
        // Ensure widgetHost has protocol
        const baseUrl = widgetHost.startsWith('http://') || widgetHost.startsWith('https://')
          ? widgetHost
          : `https://${widgetHost}`;
        const widgetUrl = new URL('/widget/vehicle-results', baseUrl);
        widgetUrl.searchParams.set('rid', runId);
        if (isDiag) {
          widgetUrl.searchParams.set('diag', '1');
        }
        vehicleResultsUrl = widgetUrl.toString();
      } catch (urlError) {
        // Fallback to template literal if URL constructor fails
        console.error(JSON.stringify({
          event: 'url_construction_error',
          widgetHost,
          error: urlError instanceof Error ? urlError.message : 'Unknown error',
        }));
        vehicleResultsUrl = `${widgetHost}/widget/vehicle-results?rid=${encodeURIComponent(runId)}${isDiag ? '&diag=1' : ''}`;
      }

      console.log(JSON.stringify({evt:'diag.tool', runId, url: vehicleResultsUrl, ts:Date.now()}));

      // Enrich cached vehicles with map pin and featured card data
      const enrichedCachedVehicles = (cachedResult.vehicles as UnifiedVehicle[]).map(vehicle => 
        enrichVehicleForStructuredContent(vehicle)
      );
      
      return {
        success: true,
        data: {
          content: [{ type: 'text', text: `Found ${cachedResult.totalCount} vehicles (run ${runId})` }],
          vehicles: cachedResult.vehicles as unknown[], // Cache may contain legacy format
          totalCount: cachedResult.totalCount,
          searchParams,
          structuredContent: {
            results: { vehicles: enrichedCachedVehicles, totalCount: cachedResult.totalCount, searchParams }
          },
          components: [
            { type: 'iframe', url: vehicleResultsUrl }
          ]
        },
      };
    }

    // Query UVS vehicles from database instead of MarketCheck API
    let vehicles: UnifiedVehicle[] = [];
    let totalCount = 0;
    const fromCache = false;

    try {
      // Map SearchParams to UVSSearchParams
      const uvsSearchParams: UVSSearchParams = {
        make: searchParams.make,
        model: searchParams.model,
        condition: searchParams.condition, // SearchParams.condition is 'new' | 'used'
        maxPrice: searchParams.maxPrice,
        minMiles: searchParams.condition === 'used' ? 1 : undefined, // Used vehicles must have miles > 0
        maxMiles: searchParams.mileageMax,
        bodyStyle: searchParams.bodyStyle,
        // Note: SearchParams doesn't have dealerId/dealerName, but UVSSearchParams does (optional)
        limit: 20,
        offset: 0,
      };

      // Query UVS vehicles from database
      const searchStart = Date.now();
      const dbResult = await searchUVSVehicles(uvsSearchParams);

      const searchDuration = Date.now() - searchStart;
      console.log(JSON.stringify({
        event: 'uvs_db_search',
        duration: searchDuration,
        success: true,
        results: dbResult.vehicles.length,
        totalCount: dbResult.total,
        params: uvsSearchParams,
      }));

      vehicles = dbResult.vehicles;
      totalCount = dbResult.total;
      
      // Track vehicle.view for each vehicle returned in search results
      vehicles.forEach((vehicle) => {
        const vehicleId = vehicle.id;
        const vin = vehicle.baseIdentity?.vin;
        // Track vehicle view event (async, don't block)
        // Note: dealerId from vehicle location, not searchParams
        const dealerId = vehicle.location?.dealer?.dealerId;
        if (vehicleId && dealerId) {
          trackEvent('vehicle.view', {
            vehicleId,
            vin: vin || undefined,
            year: vehicle.baseIdentity?.year,
            make: vehicle.baseIdentity?.make,
            model: vehicle.baseIdentity?.model,
            price: vehicle.pricing?.price,
            source: 'search_results',
          }, {
            dealerId,
            vehicleId,
            vin: vin || undefined,
            requestId,
            sessionId: requestId, // Use requestId as sessionId for correlation
          }).catch(() => {
            // Tracking failures should not break the request
          });
        }
      });
      
      // Extract enriched metadata from UVS vehicles if available
      vehicles.forEach((vehicle, index) => {
        const enrichment = vehicle.enrichment;
        if (enrichment?.providerSpecific) {
          const providerData = enrichment.providerSpecific as unknown as Record<string, unknown>;
          const marketcheck = providerData.marketcheck as unknown as Record<string, unknown> | undefined;
          if (marketcheck && typeof marketcheck === 'object' && 'extra' in marketcheck) {
            const extra = marketcheck.extra as unknown as Record<string, unknown> | undefined;
            if (extra && typeof extra === 'object') {
              enrichedMetadata[index] = {
                sellerComments: extra.seller_comments as string | undefined,
                optionPackages: extra.options as Array<{ name?: string; code?: string; description?: string }> | undefined,
              };
            }
          }
        }
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({
        event: 'uvs_db_search_failed',
        error: errorMsg,
        params: searchParams,
      }));
      
      // Fallback: return empty results rather than failing
      // In production, this should be handled more gracefully
      vehicles = [];
      totalCount = 0;
    }

    // Cache the result
    const result = { vehicles, totalCount };
    searchCache.set(cacheKey, result);

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      event: 'search',
      source: 'uvs_db',
      fromCache,
      results: vehicles.length,
      totalCount,
      ms: duration,
    }));

    // Track search event (reuse requestId from start of function)
    trackEvent('inventory.search', {
      make: searchParams.make,
      model: searchParams.model,
      condition: searchParams.condition as 'new' | 'used' | 'certified' | undefined,
      priceMin: undefined, // SearchParams only has maxPrice, not minPrice
      priceMax: searchParams.maxPrice,
      location: searchParams.location,
      resultsCount: totalCount,
      searchDuration: duration,
    }, {
      // Note: SearchParams doesn't include dealerId - omit from tracking
      requestId,
      sessionId: requestId, // Use requestId as sessionId for request-level correlation
    }).catch(() => {
      // Tracking failures should not break the request
    });

    const runId = randomUUID();
    const widgetHost = getWidgetHost();
    const isDiag = CONFIG.diagnosticsEnabled;
    
    // Build URL using URL API to ensure proper encoding
    let vehicleResultsUrl: string;
    try {
      // Ensure widgetHost has protocol
      const baseUrl = widgetHost.startsWith('http://') || widgetHost.startsWith('https://') 
        ? widgetHost 
        : `https://${widgetHost}`;
      const widgetUrl = new URL('/widget/vehicle-results', baseUrl);
      widgetUrl.searchParams.set('rid', runId);
      if (isDiag) {
        widgetUrl.searchParams.set('diag', '1');
      }
      vehicleResultsUrl = widgetUrl.toString();
    } catch (urlError) {
      // Fallback to template literal if URL constructor fails
      console.error(JSON.stringify({
        event: 'url_construction_error',
        widgetHost,
        error: urlError instanceof Error ? urlError.message : 'Unknown error',
      }));
      vehicleResultsUrl = `${widgetHost}/widget/vehicle-results?rid=${encodeURIComponent(runId)}${isDiag ? '&diag=1' : ''}`;
    }
    
    console.log(JSON.stringify({evt:'diag.tool', runId, url: vehicleResultsUrl, urlLength: vehicleResultsUrl.length, ts:Date.now()}));
    
    // Validate URL format before using it
    try {
      new URL(vehicleResultsUrl);
      console.log(JSON.stringify({event: 'url_validation', url: vehicleResultsUrl, valid: true}));
    } catch (urlError) {
      console.error(JSON.stringify({
        event: 'url_validation_failed',
        url: vehicleResultsUrl,
        error: urlError instanceof Error ? urlError.message : 'Unknown error',
      }));
    }
    
      // Build structuredContent with enriched fields for map pins and featured cards
      const structuredContentVehicles = vehicles.map((vehicle, index) => {
        // Add enriched metadata if available
        const enriched = enrichedMetadata[index];
        let base: UnifiedVehicle | Record<string, unknown> = vehicle;
        
        if (enriched) {
          // Safely add enriched metadata
          base = {
            ...vehicle,
            ...(enriched.sellerComments !== undefined && { sellerComments: enriched.sellerComments }),
            ...(enriched.optionPackages !== undefined && { optionPackages: enriched.optionPackages }),
          };
        }
        
        // Enrich with map pin and featured card data
        return enrichVehicleForStructuredContent(base);
      });

    const toolResult = {
      success: true,
      data: {
        content: [{ type: 'text', text: `Found ${totalCount} vehicles (run ${runId})` }],
        vehicles,
        totalCount,
        searchParams,
        structuredContent: { 
          results: { 
            vehicles: structuredContentVehicles, 
            totalCount, 
            searchParams 
          } as unknown
        },
        components: [
          { type: 'iframe', url: vehicleResultsUrl }
        ]
      },
      error: undefined
    };
    
    // Validate the result shape
    validateToolResult(toolResult.data);
    
    return toolResult;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({
      event: 'search_error',
      source: 'uvs_db',
      ms: duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

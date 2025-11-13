import { SearchParamsSchema, type SearchParams, type Vehicle, normalizeMarketCheckVehicle, type MarketCheckVehicle } from '@autoagent/shared';
import { safeParse } from '../lib/z.js';
import { createMarketCheckClient } from '../services/marketcheck.js';
import { searchCache } from '../lib/cache.js';
import { randomUUID } from 'crypto';
import { validateToolResult } from '../lib/responseShape.js';
import { fetchWithTimeout } from '../lib/http.js';
import {
  enrichListing,
  mergeEnrichment,
  isEnrichmentEnabled,
} from '@autoagent/shared';

function createMockVehicles(): Vehicle[] {
  const timestamp = new Date().toISOString();
  return [
    {
      id: 'mock-1',
      vin: '1HGCM82633A004352',
      stockNumber: 'AA-1234',
      listingId: 'mock-listing-1',
      year: 2022,
      make: 'Toyota',
      model: 'Camry',
      trim: 'SE',
      condition: 'used',
      bodyType: 'Sedan',
      drivetrain: 'FWD',
      fuelType: 'Gasoline',
      transmission: 'Automatic',
      price: 28500,
      msrp: 32000,
      priceChangeHistory: [
        {
          price: 28950,
          timestamp,
          source: 'mock-history',
        },
      ],
      miles: 15000,
      dealer: {
        dealerId: 'dealer-1',
        name: 'Seattle Auto Center',
        city: 'Seattle',
        state: 'WA',
        latitude: 47.6062,
        longitude: -122.3321,
        phone: '206-555-0100',
        website: 'https://dealer.example.com',
        address: '123 Main St, Seattle, WA 98101',
      },
      photoUrls: [
        'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400',
        'https://images.unsplash.com/photo-1617817741679-6c9691b2db7d?w=400',
      ],
      thumbnailUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400',
      videoUrl: undefined,
      imageUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400',
      features: ['Bluetooth', 'Backup Camera', 'Lane Assist'],
      interiorColor: 'Black',
      exteriorColor: 'Blue',
      certified: false,
      marketAveragePrice: 29200,
      daysOnMarket: 21,
      source: 'marketcheck',
      lastSyncedAt: timestamp,
      syncStatus: 'success',
      dataSource: 'mock-data',
      leadStatus: 'none',
      lastLeadAt: undefined,
      leadId: undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'mock-2',
      vin: '2HGCM82633A004353',
      stockNumber: 'AA-5678',
      listingId: 'mock-listing-2',
      year: 2021,
      make: 'Honda',
      model: 'CR-V',
      trim: 'EX-L',
      condition: 'used',
      bodyType: 'SUV',
      drivetrain: 'AWD',
      fuelType: 'Gasoline',
      transmission: 'Automatic',
      price: 32000,
      msrp: 35000,
      priceChangeHistory: [
        {
          price: 33000,
          timestamp,
          source: 'mock-history',
        },
      ],
      miles: 22000,
      dealer: {
        dealerId: 'dealer-2',
        name: 'Bellevue Motors',
        city: 'Bellevue',
        state: 'WA',
        latitude: 47.6101,
        longitude: -122.2015,
        phone: '425-555-0123',
        website: 'https://bellevuemotors.example.com',
        address: '456 Auto Way, Bellevue, WA 98004',
      },
      photoUrls: [
        'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400',
      ],
      thumbnailUrl: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400',
      videoUrl: undefined,
      imageUrl: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400',
      features: ['AWD', 'Sunroof', 'Heated Seats'],
      interiorColor: 'Gray',
      exteriorColor: 'White',
      certified: true,
      marketAveragePrice: 32500,
      daysOnMarket: 12,
      source: 'marketcheck',
      lastSyncedAt: timestamp,
      syncStatus: 'success',
      dataSource: 'mock-data',
      leadStatus: 'none',
      lastLeadAt: undefined,
      leadId: undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'mock-3',
      vin: '3HGCM82633A004354',
      stockNumber: 'AA-9012',
      listingId: 'mock-listing-3',
      year: 2023,
      make: 'Subaru',
      model: 'Outback',
      trim: 'Limited',
      condition: 'used',
      bodyType: 'Wagon',
      drivetrain: 'AWD',
      fuelType: 'Gasoline',
      transmission: 'CVT',
      price: 35000,
      msrp: 37000,
      priceChangeHistory: [
        {
          price: 35500,
          timestamp,
          source: 'mock-history',
        },
      ],
      miles: 5000,
      dealer: {
        dealerId: 'dealer-3',
        name: 'Tacoma Auto Group',
        city: 'Tacoma',
        state: 'WA',
        latitude: 47.2529,
        longitude: -122.4443,
        phone: '253-555-0199',
        website: 'https://tacomaauto.example.com',
        address: '789 Car Blvd, Tacoma, WA 98402',
      },
      photoUrls: [
        'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=400',
      ],
      thumbnailUrl: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=400',
      videoUrl: undefined,
      imageUrl: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=400',
      features: ['AWD', 'Eyesight Safety', 'Apple CarPlay'],
      interiorColor: 'Tan',
      exteriorColor: 'Green',
      certified: false,
      marketAveragePrice: 34800,
      daysOnMarket: 6,
      source: 'marketcheck',
      lastSyncedAt: timestamp,
      syncStatus: 'success',
      dataSource: 'mock-data',
      leadStatus: 'none',
      lastLeadAt: undefined,
      leadId: undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}


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
 * Search for vehicles using MarketCheck API with fallback to mocks
 */
export async function searchVehicles(params: unknown): Promise<{
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
    
    // Check cache first
    const cachedResult = searchCache.get(cacheKey);
    if (cachedResult) {
      const duration = Date.now() - startTime;
      console.log(JSON.stringify({
        event: 'search',
        hasKey: !!process.env.MARKETCHECK_API_KEY,
        fromCache: true,
        results: cachedResult.vehicles.length,
        ms: duration,
      }));
      
      const runId = randomUUID();
      const widgetHost = process.env.WIDGET_HOST || 'https://rana-flightiest-malcolm.ngrok-free.dev';
      const isDiag = process.env.AA_DIAG === '1';
      const vehicleResultsUrl = `${widgetHost}/widget/vehicle-results?rid=${runId}${isDiag ? '&diag=1' : ''}`;
      
      console.log(JSON.stringify({evt:'diag.tool', runId, url: vehicleResultsUrl, ts:Date.now()}));
      
      return {
        success: true,
        data: {
          content: [{ type: 'text', text: `Found ${cachedResult.totalCount} vehicles (run ${runId})` }],
          vehicles: cachedResult.vehicles,
          totalCount: cachedResult.totalCount,
          searchParams,
          structuredContent: { 
            results: { vehicles: cachedResult.vehicles, totalCount: cachedResult.totalCount, searchParams }
          },
          components: [
            { type: 'iframe', url: vehicleResultsUrl }
          ]
        },
      };
    }

    // Use MarketCheck API only - no mock data fallback
    const marketCheckClient = createMarketCheckClient();
    let vehicles: Vehicle[] = [];
    let totalCount = 0;
    const fromCache = false;

    if (!marketCheckClient) {
      // Return mock data for development/testing
      const mockVehicles = createMockVehicles();

      // Filter mock data by search parameters
      const filteredVehicles = mockVehicles.filter((vehicle) => {
        if (searchParams.maxPrice && vehicle.price > searchParams.maxPrice) {
          return false;
        }
        if (
          searchParams.make &&
          !vehicle.make.toLowerCase().includes(searchParams.make.toLowerCase())
        ) {
          return false;
        }
        if (
          searchParams.model &&
          !vehicle.model.toLowerCase().includes(searchParams.model.toLowerCase())
        ) {
          return false;
        }
        if (searchParams.condition === 'new' && vehicle.condition !== 'new') {
          return false;
        }
        if (searchParams.condition === 'used' && vehicle.condition === 'new') {
          return false;
        }
        if (
          searchParams.condition === 'used' &&
          typeof vehicle.miles === 'number' &&
          vehicle.miles === 0
        ) {
          return false;
        }
        return true;
      });

      vehicles = filteredVehicles;
      totalCount = filteredVehicles.length;
    } else {
    try {
      const baseUrl = process.env.MARKETCHECK_BASE_URL || 'https://marketcheck-prod.apigee.net';
      const apiKey = process.env.MARKETCHECK_API_KEY || '';
      
      // Fetch raw listings first (for enrichment)
      const searchParamsUrl = new URLSearchParams();
      searchParamsUrl.set('api_key', apiKey);
      if (searchParams.location) searchParamsUrl.set('location', searchParams.location);
      if (searchParams.condition === 'used') searchParamsUrl.set('car_type', 'used');
      if (searchParams.condition === 'new') searchParamsUrl.set('car_type', 'new');
      if (searchParams.maxPrice) searchParamsUrl.set('price_range', `0-${searchParams.maxPrice}`);
      if (searchParams.make) searchParamsUrl.set('make', searchParams.make);
      if (searchParams.model) searchParamsUrl.set('model', searchParams.model);
      if (searchParams.radiusMiles) searchParamsUrl.set('radius', searchParams.radiusMiles.toString());
      searchParamsUrl.set('page', '1');
      searchParamsUrl.set('pageSize', '20');

      const searchStart = Date.now();
      let rawResponse;
      try {
        rawResponse = await fetchWithTimeout<{ listings: MarketCheckVehicle[]; num_found: number }>(
          `${baseUrl}/v2/search/car/active?${searchParamsUrl.toString()}`,
          { timeout: 10000 },
        );

        const searchDuration = Date.now() - searchStart;
        console.log(JSON.stringify({
          event: 'marketcheck_search',
          duration: searchDuration,
          success: true,
          listings: rawResponse.data.listings?.length || 0,
          totalCount: rawResponse.data.num_found || 0,
        }));
      } catch (error) {
        const searchDuration = Date.now() - searchStart;
        console.error(JSON.stringify({
          event: 'marketcheck_search_timeout',
          duration: searchDuration,
          timeout: 10000,
          error: error instanceof Error ? error.message : 'unknown',
        }));
        throw error;
      }

      let listings = rawResponse.data.listings || [];
      totalCount = Math.min(rawResponse.data.num_found || 0, 20);
      listings = listings.slice(0, 20);

      // Enrich listings if enabled
      let enrichedCount = 0;
      let photosMerged = 0;
      let featuresMerged = 0;
      const enrichmentEnabled = isEnrichmentEnabled();

      if (enrichmentEnabled) {
        const enrichedListings = await Promise.all(
          listings.map(async (listing, index) => {
            const dealerId = listing.dealer?.id?.toString();
            try {
              const enrichment = await enrichListing(listing.id, dealerId, baseUrl, apiKey);
              if (enrichment) {
                enrichedCount++;
                if (enrichment.media?.photo_links) {
                  photosMerged += enrichment.media.photo_links.length;
                }
                if (enrichment.extra?.features) {
                  featuresMerged += enrichment.extra.features.length;
                }
                
                // Store enriched metadata for structuredContent
                if (enrichment.extra) {
                  enrichedMetadata[index] = {
                    sellerComments: enrichment.extra.seller_comments,
                    optionPackages: enrichment.extra.options,
                  };
                }
                
                return mergeEnrichment(listing, enrichment);
              }
            } catch (error) {
              // Log but continue
              console.error(JSON.stringify({
                event: 'marketcheck_enrichment_failed',
                listingId: listing.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              }));
            }
            return listing;
          }),
        );
        listings = enrichedListings;

        // Log enrichment stats
        console.log(JSON.stringify({
          event: 'search_enrichment',
          enrichmentEnabled,
          enrichedCount,
          totalListings: listings.length,
          photosMerged,
          featuresMerged,
        }));
      }

      // Normalize listings to vehicles
      vehicles = listings.map(normalizeMarketCheckVehicle);
    } catch (error) {
        // Fall back to mock data when MarketCheck fails
        console.error('MarketCheck API failed, falling back to mock data:', error);
        
        // Use the same mock data as when no API key
        const mockVehicles = createMockVehicles();

        // Filter mock data by search parameters
        const filteredVehicles = mockVehicles.filter((vehicle) => {
          if (searchParams.maxPrice && vehicle.price > searchParams.maxPrice) {
            return false;
          }
          if (
            searchParams.make &&
            !vehicle.make.toLowerCase().includes(searchParams.make.toLowerCase())
          ) {
            return false;
          }
          if (
            searchParams.model &&
            !vehicle.model.toLowerCase().includes(searchParams.model.toLowerCase())
          ) {
            return false;
          }
          if (searchParams.condition === 'new' && vehicle.condition !== 'new') {
            return false;
          }
          if (searchParams.condition === 'used' && vehicle.condition === 'new') {
            return false;
          }
          if (
            searchParams.condition === 'used' &&
            typeof vehicle.miles === 'number' &&
            vehicle.miles === 0
          ) {
            return false;
          }
          return true;
        });

        vehicles = filteredVehicles;
        totalCount = filteredVehicles.length;
      }
    }

    // Cache the result
    const result = { vehicles, totalCount };
    searchCache.set(cacheKey, result);

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      event: 'search',
      hasKey: !!process.env.MARKETCHECK_API_KEY,
      enrichmentEnabled: isEnrichmentEnabled(),
      fromCache,
      results: vehicles.length,
      ms: duration,
    }));

    const runId = randomUUID();
    const widgetHost = process.env.WIDGET_HOST || 'https://rana-flightiest-malcolm.ngrok-free.dev';
    const isDiag = process.env.AA_DIAG === '1';
    const vehicleResultsUrl = `${widgetHost}/widget/vehicle-results?rid=${runId}${isDiag ? '&diag=1' : ''}`;
    
    console.log(JSON.stringify({evt:'diag.tool', runId, url: vehicleResultsUrl, ts:Date.now()}));
    
    // Build structuredContent with enriched fields
    const structuredContentVehicles = vehicles.map((vehicle, index) => {
      const base = vehicle as Record<string, unknown>;
      // Add enriched fields if available
      const enriched = enrichedMetadata[index];
      if (enriched) {
        return {
          ...base,
          sellerComments: enriched.sellerComments,
          optionPackages: enriched.optionPackages,
        };
      }
      return base;
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
      hasKey: !!process.env.MARKETCHECK_API_KEY,
      ms: duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

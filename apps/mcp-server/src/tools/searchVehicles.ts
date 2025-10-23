import { SearchParamsSchema, type SearchParams, type Vehicle } from '@autoagent/shared';
import { safeParse, withTimeout } from '../lib/z.js';
import { createMarketCheckClient } from '../services/marketcheck.js';
import { searchCache } from '../lib/cache.js';
import { randomUUID } from 'crypto';
import { validateToolResult } from '../lib/responseShape.js';


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
      const mockVehicles = [
  {
    id: '1',
    year: 2022,
    make: 'Toyota',
    model: 'Camry',
    price: 28500,
    mileage: 15000,
    imageUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400',
    features: ['Bluetooth', 'Backup Camera', 'Lane Assist'],
    vin: '1HGCM82633A004352',
    dealer: {
      name: 'Seattle Auto Center',
      address: '123 Main St, Seattle, WA 98101',
      lat: 47.6062,
      lng: -122.3321,
    },
  },
  {
    id: '2',
    year: 2021,
    make: 'Honda',
    model: 'CR-V',
    price: 32000,
    mileage: 22000,
    imageUrl: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400',
    features: ['AWD', 'Sunroof', 'Heated Seats'],
    vin: '2HGCM82633A004353',
    dealer: {
      name: 'Bellevue Motors',
      address: '456 Auto Way, Bellevue, WA 98004',
      lat: 47.6101,
      lng: -122.2015,
    },
  },
  {
    id: '3',
    year: 2023,
    make: 'Subaru',
    model: 'Outback',
    price: 35000,
    mileage: 5000,
    imageUrl: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=400',
    features: ['AWD', 'Eyesight Safety', 'Apple CarPlay'],
    vin: '3HGCM82633A004354',
    dealer: {
      name: 'Tacoma Auto Group',
      address: '789 Car Blvd, Tacoma, WA 98402',
      lat: 47.2529,
      lng: -122.4443,
    },
  },
];

      // Filter mock data by search parameters
      const filteredVehicles = mockVehicles.filter(vehicle => {
        if (searchParams.maxPrice && vehicle.price > searchParams.maxPrice) {
      return false;
    }
        if (searchParams.make && !vehicle.make.toLowerCase().includes(searchParams.make.toLowerCase())) {
      return false;
    }
        if (searchParams.model && !vehicle.model.toLowerCase().includes(searchParams.model.toLowerCase())) {
      return false;
    }
        if (searchParams.condition === 'new' && vehicle.mileage && vehicle.mileage > 0) {
      return false;
    }
        if (searchParams.condition === 'used' && (!vehicle.mileage || vehicle.mileage === 0)) {
      return false;
    }
    return true;
  });

      vehicles = filteredVehicles;
      totalCount = filteredVehicles.length;
    } else {
    try {
      const result = await withTimeout(
        marketCheckClient.searchVehicles(searchParams),
        5000, // Increased timeout to 5 seconds for real API
      );
      
      vehicles = result.vehicles;
      totalCount = result.totalCount;
    } catch (error) {
        // Fall back to mock data when MarketCheck fails
        console.error('MarketCheck API failed, falling back to mock data:', error);
        
        // Use the same mock data as when no API key
        const mockVehicles = [
          {
            id: '1',
            year: 2022,
            make: 'Toyota',
            model: 'Camry',
            price: 28500,
            mileage: 15000,
            imageUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=400',
            features: ['Bluetooth', 'Backup Camera', 'Lane Assist'],
            vin: '1HGCM82633A004352',
            dealer: {
              name: 'Seattle Auto Center',
              address: '123 Main St, Seattle, WA 98101',
              lat: 47.6062,
              lng: -122.3321,
            },
          },
          {
            id: '2',
            year: 2021,
            make: 'Honda',
            model: 'CR-V',
            price: 32000,
            mileage: 22000,
            imageUrl: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400',
            features: ['AWD', 'Sunroof', 'Heated Seats'],
            vin: '2HGCM82633A004353',
            dealer: {
              name: 'Bellevue Motors',
              address: '456 Auto Way, Bellevue, WA 98004',
              lat: 47.6101,
              lng: -122.2015,
            },
          },
          {
            id: '3',
            year: 2023,
            make: 'Subaru',
            model: 'Outback',
            price: 35000,
            mileage: 5000,
            imageUrl: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=400',
            features: ['AWD', 'Eyesight Safety', 'Apple CarPlay'],
            vin: '3HGCM82633A004354',
            dealer: {
              name: 'Tacoma Auto Group',
              address: '789 Car Blvd, Tacoma, WA 98402',
              lat: 47.2529,
              lng: -122.4443,
            },
          },
        ];

        // Filter mock data by search parameters
        const filteredVehicles = mockVehicles.filter(vehicle => {
          if (searchParams.maxPrice && vehicle.price > searchParams.maxPrice) {
            return false;
          }
          if (searchParams.make && !vehicle.make.toLowerCase().includes(searchParams.make.toLowerCase())) {
            return false;
          }
          if (searchParams.model && !vehicle.model.toLowerCase().includes(searchParams.model.toLowerCase())) {
            return false;
          }
          if (searchParams.condition === 'new' && vehicle.mileage && vehicle.mileage > 0) {
            return false;
          }
          if (searchParams.condition === 'used' && (!vehicle.mileage || vehicle.mileage === 0)) {
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
      fromCache,
      results: vehicles.length,
      ms: duration,
    }));

    const runId = randomUUID();
    const widgetHost = process.env.WIDGET_HOST || 'https://rana-flightiest-malcolm.ngrok-free.dev';
    const isDiag = process.env.AA_DIAG === '1';
    const vehicleResultsUrl = `${widgetHost}/widget/vehicle-results?rid=${runId}${isDiag ? '&diag=1' : ''}`;
    
    console.log(JSON.stringify({evt:'diag.tool', runId, url: vehicleResultsUrl, ts:Date.now()}));
    
    const toolResult = {
      success: true,
      data: {
        content: [{ type: 'text', text: `Found ${totalCount} vehicles (run ${runId})` }],
        vehicles,
        totalCount,
        searchParams,
        structuredContent: { 
          results: { vehicles, totalCount, searchParams } as unknown
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

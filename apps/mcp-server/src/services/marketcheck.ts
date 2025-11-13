import { fetchWithTimeout, HttpError } from '../lib/http.js';
import {
  type Vehicle,
  type SearchParams,
  normalizeMarketCheckVehicle,
  type MarketCheckVehicle,
} from '@autoagent/shared';

interface MarketCheckResponse {
  listings: MarketCheckVehicle[];
  num_found: number;
  page: number;
  pageSize: number;
}

/**
 * MarketCheck API client
 */
export class MarketCheckClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Search for vehicles using MarketCheck API
   */
  async searchVehicles(params: SearchParams): Promise<{
    vehicles: Vehicle[];
    totalCount: number;
  }> {
    const url = this.buildSearchUrl(params);
    
    try {
      const response = await fetchWithTimeout<MarketCheckResponse>(url, {
        timeout: 2000,
      });

      // Cap results at 20 vehicles
      const listings = response.data.listings || [];
      const vehicles = listings.slice(0, 20);
      
      return {
        vehicles: vehicles.map(normalizeMarketCheckVehicle),
        totalCount: Math.min(response.data.num_found || 0, 20),
      };
    } catch (error) {
      console.error('MarketCheck API error:', {
        event: 'marketcheck_error',
        code: error instanceof HttpError ? error.status : undefined,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Build search URL with query parameters
   */
  private buildSearchUrl(params: SearchParams): string {
    const searchParams = new URLSearchParams();
    
    // MarketCheck API key
    searchParams.set('api_key', this.apiKey);
    
    // Required parameters - MarketCheck format
    if (params.location) {
      searchParams.set('location', params.location);
    }
    if (params.condition === 'used') {
      searchParams.set('car_type', 'used');
    } else if (params.condition === 'new') {
      searchParams.set('car_type', 'new');
    }
    
    // Optional parameters
    if (params.maxPrice) {
      searchParams.set('price_range', `0-${params.maxPrice}`);
    }
    if (params.make) {
      searchParams.set('make', params.make);
    }
    if (params.model) {
      searchParams.set('model', params.model);
    }
    if (params.radiusMiles) {
      searchParams.set('radius', params.radiusMiles.toString());
    }
    
    // Pagination - first page only
    searchParams.set('page', '1');
    searchParams.set('pageSize', '20');
    
    return `${this.baseUrl}/v2/search/car/active?${searchParams.toString()}`;
  }

}

/**
 * Create MarketCheck client instance
 */
export function createMarketCheckClient(): MarketCheckClient | null {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  const baseUrl = process.env.MARKETCHECK_BASE_URL || 'https://mc-api.example.com';
  
  if (!apiKey) {
    return null;
  }
  
  return new MarketCheckClient(baseUrl, apiKey);
}

import { fetchWithTimeout, HttpError } from '../lib/http.js';
import { type Vehicle, type SearchParams } from '@autoagent/shared';

/**
 * MarketCheck API response types
 */
interface MarketCheckVehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  price: number;
  mileage?: number;
  images?: Array<{ url: string; primary?: boolean }>;
  features?: string[];
  vin?: string;
  dealer: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    latitude?: number;
    longitude?: number;
  };
  condition?: 'new' | 'used';
}

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
      const vehicles = response.data.listings.slice(0, 20);
      
      return {
        vehicles: vehicles.map(this.normalizeVehicle),
        totalCount: Math.min(response.data.num_found, 20),
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

  /**
   * Normalize MarketCheck vehicle to our Vehicle schema
   */
  private normalizeVehicle(mcVehicle: any): Vehicle {
    // Get primary image or first available image
    let imageUrl: string | undefined;
    if (mcVehicle.media?.photo_links && mcVehicle.media.photo_links.length > 0) {
      imageUrl = mcVehicle.media.photo_links[0];
    }
    
    // Build dealer address if available
    let dealerAddress: string | undefined;
    const parts = [
      mcVehicle.dealer?.street,
      mcVehicle.dealer?.city,
      mcVehicle.dealer?.state,
      mcVehicle.dealer?.zip,
    ].filter(Boolean);
    dealerAddress = parts.length > 0 ? parts.join(', ') : undefined;
    
    return {
      id: mcVehicle.id,
      year: mcVehicle.build?.year,
      make: mcVehicle.build?.make,
      model: mcVehicle.build?.model,
      price: mcVehicle.price,
      mileage: mcVehicle.miles,
      imageUrl,
      features: mcVehicle.build ? [
        mcVehicle.build.trim,
        mcVehicle.build.engine,
        mcVehicle.build.transmission,
        mcVehicle.build.drivetrain,
      ].filter(Boolean) : undefined,
      vin: mcVehicle.vin,
      dealer: {
        name: mcVehicle.dealer?.name,
        address: dealerAddress,
        lat: mcVehicle.dealer?.latitude ? parseFloat(mcVehicle.dealer.latitude) : undefined,
        lng: mcVehicle.dealer?.longitude ? parseFloat(mcVehicle.dealer.longitude) : undefined,
      },
    };
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

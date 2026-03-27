import { NextRequest, NextResponse } from 'next/server';
import { searchUVSVehiclesByBounds } from '@/lib/db/uvs-vehicles';
import type { UnifiedVehicle } from '@autoagent/shared';

/**
 * POST /api/inventory/search
 * 
 * Inventory Search API for iOS app
 * 
 * Request JSON:
 * {
 *   "bounds": { "north": 34.9855, "south": 34.9123, "east": -80.9234, "west": -81.0123 },
 *   "filters": { "minPrice": 20000, "maxPrice": 80000, "make": "GMC", "model": "Sierra", "condition": "new" },
 *   "pagination": { "page": 1, "limit": 8 },
 *   "userLocation": { "latitude": 34.95, "longitude": -80.98 }
 * }
 * 
 * Response JSON:
 * {
 *   "success": true,
 *   "data": {
 *     "vehicles": [...],
 *     "pagination": { "page": 1, "limit": 8, "total": 232, "totalPages": 29, "hasNextPage": true, "hasPreviousPage": false }
 *   }
 * }
 */

interface SearchRequest {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    make?: string;
    model?: string;
    year?: number;
    minYear?: number;
    maxYear?: number;
    maxMiles?: number;
    condition?: 'new' | 'used' | 'certified';
    dealerId?: string;
  };
  pagination?: {
    page?: number;
    limit?: number;
  };
  userLocation?: {
    latitude: number;
    longitude: number;
  };
}

interface VehicleResponse {
  id: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  condition: 'new' | 'used' | 'certified';
  price: number;
  msrp?: number;
  miles?: number;
  bodyType?: string;
  thumbnailUrl?: string;
  primaryPhotoUrl?: string;
  location: {
    latitude: number;
    longitude: number;
    dealerName: string;
    dealerCity?: string;
    dealerState?: string;
  };
  vin?: string;
}

function formatVehicleForResponse(vehicle: UnifiedVehicle): VehicleResponse | null {
  // Ensure coordinates exist
  const latitude = vehicle.location?.dealer?.latitude;
  const longitude = vehicle.location?.dealer?.longitude;
  
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return null; // Skip vehicles without coordinates
  }
  
  // Debug logging for media field
  console.log('[formatVehicleForResponse] Vehicle media debug:', {
    id: vehicle.id,
    make: vehicle.baseIdentity.make,
    model: vehicle.baseIdentity.model,
    hasMedia: !!vehicle.media,
    mediaKeys: vehicle.media ? Object.keys(vehicle.media) : [],
    thumbnailUrl: vehicle.media?.thumbnailUrl,
    primaryPhotoUrl: vehicle.media?.primaryPhotoUrl,
    photoUrls: vehicle.media?.photoUrls,
    imagesLength: vehicle.media?.images?.length,
  });
  
  return {
    id: vehicle.id,
    year: vehicle.baseIdentity.year,
    make: vehicle.baseIdentity.make,
    model: vehicle.baseIdentity.model,
    trim: vehicle.baseIdentity.trim,
    condition: vehicle.condition,
    price: vehicle.pricing.price,
    msrp: vehicle.pricing.msrp ?? undefined,
    miles: vehicle.coreSpecs?.miles ?? undefined,
    bodyType: vehicle.coreSpecs?.bodyType ?? undefined,
    thumbnailUrl: vehicle.media?.thumbnailUrl ?? undefined,
    primaryPhotoUrl: vehicle.media?.primaryPhotoUrl ?? vehicle.media?.images?.[0]?.url ?? undefined,
    location: {
      latitude,
      longitude,
      dealerName: vehicle.location.dealer.name,
      dealerCity: vehicle.location.dealer.city ?? undefined,
      dealerState: vehicle.location.dealer.state ?? undefined,
    },
    vin: vehicle.baseIdentity.vin ?? undefined,
  };
}

function validateApiKey(request: NextRequest): boolean {
  const apiKey = process.env.INVENTORY_SEARCH_API_KEY;
  
  if (!apiKey) {
    return false; // API key not configured
  }
  
  // Check x-api-key header
  const headerKey = request.headers.get('x-api-key');
  if (headerKey === apiKey) {
    return true;
  }
  
  // Check Authorization: Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === apiKey) {
      return true;
    }
  }
  
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!validateApiKey(request)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or missing API key. Provide x-api-key header or Authorization: Bearer <key>',
          },
        },
        { status: 401 }
      );
    }
    
    // Parse request body
    let body: SearchRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid JSON in request body',
          },
        },
        { status: 400 }
      );
    }
    
    // Validate bounds (required)
    if (!body.bounds || typeof body.bounds !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_BOUNDS',
            message: 'Bounds are required and must include north, south, east, and west values',
          },
        },
        { status: 400 }
      );
    }
    
    const { north, south, east, west } = body.bounds;
    
    if (
      typeof north !== 'number' ||
      typeof south !== 'number' ||
      typeof east !== 'number' ||
      typeof west !== 'number' ||
      isNaN(north) ||
      isNaN(south) ||
      isNaN(east) ||
      isNaN(west)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_BOUNDS',
            message: 'Bounds must be valid numbers (north, south, east, west)',
          },
        },
        { status: 400 }
      );
    }
    
    // Validate bounds logic
    if (north <= south || east <= west) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_BOUNDS',
            message: 'Invalid bounds: north must be > south, east must be > west',
          },
        },
        { status: 400 }
      );
    }
    
    // Validate latitude/longitude ranges
    if (north > 90 || south < -90 || east > 180 || west < -180) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_BOUNDS',
            message: 'Bounds out of valid range: latitude [-90, 90], longitude [-180, 180]',
          },
        },
        { status: 400 }
      );
    }
    
    // Validate pagination
    const page = body.pagination?.page ?? 1;
    const limit = Math.min(Math.max(body.pagination?.limit ?? 8, 1), 50); // Default 8, min 1, max 50
    
    if (page < 1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PAGINATION',
            message: 'Page must be >= 1',
          },
        },
        { status: 400 }
      );
    }
    
    const offset = (page - 1) * limit;
    
    // Validate userLocation if provided
    if (body.userLocation) {
      const { latitude, longitude } = body.userLocation;
      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_USER_LOCATION',
              message: 'userLocation must have valid latitude [-90, 90] and longitude [-180, 180]',
            },
          },
          { status: 400 }
        );
      }
    }
    
    // Validate filters if provided
    if (body.filters) {
      const { minPrice, maxPrice, year, minYear, maxYear, maxMiles } = body.filters;
      
      if (minPrice !== undefined && (typeof minPrice !== 'number' || minPrice < 0)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_FILTERS',
              message: 'minPrice must be a non-negative number',
            },
          },
          { status: 400 }
        );
      }
      
      if (maxPrice !== undefined && (typeof maxPrice !== 'number' || maxPrice < 0)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_FILTERS',
              message: 'maxPrice must be a non-negative number',
            },
          },
          { status: 400 }
        );
      }
      
      if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_FILTERS',
              message: 'minPrice must be <= maxPrice',
            },
          },
          { status: 400 }
        );
      }
      
      if (year !== undefined && (typeof year !== 'number' || year < 1900 || year > 2100)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_FILTERS',
              message: 'year must be a valid year between 1900 and 2100',
            },
          },
          { status: 400 }
        );
      }
      
      if (minYear !== undefined && (typeof minYear !== 'number' || minYear < 1900 || minYear > 2100)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_FILTERS',
              message: 'minYear must be a valid year between 1900 and 2100',
            },
          },
          { status: 400 }
        );
      }
      
      if (maxYear !== undefined && (typeof maxYear !== 'number' || maxYear < 1900 || maxYear > 2100)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_FILTERS',
              message: 'maxYear must be a valid year between 1900 and 2100',
            },
          },
          { status: 400 }
        );
      }
      
      if (minYear !== undefined && maxYear !== undefined && minYear > maxYear) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_FILTERS',
              message: 'minYear must be <= maxYear',
            },
          },
          { status: 400 }
        );
      }
      
      if (maxMiles !== undefined && (typeof maxMiles !== 'number' || maxMiles < 0)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_FILTERS',
              message: 'maxMiles must be a non-negative number',
            },
          },
          { status: 400 }
        );
      }
      
      if (body.filters.condition && !['new', 'used', 'certified'].includes(body.filters.condition)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_FILTERS',
              message: 'condition must be one of: new, used, certified',
            },
          },
          { status: 400 }
        );
      }
    }
    
    // Perform search
    const searchResult = await searchUVSVehiclesByBounds({
      bounds: {
        north,
        south,
        east,
        west,
      },
      userLocation: body.userLocation,
      filters: body.filters,
      limit,
      offset,
    });
    
    // Format vehicles for response (exclude those without coordinates)
    const formattedVehicles = searchResult.vehicles
      .map(formatVehicleForResponse)
      .filter((v): v is VehicleResponse => v !== null);
    
    // Calculate pagination metadata
    const total = searchResult.total;
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;
    
    return NextResponse.json({
      success: true,
      data: {
        vehicles: formattedVehicles,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
      },
    });
  } catch (error) {
    console.error('[inventory-search] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}


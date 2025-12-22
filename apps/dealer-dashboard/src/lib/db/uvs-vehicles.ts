/**
 * UVS Vehicles Database Operations
 * 
 * Handles CRUD operations for uvs_vehicles table with full UVS schema support
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UnifiedVehicle } from '@autoagent/shared';

/**
 * Map UnifiedVehicle to database row format
 * Extracts key fields for indexing while preserving full UVS document
 */
function mapUVSToRow(vehicle: UnifiedVehicle): {
  id: string;
  vin: string | null;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  stock_number: string | null;
  listing_id: string | null;
  vehicle_type: string | null;
  condition: string;
  price: number;
  msrp: number | null;
  currency: string;
  body_type: string | null;
  fuel_type: string | null;
  drivetrain: string | null;
  transmission_type: string | null;
  miles: number | null;
  kilometers: number | null;
  dealer_id: string | null;
  dealer_name: string;
  dealer_city: string | null;
  dealer_state: string | null;
  dealer_country: string | null;
  dealer_latitude: number | null;
  dealer_longitude: number | null;
  availability_status: string | null;
  is_live: boolean;
  published_at: string | null;
  available_date: string | null;
  sold_date: string | null;
  days_on_market: number | null;
  data_source: string | null;
  source: string | null;
  last_synced_at: string;
  sync_status: string;
  sync_error: string | null;
  sync_retry_count: number;
  uvs_data: UnifiedVehicle;
} {
  return {
    id: vehicle.id,
    vin: vehicle.baseIdentity.vin ?? null,
    year: vehicle.baseIdentity.year,
    make: vehicle.baseIdentity.make,
    model: vehicle.baseIdentity.model,
    trim: vehicle.baseIdentity.trim ?? null,
    stock_number: vehicle.baseIdentity.stockNumber ?? null,
    listing_id: vehicle.baseIdentity.listingId ?? null,
    vehicle_type: vehicle.baseIdentity.vehicleType ?? null,
    condition: vehicle.condition,
    price: vehicle.pricing.price,
    msrp: vehicle.pricing.msrp ?? null,
    currency: vehicle.pricing.currency ?? 'USD',
    body_type: vehicle.coreSpecs?.bodyType ?? null,
    fuel_type: vehicle.coreSpecs?.fuelType ?? null,
    drivetrain: vehicle.coreSpecs?.drivetrain ?? null,
    transmission_type: vehicle.coreSpecs?.transmission?.type ?? null,
    miles: vehicle.coreSpecs?.miles ?? null,
    kilometers: vehicle.coreSpecs?.kilometers ?? null,
    dealer_id: vehicle.location.dealer.dealerId ?? null,
    dealer_name: vehicle.location.dealer.name,
    dealer_city: vehicle.location.dealer.city ?? null,
    dealer_state: vehicle.location.dealer.state ?? null,
    dealer_country: vehicle.location.dealer.country ?? null,
    dealer_latitude: vehicle.location.dealer.latitude ?? null,
    dealer_longitude: vehicle.location.dealer.longitude ?? null,
    availability_status: vehicle.availability?.status ?? null,
    is_live: vehicle.availability?.isLive ?? false,
    published_at: vehicle.availability?.publishedAt ?? null,
    available_date: vehicle.availability?.availableDate ?? null,
    sold_date: vehicle.availability?.soldDate ?? null,
    days_on_market: vehicle.availability?.daysOnMarket ?? null,
    data_source: vehicle.operational.dataSource ?? null,
    source: vehicle.operational.source ?? null,
    last_synced_at: vehicle.operational.lastSyncedAt,
    sync_status: vehicle.operational.syncStatus ?? 'success',
    sync_error: vehicle.operational.syncError ?? null,
    sync_retry_count: vehicle.operational.syncRetryCount ?? 0,
    uvs_data: vehicle, // Store full UVS document
  };
}

/**
 * Map database row back to UnifiedVehicle
 */
function mapRowToUVS(row: any): UnifiedVehicle {
  // If uvs_data is available and valid, use it directly
  if (row.uvs_data && typeof row.uvs_data === 'object') {
    return row.uvs_data as UnifiedVehicle;
  }
  
  // Otherwise reconstruct from extracted fields (fallback)
  // This should rarely be needed if we always store uvs_data
  throw new Error('uvs_data is required but missing from database row');
}

/**
 * Insert a new UVS vehicle
 */
export async function insertUVSVehicle(vehicle: UnifiedVehicle): Promise<{ id: string }> {
  const supabase = await createClient();
  const row = mapUVSToRow(vehicle);
  
  const { data, error } = await supabase
    .from('uvs_vehicles')
    .insert(row)
    .select('id')
    .single();
  
  if (error) {
    throw new Error(`Failed to insert UVS vehicle: ${error.message}`);
  }
  
  return { id: data.id };
}

/**
 * Update an existing UVS vehicle
 */
export async function updateUVSVehicle(
  id: string,
  vehicle: UnifiedVehicle
): Promise<{ id: string }> {
  const supabase = await createClient();
  const row = mapUVSToRow(vehicle);
  
  const { data, error } = await supabase
    .from('uvs_vehicles')
    .update(row)
    .eq('id', id)
    .select('id')
    .single();
  
  if (error) {
    throw new Error(`Failed to update UVS vehicle: ${error.message}`);
  }
  
  return { id: data.id };
}

/**
 * Delete a UVS vehicle
 */
export async function deleteUVSVehicle(id: string): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('uvs_vehicles')
    .delete()
    .eq('id', id);
  
  if (error) {
    throw new Error(`Failed to delete UVS vehicle: ${error.message}`);
  }
}

/**
 * Upsert a UVS vehicle (insert or update)
 * Uses id as the conflict key
 */
export async function upsertUVSVehicle(vehicle: UnifiedVehicle): Promise<{ id: string }> {
  const supabase = await createClient();
  const row = mapUVSToRow(vehicle);
  
  const { data, error } = await supabase
    .from('uvs_vehicles')
    .upsert(row, {
      onConflict: 'id',
      ignoreDuplicates: false,
    })
    .select('id')
    .single();
  
  if (error) {
    throw new Error(`Failed to upsert UVS vehicle: ${error.message}`);
  }
  
  return { id: data.id };
}

/**
 * Upsert multiple UVS vehicles in a batch
 */
export async function upsertUVSVehicles(vehicles: UnifiedVehicle[]): Promise<{ inserted: number; updated: number }> {
  if (vehicles.length === 0) {
    return { inserted: 0, updated: 0 };
  }
  
  const supabase = await createClient();
  const rows = vehicles.map(mapUVSToRow);
  
  // Batch upsert in chunks of 1000 to avoid payload limits
  const chunkSize = 1000;
  let inserted = 0;
  let updated = 0;
  
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const chunkIds = chunk.map(r => r.id);
    
    try {
      // Check which vehicles already exist
      const { data: existing, error: checkError } = await supabase
        .from('uvs_vehicles')
        .select('id')
        .in('id', chunkIds);
      
      if (checkError) {
        throw new Error(`Failed to check existing vehicles: ${checkError.message}`);
      }
      
      const existingIds = new Set((existing || []).map(r => r.id));
      
      // Upsert the chunk
      const { data, error } = await supabase
        .from('uvs_vehicles')
        .upsert(chunk, {
          onConflict: 'id',
          ignoreDuplicates: false,
        })
        .select('id');
      
      if (error) {
        throw new Error(`Failed to batch upsert UVS vehicles: ${error.message}`);
      }
      
      // Count actual inserts vs updates
      let chunkInserted = 0;
      let chunkUpdated = 0;
      
      for (const row of chunk) {
        if (existingIds.has(row.id as string)) {
          chunkUpdated++;
        } else {
          chunkInserted++;
        }
      }
      
      inserted += chunkInserted;
      updated += chunkUpdated;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to batch upsert UVS vehicles: ${errorMsg}`);
    }
  }
  
  return { inserted, updated };
}

/**
 * Get a UVS vehicle by ID
 */
export async function getUVSVehicleById(id: string): Promise<UnifiedVehicle | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('uvs_vehicles')
    .select('uvs_data')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to get UVS vehicle: ${error.message}`);
  }
  
  return data.uvs_data as UnifiedVehicle;
}

/**
 * Get UVS vehicles by VIN
 */
export async function getUVSVehiclesByVIN(vin: string): Promise<UnifiedVehicle[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('uvs_vehicles')
    .select('uvs_data')
    .eq('vin', vin);
  
  if (error) {
    throw new Error(`Failed to get UVS vehicles by VIN: ${error.message}`);
  }
  
  return (data || []).map((row) => row.uvs_data as UnifiedVehicle);
}

/**
 * Search UVS vehicles with filters
 */
export interface UVSVehicleSearchFilters {
  make?: string;
  model?: string;
  year?: number;
  minYear?: number;
  maxYear?: number;
  condition?: 'new' | 'used' | 'certified';
  minPrice?: number;
  maxPrice?: number;
  minMiles?: number;
  maxMiles?: number;
  trim?: string;
  dealerId?: string;
  dealerName?: string;
  availabilityStatus?: string;
  dataSource?: string;
  limit?: number;
  offset?: number;
}

/**
 * Search UVS vehicles with filters
 */
export async function searchUVSVehicles(
  filters: UVSVehicleSearchFilters
): Promise<{ vehicles: UnifiedVehicle[]; total: number }> {
  const supabase = await createClient();
  
  let query = supabase.from('uvs_vehicles').select('uvs_data', { count: 'exact' });
  
  // Apply filters
  if (filters.make) {
    query = query.eq('make', filters.make);
  }
  if (filters.model) {
    query = query.eq('model', filters.model);
  }
  if (filters.year) {
    query = query.eq('year', filters.year);
  }
  if (filters.minYear) {
    query = query.gte('year', filters.minYear);
  }
  if (filters.maxYear) {
    query = query.lte('year', filters.maxYear);
  }
  if (filters.condition) {
    query = query.eq('condition', filters.condition);
  }
  if (filters.minPrice !== undefined) {
    query = query.gte('price', filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte('price', filters.maxPrice);
  }
  if (filters.minMiles !== undefined) {
    query = query.gte('miles', filters.minMiles);
  }
  if (filters.maxMiles !== undefined) {
    query = query.lte('miles', filters.maxMiles);
  }
  if (filters.trim) {
    // Use JSONB query for nested trim field
    query = query.contains('uvs_data', { baseIdentity: { trim: filters.trim } });
  }
  if (filters.dealerId) {
    query = query.eq('dealer_id', filters.dealerId);
  }
  if (filters.dealerName) {
    query = query.ilike('dealer_name', `%${filters.dealerName}%`);
  }
  if (filters.availabilityStatus) {
    query = query.eq('availability_status', filters.availabilityStatus);
  } else {
    // Default to available only
    query = query.eq('availability_status', 'available');
  }
  if (filters.dataSource) {
    query = query.eq('data_source', filters.dataSource);
  }
  
  // Apply pagination
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);
  
  // Order by most recently synced
  query = query.order('last_synced_at', { ascending: false });
  
  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(`Failed to search UVS vehicles: ${error.message}`);
  }
  
  const vehicles = (data || []).map((row) => row.uvs_data as UnifiedVehicle);
  
  return {
    vehicles,
    total: count || 0,
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate map center from bounds
 */
function calculateMapCenter(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): { latitude: number; longitude: number } {
  return {
    latitude: (bounds.north + bounds.south) / 2,
    longitude: (bounds.east + bounds.west) / 2,
  };
}

/**
 * Search UVS vehicles by map bounds with distance-based ordering
 */
export interface UVSVehicleBoundsSearchParams {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  userLocation?: {
    latitude: number;
    longitude: number;
  };
  filters?: {
    make?: string;
    model?: string;
    year?: number;
    minYear?: number;
    maxYear?: number;
    condition?: 'new' | 'used' | 'certified';
    minPrice?: number;
    maxPrice?: number;
    maxMiles?: number;
    dealerId?: string;
  };
  limit?: number;
  offset?: number;
}

export interface VehicleWithDistance extends UnifiedVehicle {
  _distance?: number; // Distance in kilometers (internal use)
}

/**
 * Search UVS vehicles by bounds with distance-based ordering
 * 
 * Note: Uses admin client to bypass RLS for public API access
 * (API key authentication is handled at the route level)
 */
export async function searchUVSVehiclesByBounds(
  params: UVSVehicleBoundsSearchParams
): Promise<{ vehicles: VehicleWithDistance[]; total: number }> {
  // Use admin client to bypass RLS for public API
  // API key authentication is enforced at the route level
  const supabase = createAdminClient();
  
  // Determine reference location for distance calculation
  const referenceLocation = params.userLocation || calculateMapCenter(params.bounds);
  
  // Build query with bounds filtering
  // Select additional fields needed for distance calculation
  let query = supabase
    .from('uvs_vehicles')
    .select('uvs_data, dealer_latitude, dealer_longitude', { count: 'exact' });
  
  // Filter by bounds (latitude and longitude)
  query = query
    .gte('dealer_latitude', params.bounds.south)
    .lte('dealer_latitude', params.bounds.north)
    .gte('dealer_longitude', params.bounds.west)
    .lte('dealer_longitude', params.bounds.east);
  
  // Exclude NULL coordinates
  query = query
    .not('dealer_latitude', 'is', null)
    .not('dealer_longitude', 'is', null);
  
  // Default to available only
  query = query.eq('availability_status', 'available');
  
  // Apply filters
  if (params.filters) {
    if (params.filters.make) {
      query = query.eq('make', params.filters.make);
    }
    if (params.filters.model) {
      query = query.eq('model', params.filters.model);
    }
    if (params.filters.year !== undefined) {
      query = query.eq('year', params.filters.year);
    }
    if (params.filters.minYear !== undefined) {
      query = query.gte('year', params.filters.minYear);
    }
    if (params.filters.maxYear !== undefined) {
      query = query.lte('year', params.filters.maxYear);
    }
    if (params.filters.condition) {
      query = query.eq('condition', params.filters.condition);
    }
    if (params.filters.minPrice !== undefined) {
      query = query.gte('price', params.filters.minPrice);
    }
    if (params.filters.maxPrice !== undefined) {
      query = query.lte('price', params.filters.maxPrice);
    }
    if (params.filters.maxMiles !== undefined) {
      query = query.lte('miles', params.filters.maxMiles);
    }
    if (params.filters.dealerId) {
      query = query.eq('dealer_id', params.filters.dealerId);
    }
  }
  
  // Fetch a larger set for distance sorting (up to 200 to ensure we have enough)
  // We'll sort by distance in JS, then apply pagination
  const fetchLimit = Math.min(200, (params.limit || 8) * 5);
  query = query.limit(fetchLimit);
  
  // Order by most recently synced as secondary sort (will be overridden by distance)
  query = query.order('last_synced_at', { ascending: false });
  
  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(`Failed to search UVS vehicles by bounds: ${error.message}`);
  }
  
  // Calculate distances and attach to vehicles
  const vehiclesWithDistance: VehicleWithDistance[] = (data || [])
    .filter((row) => {
      // Double-check coordinates exist
      return (
        row.dealer_latitude !== null &&
        row.dealer_longitude !== null &&
        row.uvs_data
      );
    })
    .map((row) => {
      const vehicle = row.uvs_data as UnifiedVehicle;
      const dealerLat = row.dealer_latitude as number;
      const dealerLng = row.dealer_longitude as number;
      
      // Ensure location.dealer has coordinates (populate from database row if missing)
      if (!vehicle.location) {
        vehicle.location = { dealer: { name: 'Unknown Dealer' } };
      }
      if (!vehicle.location.dealer) {
        vehicle.location.dealer = { name: 'Unknown Dealer' };
      }
      // Populate coordinates from database row (may be missing in uvs_data JSONB)
      vehicle.location.dealer.latitude = dealerLat;
      vehicle.location.dealer.longitude = dealerLng;
      
      const distance = calculateDistance(
        referenceLocation.latitude,
        referenceLocation.longitude,
        dealerLat,
        dealerLng
      );
      return {
        ...vehicle,
        _distance: distance,
      } as VehicleWithDistance;
    });
  
  // Sort by distance (nearest first)
  vehiclesWithDistance.sort((a, b) => (a._distance || Infinity) - (b._distance || Infinity));
  
  // Apply pagination
  const limit = params.limit || 8;
  const offset = params.offset || 0;
  const paginatedVehicles = vehiclesWithDistance.slice(offset, offset + limit);
  
  return {
    vehicles: paginatedVehicles,
    total: count || 0,
  };
}

/**
 * Convert UnifiedVehicle to InventoryVehicle format for dashboard display
 */
export function convertUVSToInventoryVehicle(vehicle: UnifiedVehicle, row?: {
  id: string;
  created_at: string;
  updated_at: string;
  last_synced_at: string;
  sync_status?: string;
  sync_error?: string;
}): {
  id: string;
  vin: string | null;
  stock_number: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  price: number | null;
  msrp: number | null;
  miles: number | null;
  condition: string | null;
  body_type: string | null;
  drivetrain: string | null;
  fuel_type: string | null;
  transmission: string | null;
  interior_color: string | null;
  exterior_color: string | null;
  certified: boolean | null;
  features: string[] | null;
  market_average_price: number | null;
  days_on_market: number | null;
  thumbnail_url: string | null;
  primary_photo_url: string | null;
  photo_urls: string[] | null;
  dealer_name: string | null;
  dealer_address: string | null;
  dealer_city: string | null;
  dealer_state: string | null;
  dealer_phone: string | null;
  dealer_website: string | null;
  is_live: boolean | null;
  published_at: string | null;
  published_by: string | null;
  raw: unknown;
  // UVS-specific fields
  last_synced_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
} {
  const dealer = vehicle.location?.dealer;
  const rawFeatures = vehicle.featuresPackages?.features;
  const features = Array.isArray(rawFeatures)
    ? rawFeatures
        .map((f) =>
          typeof f === 'string'
            ? f
            : f && typeof f === 'object' && 'name' in f
            ? (f as { name?: string }).name ?? ''
            : ''
        )
        .filter(Boolean)
    : null;
  
  return {
    id: vehicle.id,
    vin: vehicle.baseIdentity?.vin || null,
    stock_number: vehicle.baseIdentity?.stockNumber || null,
    year: vehicle.baseIdentity?.year || null,
    make: vehicle.baseIdentity?.make || null,
    model: vehicle.baseIdentity?.model || null,
    trim: vehicle.baseIdentity?.trim || null,
    price: vehicle.pricing?.price ? Number(vehicle.pricing.price) : null,
    msrp: vehicle.pricing?.msrp ? Number(vehicle.pricing.msrp) : null,
    miles: vehicle.coreSpecs?.miles ? Number(vehicle.coreSpecs.miles) : null,
    condition: vehicle.condition || null,
    body_type: vehicle.coreSpecs?.bodyType || null,
    drivetrain: vehicle.coreSpecs?.drivetrain || null,
    fuel_type: vehicle.coreSpecs?.fuelType || null,
    transmission: vehicle.coreSpecs?.transmission?.type || null,
    interior_color: vehicle.featuresPackages?.interiorColor || null,
    exterior_color: vehicle.featuresPackages?.exteriorColor || null,
    certified: vehicle.condition === 'certified' || null,
    features,
    market_average_price: vehicle.marketData?.marketAveragePrice ? Number(vehicle.marketData.marketAveragePrice) : null,
    days_on_market: vehicle.availability?.daysOnMarket ?? null,
    thumbnail_url: vehicle.media?.thumbnailUrl || null,
    primary_photo_url: vehicle.media?.primaryPhotoUrl || vehicle.media?.images?.[0]?.url || null,
    photo_urls: vehicle.media?.photoUrls
      ? [...vehicle.media.photoUrls]
      : vehicle.media?.images?.map(img => img.url) || null,
    dealer_name: dealer?.name || null,
    dealer_address: dealer?.address || null,
    dealer_city: dealer?.city || null,
    dealer_state: dealer?.state || null,
    dealer_phone: dealer?.phone || null,
    dealer_website: dealer?.website || null,
    is_live: vehicle.availability?.isLive || false,
    published_at: vehicle.availability?.publishedAt || null,
    published_by: null, // Not in UVS schema
    raw: vehicle, // Store full UVS object as raw
    // UVS-specific fields
    last_synced_at: row?.last_synced_at || vehicle.operational?.lastSyncedAt || null,
    sync_status: row?.sync_status || 'success',
    sync_error: row?.sync_error || null,
  };
}

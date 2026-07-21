/**
 * UVS Vehicles Database Query Service
 * 
 * Queries uvs_vehicles table from Supabase for the MCP server
 */

import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config/env.js';
import type { UnifiedVehicle } from '@autoagent/shared';
import pino from 'pino';

const logger = (pino as any)();

/**
 * Get Supabase client for queries
 */
function getSupabaseClient() {
  const supabaseUrl = CONFIG.supabaseUrl;
  const supabaseServiceKey = CONFIG.supabaseServiceRoleKey;
  const supabaseAnonKey = CONFIG.supabaseAnonKey;
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle queries');
  }
  
  const supabaseKey = supabaseServiceKey || supabaseAnonKey;
  
  if (!supabaseKey) {
    throw new Error('Supabase key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY) must be set for vehicle queries');
  }
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Search parameters matching SearchParamsSchema
 */
export interface UVSSearchParams {
  make?: string;
  model?: string;
  year?: number;
  minPrice?: number;
  maxPrice?: number;
  condition?: 'new' | 'used' | 'certified';
  minMiles?: number;
  maxMiles?: number;
  trim?: string;
  bodyStyle?: string;
  dealerId?: string;
  dealerName?: string;
  location?: string;
  radiusMiles?: number;
  limit?: number;
  offset?: number;
}

export interface UVSDealerSummary {
  dealerId?: string;
  dealerName: string;
  city?: string;
  state?: string;
  count: number;
  minPrice?: number;
  lat?: number;
  lng?: number;
  dataSources: string[];
}

function applyUVSFilters<T extends {
  eq: (column: string, value: unknown) => T;
  gte: (column: string, value: unknown) => T;
  lte: (column: string, value: unknown) => T;
  ilike: (column: string, value: string) => T;
}>(
  query: T,
  params: UVSSearchParams
): T {
  if (params.make) {
    query = query.eq('make', params.make);
  }
  if (params.model) {
    query = query.eq('model', params.model);
  }
  if (params.year) {
    query = query.eq('year', params.year);
  }
  if (params.condition) {
    query = query.eq('condition', params.condition);
  }
  if (params.minPrice !== undefined) {
    query = query.gte('price', params.minPrice);
  }
  if (params.maxPrice !== undefined) {
    query = query.lte('price', params.maxPrice);
  }
  if (params.minMiles !== undefined) {
    query = query.gte('miles', params.minMiles);
  }
  if (params.maxMiles !== undefined) {
    query = query.lte('miles', params.maxMiles);
  }
  if (params.dealerId) {
    query = query.eq('dealer_id', params.dealerId);
  }
  if (params.dealerName) {
    query = query.ilike('dealer_name', `%${params.dealerName}%`);
  }
  return query.eq('availability_status', 'available');
}

/**
 * Search UVS vehicles with filters
 */
export async function searchUVSVehicles(
  params: UVSSearchParams
): Promise<{ vehicles: UnifiedVehicle[]; total: number; dealerSummary: UVSDealerSummary[] }> {
  const supabase = getSupabaseClient();
  
  let query = supabase.from('uvs_vehicles').select('uvs_data', { count: 'exact' });
  query = applyUVSFilters(query, params);
  
  // Apply pagination
  const limit = params.limit || 20;
  const offset = params.offset || 0;
  query = query.range(offset, offset + limit - 1);
  
  // Order by most recently synced
  query = query.order('last_synced_at', { ascending: false });
  
  // Filter by trim using JSONB query if provided
  if (params.trim) {
    query = query.contains('uvs_data', { baseIdentity: { trim: params.trim } });
  }
  
  // Filter by bodyStyle using JSONB query if provided
  if (params.bodyStyle) {
    query = query.contains('uvs_data', { coreSpecs: { bodyType: params.bodyStyle } });
  }
  
  // TODO: Location/radius filtering would require PostGIS or calculating distances
  // For now, we'll skip location-based filtering or do it client-side
  
  const { data, error, count } = await query;
  
  if (error) {
    logger.error({
      event: 'uvs_search_error',
      error: error.message,
      params,
    });
    throw new Error(`Failed to search UVS vehicles: ${error.message}`);
  }
  
  const vehicles = (data || []).map((row) => row.uvs_data as UnifiedVehicle);

  let dealerQuery = supabase
    .from('uvs_vehicles')
    .select('dealer_id, dealer_name, dealer_city, dealer_state, dealer_latitude, dealer_longitude, price, data_source');
  dealerQuery = applyUVSFilters(dealerQuery, params);
  const { data: dealerRows, error: dealerError } = await dealerQuery.range(0, 9999);

  if (dealerError) {
    logger.warn({
      event: 'uvs_dealer_summary_error',
      error: dealerError.message,
      params,
    });
  }

  const dealerMap = new Map<string, UVSDealerSummary>();
  for (const row of dealerRows || []) {
    const key = `${row.dealer_id || ''}|${row.dealer_name || 'Unknown Dealer'}`;
    const existing = dealerMap.get(key);
    const price = typeof row.price === 'number' ? row.price : Number(row.price);
    if (existing) {
      existing.count += 1;
      if (Number.isFinite(price)) {
        existing.minPrice = existing.minPrice === undefined ? price : Math.min(existing.minPrice, price);
      }
      if (row.data_source && !existing.dataSources.includes(row.data_source)) {
        existing.dataSources.push(row.data_source);
      }
      continue;
    }
    dealerMap.set(key, {
      dealerId: row.dealer_id || undefined,
      dealerName: row.dealer_name || 'Unknown Dealer',
      city: row.dealer_city || undefined,
      state: row.dealer_state || undefined,
      count: 1,
      minPrice: Number.isFinite(price) ? price : undefined,
      lat: typeof row.dealer_latitude === 'number' ? row.dealer_latitude : Number(row.dealer_latitude) || undefined,
      lng: typeof row.dealer_longitude === 'number' ? row.dealer_longitude : Number(row.dealer_longitude) || undefined,
      dataSources: row.data_source ? [row.data_source] : [],
    });
  }
  const dealerSummary = Array.from(dealerMap.values()).sort((a, b) => b.count - a.count);
  
  logger.info({
    event: 'uvs_search_complete',
    params,
    results: vehicles.length,
    total: count || 0,
    dealers: dealerSummary.length,
  });
  
  return {
    vehicles,
    total: count || 0,
    dealerSummary,
  };
}

/**
 * Get UVS vehicle by ID
 */
export async function getUVSVehicleById(id: string): Promise<UnifiedVehicle | null> {
  const supabase = getSupabaseClient();
  
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
    logger.error({
      event: 'uvs_get_by_id_error',
      id,
      error: error.message,
    });
    throw new Error(`Failed to get UVS vehicle: ${error.message}`);
  }
  
  return data.uvs_data as UnifiedVehicle;
}

/**
 * Get UVS vehicle by VIN
 */
export async function getUVSVehicleByVIN(vin: string): Promise<UnifiedVehicle | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('uvs_vehicles')
    .select('uvs_data')
    .eq('vin', vin)
    .eq('availability_status', 'available')
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    logger.error({
      event: 'uvs_get_by_vin_error',
      vin,
      error: error.message,
    });
    throw new Error(`Failed to get UVS vehicle by VIN: ${error.message}`);
  }
  
  return data.uvs_data as UnifiedVehicle;
}


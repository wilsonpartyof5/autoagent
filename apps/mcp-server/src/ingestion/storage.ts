/**
 * UVS Ingestion Storage
 * 
 * Stores ingested vehicles in the database (Supabase)
 * Handles batch operations and error handling
 */

import { createClient } from '@supabase/supabase-js';
import type { UnifiedVehicle } from '@autoagent/shared';
import { validateStrictUVS } from '@autoagent/shared';
import type { IngestionSummary } from './orchestrator';
import pino from 'pino';
import { CONFIG } from '../config/env';
import { quarantineValidationFailure } from './quarantine';

const logger = pino();

/**
 * Get Supabase client for storage
 * Uses service role key for elevated permissions
 */
function getSupabaseClient() {
  const supabaseUrl = CONFIG.supabaseUrl;
  const supabaseServiceKey = CONFIG.supabaseServiceRoleKey;
  const supabaseAnonKey = CONFIG.supabaseAnonKey;
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage');
  }
  
  // Use service role key if available, otherwise use anon key (limited functionality)
  const supabaseKey = supabaseServiceKey || supabaseAnonKey;
  
  if (!supabaseKey) {
    throw new Error('Supabase key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY) must be set for vehicle storage');
  }
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Map UnifiedVehicle to database row format
 * Extracts key fields for indexing while preserving full UVS document
 */
function mapUVSToRow(vehicle: UnifiedVehicle): Record<string, unknown> {
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
    uvs_data: vehicle, // Store full UVS document as JSONB
  };
}

/**
 * Store valid vehicles from ingestion summary in database
 * 
 * IMPORTANT: Only validated records are stored. This function performs
 * a final validation check as a safety measure to ensure no invalid data
 * reaches UVS, even if validation was bypassed elsewhere.
 * 
 * @param summary - Ingestion summary with results
 * @returns Storage summary with counts
 */
export async function storeIngestedVehicles(
  summary: IngestionSummary
): Promise<{
  stored: number;
  failed: number;
  errors: Array<{ vehicleId?: string; error: string }>;
}> {
  // Filter to only successful results with vehicles
  const candidateVehicles = summary.results
    .filter(r => r.success && r.vehicle)
    .map(r => r.vehicle!);
  
  // Final validation check - ensure no invalid data reaches UVS
  // This is a safety measure in case validation was bypassed
  const validVehicles: UnifiedVehicle[] = [];
  const validationErrors: Array<{ vehicleId?: string; error: string }> = [];
  
  for (const vehicle of candidateVehicles) {
    const validation = validateStrictUVS(vehicle, summary.provider);
    if (validation.valid && validation.data) {
      validVehicles.push(validation.data);
    } else {
      // Quarantine and log - this should not happen if orchestrator is working correctly
      quarantineValidationFailure(
        vehicle.id,
        summary.provider as any,
        validation,
        summary.dataSource
      );
      validationErrors.push({
        vehicleId: vehicle.id,
        error: `Final validation failed: ${validation.errorDetails?.map(e => e.message).join(', ') || 'Unknown error'}`,
      });
      logger.error({
        event: 'final_validation_failed_in_storage',
        vehicleId: vehicle.id,
        provider: summary.provider,
        errors: validation.errorDetails,
        message: 'Vehicle passed orchestrator validation but failed final storage validation',
      });
    }
  }
  
  if (validVehicles.length === 0) {
    logger.warn({
      event: 'no_valid_vehicles_to_store',
      provider: summary.provider,
      total: summary.total,
      validationErrors: validationErrors.length,
    });
    return { stored: 0, failed: validationErrors.length, errors: validationErrors };
  }
  
  const supabase = getSupabaseClient();
  const rows = validVehicles.map(mapUVSToRow);
  
  // Batch upsert in chunks to avoid payload limits
  const chunkSize = 1000;
  let stored = 0;
  let failed = 0;
  const errors: Array<{ vehicleId?: string; error: string }> = [];
  
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    
    try {
      const { data, error } = await supabase
        .from('uvs_vehicles')
        .upsert(chunk, {
          onConflict: 'id',
          ignoreDuplicates: false,
        })
        .select('id');
      
      if (error) {
        logger.error({
          event: 'batch_storage_failed',
          provider: summary.provider,
          chunkStart: i,
          chunkSize: chunk.length,
          error: error.message,
        });
        
        // Mark entire chunk as failed
        failed += chunk.length;
        chunk.forEach(row => {
          errors.push({
            vehicleId: row.id as string,
            error: error.message,
          });
        });
      } else {
        stored += data?.length || 0;
        logger.info({
          event: 'batch_stored',
          provider: summary.provider,
          chunkStart: i,
          chunkSize: chunk.length,
          stored: data?.length || 0,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({
        event: 'batch_storage_exception',
        provider: summary.provider,
        chunkStart: i,
        chunkSize: chunk.length,
        error: errorMsg,
      });
      
      // Mark entire chunk as failed
      failed += chunk.length;
      chunk.forEach(row => {
        errors.push({
          vehicleId: row.id as string,
          error: errorMsg,
        });
      });
    }
  }
  
  logger.info({
    event: 'storage_completed',
    provider: summary.provider,
    total: validVehicles.length,
    stored,
    failed: failed + validationErrors.length,
    errors: errors.length + validationErrors.length,
  });
  
  return { stored, failed: failed + validationErrors.length, errors: [...errors, ...validationErrors] };
}

/**
 * Store a single vehicle in the database
 * 
 * IMPORTANT: Only validated records are stored. This function performs
 * a final validation check as a safety measure to ensure no invalid data
 * reaches UVS.
 * 
 * @param vehicle - Validated UVS vehicle
 * @param provider - Optional provider name for logging
 * @returns Success status and vehicle ID
 */
export async function storeUVSVehicle(
  vehicle: UnifiedVehicle,
  provider?: string
): Promise<{ success: boolean; vehicleId: string; error?: string }> {
  try {
    // Final validation check - ensure no invalid data reaches UVS
    const validation = validateStrictUVS(vehicle, provider);
    if (!validation.valid || !validation.data) {
      const errorMsg = `Final validation failed: ${validation.errorDetails?.map(e => e.message).join(', ') || 'Unknown error'}`;
      
      // Quarantine and log
      quarantineValidationFailure(
        vehicle.id,
        (provider as any) || 'unknown',
        validation,
        provider
      );
      
      logger.error({
        event: 'final_validation_failed_in_storage',
        vehicleId: vehicle.id,
        provider,
        errors: validation.errorDetails,
        message: 'Vehicle failed final storage validation',
      });
      
      return {
        success: false,
        vehicleId: vehicle.id,
        error: errorMsg,
      };
    }
    
    // Use validated data
    const validatedVehicle = validation.data;
    const supabase = getSupabaseClient();
    const row = mapUVSToRow(validatedVehicle);
    
    const { data, error } = await supabase
      .from('uvs_vehicles')
      .upsert(row, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select('id')
      .single();
    
    if (error) {
      logger.error({
        event: 'vehicle_storage_failed',
        vehicleId: validatedVehicle.id,
        error: error.message,
      });
      
      return {
        success: false,
        vehicleId: validatedVehicle.id,
        error: error.message,
      };
    }
    
    return {
      success: true,
      vehicleId: data.id,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({
      event: 'vehicle_storage_exception',
      vehicleId: vehicle.id,
      error: errorMsg,
    });
    
    return {
      success: false,
      vehicleId: vehicle.id,
      error: errorMsg,
    };
  }
}


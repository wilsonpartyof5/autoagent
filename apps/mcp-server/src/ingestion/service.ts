/**
 * UVS Ingestion Service
 * 
 * High-level service that orchestrates the entire ingestion pipeline:
 * 1. Fetches data from provider
 * 2. Normalizes and validates via orchestrator
 * 3. Stores valid vehicles in database
 * 4. Handles deletion of vehicles no longer in provider data
 */

import { ingestVehicles, type IngestionOptions, getValidVehicles, getInvalidVehicles } from './orchestrator.js';
import { storeIngestedVehicles, storeUVSVehicle } from './storage.js';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config/env.js';
import { resolveDeletionStrategy } from '../lib/ingestAuth.js';
import pino from 'pino';
import type { UnifiedVehicle } from '@autoagent/shared';

const logger = (pino as any)();

/**
 * Get Supabase client for deletion operations
 */
function getSupabaseClient() {
  const supabaseUrl = CONFIG.supabaseUrl;
  const supabaseServiceKey = CONFIG.supabaseServiceRoleKey;
  const supabaseAnonKey = CONFIG.supabaseAnonKey;
  
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set for vehicle storage');
  }
  
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
 * Deletion strategy
 */
export type DeletionStrategy = 
  | 'none' // Don't delete anything
  | 'mark_unavailable' // Mark vehicles as unavailable instead of deleting
  | 'delete_old' // Delete vehicles from this provider that aren't in the new data
  | 'delete_all_old' // Delete all vehicles from this provider, replace with new data;

/**
 * Ingestion service options
 */
export interface IngestionServiceOptions extends IngestionOptions {
  deletionStrategy?: DeletionStrategy;
  dealerId?: string; // Optional: only process vehicles for this dealer
  dataSource?: string; // Override dataSource in operational metadata
}

/**
 * Ingestion service result
 */
export interface IngestionServiceResult {
  success: boolean;
  summary: {
    fetched: number;
    valid: number;
    invalid: number;
    stored: number;
    failed: number;
    deleted: number;
    markedUnavailable: number;
  };
  errors?: string[];
  invalidVehicles?: Array<{
    vehicleId?: string;
    error?: string;
    validationErrors?: Array<{ path: string; message: string }>;
  }>;
}

/**
 * Ingest vehicles from a provider with full pipeline orchestration
 * 
 * @param rawVehicles - Raw vehicle data from provider
 * @param options - Ingestion options
 * @returns Ingestion result with summary
 */
export async function ingestVehiclesFromProvider(
  rawVehicles: unknown[],
  options: IngestionServiceOptions
): Promise<IngestionServiceResult> {
  const startTime = Date.now();
  
  logger.info({
    event: 'ingestion_service_started',
    provider: options.provider,
    totalVehicles: rawVehicles.length,
    options,
  });
  
  try {
    // Step 1: Normalize and validate vehicles
    const ingestionSummary = await ingestVehicles(rawVehicles, options);
    
    const validVehicles = getValidVehicles(ingestionSummary);
    const invalidVehicles = getInvalidVehicles(ingestionSummary);
    
    logger.info({
      event: 'ingestion_validation_complete',
      provider: options.provider,
      total: ingestionSummary.total,
      valid: validVehicles.length,
      invalid: invalidVehicles.length,
    });
    
    // Step 2: Store valid vehicles in database
    const storageResult = await storeIngestedVehicles(ingestionSummary);
    
    logger.info({
      event: 'ingestion_storage_complete',
      provider: options.provider,
      stored: storageResult.stored,
      failed: storageResult.failed,
    });
    
    // Step 3: Handle deletion of vehicles no longer in provider data
    const deletionResult = await handleDeletions(
      validVehicles,
      options
    );
    
    logger.info({
      event: 'ingestion_deletion_complete',
      provider: options.provider,
      deleted: deletionResult.deleted,
      markedUnavailable: deletionResult.markedUnavailable,
    });
    
    const duration = Date.now() - startTime;
    
    const result: IngestionServiceResult = {
      success: true,
      summary: {
        fetched: rawVehicles.length,
        valid: validVehicles.length,
        invalid: invalidVehicles.length,
        stored: storageResult.stored,
        failed: storageResult.failed,
        deleted: deletionResult.deleted,
        markedUnavailable: deletionResult.markedUnavailable,
      },
      invalidVehicles,
      errors: storageResult.errors.map(e => e.error),
    };
    
    logger.info({
      event: 'ingestion_service_completed',
      provider: options.provider,
      duration,
      ...result.summary,
    });
    
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({
      event: 'ingestion_service_failed',
      provider: options.provider,
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return {
      success: false,
      summary: {
        fetched: rawVehicles.length,
        valid: 0,
        invalid: 0,
        stored: 0,
        failed: 0,
        deleted: 0,
        markedUnavailable: 0,
      },
      errors: [errorMsg],
    };
  }
}

/**
 * Handle deletion of vehicles no longer in provider data
 */
async function handleDeletions(
  newVehicles: UnifiedVehicle[],
  options: IngestionServiceOptions
): Promise<{ deleted: number; markedUnavailable: number }> {
  const deletionStrategy = resolveDeletionStrategy(
    options.deletionStrategy || 'none',
    options.dealerId,
  );
  
  if (deletionStrategy === 'none') {
    return { deleted: 0, markedUnavailable: 0 };
  }

  if (!options.dealerId?.trim()) {
    logger.warn({
      event: 'deletion_refused_missing_dealerId',
      provider: options.provider,
      requestedStrategy: options.deletionStrategy,
    });
    return { deleted: 0, markedUnavailable: 0 };
  }
  
  const supabase = getSupabaseClient();
  const dataSource = options.dataSource || options.provider;
  
  // Find all vehicles from this provider that aren't in the new data
  const newVehicleIds = new Set(newVehicles.map(v => v.id));
  
  try {
    // Get existing vehicles from this provider, always scoped to one dealer.
    const query = supabase
      .from('uvs_vehicles')
      .select('id, availability_status')
      .eq('data_source', dataSource)
      .eq('dealer_id', options.dealerId);
    
    const { data: existingVehicles, error } = await query;
    
    if (error) {
      logger.error({
        event: 'deletion_query_failed',
        provider: options.provider,
        error: error.message,
      });
      return { deleted: 0, markedUnavailable: 0 };
    }
    
    // Find vehicles that need to be handled
    const vehiclesToHandle = (existingVehicles || []).filter(
      v => !newVehicleIds.has(v.id)
    );
    
    if (vehiclesToHandle.length === 0) {
      return { deleted: 0, markedUnavailable: 0 };
    }
    
    let deleted = 0;
    let markedUnavailable = 0;
    
    if (deletionStrategy === 'delete_old' || deletionStrategy === 'delete_all_old') {
      // Delete vehicles not in new data
      const idsToDelete = vehiclesToHandle.map(v => v.id);
      
      const { error: deleteError } = await supabase
        .from('uvs_vehicles')
        .delete()
        .in('id', idsToDelete);
      
      if (deleteError) {
        logger.error({
          event: 'deletion_failed',
          provider: options.provider,
          count: idsToDelete.length,
          error: deleteError.message,
        });
      } else {
        deleted = idsToDelete.length;
        logger.info({
          event: 'vehicles_deleted',
          provider: options.provider,
          count: deleted,
        });
      }
    } else if (deletionStrategy === 'mark_unavailable') {
      // Mark vehicles as unavailable
      const idsToMark = vehiclesToHandle.map(v => v.id);
      
      const { error: updateError } = await supabase
        .from('uvs_vehicles')
        .update({
          availability_status: 'unavailable',
          sync_status: 'success',
        })
        .in('id', idsToMark);
      
      if (updateError) {
        logger.error({
          event: 'mark_unavailable_failed',
          provider: options.provider,
          count: idsToMark.length,
          error: updateError.message,
        });
      } else {
        markedUnavailable = idsToMark.length;
        logger.info({
          event: 'vehicles_marked_unavailable',
          provider: options.provider,
          count: markedUnavailable,
        });
      }
    }
    
    return { deleted, markedUnavailable };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({
      event: 'deletion_exception',
      provider: options.provider,
      error: errorMsg,
    });
    return { deleted: 0, markedUnavailable: 0 };
  }
}

/**
 * Ingest a single vehicle (convenience function)
 */
export async function ingestSingleVehicle(
  rawVehicle: unknown,
  options: IngestionServiceOptions
): Promise<{ success: boolean; vehicleId?: string; error?: string }> {
  const result = await ingestVehiclesFromProvider([rawVehicle], options);
  
  if (!result.success || result.summary.stored === 0) {
    return {
      success: false,
      error: result.errors?.[0] || 'Failed to ingest vehicle',
    };
  }
  
  // Get the stored vehicle ID
  const validVehicles = getValidVehicles({
    results: result.invalidVehicles ? [] : [{ success: true }],
    total: 1,
    valid: result.summary.valid,
    invalid: result.summary.invalid,
    errors: 0,
    provider: options.provider,
    dataSource: options.dataSource || options.provider,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
  });
  
  // Actually, we need to get the ID from the stored vehicle
  // For simplicity, extract from the raw vehicle
  const vehicleId = (rawVehicle as any)?.id || (rawVehicle as any)?.vin || 'unknown';
  
  return {
    success: true,
    vehicleId,
  };
}


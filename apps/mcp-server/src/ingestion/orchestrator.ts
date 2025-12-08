/**
 * UVS Ingestion Orchestrator
 * 
 * Orchestrates the ingestion pipeline:
 * 1. Calls appropriate provider normalizers
 * 2. Runs UVS validation
 * 3. Writes only valid UVS entries to the database
 * 4. Logs invalid entries
 * 5. Handles provider timeouts/failures gracefully
 * 6. Tags vehicles with provider metadata
 * 7. Updates operational.lastSyncedAt
 */

import type { UnifiedVehicle } from '@autoagent/shared';
import { validateStrictUVS } from '@autoagent/shared';
import { validateUVS } from '../validation/validateUVS.js';
import { normalize as normalizeMarketCheck } from './providers/marketcheck.js';
import { normalize as normalizeCSV } from './providers/csvImport.js';
import { normalize as normalizeDealerAPI } from './providers/dealerApi.js';
import { normalize as normalizeDealerCom } from './providers/dealerCom.js';
import { normalize as normalizeHomenet } from './providers/homenet.js';
import { normalize as normalizeVAuto } from './providers/vauto.js';
import type { UVS } from '../types/UVS.js';
import {
  quarantineValidationFailure,
  quarantineNormalizationFailure,
  logQuarantineMetricsSummary,
} from './quarantine.js';
import pino from 'pino';

const logger = (pino as any)();

/**
 * Provider type identifier
 */
export type ProviderType = 
  | 'marketcheck'
  | 'csv-import'
  | 'dealer-api'
  | 'dealer-com'
  | 'homenet'
  | 'vauto';

/**
 * Ingestion options
 */
export interface IngestionOptions {
  provider: ProviderType;
  timeoutMs?: number; // Default: 30000 (30 seconds)
  batchSize?: number; // Default: 100
  retryCount?: number; // Default: 3
  retryDelayMs?: number; // Default: 1000
  continueOnError?: boolean; // Default: true
}

/**
 * Ingestion result for a single vehicle
 */
export interface VehicleIngestionResult {
  success: boolean;
  vehicle?: UnifiedVehicle;
  vehicleId?: string;
  error?: string;
  validationErrors?: Array<{ path: string; message: string }>;
}

/**
 * Ingestion summary
 */
export interface IngestionSummary {
  total: number;
  valid: number;
  invalid: number;
  errors: number;
  results: VehicleIngestionResult[];
  provider: ProviderType;
  dataSource: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

/**
 * Get normalizer function for provider
 */
function getNormalizer(provider: ProviderType) {
  switch (provider) {
    case 'marketcheck':
      return normalizeMarketCheck;
    case 'csv-import':
      return normalizeCSV;
    case 'dealer-api':
      return normalizeDealerAPI;
    case 'dealer-com':
      return normalizeDealerCom;
    case 'homenet':
      return normalizeHomenet;
    case 'vauto':
      return normalizeVAuto;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Convert UVS format to UnifiedVehicle format
 */
function convertUVSToUnifiedVehicle(uvs: UVS): UnifiedVehicle {
  return {
    ...uvs,
    featuresPackages: uvs.featuresPackages ? {
      ...uvs.featuresPackages,
      // Convert Feature[] to string[] for UnifiedVehicle compatibility
      features: uvs.featuresPackages.features 
        ? uvs.featuresPackages.features.map(f => typeof f === 'string' ? f : f.name)
        : undefined,
    } : undefined,
  } as UnifiedVehicle;
}

/**
 * Normalize raw vehicle data to UVS format, then convert to UnifiedVehicle
 */
function normalizeVehicle(
  raw: unknown,
  provider: ProviderType
): UnifiedVehicle {
  const normalizer = getNormalizer(provider);
  const uvs = normalizer(raw as any);
  return convertUVSToUnifiedVehicle(uvs);
}

/**
 * Validate and enrich UVS vehicle with operational metadata
 */
function validateAndEnrichVehicle(
  vehicle: UnifiedVehicle,
  provider: ProviderType,
  dataSource?: string
): UnifiedVehicle {
  // Ensure operational.lastSyncedAt is set
  const now = new Date().toISOString();
  
  // Ensure operational block exists with proper metadata
  const enriched: UnifiedVehicle = {
    ...vehicle,
    operational: {
      ...vehicle.operational,
      dataSource: dataSource || provider,
      source: vehicle.operational.source || provider,
      lastSyncedAt: vehicle.operational.lastSyncedAt || now,
      syncStatus: vehicle.operational.syncStatus || 'success',
      createdAt: vehicle.operational.createdAt || now,
      updatedAt: now,
    },
  };
  
  return enriched;
}

/**
 * Process a single vehicle through the ingestion pipeline
 */
async function processVehicle(
  raw: unknown,
  provider: ProviderType,
  options: IngestionOptions
): Promise<VehicleIngestionResult> {
  const vehicleId = (raw as any)?.id || (raw as any)?.vin || 'unknown';
  
  try {
    // Step 1: Normalize to UVS format
    let vehicle: UnifiedVehicle;
    try {
      vehicle = normalizeVehicle(raw, provider);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Quarantine normalization failure
      quarantineNormalizationFailure(vehicleId, provider, errorMsg, options.provider);
      
      logger.warn({
        event: 'normalization_failed',
        provider,
        vehicleId,
        error: errorMsg,
      });
      
      return {
        success: false,
        vehicleId,
        error: `Normalization failed: ${errorMsg}`,
      };
    }
    
    // Step 2: Enrich with operational metadata
    vehicle = validateAndEnrichVehicle(vehicle, provider, options.provider);
    
    // Step 3: Validate against strict UVS schema
    // This enforces all required blocks, enums, and validations
    const validation = validateStrictUVS(vehicle, provider);
    if (!validation.valid || !validation.data) {
      const errors = validation.errorDetails?.map(err => ({
        path: err.path,
        message: err.message,
      })) || [];
      
      // Quarantine validation failure - record is NOT written to UVS
      quarantineValidationFailure(vehicle.id, provider, validation, options.provider);
      
      logger.warn({
        event: 'uvs_validation_failed',
        provider,
        vehicleId: vehicle.id,
        errors,
      });
      
      return {
        success: false,
        vehicleId: vehicle.id,
        validationErrors: errors,
        error: `UVS validation failed: ${errors.map(e => e.message).join(', ')}`,
      };
    }
    
    // Only validated records reach this point
    const validatedVehicle = validation.data;
    
    // Step 4: Return successful result
    return {
      success: true,
      vehicle: validatedVehicle,
      vehicleId: validatedVehicle.id,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({
      event: 'vehicle_processing_error',
      provider,
      vehicleId,
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return {
      success: false,
      vehicleId,
      error: `Processing error: ${errorMsg}`,
    };
  }
}

/**
 * Process vehicles with timeout protection
 */
async function processVehicleWithTimeout(
  raw: unknown,
  provider: ProviderType,
  options: IngestionOptions
): Promise<VehicleIngestionResult> {
  const timeoutMs = options.timeoutMs || 30000;
  
  return Promise.race([
    processVehicle(raw, provider, options),
    new Promise<VehicleIngestionResult>((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          vehicleId: (raw as any)?.id || (raw as any)?.vin || 'unknown',
          error: `Processing timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);
    }),
  ]);
}

/**
 * Ingest vehicles from a provider
 * 
 * @param rawVehicles - Array of raw vehicle data from provider
 * @param options - Ingestion options
 * @returns Ingestion summary with results
 */
export async function ingestVehicles(
  rawVehicles: unknown[],
  options: IngestionOptions
): Promise<IngestionSummary> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  
  logger.info({
    event: 'ingestion_started',
    provider: options.provider,
    totalVehicles: rawVehicles.length,
    options,
  });
  
  const results: VehicleIngestionResult[] = [];
  const batchSize = options.batchSize || 100;
  
  // Process vehicles in batches to avoid overwhelming the system
  for (let i = 0; i < rawVehicles.length; i += batchSize) {
    const batch = rawVehicles.slice(i, i + batchSize);
    
    // Process batch with timeout protection
    const batchPromises = batch.map(raw =>
      processVehicleWithTimeout(raw, options.provider, options)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Log batch progress
    if (i % (batchSize * 10) === 0) {
      logger.info({
        event: 'ingestion_progress',
        provider: options.provider,
        processed: i + batch.length,
        total: rawVehicles.length,
        valid: results.filter(r => r.success).length,
        invalid: results.filter(r => !r.success && r.validationErrors).length,
        errors: results.filter(r => !r.success && !r.validationErrors).length,
      });
    }
  }
  
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;
  
  const valid = results.filter(r => r.success).length;
  const invalid = results.filter(r => !r.success && r.validationErrors).length;
  const errors = results.filter(r => !r.success && !r.validationErrors).length;
  
  const summary: IngestionSummary = {
    total: rawVehicles.length,
    valid,
    invalid,
    errors,
    results,
    provider: options.provider,
    dataSource: options.provider,
    startedAt,
    completedAt,
    durationMs,
  };
  
  logger.info({
    event: 'ingestion_completed',
    ...summary,
  });
  
  // Log quarantine metrics summary
  logQuarantineMetricsSummary(options.provider);
  
  return summary;
}

/**
 * Extract valid vehicles from ingestion summary
 */
export function getValidVehicles(summary: IngestionSummary): UnifiedVehicle[] {
  return summary.results
    .filter(r => r.success && r.vehicle)
    .map(r => r.vehicle!);
}

/**
 * Extract invalid vehicles with error details
 */
export function getInvalidVehicles(summary: IngestionSummary): Array<{
  vehicleId?: string;
  error?: string;
  validationErrors?: Array<{ path: string; message: string }>;
}> {
  return summary.results
    .filter(r => !r.success)
    .map(r => ({
      vehicleId: r.vehicleId,
      error: r.error,
      validationErrors: r.validationErrors,
    }));
}


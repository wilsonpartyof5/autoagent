/**
 * Quarantine System for Invalid UVS Records
 * 
 * Logs and tracks invalid records that fail validation.
 * Provides structured logging and metrics for rejected records.
 */

import pino from 'pino';
import type { ProviderType } from './orchestrator';
import type { StrictValidationResult } from '@autoagent/shared';

const logger = pino();

/**
 * Quarantine record metadata
 */
export interface QuarantineRecord {
  vehicleId?: string;
  provider: ProviderType;
  dataSource?: string;
  timestamp: string;
  validationErrors: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  rawData?: unknown; // Optional: store raw data for debugging (be careful with size)
  errorType: 'validation' | 'normalization' | 'processing';
  errorMessage?: string;
}

/**
 * Quarantine metrics counter
 */
interface QuarantineMetrics {
  totalRejected: number;
  byProvider: Record<ProviderType, number>;
  byErrorType: Record<string, number>;
  byErrorCode: Record<string, number>;
}

/**
 * Global quarantine metrics (in-memory counter)
 * In production, this could be replaced with a metrics service
 */
let quarantineMetrics: QuarantineMetrics = {
  totalRejected: 0,
  byProvider: {} as Record<ProviderType, number>,
  byErrorType: {},
  byErrorCode: {},
};

/**
 * Reset quarantine metrics (useful for testing)
 */
export function resetQuarantineMetrics(): void {
  quarantineMetrics = {
    totalRejected: 0,
    byProvider: {} as Record<ProviderType, number>,
    byErrorType: {},
    byErrorCode: {},
  };
}

/**
 * Get current quarantine metrics
 */
export function getQuarantineMetrics(): QuarantineMetrics {
  return { ...quarantineMetrics };
}

/**
 * Quarantine an invalid record
 * 
 * Logs the record with structured logging and updates metrics.
 * In production, this could also write to a quarantine table or queue.
 * 
 * @param record - Quarantine record metadata
 */
export function quarantineRecord(record: QuarantineRecord): void {
  // Update metrics
  quarantineMetrics.totalRejected++;
  
  // Update provider counter
  if (!quarantineMetrics.byProvider[record.provider]) {
    quarantineMetrics.byProvider[record.provider] = 0;
  }
  quarantineMetrics.byProvider[record.provider]++;
  
  // Update error type counter
  if (!quarantineMetrics.byErrorType[record.errorType]) {
    quarantineMetrics.byErrorType[record.errorType] = 0;
  }
  quarantineMetrics.byErrorType[record.errorType]++;
  
  // Update error code counters
  record.validationErrors.forEach((err) => {
    if (!quarantineMetrics.byErrorCode[err.code]) {
      quarantineMetrics.byErrorCode[err.code] = 0;
    }
    quarantineMetrics.byErrorCode[err.code]++;
  });
  
  // Structured logging
  logger.warn({
    event: 'record_quarantined',
    vehicleId: record.vehicleId,
    provider: record.provider,
    dataSource: record.dataSource,
    errorType: record.errorType,
    errorMessage: record.errorMessage,
    validationErrors: record.validationErrors,
    timestamp: record.timestamp,
    metrics: {
      totalRejected: quarantineMetrics.totalRejected,
      providerRejected: quarantineMetrics.byProvider[record.provider],
    },
  });
  
  // Log individual error details for debugging
  record.validationErrors.forEach((err) => {
    logger.debug({
      event: 'validation_error_detail',
      vehicleId: record.vehicleId,
      provider: record.provider,
      path: err.path,
      message: err.message,
      code: err.code,
    });
  });
}

/**
 * Quarantine a validation failure
 * 
 * @param vehicleId - Vehicle identifier
 * @param provider - Provider type
 * @param validationResult - Validation result with errors
 * @param dataSource - Optional data source identifier
 */
export function quarantineValidationFailure(
  vehicleId: string | undefined,
  provider: ProviderType,
  validationResult: StrictValidationResult,
  dataSource?: string
): void {
  const record: QuarantineRecord = {
    vehicleId,
    provider,
    dataSource,
    timestamp: new Date().toISOString(),
    validationErrors: validationResult.errorDetails || [],
    errorType: 'validation',
    errorMessage: validationResult.errors?.message || 'Validation failed',
  };
  
  quarantineRecord(record);
}

/**
 * Quarantine a normalization failure
 * 
 * @param vehicleId - Vehicle identifier
 * @param provider - Provider type
 * @param error - Error message
 * @param dataSource - Optional data source identifier
 */
export function quarantineNormalizationFailure(
  vehicleId: string | undefined,
  provider: ProviderType,
  error: string,
  dataSource?: string
): void {
  const record: QuarantineRecord = {
    vehicleId,
    provider,
    dataSource,
    timestamp: new Date().toISOString(),
    validationErrors: [
      {
        path: 'normalization',
        message: error,
        code: 'NORMALIZATION_ERROR',
      },
    ],
    errorType: 'normalization',
    errorMessage: error,
  };
  
  quarantineRecord(record);
}

/**
 * Quarantine a processing failure
 * 
 * @param vehicleId - Vehicle identifier
 * @param provider - Provider type
 * @param error - Error message
 * @param dataSource - Optional data source identifier
 */
export function quarantineProcessingFailure(
  vehicleId: string | undefined,
  provider: ProviderType,
  error: string,
  dataSource?: string
): void {
  const record: QuarantineRecord = {
    vehicleId,
    provider,
    dataSource,
    timestamp: new Date().toISOString(),
    validationErrors: [
      {
        path: 'processing',
        message: error,
        code: 'PROCESSING_ERROR',
      },
    ],
    errorType: 'processing',
    errorMessage: error,
  };
  
  quarantineRecord(record);
}

/**
 * Log quarantine metrics summary
 * 
 * Call this periodically or at the end of ingestion batches
 * to log a summary of rejected records.
 */
export function logQuarantineMetricsSummary(provider?: ProviderType): void {
  const metrics = getQuarantineMetrics();
  
  if (metrics.totalRejected === 0) {
    logger.info({
      event: 'quarantine_metrics_summary',
      provider,
      message: 'No records quarantined',
    });
    return;
  }
  
  logger.warn({
    event: 'quarantine_metrics_summary',
    provider,
    totalRejected: metrics.totalRejected,
    byProvider: metrics.byProvider,
    byErrorType: metrics.byErrorType,
    byErrorCode: metrics.byErrorCode,
    message: `Total records quarantined: ${metrics.totalRejected}`,
  });
}


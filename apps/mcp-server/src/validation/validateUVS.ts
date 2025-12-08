/**
 * UVS Validation using Strict Zod Schemas
 * 
 * Validates incoming vehicle data against the strict Unified Vehicle Schema (UVS).
 * Uses strict schemas that enforce all required blocks and enums.
 * 
 * This validation is used for provider-normalized UVS payloads before writing to the database.
 * Invalid payloads are quarantined and logged, not written to UVS.
 */

import type { UVS } from '../types/UVS.js';
import type { UnifiedVehicle } from '@autoagent/shared';
import { validateStrictUVS, type StrictValidationResult } from '@autoagent/shared';

/**
 * Validation result (backward compatible with existing code)
 */
export interface ValidationResult {
  valid: boolean;
  errors?: {
    errors: Array<{
      path: (string | number)[];
      message: string;
      code: string;
    }>;
    message: string;
  };
  data?: UVS | UnifiedVehicle;
}

/**
 * Validate data against strict UVS schema
 * 
 * This function enforces:
 * - Required blocks: baseIdentity, pricing, location, operational
 * - Enums: fuelType, drivetrain, transmission.type, odometer unit ("mi"/"km")
 * - Valid ranges/types (e.g., year, price ≥ 0)
 * 
 * @param data - Data to validate
 * @param provider - Optional provider name for logging
 * @returns Validation result with valid flag, errors (if any), and parsed data
 */
export function validateUVS(data: unknown, provider?: string): ValidationResult {
  const strictResult = validateStrictUVS(data, provider);
  
  if (strictResult.valid && strictResult.data) {
    return {
      valid: true,
      data: strictResult.data as UVS,
    };
  }
  
  // Convert strict validation errors to backward-compatible format
  const zodError = strictResult.errors;
  if (zodError) {
    return {
      valid: false,
      errors: {
        errors: zodError.errors.map((err) => ({
          path: err.path as (string | number)[],
          message: err.message,
          code: err.code,
        })),
        message: zodError.message,
      },
    };
  }
  
  // Convert errorDetails to proper format if it exists
  // errorDetails has structure: { path: string; message: string; code: string }[]
  // Need to convert path from string to (string | number)[]
  const errorDetails = strictResult.errorDetails && Array.isArray(strictResult.errorDetails)
    ? strictResult.errorDetails.map((err: { path: string; message: string; code: string }) => ({
        path: err.path.split('.').map((part: string) => {
          // Try to parse as number if it looks numeric, otherwise keep as string
          const numPart = Number(part);
          return isNaN(numPart) || numPart.toString() !== part ? part : numPart;
        }) as (string | number)[],
        message: err.message,
        code: err.code,
      }))
    : [];
  
  return {
    valid: false,
    errors: {
      errors: errorDetails,
      message: 'Validation failed',
    },
  };
}

/**
 * Type guard to check if data is valid UVS
 */
export function isValidUVS(data: unknown): data is UVS {
  return validateUVS(data).valid;
}


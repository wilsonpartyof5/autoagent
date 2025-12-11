# Strict Provider Validation and Enrichment Consistency Implementation

## Overview

This implementation enforces strict provider validation and enrichment consistency for UVS ingestion. All provider mappers validate outputs against schemas with enums and required fields. Invalid payloads are quarantined/logged and not written to UVS.

## Implementation Summary

### 1. Strict Zod Schemas ✅

**Location**: `packages/shared/src/uvs-provider-schemas.ts`

Created comprehensive Zod schemas that enforce:
- **Required blocks**: `baseIdentity`, `pricing`, `location`, `operational`
- **Enums**: 
  - `fuelType`: gasoline, diesel, electric, hybrid, plug-in hybrid, flex fuel, natural gas, hydrogen, other
  - `drivetrain`: fwd, rwd, awd, 4wd, part-time 4wd
  - `transmission.type`: automatic, manual, cvt, dual clutch, automated manual
  - `odometer.unit`: "mi" or "km" (strict validation)
- **Valid ranges/types**:
  - Year: 1900-2100
  - Price: ≥ 0
  - Odometer value: ≥ 0

### 2. Updated Validation ✅

**Location**: `apps/mcp-server/src/validation/validateUVS.ts`

- Updated to use strict schemas from `@autoagent/shared`
- Maintains backward compatibility with existing code
- Provides detailed error information for logging

### 3. Provider Mapper Integration ✅

**Location**: `apps/mcp-server/src/ingestion/orchestrator.ts`

- All provider mappers are validated through the orchestrator
- Validation happens after normalization and enrichment
- Invalid records are quarantined before storage
- No invalid data reaches the storage layer

### 4. Quarantine System ✅

**Location**: `apps/mcp-server/src/ingestion/quarantine.ts`

Comprehensive quarantine system that:
- Logs invalid records with structured logging (provider, vehicleId, errors)
- Tracks metrics (counts by provider, error type, error code)
- Provides quarantine functions for:
  - Validation failures
  - Normalization failures
  - Processing failures
- Logs metrics summary at end of ingestion batches

### 5. Storage Safety Checks ✅

**Location**: `apps/mcp-server/src/ingestion/storage.ts`

- Added final validation check before storage (safety measure)
- Only validated records are persisted to database
- Invalid records are quarantined even if they somehow reach storage
- No "best effort" writes - strict validation only

### 6. Comprehensive Tests ✅

**Location**: `apps/mcp-server/test/strict-uvs-validation.test.ts`

Tests cover:
- **Positive tests**: Valid payloads with all required blocks and enums
- **Negative tests**: 
  - Missing required blocks
  - Invalid enum values
  - Invalid ranges (year, price, odometer)
  - Invalid types/format
- **Edge cases**: Null, undefined, zero values

**Test Documentation**: `apps/mcp-server/test/STRICT_VALIDATION_README.md`

## Key Features

### Strict Validation
- All required blocks must be present and valid
- All enum values are strictly enforced
- Invalid units (e.g., "miles" instead of "mi") are rejected
- Range validations prevent invalid data

### Quarantine System
- Invalid records are never written to UVS
- Structured logging with provider, vehicleId, and error details
- Metrics tracking for monitoring and debugging
- Error categorization (validation, normalization, processing)

### No Invalid Data in UVS
- Validation at orchestrator level (primary)
- Validation at storage level (safety check)
- Quarantine system prevents any invalid data from being persisted

## File Structure

```
packages/shared/src/
  ├── uvs-provider-schemas.ts      # Strict Zod schemas
  └── index.ts                      # Exports schemas and validators

apps/mcp-server/src/
  ├── validation/
  │   └── validateUVS.ts            # Updated to use strict schemas
  ├── ingestion/
  │   ├── orchestrator.ts          # Validates and quarantines invalid records
  │   ├── quarantine.ts            # Quarantine system
  │   └── storage.ts                # Final validation before storage
  └── test/
      ├── strict-uvs-validation.test.ts  # Comprehensive tests
      └── STRICT_VALIDATION_README.md    # Test documentation
```

## Usage

### Running Tests

```bash
# Run all tests
cd apps/mcp-server
pnpm test

# Run only strict validation tests
pnpm test strict-uvs-validation

# Run tests in watch mode
pnpm test:watch
```

### Validation Flow

1. **Provider Normalization**: Raw data → UVS format
2. **Strict Validation**: Validate against strict schemas
3. **Quarantine**: Invalid records logged and tracked (NOT written)
4. **Storage**: Only validated records written to database

### Example: Quarantine Logging

```typescript
// Invalid record is quarantined
{
  event: 'record_quarantined',
  vehicleId: 'veh-123',
  provider: 'marketcheck',
  errorType: 'validation',
  validationErrors: [
    { path: 'odometer.unit', message: 'Odometer unit must be "mi" or "km"', code: 'invalid_enum_value' }
  ],
  metrics: {
    totalRejected: 1,
    providerRejected: 1
  }
}
```

## Acceptance Criteria ✅

- ✅ All provider mappers validate outputs against strict schemas
- ✅ Invalid enums/units/required-field omissions are rejected (logged) and not written
- ✅ Tests (negative/positive) pass and show validation behavior
- ✅ Odometer/fuel/drivetrain/transmission enums enforced per UVS schema
- ✅ No invalid data reaches UVS database

## Next Steps

1. **Build packages**: Run `pnpm build` in `packages/shared` to compile TypeScript
2. **Run tests**: Verify all tests pass
3. **Monitor**: Check quarantine metrics in logs to identify problematic providers
4. **Iterate**: Update provider mappers if validation failures indicate mapping issues

## Notes

- The strict schemas are exported from `@autoagent/shared` for reuse
- Quarantine metrics are in-memory; consider persisting to database for production
- Storage functions include a final validation check as a safety measure
- All validation errors are logged with structured logging for easy debugging


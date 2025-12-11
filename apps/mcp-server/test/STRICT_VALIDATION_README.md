# Strict UVS Validation Tests

This directory contains tests for strict validation of provider-normalized UVS payloads.

## Overview

The strict validation system enforces:
- **Required blocks**: `baseIdentity`, `pricing`, `location`, `operational`
- **Enums**: `fuelType`, `drivetrain`, `transmission.type`, `odometer.unit` ("mi"/"km")
- **Valid ranges/types**: year (1900-2100), price (≥ 0), odometer value (≥ 0)
- **Invalid payloads are quarantined/logged and NOT written to UVS**

## Running Tests

### Run all tests
```bash
cd apps/mcp-server
pnpm test
```

### Run only strict validation tests
```bash
cd apps/mcp-server
pnpm test strict-uvs-validation
```

### Run tests in watch mode
```bash
cd apps/mcp-server
pnpm test:watch
```

### Run tests with coverage
```bash
cd apps/mcp-server
pnpm test --coverage
```

## Test Files

- `strict-uvs-validation.test.ts` - Comprehensive tests for strict UVS validation
  - Valid payloads (positive tests)
  - Required blocks validation (negative tests)
  - Enum validation (negative tests)
  - Range and type validation (negative tests)
  - Edge cases

## Test Structure

### Positive Tests
Tests that verify valid payloads pass validation:
- Minimal valid payload
- Fully populated payload
- All enum values (fuelType, drivetrain, transmission.type, odometer.unit)
- Edge cases (zero price, zero odometer)

### Negative Tests
Tests that verify invalid payloads are rejected:
- Missing required blocks
- Invalid enum values
- Invalid ranges (year, price, odometer)
- Invalid types/format (lastSyncedAt)

## Validation Flow

1. **Provider Normalization**: Raw data is normalized to UVS format by provider mappers
2. **Strict Validation**: Normalized data is validated against strict Zod schemas
3. **Quarantine**: Invalid records are quarantined and logged (NOT written to UVS)
4. **Storage**: Only validated records are written to the database

## Quarantine System

Invalid records are:
- Logged with structured logging (provider, vehicleId, errors)
- Tracked in metrics (counts by provider, error type, error code)
- NOT written to UVS database

See `src/ingestion/quarantine.ts` for implementation details.

## Schema Location

Strict schemas are defined in:
- `packages/shared/src/uvs-provider-schemas.ts`

These schemas are exported and used by:
- `apps/mcp-server/src/validation/validateUVS.ts`
- `apps/mcp-server/src/ingestion/orchestrator.ts`
- `apps/mcp-server/src/ingestion/storage.ts`

## Acceptance Criteria

All tests must pass to ensure:
- ✅ All provider mappers validate outputs against strict schemas
- ✅ Invalid enums/units/required-field omissions are rejected (logged) and not written
- ✅ Tests (negative/positive) pass and show validation behavior
- ✅ Odometer/fuel/drivetrain/transmission enums enforced per UVS schema


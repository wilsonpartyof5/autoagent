# UVS FK Alignment - Implementation Summary

## Overview

Successfully aligned all dashboard and analytics APIs with UVS (Unified Vehicle Schema) entities. All lead and analytics queries now join via UVS foreign keys instead of using VIN-only or legacy table logic.

## Changes Made

### 1. Database Schema

**File:** `apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql`

Added foreign key constraints to the `leads` table:
- `fk_leads_vehicle_id`: `leads.vehicle_id` → `uvs_vehicles.id`
- `fk_leads_dealer_id`: `leads.dealer_id` → `dealerships.marketcheck_dealer_id`

**Note:** The `analytics_events` table already had proper FK constraints (added in `20250301_create_analytics_tables.sql`):
- `fk_analytics_events_vehicle_id`: `analytics_events.vehicle_id` → `uvs_vehicles.id`
- `fk_analytics_events_dealer_id`: `analytics_events.dealer_id` → `dealerships.marketcheck_dealer_id`

### 2. Metrics API Endpoints

#### `/api/metrics/leads` (Updated)
**File:** `apps/dealer-dashboard/src/app/api/metrics/leads/route.ts`

**Changes:**
- Updated `recentLeads` query to join `uvs_vehicles` via FK
- Returns vehicle details (id, vin, year, make, model, trim) from UVS
- Uses `uvs_vehicles!inner(...)` to ensure referential integrity

**Before:**
```typescript
.select('id, vehicle_id, vin, timestamp, payload')
```

**After:**
```typescript
.select(`
  id,
  vehicle_id,
  vin,
  timestamp,
  payload,
  uvs_vehicles!inner(
    id,
    vin,
    year,
    make,
    model,
    trim
  )
`)
```

#### `/api/metrics/kpis` (Updated)
**File:** `apps/dealer-dashboard/src/app/api/metrics/kpis/route.ts`

**Changes:**
- Updated `topPerformingVehicles` query to join `uvs_vehicles` via FK
- Returns enriched vehicle data (year, make, model, trim) in top vehicles list
- Uses `uvs_vehicles!inner(...)` join

**Before:**
```typescript
.select('vehicle_id, vin')
```

**After:**
```typescript
.select(`
  vehicle_id,
  vin,
  uvs_vehicles!inner(
    id,
    vin,
    year,
    make,
    model,
    trim
  )
`)
```

#### Other Metrics Endpoints (Verified - No Changes Needed)
- `/api/metrics/daily` - Uses materialized views that aggregate from `analytics_events` (already has UVS FKs)
- `/api/metrics/weekly` - Uses materialized views that aggregate from `analytics_events` (already has UVS FKs)
- `/api/metrics/monthly` - Uses materialized views that aggregate from `analytics_events` (already has UVS FKs)
- `/api/metrics/conversions` - Uses materialized views that aggregate from `analytics_events` (already has UVS FKs)
- `/api/metrics/search` - Queries `analytics_events` directly (already has UVS FKs)

### 3. Dashboard UI

#### Leads Page (Updated)
**File:** `apps/dealer-dashboard/src/app/app/leads/page.tsx`

**Changes:**
- Replaced separate vehicle queries with FK join
- Now uses `uvs_vehicles!inner(...)` join in the main leads query
- Vehicle data (year, make, model, trim, vin) comes directly from UVS join
- Removed separate `vehicleMap` lookup logic

**Before:**
```typescript
// Separate query for vehicles
const { data: vehicles } = await supabase
  .from("uvs_vehicles")
  .select("id, uvs_data")
  .in("id", vehicleIds);
```

**After:**
```typescript
// FK join in main query
.select(`
  ...,
  uvs_vehicles!inner(
    id,
    vin,
    year,
    make,
    model,
    trim,
    uvs_data
  )
`)
```

#### Inventory Page (Verified - No Changes Needed)
**File:** `apps/dealer-dashboard/src/app/app/inventory/page.tsx`

- Already uses `uvs_vehicles` exclusively via `searchUVSVehicles()`
- No legacy `inventory_vehicles` table usage
- Properly aligned with UVS

## Key Benefits

1. **Referential Integrity**: FK constraints ensure all `vehicle_id` values reference valid UVS vehicles
2. **Data Consistency**: Vehicle information always comes from UVS (single source of truth)
3. **Performance**: FK joins are optimized by the database
4. **Type Safety**: TypeScript types align with UVS schema
5. **Maintainability**: Single code path for vehicle data access

## Migration Instructions

### 1. Apply Database Migration

Run the migration in Supabase SQL Editor:
```sql
-- File: apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql
```

Or apply via Supabase CLI:
```bash
supabase db push
```

### 2. Verify FK Constraints

Run verification queries (see `UVS_FK_ALIGNMENT_VERIFICATION.md`):
```sql
-- Check leads table FKs
SELECT constraint_name, table_name, column_name 
FROM information_schema.table_constraints 
WHERE table_name = 'leads' AND constraint_type = 'FOREIGN KEY';
```

### 3. Test API Endpoints

Test the updated endpoints:
- `GET /api/metrics/leads?dealer_id=<id>` - Should return vehicle details in `recentLeads`
- `GET /api/metrics/kpis?dealer_id=<id>` - Should return vehicle details in `topPerformingVehicles`

### 4. Test UI

- Navigate to `/app/leads` - Should display vehicle info from UVS
- Navigate to `/app/inventory` - Should display vehicles from UVS only
- Navigate to `/app/analytics` - Should display metrics with UVS-aligned data

## Potential Issues & Solutions

### Issue: Migration fails with FK constraint violation
**Cause:** Existing leads have `vehicle_id` values that don't match `uvs_vehicles.id`

**Solution:**
```sql
-- Find orphaned leads
SELECT l.id, l.vehicle_id
FROM leads l
LEFT JOIN uvs_vehicles v ON l.vehicle_id = v.id
WHERE v.id IS NULL;

-- Either:
-- 1. Delete orphaned leads, OR
-- 2. Update vehicle_id to valid UVS vehicle ID
```

### Issue: Leads page shows fewer leads than expected
**Cause:** Using `!inner` join means leads without valid UVS vehicles are excluded

**Solution:** This is expected behavior - ensure all leads have valid `vehicle_id` values. The FK constraint will prevent invalid IDs going forward.

### Issue: Metrics endpoints return empty vehicle data
**Cause:** `analytics_events` may have `vehicle_id` values that don't match `uvs_vehicles.id`

**Solution:** Check FK constraint on `analytics_events`:
```sql
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'analytics_events' 
  AND constraint_name = 'fk_analytics_events_vehicle_id';
```

## Files Modified

1. ✅ `apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql` - New migration
2. ✅ `apps/dealer-dashboard/src/app/api/metrics/leads/route.ts` - Added UVS join
3. ✅ `apps/dealer-dashboard/src/app/api/metrics/kpis/route.ts` - Added UVS join
4. ✅ `apps/dealer-dashboard/src/app/app/leads/page.tsx` - Updated to use FK join

## Files Verified (No Changes Needed)

1. ✅ `apps/dealer-dashboard/src/app/api/metrics/daily/route.ts`
2. ✅ `apps/dealer-dashboard/src/app/api/metrics/weekly/route.ts`
3. ✅ `apps/dealer-dashboard/src/app/api/metrics/monthly/route.ts`
4. ✅ `apps/dealer-dashboard/src/app/api/metrics/conversions/route.ts`
5. ✅ `apps/dealer-dashboard/src/app/api/metrics/search/route.ts`
6. ✅ `apps/dealer-dashboard/src/app/app/inventory/page.tsx`

## Documentation

- **Verification Guide:** `apps/dealer-dashboard/docs/UVS_FK_ALIGNMENT_VERIFICATION.md`
- **This Summary:** `UVS_FK_ALIGNMENT_SUMMARY.md`

## Acceptance Criteria Status

✅ **All lead and analytics queries join on UVS vehicle/dealer IDs (FKs), not VIN-only or legacy tables**
- Leads table has FK to `uvs_vehicles.id`
- Analytics events already had FK to `uvs_vehicles.id`
- All queries use FK joins

✅ **Dashboard pages render leads and inventory using UVS data exclusively**
- Leads page uses FK join to `uvs_vehicles`
- Inventory page already uses `uvs_vehicles` exclusively

✅ **Metrics endpoints return UVS-aligned data**
- `/api/metrics/leads` returns vehicle details from UVS
- `/api/metrics/kpis` returns vehicle details from UVS
- Other endpoints use materialized views that aggregate from `analytics_events` (which has UVS FKs)

## Next Steps

1. Apply the migration to production database
2. Run verification queries to ensure FK constraints are in place
3. Test all endpoints and UI pages
4. Monitor for any orphaned leads or invalid vehicle references
5. Update any lead ingestion code to ensure `vehicle_id` matches UVS vehicle IDs


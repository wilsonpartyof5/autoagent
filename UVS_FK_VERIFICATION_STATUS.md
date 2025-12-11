# UVS FK Alignment - Verification Status

## ✅ Code Verification Complete

All code changes have been verified and are correctly aligned with UVS foreign keys.

### Metrics Endpoints - Verified ✅

1. **`/api/metrics/leads`** ✅
   - **File:** `apps/dealer-dashboard/src/app/api/metrics/leads/route.ts`
   - **Status:** Uses `uvs_vehicles!inner(...)` join
   - **Line:** 78-85
   - **Returns:** Vehicle details (id, vin, year, make, model, trim) in `recentLeads`

2. **`/api/metrics/kpis`** ✅
   - **File:** `apps/dealer-dashboard/src/app/api/metrics/kpis/route.ts`
   - **Status:** Uses `uvs_vehicles!inner(...)` join
   - **Line:** 134-141
   - **Returns:** Vehicle details in `topPerformingVehicles`

3. **`/api/metrics/conversions`** ✅
   - **File:** `apps/dealer-dashboard/src/app/api/metrics/conversions/route.ts`
   - **Status:** Uses materialized view `search_to_lead_conversion` (aggregates from `analytics_events` which has UVS FKs)
   - **No changes needed**

4. **`/api/metrics/search`** ✅
   - **File:** `apps/dealer-dashboard/src/app/api/metrics/search/route.ts`
   - **Status:** Queries `analytics_events` directly (already has UVS FK constraints)
   - **No changes needed**

5. **`/api/metrics/daily`** ✅
   - **File:** `apps/dealer-dashboard/src/app/api/metrics/daily/route.ts`
   - **Status:** Uses materialized view `daily_leads_per_dealer` (aggregates from `analytics_events`)
   - **No changes needed**

6. **`/api/metrics/weekly`** ✅
   - **File:** `apps/dealer-dashboard/src/app/api/metrics/weekly/route.ts`
   - **Status:** Uses materialized view `weekly_metrics_per_dealer` (aggregates from `analytics_events`)
   - **No changes needed**

7. **`/api/metrics/monthly`** ✅
   - **File:** `apps/dealer-dashboard/src/app/api/metrics/monthly/route.ts`
   - **Status:** Uses materialized view `monthly_metrics_per_dealer` (aggregates from `analytics_events`)
   - **No changes needed**

### Dashboard UI - Verified ✅

1. **Leads Page** ✅
   - **File:** `apps/dealer-dashboard/src/app/app/leads/page.tsx`
   - **Status:** Uses `uvs_vehicles!inner(...)` join
   - **Line:** 56-64
   - **Behavior:** Vehicle data comes directly from UVS join, no separate queries

2. **Inventory Page** ✅
   - **File:** `apps/dealer-dashboard/src/app/app/inventory/page.tsx`
   - **Status:** Already uses `uvs_vehicles` exclusively via `searchUVSVehicles()`
   - **No changes needed**

## ⚠️ Database Migration - Action Required

### Migration File
**Location:** `apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql`

### Status
- ✅ Migration file created and ready
- ⚠️ **Needs to be applied to Supabase database**

### What the Migration Does
1. Adds FK constraint: `leads.vehicle_id` → `uvs_vehicles.id`
2. Adds FK constraint: `leads.dealer_id` → `dealerships.marketcheck_dealer_id`
3. Ensures `dealerships.marketcheck_dealer_id` is unique
4. Adds indexes for performance

### How to Apply

**Option 1: Supabase SQL Editor (Recommended)**
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql`
3. Paste and execute
4. Verify with SQL query (see verification guide)

**Option 2: Supabase CLI**
```bash
cd apps/dealer-dashboard
supabase db push
```

### Verification After Migration

Run this SQL in Supabase SQL Editor:
```sql
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'leads';
```

**Expected Results:**
- `fk_leads_vehicle_id` → `uvs_vehicles.id`
- `fk_leads_dealer_id` → `dealerships.marketcheck_dealer_id`

## Verification Script

A verification script is available:
```bash
node scripts/verify-uvs-fk-alignment.js
```

**What it checks:**
1. FK constraints exist on `leads` table
2. Code files use UVS joins
3. No orphaned leads (leads with invalid vehicle_ids)

**Requirements:**
- Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables

## Summary

### ✅ Completed
- [x] Metrics endpoints updated with UVS joins (`/api/metrics/leads`, `/api/metrics/kpis`)
- [x] Leads page updated with UVS join
- [x] Other metrics endpoints verified (use materialized views with UVS FKs)
- [x] Inventory page verified (already uses UVS)
- [x] Migration file created
- [x] Verification script created
- [x] Documentation created

### ⚠️ Pending
- [ ] **Apply migration to Supabase database** (see `apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md`)
- [ ] Verify FK constraints exist after migration
- [ ] Test endpoints after migration applied
- [ ] Check for orphaned leads and fix if any

## Next Steps

1. **Apply Migration:**
   - Follow instructions in `apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md`
   - Or run the migration SQL in Supabase SQL Editor

2. **Verify:**
   - Run verification SQL query
   - Or run `node scripts/verify-uvs-fk-alignment.js`

3. **Test:**
   - Test `/api/metrics/leads` endpoint
   - Test `/api/metrics/kpis` endpoint
   - Test `/app/leads` page
   - Verify vehicle data displays correctly

## Documentation

- **Migration Guide:** `apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md`
- **Verification Guide:** `apps/dealer-dashboard/docs/UVS_FK_ALIGNMENT_VERIFICATION.md`
- **Implementation Summary:** `UVS_FK_ALIGNMENT_SUMMARY.md`

## Notes

- The migration is **idempotent** - safe to run multiple times
- All code changes are **already applied** and verified
- The only remaining step is **applying the database migration**
- After migration, FK constraints will enforce referential integrity automatically


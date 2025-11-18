# Fix for "Imported 0 vehicles" Issue

## Date: 2025-02-21

## Root Causes Identified

### 1. ✅ Validation Error (FIXED)
**Issue**: All 10 listings were failing Zod validation due to invalid dealer website URL.

**Error**: 
```
ZodError: "path": ["dealer", "website"], "message": "Invalid url"
```

**Cause**: MarketCheck returns dealer website as `"myrockhillgmc.com"` (domain without protocol), but Zod schema requires a valid URL with `http://` or `https://`.

**Fix**: Updated `packages/shared/src/marketcheck.ts` to validate and normalize website URLs:
- If website is already a valid URL, use it
- If website is a domain (contains `.` but no protocol), prepend `https://`
- If website is invalid, set to `undefined`

**File**: `packages/shared/src/marketcheck.ts` (lines 113-135)

### 2. ❌ Database Schema Missing (REQUIRES ACTION)
**Issue**: Database tables and columns don't exist.

**Errors**:
- `Could not find the table 'public.inventory_vehicles' in the schema cache`
- `Could not find the 'marketcheck_dealer_id' column of 'profiles' in the schema cache`

**Cause**: Migrations haven't been run in Supabase.

**Fix**: Run migrations in Supabase SQL Editor.

## Solution Steps

### Step 1: Run Database Migrations

**Option A: Run Consolidated Migration** (Recommended)
1. Open Supabase SQL Editor
2. Copy and run: `scripts/run-all-migrations.sql`
3. Verify migrations succeeded

**Option B: Run Individual Migrations**
Run these migrations in order:
1. `apps/dealer-dashboard/supabase/migrations/20250219_add_profiles_table.sql`
2. `apps/dealer-dashboard/supabase/migrations/20250220_alter_profiles_marketcheck.sql`
3. `apps/dealer-dashboard/supabase/migrations/20250220_create_inventory_vehicles.sql`
4. `apps/dealer-dashboard/supabase/migrations/20250221_alter_inventory_vehicles_metafields.sql`

### Step 2: Refresh Supabase Schema Cache

If you see "schema cache" errors:
1. Go to Supabase Dashboard
2. Settings → API
3. Click "Refresh schema cache"
4. Wait for cache to refresh

### Step 3: Verify Schema

Run the schema check script:
```bash
node scripts/checkDatabaseSchema.js
```

Should show:
- ✅ profiles table exists with marketcheck columns
- ✅ inventory_vehicles table exists

### Step 4: Restart Dashboard Server

```bash
cd apps/dealer-dashboard
rm -rf .next
npm run dev
```

### Step 5: Try Sync Again

1. Hard refresh browser (Cmd+Shift+R)
2. Go to `http://localhost:3000/app/setup`
3. Click "Sync MarketCheck Inventory"
4. Should now import 10+ vehicles

## Expected Results After Fix

**Sync Logs**:
```
[syncMarketCheckInventory] Using source endpoint for dealer: { dealerId: '11042155', source: 'myrockhillgmc.com' }
[syncMarketCheckInventory] MarketCheck response: { numFound: 232, listingsLength: 10, ... }
[syncMarketCheckInventory] Normalization and mapping complete: { recordsCreated: 10, validationErrors: 0, ... }
[syncMarketCheckInventory] Supabase insert result: { insertSuccess: true, insertedCount: 10, ... }
```

**Dashboard**: Should show "Imported 10 vehicles"

**Database**: 10 vehicles in `inventory_vehicles` table with `dealer_id = '11042155'`

## Verification

After running migrations and syncing:

```sql
-- Check vehicles imported
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE dealer_id = '11042155') as rock_hill,
  COUNT(*) FILTER (WHERE data_source = 'marketcheck-api') as from_marketcheck
FROM inventory_vehicles
WHERE user_id = 'YOUR_USER_ID';

-- Sample vehicles
SELECT vin, year, make, model, condition, price, miles
FROM inventory_vehicles
WHERE user_id = 'YOUR_USER_ID' AND dealer_id = '11042155'
ORDER BY created_at DESC
LIMIT 10;
```

## Files Modified

1. `packages/shared/src/marketcheck.ts` - Fixed website URL validation
2. `scripts/run-all-migrations.sql` - Consolidated migration script (NEW)
3. `scripts/checkDatabaseSchema.js` - Schema verification script (NEW)

## Next Steps

1. ✅ Run migrations in Supabase
2. ✅ Refresh schema cache if needed
3. ✅ Verify schema with check script
4. ✅ Try sync again
5. ⏳ Document successful sync results


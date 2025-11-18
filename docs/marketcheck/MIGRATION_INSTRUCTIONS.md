# Database Migration Instructions - Rock Hill GMC Onboarding

## Overview

To complete Rock Hill GMC onboarding, the following database migrations must be run in Supabase. These migrations create the necessary tables and columns for inventory sync and profile management.

## Migration Files

All migrations are located in: `apps/dealer-dashboard/supabase/migrations/`

### Required Migrations (in order):

1. **20250219_add_profiles_table.sql** - Creates profiles table
2. **20250220_alter_profiles_marketcheck.sql** - Adds MarketCheck columns to profiles
3. **20250220_create_inventory_vehicles.sql** - Creates inventory_vehicles table
4. **20250221_alter_inventory_vehicles_metafields.sql** - Expands inventory_vehicles with full schema

## Quick Start: Consolidated Migration

**Recommended**: Use the consolidated migration script that includes all migrations:

**File**: `scripts/run-all-migrations.sql`

### Steps:

1. **Open Supabase SQL Editor**:
   - Go to Supabase Dashboard
   - Navigate to: SQL Editor
   - Click "New query"

2. **Copy Migration SQL**:
   ```bash
   # View the migration file
   cat scripts/run-all-migrations.sql
   ```
   - Copy the entire contents of `scripts/run-all-migrations.sql`

3. **Paste and Execute**:
   - Paste the SQL into the SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter
   - Wait for execution to complete

4. **Verify Migration**:
   ```bash
   node scripts/checkDatabaseSchema.js
   ```
   - Should show: ✅ profiles table exists with marketcheck columns
   - Should show: ✅ inventory_vehicles table exists

5. **Refresh Schema Cache** (if needed):
   - Go to Settings → API
   - Click "Refresh schema cache"
   - Wait for cache refresh

## Alternative: Run Individual Migrations

If you prefer to run migrations individually:

1. **20250219_add_profiles_table.sql**:
   ```sql
   -- Creates profiles table with basic columns
   -- Includes RLS policies and trigger for new users
   ```

2. **20250220_alter_profiles_marketcheck.sql**:
   ```sql
   -- Adds marketcheck_dealer_id and marketcheck_zip columns
   ```

3. **20250220_create_inventory_vehicles.sql**:
   ```sql
   -- Creates inventory_vehicles table with basic schema
   ```

4. **20250221_alter_inventory_vehicles_metafields.sql**:
   ```sql
   -- Expands inventory_vehicles with full AutoAgent schema
   -- Adds all required columns for vehicle data
   ```

## Verification

After running migrations, verify the schema:

```bash
node scripts/checkDatabaseSchema.js
```

**Expected Output**:
```
✅ profiles table exists with marketcheck columns
✅ inventory_vehicles table exists
```

## Troubleshooting

### Error: "Table does not exist"
- **Cause**: Migration didn't run or failed
- **Solution**: Check SQL Editor for errors, re-run migration

### Error: "Column does not exist"
- **Cause**: Migration for that column didn't run
- **Solution**: Run the specific migration that adds the column

### Error: "Schema cache" error
- **Cause**: Supabase schema cache is stale
- **Solution**: 
  1. Go to Settings → API
  2. Click "Refresh schema cache"
  3. Wait 30-60 seconds
  4. Try again

### Error: "Permission denied"
- **Cause**: Using anon key instead of service role key
- **Solution**: Run migrations in SQL Editor (uses service role automatically)

## Next Steps

After migrations are complete:

1. ✅ Verify schema: `node scripts/checkDatabaseSchema.js`
2. ✅ Update profile: Set dealer_id=11042155, ZIP=29730
3. ✅ Run sync: Click "Sync MarketCheck Inventory" in dashboard
4. ✅ Verify inventory: Check `/app/inventory` for vehicles

## Migration SQL Location

**Consolidated**: `scripts/run-all-migrations.sql`
**Individual**: `apps/dealer-dashboard/supabase/migrations/*.sql`

## Reference

- **Migration Guide**: This file
- **Schema Check**: `scripts/checkDatabaseSchema.js`
- **Troubleshooting**: `docs/marketcheck/SYNC_TROUBLESHOOTING.md`


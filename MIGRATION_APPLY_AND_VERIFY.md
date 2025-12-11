# Apply UVS FK Migration - Step by Step Guide

## Quick Start

### Step 1: Apply Migration in Supabase

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to: **SQL Editor**
   - Click **"New query"**

2. **Copy Migration SQL**
   ```bash
   # View the migration file
   cat apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql
   ```
   
   Or copy from the file: `apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql`

3. **Paste and Execute**
   - Paste the entire SQL into the SQL Editor
   - Click **"Run"** or press `Cmd/Ctrl + Enter`
   - Wait for execution to complete (should show "Success")

4. **Expected Result**
   - No errors should appear
   - Migration is idempotent (safe to run multiple times)

### Step 2: Verify FK Constraints

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
  AND tc.table_name = 'leads'
  AND tc.table_schema = 'public';
```

**Expected Output:**
```
constraint_name          | table_name | column_name | foreign_table_name | foreign_column_name
-------------------------|------------|-------------|-------------------|--------------------
fk_leads_vehicle_id     | leads      | vehicle_id  | uvs_vehicles       | id
fk_leads_dealer_id      | leads      | dealer_id   | dealerships        | marketcheck_dealer_id
```

### Step 3: Check for Orphaned Leads

Run this SQL to find leads with invalid vehicle_ids:

```sql
-- Find orphaned leads (leads without matching UVS vehicles)
SELECT 
  l.id, 
  l.vehicle_id, 
  l.dealer_id, 
  l.created_at
FROM leads l
LEFT JOIN uvs_vehicles v ON l.vehicle_id = v.id
WHERE v.id IS NULL
ORDER BY l.created_at DESC
LIMIT 20;
```

**Expected Result:**
- If migration was applied before any leads were created: **0 rows** (empty result)
- If leads exist with invalid vehicle_ids: **List of orphaned leads**

**If orphaned leads are found:**

**Option 1: Delete orphaned leads** (if they are invalid/test data)
```sql
DELETE FROM leads 
WHERE vehicle_id NOT IN (SELECT id FROM uvs_vehicles);
```

**Option 2: Update vehicle_id** (if you know the correct UVS vehicle ID)
```sql
UPDATE leads 
SET vehicle_id = '<valid-uvs-vehicle-id>' 
WHERE id = '<lead-id>';
```

### Step 4: Run Automated Verification Script

After applying the migration, run:

```bash
# Make sure you have environment variables set
export NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run verification
node scripts/verify-uvs-fk-post-migration.js
```

**What it checks:**
- ✅ FK join test (can leads join with uvs_vehicles?)
- ✅ Orphaned leads detection
- ✅ Valid vehicle_ids and dealer_ids

## Alternative: Interactive Script

For a guided experience:

```bash
node scripts/apply-and-verify-uvs-fk-migration.js
```

This script will:
1. Display the migration SQL for you to copy
2. Wait for you to apply it
3. Then verify the results

## Troubleshooting

### Error: "foreign key constraint violation"
**Cause:** Existing leads have `vehicle_id` values that don't match `uvs_vehicles.id`

**Solution:**
1. First, find orphaned leads (use SQL from Step 3)
2. Either delete them or update their `vehicle_id` to valid UVS vehicle IDs
3. Then re-run the migration

### Error: "constraint already exists"
**Cause:** Migration was already applied

**Solution:** This is fine! The migration is idempotent and will skip existing constraints.

### Error: "relation uvs_vehicles does not exist"
**Cause:** `uvs_vehicles` table doesn't exist yet

**Solution:** Run prerequisite migration first:
- `apps/dealer-dashboard/supabase/migrations/20250228_create_uvs_vehicles.sql`

### Error: "relation dealerships does not exist"
**Cause:** `dealerships` table doesn't exist yet

**Solution:** Run prerequisite migration first:
- `apps/dealer-dashboard/supabase/migrations/20250223_create_dealerships.sql`

## Verification Checklist

After applying migration:

- [ ] Migration executed without errors
- [ ] FK constraints exist (run verification SQL)
- [ ] No orphaned leads (or fixed if found)
- [ ] Verification script passes
- [ ] API endpoints work: `/api/metrics/leads` and `/api/metrics/kpis`
- [ ] UI works: `/app/leads` page displays vehicle data

## Migration SQL Reference

**File:** `apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql`

**What it does:**
1. Adds `fk_leads_vehicle_id`: `leads.vehicle_id` → `uvs_vehicles.id`
2. Adds `fk_leads_dealer_id`: `leads.dealer_id` → `dealerships.marketcheck_dealer_id`
3. Ensures `dealerships.marketcheck_dealer_id` is unique
4. Adds indexes for performance

**Idempotent:** Safe to run multiple times (uses `if not exists` checks)

## Next Steps

After migration is verified:

1. ✅ Test API endpoints return vehicle details from UVS
2. ✅ Test leads page displays vehicle information
3. ✅ Monitor for any new orphaned leads
4. ✅ Verify FK constraints prevent invalid data

## Support

- **Migration Guide:** `apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md`
- **Verification Guide:** `apps/dealer-dashboard/docs/UVS_FK_ALIGNMENT_VERIFICATION.md`
- **Status Report:** `UVS_FK_VERIFICATION_STATUS.md`


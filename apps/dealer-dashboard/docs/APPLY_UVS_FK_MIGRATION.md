# Apply UVS FK Migration

## Quick Start

### Step 1: Apply Migration

1. **Open Supabase SQL Editor**:
   - Go to Supabase Dashboard
   - Navigate to: SQL Editor
   - Click "New query"

2. **Copy and Run Migration**:
   ```bash
   # View the migration file
   cat apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql
   ```
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run" or press Cmd/Ctrl + Enter

3. **Verify Migration Applied**:
   ```sql
   -- Check FK constraints exist
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

   **Expected Output:**
   - `fk_leads_vehicle_id` → `uvs_vehicles.id`
   - `fk_leads_dealer_id` → `dealerships.marketcheck_dealer_id`

### Step 2: Verify Code Alignment

Run the verification script:
```bash
node scripts/verify-uvs-fk-alignment.js
```

Or manually check:
- ✅ `apps/dealer-dashboard/src/app/api/metrics/leads/route.ts` - Has `uvs_vehicles!inner(...)`
- ✅ `apps/dealer-dashboard/src/app/api/metrics/kpis/route.ts` - Has `uvs_vehicles!inner(...)`
- ✅ `apps/dealer-dashboard/src/app/app/leads/page.tsx` - Has `uvs_vehicles!inner(...)`

### Step 3: Test Endpoints

Test the updated endpoints:
```bash
# Test leads metrics (should return vehicle details)
curl -X GET "http://localhost:3000/api/metrics/leads?dealer_id=<dealer_id>" \
  -H "Cookie: <auth-cookie>"

# Test KPIs (should return vehicle details in topPerformingVehicles)
curl -X GET "http://localhost:3000/api/metrics/kpis?dealer_id=<dealer_id>" \
  -H "Cookie: <auth-cookie>"
```

## Migration Details

**File:** `apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql`

**What it does:**
1. Adds FK constraint `fk_leads_vehicle_id`: `leads.vehicle_id` → `uvs_vehicles.id`
2. Adds FK constraint `fk_leads_dealer_id`: `leads.dealer_id` → `dealerships.marketcheck_dealer_id`
3. Ensures `dealerships.marketcheck_dealer_id` is unique (required for FK)
4. Adds indexes for faster joins

**Idempotent:** The migration uses `if not exists` checks, so it's safe to run multiple times.

## Troubleshooting

### Error: "foreign key constraint violation"
**Cause:** Existing leads have `vehicle_id` values that don't match `uvs_vehicles.id`

**Solution:**
```sql
-- Find orphaned leads
SELECT l.id, l.vehicle_id
FROM leads l
LEFT JOIN uvs_vehicles v ON l.vehicle_id = v.id
WHERE v.id IS NULL;

-- Either delete them or update vehicle_id to valid UVS vehicle ID
-- Example: Update to a valid vehicle ID
-- UPDATE leads SET vehicle_id = '<valid-uvs-vehicle-id>' WHERE id = '<lead-id>';
```

### Error: "constraint already exists"
**Cause:** Migration was already applied

**Solution:** This is fine - the migration is idempotent and will skip existing constraints.

### Error: "column does not exist"
**Cause:** Required tables (`uvs_vehicles` or `dealerships`) don't exist

**Solution:** Run prerequisite migrations first:
- `20250228_create_uvs_vehicles.sql`
- `20250223_create_dealerships.sql`

## Verification Checklist

- [ ] Migration applied successfully
- [ ] FK constraints exist (run verification SQL)
- [ ] Code files use UVS joins (check with verification script)
- [ ] No orphaned leads (leads with invalid vehicle_ids)
- [ ] Endpoints return vehicle details from UVS
- [ ] Leads page displays vehicle info from UVS

## Next Steps

After migration is applied:
1. ✅ Verify FK constraints exist
2. ✅ Test API endpoints
3. ✅ Test UI pages
4. ✅ Monitor for any orphaned leads

For detailed verification steps, see: `apps/dealer-dashboard/docs/UVS_FK_ALIGNMENT_VERIFICATION.md`


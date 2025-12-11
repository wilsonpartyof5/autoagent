# UVS FK Migration - Ready to Apply

## ✅ Preparation Complete

All code changes are complete and verified. The migration is ready to apply.

### What's Ready

1. **Migration File** ✅
   - Location: `apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql`
   - Status: Ready to apply
   - Idempotent: Safe to run multiple times

2. **Code Changes** ✅
   - `/api/metrics/leads` - Uses UVS joins
   - `/api/metrics/kpis` - Uses UVS joins
   - `/app/leads` page - Uses UVS joins
   - All other endpoints verified

3. **Verification Scripts** ✅
   - `scripts/verify-uvs-fk-post-migration.js` - Post-migration verification
   - `scripts/apply-and-verify-uvs-fk-migration.js` - Interactive guide
   - `scripts/verify-uvs-fk-alignment.js` - Full alignment check

4. **Documentation** ✅
   - `MIGRATION_APPLY_AND_VERIFY.md` - Step-by-step guide
   - `apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md` - Migration guide
   - `UVS_FK_VERIFICATION_STATUS.md` - Status report

## 🚀 Next Steps: Apply Migration

### Quick Method (Recommended)

1. **Open Supabase SQL Editor**
   - Go to Supabase Dashboard → SQL Editor → New query

2. **Copy and Run Migration**
   ```bash
   # View the migration SQL
   cat apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql
   ```
   - Copy the entire SQL
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Constraints**
   ```sql
   SELECT constraint_name, table_name, column_name 
   FROM information_schema.table_constraints 
   WHERE table_name = 'leads' AND constraint_type = 'FOREIGN KEY';
   ```
   Should show:
   - `fk_leads_vehicle_id`
   - `fk_leads_dealer_id`

4. **Check for Orphaned Leads**
   ```sql
   SELECT l.id, l.vehicle_id 
   FROM leads l
   LEFT JOIN uvs_vehicles v ON l.vehicle_id = v.id
   WHERE v.id IS NULL;
   ```
   Should return 0 rows (or fix any found)

5. **Run Verification Script**
   ```bash
   node scripts/verify-uvs-fk-post-migration.js
   ```

### Interactive Method

Run the interactive script:
```bash
node scripts/apply-and-verify-uvs-fk-migration.js
```

This will guide you through:
1. Displaying the migration SQL
2. Waiting for you to apply it
3. Verifying the results

## 📋 Migration SQL

The migration adds:
- `fk_leads_vehicle_id`: `leads.vehicle_id` → `uvs_vehicles.id`
- `fk_leads_dealer_id`: `leads.dealer_id` → `dealerships.marketcheck_dealer_id`
- Indexes for performance

**Full SQL:**
```sql
-- Add UVS foreign key constraints to leads table
-- Ensures leads.vehicle_id references uvs_vehicles.id
-- and leads.dealer_id references dealerships.marketcheck_dealer_id

-- Add foreign key constraint for vehicle_id -> uvs_vehicles.id
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_leads_vehicle_id'
  ) then
    alter table leads
      add constraint fk_leads_vehicle_id
      foreign key (vehicle_id)
      references uvs_vehicles(id)
      on delete restrict
      deferrable initially deferred;
  end if;
end;
$$;

-- Add foreign key constraint for dealer_id -> dealerships.marketcheck_dealer_id
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_leads_dealer_id'
  ) then
    -- Ensure dealerships.marketcheck_dealer_id is unique (required for FK)
    if not exists (
      select 1 from pg_constraint
      where conname = 'dealerships_marketcheck_dealer_id_unique'
    ) then
      alter table dealerships
        add constraint dealerships_marketcheck_dealer_id_unique unique (marketcheck_dealer_id);
    end if;
    
    alter table leads
      add constraint fk_leads_dealer_id
      foreign key (dealer_id)
      references dealerships(marketcheck_dealer_id)
      on delete restrict
      deferrable initially deferred;
  end if;
end;
$$;

-- Add index for faster joins
create index if not exists idx_leads_vehicle_id_fk on leads(vehicle_id) where vehicle_id is not null;
create index if not exists idx_leads_dealer_id_fk on leads(dealer_id) where dealer_id is not null;
```

## ✅ Verification Checklist

After applying migration:

- [ ] Migration executed without errors
- [ ] FK constraints exist (run verification SQL)
- [ ] No orphaned leads (or fixed if found)
- [ ] Verification script passes
- [ ] Test `/api/metrics/leads` endpoint
- [ ] Test `/api/metrics/kpis` endpoint
- [ ] Test `/app/leads` page

## 📚 Documentation

- **Step-by-Step Guide:** `MIGRATION_APPLY_AND_VERIFY.md`
- **Migration Guide:** `apps/dealer-dashboard/docs/APPLY_UVS_FK_MIGRATION.md`
- **Verification Guide:** `apps/dealer-dashboard/docs/UVS_FK_ALIGNMENT_VERIFICATION.md`
- **Status Report:** `UVS_FK_VERIFICATION_STATUS.md`

## 🎯 Summary

**Status:** ✅ Ready to apply

**Action Required:** Apply migration in Supabase SQL Editor

**Time Estimate:** 2-5 minutes

**Risk Level:** Low (migration is idempotent and uses `if not exists` checks)

**Rollback:** If needed, constraints can be dropped:
```sql
ALTER TABLE leads DROP CONSTRAINT IF EXISTS fk_leads_vehicle_id;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS fk_leads_dealer_id;
```


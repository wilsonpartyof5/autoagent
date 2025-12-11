# UVS FK Alignment Verification

This document describes how to verify that all lead and analytics queries are properly aligned with UVS (Unified Vehicle Schema) entities using foreign key relationships.

## Overview

All lead and analytics queries must:
1. Join via UVS foreign keys (`uvs_vehicle_id` → `uvs_vehicles.id`, `dealer_id` → `dealerships.marketcheck_dealer_id`)
2. Use UVS data as the source of truth for vehicle information
3. Display UVS IDs in the UI where applicable

## Database Schema Verification

### 1. Verify FK Constraints on Leads Table

Run this SQL query in Supabase SQL Editor:

```sql
-- Check if FK constraints exist on leads table
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
- `fk_leads_vehicle_id` → `leads.vehicle_id` → `uvs_vehicles.id`
- `fk_leads_dealer_id` → `leads.dealer_id` → `dealerships.marketcheck_dealer_id`

### 2. Verify FK Constraints on Analytics Events Table

```sql
-- Check FK constraints on analytics_events
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
  AND tc.table_name = 'analytics_events';
```

**Expected Results:**
- `fk_analytics_events_vehicle_id` → `analytics_events.vehicle_id` → `uvs_vehicles.id`
- `fk_analytics_events_dealer_id` → `analytics_events.dealer_id` → `dealerships.marketcheck_dealer_id`

## API Endpoint Verification

### 3. Test Leads Metrics Endpoint

**Endpoint:** `GET /api/metrics/leads?dealer_id=<dealer_id>`

**Verification Steps:**
1. Make authenticated request to the endpoint
2. Check response includes `recentLeads` array
3. Verify each lead in `recentLeads` includes `uvs_vehicles` object with vehicle details
4. Verify `vehicle_id` matches a valid `uvs_vehicles.id`

**Example Test:**
```bash
curl -X GET "http://localhost:3000/api/metrics/leads?dealer_id=10015450" \
  -H "Cookie: <your-auth-cookie>"
```

**Expected Response Structure:**
```json
{
  "success": true,
  "data": {
    "totalLeads": 10,
    "leadsToday": 2,
    "leadsThisWeek": 5,
    "leadsThisMonth": 10,
    "recentLeads": [
      {
        "id": "lead_123",
        "vehicle_id": "mc-456",
        "vin": "1HGBH41JXMN109186",
        "timestamp": "2024-01-15T10:00:00Z",
        "uvs_vehicles": {
          "id": "mc-456",
          "vin": "1HGBH41JXMN109186",
          "year": 2023,
          "make": "Toyota",
          "model": "Camry",
          "trim": "LE"
        }
      }
    ]
  }
}
```

### 4. Test KPIs Endpoint

**Endpoint:** `GET /api/metrics/kpis?dealer_id=<dealer_id>`

**Verification Steps:**
1. Make authenticated request
2. Check `topPerformingVehicles` array
3. Verify each vehicle includes UVS vehicle details (year, make, model, trim)
4. Verify `vehicleId` matches a valid `uvs_vehicles.id`

**Expected Response Structure:**
```json
{
  "success": true,
  "data": {
    "sales": {
      "topPerformingVehicles": [
        {
          "vehicleId": "mc-456",
          "leadCount": 5,
          "vin": "1HGBH41JXMN109186",
          "year": 2023,
          "make": "Toyota",
          "model": "Camry",
          "trim": "LE"
        }
      ]
    }
  }
}
```

### 5. Test Leads Page Query

**Page:** `/app/leads`

**Verification Steps:**
1. Navigate to leads page while authenticated
2. Open browser DevTools → Network tab
3. Check the server-side query includes `uvs_vehicles!inner(...)` join
4. Verify leads display vehicle information (year, make, model) from UVS
5. Verify VIN displayed matches UVS vehicle VIN

**Database Query Verification:**
Run this query to verify leads are properly joined:
```sql
SELECT 
  l.id as lead_id,
  l.vehicle_id,
  l.dealer_id,
  v.id as uvs_vehicle_id,
  v.vin as uvs_vin,
  v.make,
  v.model,
  v.year
FROM leads l
INNER JOIN uvs_vehicles v ON l.vehicle_id = v.id
WHERE l.dealer_id = '<your-dealer-id>'
LIMIT 10;
```

**Expected:** All leads should have matching UVS vehicles.

### 6. Test Inventory Page

**Page:** `/app/inventory`

**Verification Steps:**
1. Navigate to inventory page
2. Verify all vehicles are displayed from `uvs_vehicles` table only
3. Check browser DevTools → Network tab for queries
4. Verify no queries to legacy `inventory_vehicles` table

**Database Query Verification:**
```sql
-- Verify inventory page only queries uvs_vehicles
-- (Check application logs or use Supabase query inspector)
```

## Manual Testing Checklist

### Leads Functionality
- [ ] Leads page loads and displays leads
- [ ] Each lead shows vehicle information (year, make, model, trim)
- [ ] VIN displayed matches UVS vehicle VIN
- [ ] Lead details page (if exists) shows UVS vehicle reference
- [ ] No errors in console about missing vehicle data

### Analytics/Metrics Functionality
- [ ] `/api/metrics/leads` returns vehicle details in `recentLeads`
- [ ] `/api/metrics/kpis` returns vehicle details in `topPerformingVehicles`
- [ ] `/api/metrics/daily` returns data (uses materialized views with UVS FKs)
- [ ] `/api/metrics/weekly` returns data (uses materialized views with UVS FKs)
- [ ] `/api/metrics/monthly` returns data (uses materialized views with UVS FKs)
- [ ] `/api/metrics/conversions` returns data (uses materialized views with UVS FKs)
- [ ] `/api/metrics/search` returns data (queries analytics_events with UVS FKs)

### Inventory Functionality
- [ ] Inventory page displays vehicles from `uvs_vehicles` only
- [ ] Vehicle cards show correct information
- [ ] No queries to legacy `inventory_vehicles` table

## SQL Verification Queries

### Check for Orphaned Leads (leads without UVS vehicles)
```sql
SELECT l.id, l.vehicle_id, l.dealer_id
FROM leads l
LEFT JOIN uvs_vehicles v ON l.vehicle_id = v.id
WHERE v.id IS NULL;
```

**Expected:** No results (all leads should have matching UVS vehicles)

### Check for Invalid Dealer IDs in Leads
```sql
SELECT l.id, l.dealer_id
FROM leads l
LEFT JOIN dealerships d ON l.dealer_id = d.marketcheck_dealer_id
WHERE l.dealer_id IS NOT NULL AND d.marketcheck_dealer_id IS NULL;
```

**Expected:** No results (all dealer_ids should reference valid dealerships)

### Verify Analytics Events Use UVS FKs
```sql
SELECT 
  COUNT(*) as total_events,
  COUNT(DISTINCT vehicle_id) as unique_vehicles,
  COUNT(CASE WHEN vehicle_id IS NOT NULL THEN 1 END) as events_with_vehicle
FROM analytics_events
WHERE event_name = 'lead.submit'
  AND dealer_id = '<your-dealer-id>';
```

**Expected:** All `vehicle_id` values should reference valid `uvs_vehicles.id`

## Code Review Checklist

### Files Modified
- [x] `apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql` - Added FK constraints
- [x] `apps/dealer-dashboard/src/app/api/metrics/leads/route.ts` - Added UVS join
- [x] `apps/dealer-dashboard/src/app/api/metrics/kpis/route.ts` - Added UVS join for top vehicles
- [x] `apps/dealer-dashboard/src/app/app/leads/page.tsx` - Updated to use FK join

### Files Verified (No Changes Needed)
- [x] `apps/dealer-dashboard/src/app/api/metrics/daily/route.ts` - Uses materialized views (already UVS-aligned)
- [x] `apps/dealer-dashboard/src/app/api/metrics/weekly/route.ts` - Uses materialized views (already UVS-aligned)
- [x] `apps/dealer-dashboard/src/app/api/metrics/monthly/route.ts` - Uses materialized views (already UVS-aligned)
- [x] `apps/dealer-dashboard/src/app/api/metrics/conversions/route.ts` - Uses materialized views (already UVS-aligned)
- [x] `apps/dealer-dashboard/src/app/api/metrics/search/route.ts` - Queries analytics_events (already has UVS FKs)
- [x] `apps/dealer-dashboard/src/app/app/inventory/page.tsx` - Already uses `uvs_vehicles` exclusively

## Running Tests

### Prerequisites
1. Supabase database with migrations applied
2. Test data: at least one dealership, one UVS vehicle, and one lead
3. Authenticated user session

### Quick Verification Script

```bash
# 1. Run migration (if not already applied)
# Apply: apps/dealer-dashboard/supabase/migrations/20250302_add_leads_uvs_fks.sql

# 2. Verify FK constraints exist
# Run SQL queries from "Database Schema Verification" section above

# 3. Test API endpoints
# Use curl or Postman to test endpoints listed in "API Endpoint Verification"

# 4. Manual UI testing
# Follow "Manual Testing Checklist" above
```

## Troubleshooting

### Issue: Leads page shows "No vehicle data"
**Solution:** Check that `leads.vehicle_id` matches `uvs_vehicles.id`. The FK constraint should prevent invalid IDs, but existing data might need cleanup.

### Issue: Metrics endpoints return empty vehicle data
**Solution:** Verify that `analytics_events.vehicle_id` references valid `uvs_vehicles.id`. Check FK constraint is applied.

### Issue: Migration fails with "foreign key constraint violation"
**Solution:** Clean up orphaned leads first:
```sql
-- Find orphaned leads
SELECT l.id, l.vehicle_id
FROM leads l
LEFT JOIN uvs_vehicles v ON l.vehicle_id = v.id
WHERE v.id IS NULL;

-- Either delete them or update vehicle_id to valid UVS vehicle ID
```

## Summary

All lead and analytics queries are now aligned with UVS entities:
- ✅ Leads table has FK constraints to `uvs_vehicles` and `dealerships`
- ✅ Analytics events already had FK constraints (no changes needed)
- ✅ Metrics endpoints join to `uvs_vehicles` for vehicle details
- ✅ Leads page uses FK join instead of separate queries
- ✅ Inventory page already uses `uvs_vehicles` exclusively
- ✅ Materialized views aggregate from `analytics_events` (which has UVS FKs)


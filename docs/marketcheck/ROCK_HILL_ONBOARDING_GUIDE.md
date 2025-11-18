# Rock Hill GMC Onboarding Guide

## Overview

This guide walks through the complete onboarding flow for My Rock Hill GMC (dealer ID: 11042155) to import real MarketCheck inventory into the AutoAgent dealer dashboard.

## Prerequisites

- ✅ Dashboard server running: `http://localhost:3000`
- ✅ MarketCheck API key configured in `apps/dealer-dashboard/.env.local`
- ✅ Supabase project configured and accessible
- ✅ Browser access to `http://localhost:3000`

## Step-by-Step Instructions

### Step 1: Sign In to Dashboard

1. Open browser and navigate to: `http://localhost:3000/auth`
2. Sign in with your account (or create a new test account)
3. Verify you're redirected to `/app/setup` or `/app/dashboard`

### Step 2: Update Profile Settings

**Option A: Via Dashboard UI (Recommended)**
1. Navigate to: `http://localhost:3000/app/settings`
2. Find the "Inventory Provider" section
3. Set **MarketCheck Dealer ID**: `11042155`
4. Set **ZIP Code**: `29730`
5. Click "Save" or "Update Settings"

**Option B: Via SQL (If UI doesn't work)**
1. Open Supabase SQL Editor
2. Run the following SQL (replace `YOUR_USER_ID` with your actual user ID):

```sql
-- Get your user_id first
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- Update profile (replace YOUR_USER_ID with actual ID)
UPDATE profiles
SET 
  marketcheck_dealer_id = '11042155',
  marketcheck_zip = '29730',
  dms_provider = 'marketcheck',
  updated_at = NOW()
WHERE id = 'YOUR_USER_ID';

-- Verify profile was updated
SELECT 
  marketcheck_dealer_id,
  marketcheck_zip,
  dms_provider,
  inventory_connected
FROM profiles
WHERE id = 'YOUR_USER_ID';
```

### Step 3: Run MarketCheck Sync

1. Navigate to: `http://localhost:3000/app/setup`
2. Verify the dealer ID shows `11042155` (should be auto-populated from profile)
3. Click the **"Sync MarketCheck Inventory"** button
4. Wait for the sync to complete (you'll see a success message)

### Step 4: Capture Sync Logs

**From Terminal (where server is running):**
1. Look for log entries starting with `[syncMarketCheckInventory]`
2. Capture the following log lines:
   - `Using source endpoint for dealer`
   - `Fetching from MarketCheck`
   - `Response status`
   - `MarketCheck response` (numFound, listingsLength)
   - `First listing sample`
   - `Normalization and mapping complete`
   - `Supabase insert result`
   - `Profile update successful`

**Example log output:**
```
[syncMarketCheckInventory] Using source endpoint for dealer: { dealerId: '11042155', source: 'myrockhillgmc.com' }
[syncMarketCheckInventory] Fetching from MarketCheck: { url: 'https://mc-api.marketcheck.com/v2/car/dealer/inventory/active?api_key=***REDACTED***&source=myrockhillgmc.com&page=1&pageSize=100', baseUrl: 'https://mc-api.marketcheck.com', dealerId: '11042155', zip: null, hasApiKey: true }
[syncMarketCheckInventory] Response status: { status: 200, statusText: 'OK', ok: true, ... }
[syncMarketCheckInventory] MarketCheck response: { dealerId: '11042155', zip: null, numFound: 232, listingsLength: 10, firstVin: '1GT4UXEY6TF159491', hasListings: true, url: '...' }
[syncMarketCheckInventory] First listing sample: { vin: '1GT4UXEY6TF159491', year: 2026, make: 'GMC', model: 'Sierra 2500HD', dealerId: '11042155', dealerName: 'Rock Hill Gmc', price: 97514, miles: 1 }
[syncMarketCheckInventory] Starting normalization and mapping: { totalListings: 10, ... }
[syncMarketCheckInventory] Normalization and mapping complete: { validRecords: X, skippedRecords: Y, ... }
[syncMarketCheckInventory] Prepared records for insert: { recordCount: X, ... }
[syncMarketCheckInventory] Supabase insert result: { insertSuccess: true, insertedCount: X, insertedVins: [...], ... }
[syncMarketCheckInventory] Profile update successful
```

### Step 5: Verify Inventory in Dashboard

1. Navigate to: `http://localhost:3000/app/inventory`
2. Verify you see a grid of GMC vehicles (Sierra, Yukon, etc.)
3. Check that vehicles show:
   - Year, Make, Model
   - VIN
   - Price
   - Mileage
   - Condition (should be "NEW" for Rock Hill GMC)
   - Dealer information

### Step 6: Verify Inventory in Database

**Option A: Via SQL**
Run the following SQL in Supabase SQL Editor (replace `YOUR_USER_ID` with your user ID):

```sql
-- Count vehicles imported from MarketCheck
SELECT 
  COUNT(*) as total_vehicles,
  COUNT(*) FILTER (WHERE data_source = 'marketcheck-api') as marketcheck_vehicles,
  COUNT(*) FILTER (WHERE dealer_id = '11042155') as rock_hill_vehicles,
  COUNT(DISTINCT make) as makes,
  COUNT(DISTINCT condition) as conditions,
  MIN(year) as min_year,
  MAX(year) as max_year
FROM inventory_vehicles
WHERE user_id = 'YOUR_USER_ID';

-- Sample vehicles
SELECT 
  vin,
  year,
  make,
  model,
  condition,
  price,
  miles,
  dealer_id,
  data_source,
  created_at
FROM inventory_vehicles
WHERE user_id = 'YOUR_USER_ID'
  AND dealer_id = '11042155'
  AND data_source = 'marketcheck-api'
ORDER BY created_at DESC
LIMIT 10;
```

**Option B: Via Script**
Run the verification script:
```bash
cd /Users/mac/AutoAgent
node scripts/verifyRockHillInventory.js
```

### Step 7: Document Results

1. Copy the sync logs from Step 4
2. Copy the SQL query results from Step 6
3. Update `docs/marketcheck/dealer-sync-ask-jorge-lopez.md` with:
   - Today's timestamp
   - Sync logs
   - SQL query results
   - Vehicle count and sample VINs

## Expected Results

- **Vehicles Imported**: 10+ vehicles (first page of 232 total)
- **Make**: GMC
- **Models**: Sierra, Yukon, etc.
- **Condition**: New
- **Dealer ID**: 11042155
- **Data Source**: `marketcheck-api`

## Troubleshooting

### Sync Returns 0 Vehicles

- Check server logs for errors
- Verify MarketCheck API key is configured
- Check that dealer_id=11042155 is set in profile
- Verify the source endpoint is being used (check logs for "Using source endpoint")

### Profile Update Fails

- Verify you're signed in
- Check that the profiles table exists
- Try updating via SQL directly

### Inventory Not Showing in Dashboard

- Verify sync completed successfully (check logs)
- Check that vehicles were inserted into `inventory_vehicles` table
- Verify `user_id` matches your authenticated user
- Check browser console for errors

## Next Steps

After successful onboarding:

1. ✅ Update `docs/marketcheck/STATUS.md` with successful import
2. ✅ Update `docs/CHATGPT_INTEGRATION_READY.md` with inventory status
3. ✅ Test ChatGPT integration with real inventory
4. ✅ Verify lead submission works with imported vehicles

## Files Reference

- **Sync Code**: `apps/dealer-dashboard/src/app/app/setup/actions.ts`
- **SQL Script**: `scripts/rock-hill-onboarding.sql`
- **Verification Script**: `scripts/verifyRockHillInventory.js`
- **Documentation**: `docs/marketcheck/dealer-sync-ask-jorge-lopez.md`

